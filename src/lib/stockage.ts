// Petit accès sûr au stockage du téléphone : si le stockage est indisponible
// (navigation privée…), l'appli continue, elle oublie juste au redémarrage.

export function lire<T>(cle: string, defaut: T): T {
  try {
    const v = localStorage.getItem(cle);
    return v ? (JSON.parse(v) as T) : defaut;
  } catch {
    return defaut;
  }
}

export function ecrire(cle: string, valeur: unknown): void {
  try {
    if (valeur === null || valeur === undefined) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible */
  }
}

export const CLES = {
  membre: 'coupdefrais.membre',
  cache: 'coupdefrais.cache',
  fileAttente: 'coupdefrais.file',
} as const;
