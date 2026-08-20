const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const { SECRET } = require('../middleware/auth');

/** Ne jamais renvoyer le hash du mot de passe au client. */
function sansMotDePasse(u) {
  const { password, colis_seq, ...reste } = u;
  return reste;
}

function signer(u) {
  return jwt.sign({ id: u.id, gp_id: u.gp_id, role: u.role }, SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { prenom, nom, telephone, email, password } = req.body;
    if (!prenom || !nom || !telephone || !password)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    if (String(password).length < 6)
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });

    const gp_id = await db.prochainGpId();
    const u = await db.row(
      `INSERT INTO users (gp_id, prenom, nom, telephone, email, password, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'client')
       RETURNING *`,
      [gp_id, prenom, nom, telephone, email || null, bcrypt.hashSync(password, 10)]
    );

    res.json({ token: signer(u), user: sansMotDePasse(u) });
  } catch (e) {
    // 23505 = violation d'unicité. La contrainte fait foi, pas un SELECT
    // préalable : entre le SELECT et l'INSERT, un autre client peut passer.
    if (e.code === '23505') {
      return res.status(409).json({
        error: e.constraint === 'users_email_key'
          ? 'Email déjà utilisé'
          : 'Cet identifiant est déjà attribué',
      });
    }
    next(e);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const u = await db.row(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email]);
    if (!u || !bcrypt.compareSync(password, u.password))
      return res.status(401).json({ error: 'Identifiants incorrects' });

    res.json({ token: signer(u), user: sansMotDePasse(u) });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const entete = req.headers.authorization;
    if (!entete) return res.status(401).json({ error: 'Non authentifié' });

    let charge;
    try { charge = jwt.verify(entete.replace('Bearer ', ''), SECRET); }
    catch { return res.status(401).json({ error: 'Token invalide' }); }

    const u = await db.row(`SELECT * FROM users WHERE id = $1`, [charge.id]);
    if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(sansMotDePasse(u));
  } catch (e) { next(e); }
});

module.exports = router;
