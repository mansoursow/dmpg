/**
 * Stockage des photos de colis.
 *
 * Cloudinary si ses variables sont présentes, disque local sinon.
 * Le disque des hébergeurs (Railway, Render, Vercel…) est éphémère :
 * il est réinitialisé à chaque redéploiement. Le repli local ne sert
 * donc qu'au développement — en production, Cloudinary est requis.
 */
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');

const CLOUDINARY_ACTIF = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (!CLOUDINARY_ACTIF && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Cloudinary non configuré. Sans lui, les photos disparaissent à chaque ' +
    'redéploiement : renseignez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ' +
    'et CLOUDINARY_API_SECRET.'
  );
}

let stockage;

if (CLOUDINARY_ACTIF) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  stockage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'dmgp/colis',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
      transformation: [{ width: 1400, crop: 'limit', quality: 'auto' }],
    },
  });
  console.log('🖼️  Photos → Cloudinary');
} else {
  const dossier = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });

  stockage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, dossier),
    filename:    (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
  });
  console.log('🖼️  Photos → disque local (développement)');
}

const upload = multer({
  storage: stockage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error("Seules les images sont acceptées"));
  },
});

/** URL publique de la photo, quel que soit le stockage utilisé. */
function urlPhoto(file) {
  if (!file) return null;
  return CLOUDINARY_ACTIF ? file.path : `/uploads/${file.filename}`;
}

module.exports = { upload, urlPhoto, CLOUDINARY_ACTIF };
