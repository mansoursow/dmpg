const router = require('express').Router();
const db     = require('../db');
const { auth } = require('../middleware/auth');
const { upload, urlPhoto } = require('../storage');

/** Postgres renvoie NUMERIC en chaîne : le frontend attend un nombre. */
function normaliser(c) {
  if (!c) return c;
  return { ...c, poids: c.poids === null ? null : Number(c.poids) };
}

const CHAMPS = `
  c.*, u.prenom, u.nom, u.gp_id
`;

// GET /api/colis — les colis du client connecté
router.get('/', auth, async (req, res, next) => {
  try {
    const r = await db.rows(
      `SELECT ${CHAMPS} FROM colis c
       JOIN users u ON u.id = c.client_id
       WHERE c.client_id = $1
       ORDER BY c.id DESC`,
      [req.user.id]
    );
    res.json(r.map(normaliser));
  } catch (e) { next(e); }
});

// POST /api/colis — déclarer un colis
router.post('/', auth, upload.single('photo'), async (req, res, next) => {
  try {
    const { fournisseur, num_commande, tracking_num, description, poids } = req.body;
    if (!num_commande || !String(num_commande).trim())
      return res.status(400).json({ error: 'Le numéro de commande est obligatoire' });

    const ref = await db.prochaineRef(req.user.id);
    const c = await db.row(
      `INSERT INTO colis
         (ref, client_id, fournisseur, num_commande, tracking_num, description, poids)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        ref,
        req.user.id,
        fournisseur || null,
        String(num_commande).trim(),
        tracking_num || null,
        description || null,
        poids ? parseFloat(poids) : null,
      ]
    );
    res.json(normaliser({ ...c, photo: await enregistrerPhoto(c.id, req.file) }));
  } catch (e) { next(e); }
});

/** La photo est écrite après l'INSERT pour ne pas perdre le colis si l'upload échoue. */
async function enregistrerPhoto(colisId, file) {
  const url = urlPhoto(file);
  if (!url) return null;
  await db.query(`UPDATE colis SET photo = $1 WHERE id = $2`, [url, colisId]);
  return url;
}

/**
 * Un colis n'est modifiable par son proprietaire que tant qu'il n'est pas
 * arrive au depot. Une fois receptionne physiquement, le modifier ou le
 * supprimer casserait le lien entre le carton et sa fiche : le client
 * passe alors par le support.
 */
const MODIFIABLE = 'attente';

async function chargerSiModifiable(req, res) {
  const c = await db.row(`SELECT * FROM colis WHERE id = $1`, [parseInt(req.params.id, 10)]);
  if (!c || c.client_id !== req.user.id) {
    res.status(404).json({ error: 'Colis introuvable' });
    return null;
  }
  if (c.status !== MODIFIABLE) {
    res.status(409).json({
      error: 'Ce colis est déjà pris en charge : contactez-nous pour toute correction.',
    });
    return null;
  }
  return c;
}

// PATCH /api/colis/:id — corriger une declaration
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const c = await chargerSiModifiable(req, res);
    if (!c) return;

    const { fournisseur, num_commande, tracking_num, description, poids } = req.body;
    if (num_commande !== undefined && !String(num_commande).trim())
      return res.status(400).json({ error: 'Le numéro de commande est obligatoire' });

    // On ne touche qu'aux champs reellement transmis.
    const maj = {
      fournisseur:  fournisseur  !== undefined ? (fournisseur || null) : c.fournisseur,
      num_commande: num_commande !== undefined ? String(num_commande).trim() : c.num_commande,
      tracking_num: tracking_num !== undefined ? (tracking_num || null) : c.tracking_num,
      description:  description  !== undefined ? (description || null) : c.description,
      poids:        poids        !== undefined ? (poids ? parseFloat(poids) : null) : c.poids,
    };

    const maj_c = await db.row(
      `UPDATE colis SET fournisseur = $1, num_commande = $2, tracking_num = $3,
                        description = $4, poids = $5
       WHERE id = $6 RETURNING *`,
      [maj.fournisseur, maj.num_commande, maj.tracking_num, maj.description, maj.poids, c.id]
    );
    res.json(normaliser(maj_c));
  } catch (e) { next(e); }
});

// DELETE /api/colis/:id — retirer une declaration
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const c = await chargerSiModifiable(req, res);
    if (!c) return;
    await db.query(`DELETE FROM colis WHERE id = $1`, [c.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/colis/:ref — suivi public
router.get('/:ref', async (req, res, next) => {
  try {
    const c = await db.row(
      `SELECT ${CHAMPS} FROM colis c
       JOIN users u ON u.id = c.client_id
       WHERE upper(c.ref) = upper($1)`,
      [req.params.ref]
    );
    if (!c) return res.status(404).json({ error: 'Colis introuvable' });
    // Le suivi est public : on n'expose ni le numéro de commande ni le téléphone.
    const { num_commande, description, ...publiable } = normaliser(c);
    res.json(publiable);
  } catch (e) { next(e); }
});

module.exports = router;
