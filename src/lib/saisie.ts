// Saisie en langage naturel (IA1, §9) : ce que l'appli fait des cartes reçues de la fonction llm.
// Fonctions pures, testées dans saisie.test.ts. Rien ici n'écrit en base : c'est le code existant
// (agir, ajouterTache) qui écrit, après le « OK » de la personne.

import type { Jour } from './dates.ts';
import { estFaiteLe } from './fraicheur.ts';
import type { CarteIA, RaisonSansIA, SortieSaisie } from './ia.ts';
import type { Piece, Tache } from './types.ts';

export type LigneSaisie =
  | { cle: string; type: 'cocher'; tacheId: string; raison?: string; coche: boolean; dejaFaite: boolean }
  | { cle: string; type: 'nouvelle'; nom: string; pieceId: string; rythme: number; duree: number; raison?: string; coche: boolean };

/**
 * Deuxième barrière, côté téléphone : le serveur a déjà rejeté les ids inconnus, on écarte en plus
 * toute carte qui vise une tâche ou une pièce absente de l'état local (supprimée entre-temps).
 */
export function cartesLocales(
  sortie: SortieSaisie,
  taches: Pick<Tache, 'id'>[],
  pieces: Pick<Piece, 'id'>[],
): { cartes: CarteIA[]; ecartees: number } {
  const idsTaches = new Set(taches.map((t) => t.id));
  const idsPieces = new Set(pieces.map((p) => p.id));
  const vus = new Set<string>();
  const cartes: CarteIA[] = [];
  for (const c of sortie.cartes) {
    if (c.type === 'cocher') {
      if (!idsTaches.has(c.tache_id) || vus.has(c.tache_id)) continue;
      vus.add(c.tache_id);
      cartes.push(c);
    } else if (idsPieces.has(c.piece_id)) {
      cartes.push(c);
    }
  }
  return { cartes, ecartees: sortie.cartes.length - cartes.length };
}

/**
 * Lignes à cocher. Bons défauts (P4) : tout est coché, sauf une tâche déjà faite aujourd'hui
 * (la cocher une seconde fois doublerait l'historique) : elle est montrée, décochée.
 */
export function lignesDepuis(cartes: CarteIA[], taches: Tache[], jour: Jour): LigneSaisie[] {
  return cartes.map((c, i): LigneSaisie => {
    if (c.type === 'cocher') {
      const t = taches.find((x) => x.id === c.tache_id);
      const dejaFaite = Boolean(t && estFaiteLe(t, jour));
      return { cle: `c${i}`, type: 'cocher', tacheId: c.tache_id, raison: c.raison, coche: !dejaFaite, dejaFaite };
    }
    return { cle: `n${i}`, type: 'nouvelle', nom: c.nom, pieceId: c.piece_id, rythme: c.rythme_jours, duree: c.duree_min, raison: c.raison, coche: true };
  });
}

/** Phrase du bandeau après le OK : « 3 tâches cochées · 1 tâche ajoutée ». */
export function phraseValidation(cochees: number, ajoutees: number): string {
  const pluriel = (n: number) => (n > 1 ? 's' : '');
  const parts: string[] = [];
  if (cochees) parts.push(`${cochees} tâche${pluriel(cochees)} cochée${pluriel(cochees)}`);
  if (ajoutees) parts.push(`${ajoutees} tâche${pluriel(ajoutees)} ajoutée${pluriel(ajoutees)}`);
  return `${parts.join(' · ')} ✓`;
}

/** Quand l'IA ne répond pas : neutre, sans reproche, avec la sortie « à la main » (P1 et P2). */
export function messageSansIA(raison?: RaisonSansIA): string {
  switch (raison) {
    case 'quota_jour':
      return 'L’aide par phrase se repose jusqu’à demain : tu peux cocher à la main.';
    case 'quota_minute':
      return 'Un petit instant, puis tu peux réessayer.';
    default:
      return 'Ça ne répond pas pour l’instant : tu peux cocher à la main.';
  }
}

export const MESSAGE_RIEN_TROUVE = 'Je n’ai rien trouvé à cocher. Tu peux le dire autrement, ou cocher à la main.';
