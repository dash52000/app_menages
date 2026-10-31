import type { Jour } from './dates.ts';

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
}

export interface Membre {
  foyer_id: string;
  profil_id: string;
}

/** Ce qu'on peut faire d'une tâche, dans le check ou depuis une pièce. */
export type Action = 'fait' | 'fait_autre' | 'demain' | 'je_prends';
