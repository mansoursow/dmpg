require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');
const { EST_PROD } = require('./env');

const app  = express();
const PROD = EST_PROD;

app.set('trust proxy', 1);          // Railway / Render placent un proxy devant

// ── CORS ──
// `origin: '*'` laissait n'importe quel site appeler l'API avec le token
// d'un visiteur connecté. En production, seule la liste blanche passe.
const ORIGINES = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!PROD) return cb(null, true);                 // dev : tout est permis
    if (!origin) return cb(null, true);               // requêtes serveur à serveur
    if (ORIGINES.length === 0) return cb(null, true); // service unique, même domaine
    cb(ORIGINES.includes(origin) ? null : new Error('Origine non autorisée : ' + origin),
       ORIGINES.includes(origin));
  },
}));

app.use(express.json({ limit: '1mb' }));

// Photos servies localement uniquement en développement ; en production
// elles vivent chez Cloudinary et sont servies par lui.
const dossierUploads = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(dossierUploads)) app.use('/uploads', express.static(dossierUploads));

// ── Routes ──
app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message });
  }
});

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/colis',         require('./routes/colis'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

// ── Frontend compilé ──
const frontDist = path.join(__dirname, '..', 'frontend', 'dist');
if (PROD && !fs.existsSync(frontDist)) {
  console.warn(
    '⚠️  frontend/dist absent : le build n\'a pas ete execute.\n' +
    "   Build Command attendu : npm install && npm run build"
  );
}
if (fs.existsSync(frontDist)) {
  app.use(express.static(frontDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(frontDist, 'index.html')));
}

// ── Erreurs ──
// Sans ce gestionnaire, Express renvoie une page HTML : le frontend reçoit
// alors une réponse qu'il ne sait pas lire et affiche un message générique.
app.use((err, _req, res, _next) => {
  console.error('[erreur]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'Photo trop lourde (5 Mo maximum)' });
  res.status(err.status || 500).json({
    error: PROD ? 'Erreur serveur' : err.message,
  });
});

const PORT = process.env.PORT || 3001;

db.demarrer()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 DMgp API → http://localhost:${PORT}`));
  })
  .catch(e => {
    // Démarrer sans base donnerait une app qui répond mais perd tout.
    console.error('❌ Démarrage impossible :', e.message);
    process.exit(1);
  });
