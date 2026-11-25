// Le placard au service des tâches : quelles tâches utilisent un produit, depuis
// quand son état a été vérifié, ce qu'il y a à racheter. Fonctions pures, testées.
import { ecart, ilYa, versJour, type Jour } from './dates.ts';
import { besoinsDe, trouverProduit, type Besoin, type ProduitPlacard } from './fiches.ts';
import type { Produit, Tache } from './types.ts';

/** Les tâches qui utilisent un produit (par son id, ou par sa clé de catalogue dans une fiche). */
export function tachesPourProduit(produit: Pick<Produit, 'id' | 'cle'>, taches: Tache[]): Tache[] {
  return taches.filter((t) =>
    besoinsDe(t)
      .flat()
      .some((r) => r === produit.id || (produit.cle !== null && r === produit.cle)),
  );
}

/** Le produit du placard qu'on a sous la main pour un besoin (sinon l'idéal s'il y est). */
export function produitDuBesoin<T extends ProduitPlacard>(b: Besoin, placard: T[]): T | undefined {
  return (b.choisi ? trouverProduit(b.choisi, placard) : undefined) ?? trouverProduit(b.ideal, placard);
}

/** « Vérifié aujourd'hui », « Vérifié il y a 3 j » : depuis quand l'état du produit est confirmé. */
export function verifieDepuis(majLe: string, jour: Jour): string {
  const quand = new Date(majLe);
  if (Number.isNaN(quand.getTime())) return 'Jamais vérifié';
  const j = versJour(quand);
  return ecart(j, jour) <= 0 ? 'Vérifié aujourd’hui' : `Vérifié ${ilYa(j, jour)}`;
}

/** Les produits bas ou vides : la liste de courses se déduit d'eux, sans relance. */
export function aRacheter(produits: Produit[]): Produit[] {
  return produits.filter((x) => x.etat !== 'ok');
}

/** Ceux de la liste qui ne sont pas encore sur la liste de courses de Panier. */
export function pasEncoreAuxCourses(produits: Produit[]): Produit[] {
  return aRacheter(produits).filter((x) => !x.courses_le);
}
