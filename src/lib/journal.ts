// Règles du journal d'utilisation du check (F1) : quel événement écrire, et comment
// marquer une session de test. Fonctions pures, testées dans journal.test.ts.

/**
 * Quitter l'appli au milieu d'un check :
 * - check_vu : le check a été regardé, aucune action ;
 * - check_quitte : au moins une action, mais pas toutes les cartes traitées.
 * (« abandonné » n'existe plus : ouvrir l'appli sans rien cocher n'est pas un échec.)
 */
export function evenementSortie(nbActions: number): 'check_vu' | 'check_quitte' {
  return nbActions === 0 ? 'check_vu' : 'check_quitte';
}

/** Fin du check : check_termine si toutes les cartes sont traitées, sinon (« C'est tout pour aujourd'hui ») check_quitte. */
export function evenementFin(raison: 'complet' | 'arret'): 'check_termine' | 'check_quitte' {
  return raison === 'complet' ? 'check_termine' : 'check_quitte';
}

/** Marque les détails d'un événement quand la session de test est allumée. */
export function detailsMarques<T extends Record<string, unknown>>(details: T, enTest: boolean): T | (T & { test: true }) {
  return enTest ? { ...details, test: true } : details;
}
