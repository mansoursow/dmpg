/**
 * Vérification de la couche Postgres, exécutée sur PGlite.
 *   node test-migration.js
 * Détruit et recrée .pgdata-test à chaque exécution.
 */
const fs   = require('fs');
const path = require('path');

const DOSSIER = path.join(__dirname, '.pgdata-test');
fs.rmSync(DOSSIER, { recursive: true, force: true });

let ok = 0, ko = 0;
const verifier = (nom, condition, detail = '') => {
  if (condition) { ok++; console.log(`  ✅ ${nom}`); }
  else { ko++; console.log(`  ❌ ${nom}${detail ? ' — ' + detail : ''}`); }
};

(async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const pg = await PGlite.create(DOSSIER);
  const q = (sql, p) => pg.query(sql, p);
  const un = async (sql, p) => (await q(sql, p)).rows[0];

  // ── Schéma ──
  console.log('\n▶ Schéma');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const instructions = schema.split(/;\s*$/m)
    .map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
  for (const i of instructions) await q(i);
  verifier(`${instructions.length} instructions appliquées`, true);

  // Rejouable sans erreur ?
  for (const i of instructions) await q(i);
  verifier('schéma idempotent (rejoué sans erreur)', true);

  const tables = (await q(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  )).rows.map(r => r.tablename);
  verifier('tables users/colis/notifications',
    ['colis','notifications','users'].every(t => tables.includes(t)), tables.join(','));

  // ── Séquence d'identifiants : le bug historique ──
  console.log('\n▶ Identifiants clients (ex-bug des doublons)');
  const { codeClient } = require('./db');
  const creer = async (prenom, email) => {
    const gp = codeClient(Number((await un(`SELECT nextval('gp_id_seq') AS n`)).n));
    return un(
      `INSERT INTO users (gp_id, prenom, nom, telephone, email, password)
       VALUES ($1,$2,'X','0','${email}','h') RETURNING *`, [gp, prenom]);
  };
  const a = await creer('A', 'a@x.fr');
  const b = await creer('B', 'b@x.fr');
  const c = await creer('C', 'c@x.fr');

  // Le champ « Nom » des marchands refuse les chiffres : un code qui en
  // contient est inutilisable, c'est tout l'objet du format lettré.
  verifier('codes en lettres seules, sans chiffre ni tiret',
    [a, b, c].every(u => /^[A-Z]+$/.test(u.gp_id)),
    `${a.gp_id},${b.gp_id},${c.gp_id}`);
  verifier('codes successifs tous différents',
    new Set([a.gp_id, b.gp_id, c.gp_id]).size === 3,
    `${a.gp_id},${b.gp_id},${c.gp_id}`);

  // L'encodage est bijectif : deux numéros de séquence ne peuvent pas
  // retomber sur le même code, y compris au-delà des 160 000 codes à
  // quatre lettres — le générateur passe alors à cinq.
  const vus = new Set();
  for (let n = 1001; n < 201001; n++) vus.add(codeClient(n));
  verifier('200 000 codes consécutifs, aucune collision', vus.size === 200000, String(vus.size));

  // Colonne de reprise : sans elle, un colis étiqueté « GP-1001 » avant la
  // conversion ne serait plus rattachable à personne.
  const colonnes = (await q(
    `SELECT column_name FROM information_schema.columns WHERE table_name='users'`
  )).rows.map(r => r.column_name);
  verifier('colonne ancien_gp_id présente', colonnes.includes('ancien_gp_id'), colonnes.join(','));

  // Le scénario qui cassait : supprimer un client puis en créer un autre.
  await q(`DELETE FROM users WHERE id = $1`, [b.id]);
  const d = await creer('D', 'd@x.fr');
  verifier('après suppression, aucun code réutilisé',
    d.gp_id === codeClient(1004) && d.gp_id !== c.gp_id,
    `obtenu ${d.gp_id}, l'ancien code aurait redonné ${c.gp_id}`);

  // ── Contrainte d'unicité ──
  console.log('\n▶ Contraintes');
  let violation = null;
  try {
    await q(`INSERT INTO users (gp_id, prenom, nom, telephone, email, password)
             VALUES ($1,'E','X','0','e@x.fr','h')`, [a.gp_id]);
  } catch (e) { violation = e.code || e.message; }
  verifier('GP-ID en double refusé par la base', violation !== null, String(violation));

  violation = null;
  try {
    await q(`INSERT INTO users (gp_id, prenom, nom, telephone, email, password)
             VALUES ('GPZZZZ','F','X','0','a@x.fr','h')`);
  } catch (e) { violation = e.code || e.message; }
  verifier('email en double refusé', violation !== null, String(violation));

  // ── Références de colis ──
  console.log('\n▶ Références de colis');
  const nouveauColis = async (clientId, cmd) => {
    const s = await un(`UPDATE users SET colis_seq = colis_seq + 1
                        WHERE id = $1 RETURNING colis_seq`, [clientId]);
    const ref = `DMG-${clientId}-${String(s.colis_seq).padStart(3,'0')}`;
    return un(`INSERT INTO colis (ref, client_id, fournisseur, num_commande, poids)
               VALUES ($1,$2,'Zara',$3,3.5) RETURNING *`, [ref, clientId, cmd]);
  };
  const c1 = await nouveauColis(a.id, 'CMD-1');
  const c2 = await nouveauColis(a.id, 'CMD-2');
  verifier('références incrémentales', c1.ref === `DMG-${a.id}-001` && c2.ref === `DMG-${a.id}-002`,
    `${c1.ref} / ${c2.ref}`);

  await q(`DELETE FROM colis WHERE id = $1`, [c2.id]);
  const c3 = await nouveauColis(a.id, 'CMD-3');
  verifier('après suppression, aucune référence réutilisée',
    c3.ref === `DMG-${a.id}-003`, `obtenu ${c3.ref}, l'ancien code aurait redonné …-002`);

  verifier('numéro de commande stocké', c1.num_commande === 'CMD-1', c1.num_commande);

  // ── Suppression en cascade ──
  console.log('\n▶ Cascade');
  await q(`INSERT INTO notifications (client_id, colis_id, ref, message)
           VALUES ($1,$2,$3,'test')`, [a.id, c1.id, c1.ref]);
  await q(`DELETE FROM users WHERE id = $1`, [a.id]);
  const restants = await un(`SELECT
      (SELECT count(*)::int FROM colis WHERE client_id=$1) AS colis,
      (SELECT count(*)::int FROM notifications WHERE client_id=$1) AS notifs`, [a.id]);
  verifier('colis et notifications supprimés avec le client',
    restants.colis === 0 && restants.notifs === 0, JSON.stringify(restants));

  // ── Requête de statistiques du dashboard ──
  console.log('\n▶ Statistiques du dashboard');
  const e = await creer('E', 'e2@x.fr');
  await nouveauColis(e.id, 'CMD-A');
  const cc = await nouveauColis(e.id, 'CMD-B');
  await q(`UPDATE colis SET status='livre', delivered_at=now() WHERE id=$1`, [cc.id]);

  const stats = await un(`
    SELECT
      (SELECT count(*) FROM users WHERE role='client') AS clients,
      (SELECT count(*) FROM colis)                     AS total,
      count(*) FILTER (WHERE status='attente')         AS attente,
      count(*) FILTER (WHERE status='livre')           AS livre
    FROM colis`);
  const s = Object.fromEntries(Object.entries(stats).map(([k,v]) => [k, Number(v)]));
  verifier('compteurs corrects', s.total === 2 && s.attente === 1 && s.livre === 1,
    JSON.stringify(s));
  verifier('nombre de clients inscrits', s.clients >= 1, String(s.clients));

  // ── Recherche admin ──
  console.log('\n▶ Recherche admin');
  const trouve = await q(
    `SELECT c.ref FROM colis c JOIN users u ON u.id=c.client_id
     WHERE coalesce(c.num_commande,'') ILIKE $1`, ['%cmd-a%']);
  verifier('recherche par numéro de commande, insensible à la casse',
    trouve.rows.length === 1, JSON.stringify(trouve.rows));

  await pg.close();
  fs.rmSync(DOSSIER, { recursive: true, force: true });

  console.log(`\n${ko === 0 ? '✅' : '❌'}  ${ok} réussis, ${ko} échoués\n`);
  process.exit(ko === 0 ? 0 : 1);
})().catch(e => { console.error('\n💥', e); process.exit(1); });
