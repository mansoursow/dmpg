/**
 * Couche base de données.
 *
 * Une seule interface — query() / tx() — pour deux pilotes :
 *   • DATABASE_URL défini  → `pg`, la vraie base managée (production)
 *   • sinon                → PGlite, Postgres compilé en WebAssembly,
 *                            stocké dans backend/.pgdata (développement)
 *
 * PGlite est du vrai Postgres : mêmes séquences, mêmes contraintes,
 * mêmes messages d'erreur. Ce qui marche en local marche en production,
 * et personne n'a besoin d'installer Postgres pour développer.
 */
const fs   = require('fs');
const path = require('path');
const { EST_PROD, PLATEFORME } = require('./env');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

let _query;   // (sql, params) -> { rows }
let _pret;    // promesse résolue quand le schéma est en place

function demarrer() {
  if (_pret) return _pret;

  _pret = (async () => {
    if (process.env.DATABASE_URL) {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // Les Postgres managés (Railway, Render, Supabase) imposent TLS
        // avec un certificat que Node ne connaît pas par défaut.
        ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
        max: 10,
      });
      _query = (sql, params) => pool.query(sql, params);
      console.log('🗄️  Postgres (DATABASE_URL)');
    } else if (EST_PROD) {
      // Sans cette garde, on tomberait sur PGlite — absent en production —
      // et l'erreur serait un « module introuvable » incomprehensible.
      throw new Error(
        `DATABASE_URL est absent alors que l'application tourne sur ${PLATEFORME}.\n` +
        `   Ajoutez un service PostgreSQL au projet : Railway injecte alors\n` +
        `   DATABASE_URL automatiquement. Sans base, aucune donnee ne survivrait\n` +
        `   a un redeploiement.`
      );
    } else {
      const { PGlite } = require('@electric-sql/pglite');
      const dossier = path.join(__dirname, '.pgdata');
      const pg = await PGlite.create(dossier);
      _query = (sql, params) => pg.query(sql, params);
      console.log(`🗄️  PGlite local → ${path.relative(process.cwd(), dossier)}`);
    }

    // Le schéma est idempotent : on le rejoue à chaque démarrage.
    for (const instruction of decouperSql(SCHEMA)) {
      await _query(instruction);
    }
    await semerAdmin();
  })();

  return _pret;
}

/** PGlite n'accepte qu'une instruction par appel : on découpe sur les `;`. */
function decouperSql(sql) {
  return sql
    .split(/;\s*$/m)
    .map(s => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

async function query(sql, params) {
  await demarrer();
  return _query(sql, params);
}

/** Raccourci : renvoie directement les lignes. */
async function rows(sql, params) {
  return (await query(sql, params)).rows;
}

/** Raccourci : renvoie la première ligne, ou null. */
async function row(sql, params) {
  return (await query(sql, params)).rows[0] || null;
}

/** Compte d'administration, créé au premier démarrage seulement. */
async function semerAdmin() {
  const existe = await _query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
  if (existe.rows.length) return;

  const bcrypt = require('bcryptjs');
  const motDePasse = process.env.ADMIN_PASSWORD;
  const email      = process.env.ADMIN_EMAIL || 'admin@dmgp.fr';

  // Un mot de passe par défaut écrit dans le dépôt serait une porte ouverte
  // sur toutes les installations. En développement on en tire un au hasard
  // et on l'affiche une seule fois ; en production la variable est exigée.
  let motDePasseFinal = motDePasse;
  if (!motDePasseFinal) {
    if (EST_PROD) {
      throw new Error('ADMIN_PASSWORD est obligatoire au premier démarrage en production.');
    }
    motDePasseFinal = require('crypto').randomBytes(9).toString('base64url');
    console.warn('\n⚠️  ADMIN_PASSWORD absent. Mot de passe généré pour cette base locale :');
    console.warn(`   ${email} / ${motDePasseFinal}`);
    console.warn('   Notez-le : il ne sera plus affiché.\n');
  }

  await _query(
    `INSERT INTO users (gp_id, prenom, nom, telephone, email, password, role)
     VALUES ('ADMIN-001', 'Admin', 'DMgp', $1, $2, $3, 'admin')`,
    [
      process.env.ADMIN_PHONE || '0758509931',
      email,
      bcrypt.hashSync(motDePasseFinal, 10),
    ]
  );
  console.log(`✅ Compte administrateur créé : ${email}`);
}

/**
 * Identifiant client, tiré d'une séquence.
 * Ne peut ni reculer ni être réattribué après suppression d'un client.
 */
async function prochainGpId() {
  const r = await row(`SELECT nextval('gp_id_seq') AS n`);
  return 'GP-' + r.n;
}

/**
 * Référence de colis, via un compteur propre au client incrémenté
 * de façon atomique. Deux déclarations simultanées obtiennent deux
 * références distinctes.
 */
async function prochaineRef(clientId) {
  const r = await row(
    `UPDATE users SET colis_seq = colis_seq + 1 WHERE id = $1 RETURNING colis_seq`,
    [clientId]
  );
  if (!r) throw new Error('Client introuvable : ' + clientId);
  return `DMG-${clientId}-${String(r.colis_seq).padStart(3, '0')}`;
}

module.exports = { demarrer, query, rows, row, prochainGpId, prochaineRef };
