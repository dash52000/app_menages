// Avertissement doux à la création d'une tâche : un nom proche existe déjà dans
// la même pièce (« Nettoyer le plan de travail » / « Nettoyer plan de travail »).
// Jamais bloquant : c'est une phrase, l'utilisateur garde la main.
import { normaliser } from './normalise.ts';

/** Petits mots qui ne distinguent pas deux tâches. */
const MOTS_VIDES = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'de', 'du', 'des', 'd', 'sur', 'et', 'a', 'au', 'aux', 'en', 'dans']);

function mots(nom: string): string[] {
  return [...new Set(normaliser(nom).split(' ').filter((m) => m && !MOTS_VIDES.has(m)))];
}

/** Part de mots communs, rapportée à l'ensemble des mots des deux noms (0 à 1). */
function similitude(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const communs = a.filter((m) => b.includes(m)).length;
  return communs / new Set([...a, ...b]).size;
}

/**
 * Le nom existant le plus proche de `nom`, ou null s'il n'y en a pas.
 * Proche = même nom une fois normalisé (accents, pluriels, majuscules),
 * ou les mots de l'un sont tous dans l'autre, ou au moins la moitié des mots en commun.
 */
export function nomProche(nom: string, existants: string[]): string | null {
  const a = mots(nom);
  if (!a.length) return null;
  let meilleur: { nom: string; score: number } | null = null;
  for (const e of existants) {
    const b = mots(e);
    if (!b.length) continue;
    const inclus = a.every((m) => b.includes(m)) || b.every((m) => a.includes(m));
    const score = normaliser(nom) === normaliser(e) ? 2 : inclus && Math.min(a.length, b.length) >= 2 ? 1.5 : similitude(a, b);
    if ((score >= 0.5 || score === 2) && (!meilleur || score > meilleur.score)) meilleur = { nom: e, score };
  }
  return meilleur?.nom ?? null;
}
