/** Ligne directe DMgp, partagée par la landing, l'espace client et le suivi public. */
export const SUPPORT = {
  numero: '+221 77 586 08 29',
  tel:    '+221775860829',
  wa:     '221775860829',
};

export const waLien = (msg) =>
  `https://wa.me/${SUPPORT.wa}?text=${encodeURIComponent(msg)}`;

/**
 * URL publique de suivi d'un colis, encodée dans les QR codes.
 * Basée sur l'origine courante : fonctionne en local comme sur
 * www.dm-gp.com, sans domaine écrit en dur.
 */
export const urlSuivi = (ref) =>
  `${window.location.origin}/suivi/${encodeURIComponent(ref)}`;
