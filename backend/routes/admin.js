const router = require('express').Router();
const db     = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { upload, urlPhoto } = require('../storage');

router.use(auth, adminOnly);

function normaliser(c) {
  if (!c) return c;
  return { ...c, poids: c.poids === null ? null : Number(c.poids) };
}

const STATUTS_VALIDES = ['attente', 'recu-paris', 'transit', 'dakar', 'livre'];
const HORODATAGE = { 'recu-paris': 'received_at', transit: 'shipped_at', livre: 'delivered_at' };
const MESSAGES = {
  'recu-paris': 'Votre colis est arrivé à notre dépôt de Paris ✅',
  transit:      'Votre colis est en route vers Dakar 🚢',
  dakar:        'Votre colis est arrivé à Dakar 🇸🇳',
  livre:        'Votre colis a été livré 🎉',
};

/** Le client est prévenu dans son espace de ce que l'équipe fait sur son colis. */
async function notifier(c, message) {
  await db.query(
    `INSERT INTO notifications (client_id, colis_id, ref, fournisseur, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [c.client_id, c.id, c.ref, c.fournisseur, message]
  );
}

/** Champ texte : vide signifie « effacer », absent signifie « ne pas toucher ». */
function texte(v) {
  if (v === undefined) return undefined;
  return String(v).trim() || null;
}

/** Un poids illisible vaut mieux vide qu'en erreur SQL. */
function nombre(v) {
  if (v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/admin/stats — les compteurs du tableau de bord
router.get('/stats', async (_req, res, next) => {
  try {
    const s = await db.row(`
      SELECT
        (SELECT count(*) FROM users WHERE role = 'client')      AS clients,
        (SELECT count(*) FROM colis)                            AS total,
        count(*) FILTER (WHERE status = 'attente')              AS attente,
        count(*) FILTER (WHERE status = 'recu-paris')           AS recu,
        count(*) FILTER (WHERE status = 'transit')              AS transit,
        count(*) FILTER (WHERE status = 'dakar')                AS dakar,
        count(*) FILTER (WHERE status = 'livre')                AS livre
      FROM colis
    `);
    // count() renvoie du bigint, donc une chaîne côté pilote.
    res.json(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])));
  } catch (e) { next(e); }
});

// GET /api/admin/colis?status=&q=
router.get('/colis', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const conditions = [];
    const params = [];

    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        u.prenom ILIKE $${params.length} OR u.nom ILIKE $${params.length} OR
        u.gp_id  ILIKE $${params.length} OR c.ref ILIKE $${params.length} OR
        coalesce(u.ancien_gp_id,'') ILIKE $${params.length} OR
        coalesce(c.tracking_num,'') ILIKE $${params.length} OR
        coalesce(c.num_commande,'') ILIKE $${params.length}
      )`);
    }

    const r = await db.rows(
      `SELECT c.*, u.prenom, u.nom, u.gp_id, u.telephone
       FROM colis c JOIN users u ON u.id = c.client_id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY c.id DESC`,
      params
    );
    res.json(r.map(normaliser));
  } catch (e) { next(e); }
});

/**
 * POST /api/admin/colis — déclarer un colis à la place d'un client.
 *
 * Tous les clients ne déclarent pas leurs commandes : l'équipe complète
 * le compte à leur place, sinon le carton arrive à Paris sans fiche.
 */
router.post('/colis', upload.single('photo'), async (req, res, next) => {
  try {
    const b = req.body;
    const clientId = parseInt(b.client_id, 10);
    if (!clientId) return res.status(400).json({ error: 'Client obligatoire' });
    if (!b.num_commande || !String(b.num_commande).trim())
      return res.status(400).json({ error: 'Le numéro de commande est obligatoire' });

    const statut = b.status || 'attente';
    if (!STATUTS_VALIDES.includes(statut))
      return res.status(400).json({ error: 'Statut invalide' });

    const client = await db.row(
      `SELECT id FROM users WHERE id = $1 AND role = 'client'`, [clientId]);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });

    const colonne = HORODATAGE[statut];
    const ref = await db.prochaineRef(clientId);
    const c = await db.row(
      `INSERT INTO colis
         (ref, client_id, fournisseur, num_commande, tracking_num,
          description, poids, photo, status${colonne ? `, ${colonne}` : ''})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${colonne ? ', now()' : ''})
       RETURNING *`,
      [
        ref, clientId,
        texte(b.fournisseur)  ?? null,
        String(b.num_commande).trim(),
        texte(b.tracking_num) ?? null,
        texte(b.description)  ?? null,
        nombre(b.poids)       ?? null,
        urlPhoto(req.file),
        statut,
      ]
    );

    await notifier(c, `DMgp a ajouté un colis à votre espace : ${c.ref} 📦`);
    if (MESSAGES[statut]) await notifier(c, MESSAGES[statut]);

    res.json({ ok: true, colis: normaliser(c) });
  } catch (e) { next(e); }
});

/**
 * PATCH /api/admin/colis/:id — corriger une fiche et y joindre une photo.
 *
 * Contrairement au client, l'équipe reste maîtresse du colis à tous les
 * stades : c'est elle qui a le carton sous les yeux.
 */
router.patch('/colis/:id', upload.single('photo'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const c = await db.row(`SELECT * FROM colis WHERE id = $1`, [id]);
    if (!c) return res.status(404).json({ error: 'Colis introuvable' });

    const b = req.body;
    if (b.num_commande !== undefined && !String(b.num_commande).trim())
      return res.status(400).json({ error: 'Le numéro de commande est obligatoire' });
    if (b.status !== undefined && !STATUTS_VALIDES.includes(b.status))
      return res.status(400).json({ error: 'Statut invalide' });

    const photo = urlPhoto(req.file);
    const maj = {
      fournisseur:  texte(b.fournisseur),
      num_commande: texte(b.num_commande),
      tracking_num: texte(b.tracking_num),
      description:  texte(b.description),
      poids:        nombre(b.poids),
      // Sans nouveau fichier la photo existante est conservée : un
      // formulaire renvoyé sans image ne doit pas l'effacer.
      photo:        photo || undefined,
      status:       b.status,
    };

    const sets = [], params = [];
    for (const [colonne, valeur] of Object.entries(maj)) {
      if (valeur === undefined) continue;
      params.push(valeur);
      sets.push(`${colonne} = $${params.length}`);
    }

    // Un changement de statut date l'étape franchie et prévient le client.
    const change = Boolean(maj.status) && maj.status !== c.status;
    const horodate = change ? HORODATAGE[maj.status] : null;
    if (horodate) sets.push(`${horodate} = now()`);

    if (!sets.length) return res.json({ ok: true, colis: normaliser(c) });

    params.push(id);
    const maj_c = await db.row(
      `UPDATE colis SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (change && MESSAGES[maj.status]) await notifier(maj_c, MESSAGES[maj.status]);
    else if (photo) await notifier(maj_c, `Photo ajoutée à votre colis ${maj_c.ref} 📷`);

    res.json({ ok: true, colis: normaliser(maj_c) });
  } catch (e) { next(e); }
});

// PATCH /api/admin/colis/:id/status
router.patch('/colis/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUTS_VALIDES.includes(status))
      return res.status(400).json({ error: 'Statut invalide' });

    const colonne = HORODATAGE[status];
    const c = await db.row(
      `UPDATE colis
       SET status = $1 ${colonne ? `, ${colonne} = now()` : ''}
       WHERE id = $2
       RETURNING *`,
      [status, parseInt(req.params.id, 10)]
    );
    // L'ancienne version répondait ok:true même pour un id inexistant.
    if (!c) return res.status(404).json({ error: 'Colis introuvable' });

    if (MESSAGES[status]) await notifier(c, MESSAGES[status]);
    res.json({ ok: true, colis: normaliser(c) });
  } catch (e) { next(e); }
});

// GET /api/admin/clients
router.get('/clients', async (_req, res, next) => {
  try {
    const r = await db.rows(`
      SELECT u.id, u.gp_id, u.ancien_gp_id, u.prenom, u.nom, u.telephone, u.email, u.created_at,
             count(c.id)::int AS nb_colis
      FROM users u
      LEFT JOIN colis c ON c.client_id = u.id
      WHERE u.role = 'client'
      GROUP BY u.id
      ORDER BY u.id DESC
    `);
    res.json(r);
  } catch (e) { next(e); }
});

// DELETE /api/admin/clients/:id
// Les colis et notifications partent avec, via ON DELETE CASCADE.
router.delete('/clients/:id', async (req, res, next) => {
  try {
    const r = await db.row(
      `DELETE FROM users WHERE id = $1 AND role = 'client' RETURNING id`,
      [parseInt(req.params.id, 10)]
    );
    if (!r) return res.status(404).json({ error: 'Client introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/admin/colis/:id
router.delete('/colis/:id', async (req, res, next) => {
  try {
    const r = await db.row(`DELETE FROM colis WHERE id = $1 RETURNING id`,
      [parseInt(req.params.id, 10)]);
    if (!r) return res.status(404).json({ error: 'Colis introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/admin/notifications — le flux complet, tous clients
router.get('/notifications', async (_req, res, next) => {
  try {
    res.json(await db.rows(
      `SELECT n.*, u.prenom, u.nom, u.gp_id
       FROM notifications n JOIN users u ON u.id = n.client_id
       ORDER BY n.id DESC LIMIT 100`
    ));
  } catch (e) { next(e); }
});

module.exports = router;
