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
