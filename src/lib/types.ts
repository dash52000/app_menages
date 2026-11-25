import type { Jour } from './dates.ts';
import type { EtatProduit } from './produits.ts';

export interface Foyer {
  id: string;
  code: string;
  dernier_check: Jour | null;
}

export interface Profil {
  id: string;
  foyer_id: string;
  prenom: string;
  couleur: string;
}

export interface Piece {
  id: string;
  foyer_id: string;
  nom: string;
  icone: string;
  ordre: number;
  /** V1.6 : à l'arrêt depuis ce jour (poêle hors saison), sinon null. */
  en_pause_depuis?: Jour | null;
}

export interface Tache {
  id: string;
  foyer_id: string;
  piece_id: string;
  nom: string;
  icone: string;
  rythme_jours: number;
  duree_min: number;
  derniere_fois: Jour | null;
  derniere_par: string | null;
  reporte_le: Jour | null;
  reporte_jusqu_au: Jour | null;
  reserve_par: string | null;
  reserve_le: Jour | null;
  /** V1.5 (absents tant que la base n'est pas à jour). */
  fiche?: string | null;
  note?: string | null;
  /** Ids de produits du placard (V1.8 : plus de clés de catalogue mélangées aux ids). */
  produits?: string[] | null;
  /** V1.8 : clé stable de la fiche du catalogue ; renommer la tâche ne la casse plus. */
  fiche_id?: string | null;
  /** V1.9 : tâche proposée par « J'ai 1 min » (séparé de la durée). */
  quick?: boolean;
  cree_le?: string;
}

export interface Produit {
  id: string;
  foyer_id: string;
  cle: string | null;
  nom: string;
  icone: string;
  etat: EtatProduit;
  indispensable: boolean;
  courses_le: string | null;
  maj_par: string | null;
  maj_le: string;
}

export interface Membre {
  foyer_id: string;
  profil_id: string;
}

/** Ce qu'on peut faire d'une tâche, dans le check ou depuis une pièce. */
export type Action = 'fait' | 'fait_autre' | 'demain' | 'je_prends';
