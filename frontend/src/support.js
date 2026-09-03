/** Ligne directe DMgp, partagée par la landing, l'espace client et le suivi public. */
export const SUPPORT = {
  numero: '+221 77 586 08 29',
  tel:    '+221775860829',
  wa:     '221775860829',
};

export const waLien = (msg) =>
  `https://wa.me/${SUPPORT.wa}?text=${encodeURIComponent(msg)}`;

/**
 * Numéro au format attendu par WhatsApp : chiffres seuls, indicatif pays inclus.
 *
 * Les clients saisissent leur numéro comme ils le veulent (+221 77…, 00221…,
 * 77 xxx xx xx, 07 xx xx xx xx). Sans indicatif, wa.me ouvre une conversation
 * vide : on le complète d'après la forme du numéro. Neuf chiffres = Sénégal
 * (mobiles en 7x comme fixes en 33x), dix chiffres commençant par 0 = France.
 */
export function numeroWhatsApp(telephone) {
  const brut = String(telephone || '').trim();
  const chiffres = brut.replace(/\D/g, '');
  if (!chiffres) return '';
  if (brut.startsWith('+'))       return chiffres;
  if (chiffres.startsWith('00'))  return chiffres.slice(2);
  if (chiffres.length === 9)      return '221' + chiffres;
  if (chiffres.length === 10 && chiffres.startsWith('0')) return '33' + chiffres.slice(1);
  return chiffres;
}

/** Conversation WhatsApp avec un client, message déjà écrit. */
export const waClient = (telephone, message) =>
  `https://wa.me/${numeroWhatsApp(telephone)}?text=${encodeURIComponent(message)}`;

/**
 * URL publique de suivi d'un colis, encodée dans les QR codes.
 * Basée sur l'origine courante : fonctionne en local comme sur
 * www.dm-gp.com, sans domaine écrit en dur.
 */
export const urlSuivi = (ref) =>
  `${window.location.origin}/suivi/${encodeURIComponent(ref)}`;
