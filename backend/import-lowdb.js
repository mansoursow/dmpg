/**
 * Reprise des données de l'ancienne base lowdb (backend/data/db.json)
 * vers Postgres. À lancer une seule fois, après avoir renseigné
 * DATABASE_URL si l'on vise la base de production.
 *
 *   node import-lowdb.js            → vers la base locale PGlite
 *   DATABASE_URL=… node import-lowdb.js  → vers la base distante
 *
 * Sans effet si la cible contient déjà des clients : le script refuse
 * plutôt que de créer des doublons.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('./db');

(async () => {
  const source = path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(source)) {
    console.log('Aucune ancienne base à reprendre.');
    process.exit(0);
  }

  const ancien = JSON.parse(fs.readFileSync(source, 'utf8'));
  const clients = (ancien.users || []).filter(u => u.role === 'client');
  const colis   = ancien.colis || [];
  const notifs  = ancien.notifications || [];

  if (!clients.length && !colis.length) {
    console.log('Ancienne base vide (hors administrateur) : rien à reprendre.');
    process.exit(0);
  }

  await db.demarrer();
  const dejaLa = await db.row(`SELECT count(*)::int AS n FROM users WHERE role = 'client'`);
  if (dejaLa.n > 0) {
    console.error(`❌ La cible contient déjà ${dejaLa.n} client(s). Reprise annulée.`);
    process.exit(1);
  }

  // Les identifiants changent : on garde la correspondance ancien → nouveau.
  const idParAncien = new Map();
  let plusGrandGp = 1000;

  for (const u of clients) {
    const n = parseInt(String(u.gp_id).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n)) plusGrandGp = Math.max(plusGrandGp, n);

    // L'ancien format « GP-1001 » est inutilisable chez les marchands, qui
    // refusent les chiffres dans le champ « Nom » : on reprend le client
    // avec son code lettré, l'ancien restant consultable pour les colis
    // déjà étiquetés.
    const nb = colis.filter(c => c.client_id === u.id).length;
    const cree = await db.row(
      `INSERT INTO users (gp_id, ancien_gp_id, prenom, nom, telephone, email, password, role, colis_seq, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'client',$8,$9) RETURNING id`,
      [Number.isNaN(n) ? u.gp_id : db.codeClient(n), u.gp_id,
       u.prenom, u.nom, u.telephone, u.email || null, u.password,
       nb, u.created_at || new Date().toISOString()]
    );
    idParAncien.set(u.id, cree.id);
  }

  // La séquence doit repartir au-dessus du plus grand identifiant repris.
  await db.query(`SELECT setval('gp_id_seq', $1)`, [plusGrandGp]);

  const colisParAncien = new Map();
  for (const c of colis) {
    const clientId = idParAncien.get(c.client_id);
    if (!clientId) continue;
    const cree = await db.row(
      `INSERT INTO colis (ref, client_id, fournisseur, num_commande, tracking_num,
                          description, poids, status, photo,
                          declared_at, received_at, shipped_at, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [c.ref, clientId, c.fournisseur || null, c.num_commande || null,
       c.tracking_num || null, c.description || null, c.poids ?? null,
       c.status || 'attente', c.photo || null,
       c.declared_at || new Date().toISOString(),
       c.received_at || null, c.shipped_at || null, c.delivered_at || null]
    );
    colisParAncien.set(c.id, cree.id);
  }

  for (const n of notifs) {
    const clientId = idParAncien.get(n.client_id);
    if (!clientId) continue;
    await db.query(
      `INSERT INTO notifications (client_id, colis_id, ref, fournisseur, message, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [clientId, colisParAncien.get(n.colis_id) || null, n.ref || null,
       n.fournisseur || null, n.message, Boolean(n.read),
       n.created_at || new Date().toISOString()]
    );
  }

  console.log(`✅ Repris : ${clients.length} client(s), ${colis.length} colis, ${notifs.length} notification(s).`);
  console.log(`   Prochain identifiant attribué : ${db.codeClient(plusGrandGp + 1)}`);
  process.exit(0);
})().catch(e => { console.error('💥', e.message); process.exit(1); });
