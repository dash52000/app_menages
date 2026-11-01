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
  produits?: string[] | null;
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
