const jwt = require('jsonwebtoken');
const { EST_PROD } = require('../env');

// Un secret écrit en dur dans le dépôt permet à quiconque y a accès de
// forger un token administrateur. En production il devient obligatoire.
const SECRET = process.env.JWT_SECRET || (() => {
  if (EST_PROD) {
    throw new Error('JWT_SECRET est obligatoire en production.');
  }
  console.warn('⚠️  JWT_SECRET absent : secret de développement utilisé.');
  return 'dev_only_secret_ne_pas_utiliser_en_production';
})();

function auth(req, res, next) {
  const entete = req.headers.authorization;
  if (!entete) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(entete.replace('Bearer ', ''), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  next();
}

module.exports = { auth, adminOnly, SECRET };
