/**
 * Détection de l'environnement et contrôle de configuration.
 *
 * Ne pas se fier au seul NODE_ENV : s'il est absent sur l'hébergeur,
 * l'application démarrerait en mode développement sans le dire —
 * secret JWT de test, photos sur un disque éphémère, base locale
 * effacée à chaque redéploiement. Les plateformes posent toutes une
 * variable qui leur est propre : on s'en sert comme filet.
 */
const EST_PROD =
  process.env.NODE_ENV === 'production' ||
  Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RENDER ||
    process.env.FLY_APP_NAME ||
    process.env.DYNO
  );

/** Nom de la plateforme détectée, pour les messages d'erreur. */
const PLATEFORME =
  (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) ? 'Railway'
  : process.env.RENDER       ? 'Render'
  : process.env.FLY_APP_NAME ? 'Fly.io'
  : process.env.DYNO         ? 'Heroku'
  : 'production';

const REQUISES = [
  { nom: 'DATABASE_URL',
    aide: "Ajoutez un service PostgreSQL au projet — la variable est alors injectée toute seule." },
  { nom: 'JWT_SECRET',
    aide: 'Générer : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"' },
  { nom: 'ADMIN_PASSWORD',
    aide: "Mot de passe du compte administrateur, créé au premier démarrage." },
  { nom: 'CLOUDINARY_CLOUD_NAME', aide: 'Tableau de bord Cloudinary → "Cloud name".' },
  { nom: 'CLOUDINARY_API_KEY',    aide: 'Tableau de bord Cloudinary → "API Key".' },
  { nom: 'CLOUDINARY_API_SECRET', aide: 'Tableau de bord Cloudinary → "API Secret".' },
];

/**
 * Vérifie toute la configuration d'un coup et échoue avec la liste
 * complète. Sans cela, chaque variable manquante coûte un déploiement :
 * on la découvre, on la corrige, et la suivante apparaît.
 */
function verifierConfig() {
  if (!EST_PROD) return;

  const manquantes = REQUISES.filter(v => !String(process.env[v.nom] || '').trim());
  if (manquantes.length === 0) return;

  const lignes = [
    '',
    '╭─────────────────────────────────────────────────────────────╮',
    `│  Configuration incomplète sur ${PLATEFORME.padEnd(29)}│`,
    '╰─────────────────────────────────────────────────────────────╯',
    '',
    `${manquantes.length} variable(s) manquante(s) sur ${REQUISES.length} requises :`,
    '',
    ...manquantes.flatMap(v => [`  ✗ ${v.nom}`, `      ${v.aide}`, '']),
    'Ces variables se règlent dans l\'onglet Variables du service.',
    'Le démarrage est interrompu volontairement : sans elles,',
    'l\'application perdrait les données de vos clients.',
    '',
  ];
  const e = new Error(lignes.join('\n'));
  e.configIncomplete = true;
  throw e;
}

module.exports = { EST_PROD, PLATEFORME, verifierConfig };
