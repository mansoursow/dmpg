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
    await convertirAnciensCodes();
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

/**
 * Compte d'administration.
 *
 * ADMIN_PASSWORD fait foi : si le compte existe deja mais que son mot de
 * passe ne correspond plus a la variable, il est realigne au demarrage.
 * Sans cela, changer la variable n'avait aucun effet — le compte gardait
 * indefiniment son mot de passe d'origine.
 */
async function semerAdmin() {
  const bcrypt = require('bcryptjs');
  const existant = await _query(
    `SELECT id, password FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
  );

  if (existant.rows.length) {
    const voulu = process.env.ADMIN_PASSWORD;
    if (voulu && !bcrypt.compareSync(voulu, existant.rows[0].password)) {
      await _query(`UPDATE users SET password = $1 WHERE id = $2`,
        [bcrypt.hashSync(voulu, 10), existant.rows[0].id]);
      console.log('🔑 Mot de passe administrateur realigne sur ADMIN_PASSWORD');
    }
    return;
  }

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

/* ──────────────────────────────────────────────────────────────
 *  Identifiant client
 *
 *  Les marchands (Shein, Zara, Amazon…) refusent les chiffres dans le
 *  champ « Nom » : « Abdou Mbaye [GP-1001] » y est impossible à saisir.
 *  Le code est donc fait de lettres seules, sans tiret ni crochet, pour
 *  s'écrire à la suite du nom : « Abdou Mbaye GPGHWF ».
 * ────────────────────────────────────────────────────────────── */

// Les 20 consonnes uniquement : sans voyelle, aucun mot — donc aucun juron
// ni sigle malheureux — ne peut sortir du générateur. Exclure I et O écarte
// au passage la confusion avec les chiffres 1 et 0.
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const PREFIXE  = 'GP';
const LONGUEUR = 4;                       // 20⁴ = 160 000 codes avant d'ajouter une lettre

// Le numéro de séquence est multiplié avant d'être encodé : deux inscriptions
// successives donnent des codes visiblement différents, donc une faute de
// frappe ne tombe pas sur le voisin d'inscription. Le facteur est impair et
// non multiple de 5, donc premier avec 20^n : la transformation reste
// bijective et deux clients ne peuvent pas obtenir le même code.
const PAS = 51343;

function codeClient(n) {
  let largeur  = LONGUEUR;
  let capacite = ALPHABET.length ** largeur;
  // Au-delà de la capacité on allonge d'une lettre plutôt que de reboucler :
  // un code plus long ne peut collisionner avec aucun code plus court.
  while (n >= capacite) { largeur++; capacite *= ALPHABET.length; }

  let reste = (n * PAS) % capacite;
  let code  = '';
  for (let i = 0; i < largeur; i++) {
    code  = ALPHABET[reste % ALPHABET.length] + code;
    reste = Math.floor(reste / ALPHABET.length);
  }
  return PREFIXE + code;
}

/**
 * Identifiant client, tiré d'une séquence puis encodé en lettres.
 * La séquence ne recule pas : un code ne peut être réattribué après
 * la suppression d'un client.
 */
async function prochainGpId() {
  const r = await row(`SELECT nextval('gp_id_seq') AS n`);
  return codeClient(Number(r.n));
}

/**
 * Conversion des identifiants historiques « GP-1001 » en codes lettrés.
 * Rejouée à chaque démarrage sans effet : après conversion, plus aucune
 * ligne ne correspond au motif. L'ancien code est conservé dans
 * `ancien_gp_id` pour les colis déjà étiquetés à l'ancien format.
 */
async function convertirAnciensCodes() {
  const anciens = (await _query(
    `SELECT id, gp_id FROM users WHERE role = 'client' AND gp_id ~ '^GP-[0-9]+$'`
  )).rows;

  for (const u of anciens) {
    await _query(
      `UPDATE users SET gp_id = $1, ancien_gp_id = $2 WHERE id = $3`,
      [codeClient(parseInt(u.gp_id.slice(3), 10)), u.gp_id, u.id]
    );
  }
  if (anciens.length) {
    console.log(`🔤 ${anciens.length} identifiant(s) client converti(s) en code lettré`);
  }
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

module.exports = { demarrer, query, rows, row, prochainGpId, prochaineRef, codeClient };
