/**
 * Détection de l'environnement.
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
  : process.env.RENDER      ? 'Render'
  : process.env.FLY_APP_NAME ? 'Fly.io'
  : process.env.DYNO         ? 'Heroku'
  : 'production';

module.exports = { EST_PROD, PLATEFORME };
