/**
 * Normalise un nom pour comparer « Sacs poubelle » et « sac poubelle ».
 * Copie exacte de la fonction de Panier (dépôt course_magasins) : les deux
 * applis doivent produire la même clé pour retrouver un produit dans la liste
 * de courses.
 */
export function normaliser(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => (mot.length > 3 && /[sx]$/.test(mot) && !/ss$/.test(mot) ? mot.slice(0, -1) : mot))
    .join(' ');
}
