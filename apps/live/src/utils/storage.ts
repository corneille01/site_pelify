// Le navigateur ne garde que le choix des cookies. Comptes, réservations et messages vivent sur le serveur.
const KEY = 'ocd_live_cookies_v2';

export function getCookieConsent(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === 'true';
  } catch {
    return null;
  }
}

export function setCookieConsent(accepted: boolean): void {
  try {
    localStorage.setItem(KEY, String(accepted));
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}
