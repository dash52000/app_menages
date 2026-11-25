// Exports CSV / JSON pour analyser ses données ailleurs (R, tableur…).
// Chaque ligne garde son id stable : on peut recroiser les fichiers entre eux
// (tâches ↔ historique ↔ journal) et avec les autres applis.
import type { Piece, Produit, Profil, Tache } from './types.ts';

type Ligne = Record<string, unknown>;

function cellule(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV séparé par des virgules, en UTF-8 avec BOM (lisible directement dans Excel). */
export function versCsv(lignes: Ligne[], colonnes?: string[]): string {
  const cols = colonnes ?? [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const corps = lignes.map((l) => cols.map((c) => cellule(l[c])).join(','));
  return '﻿' + [cols.join(','), ...corps].join('\r\n') + '\r\n';
}

export interface Fichier {
  nom: string;
  contenu: string;
  type: string;
}

const prenomDe = (profils: Profil[], id: unknown) => profils.find((p) => p.id === id)?.prenom ?? '';

// ---------- Une fonction par fichier : colonnes fixes, ids en clair ----------

export function csvTaches(taches: Tache[], pieces: Piece[], profils: Profil[]): string {
  return versCsv(
    taches.map((t) => ({
      id: t.id,
      piece_id: t.piece_id,
      piece: pieces.find((p) => p.id === t.piece_id)?.nom ?? '',
      nom: t.nom,
      icone: t.icone,
      rythme_jours: t.rythme_jours,
      duree_min: t.duree_min,
      quick: t.quick ?? '',
      derniere_fois: t.derniere_fois,
      derniere_par_id: t.derniere_par,
      derniere_par: prenomDe(profils, t.derniere_par),
      reporte_jusqu_au: t.reporte_jusqu_au,
      fiche_id: t.fiche_id ?? t.fiche ?? '',
      produits_ids: (t.produits ?? []).join('|'),
      note: t.note,
      cree_le: t.cree_le,
    })),
    [
      'id', 'piece_id', 'piece', 'nom', 'icone', 'rythme_jours', 'duree_min', 'quick', 'derniere_fois',
      'derniere_par_id', 'derniere_par', 'reporte_jusqu_au', 'fiche_id', 'produits_ids', 'note', 'cree_le',
    ],
  );
}

export function csvPieces(pieces: Piece[]): string {
  return versCsv(
    pieces.map((p) => ({ id: p.id, nom: p.nom, icone: p.icone, ordre: p.ordre, en_pause_depuis: p.en_pause_depuis })),
    ['id', 'nom', 'icone', 'ordre', 'en_pause_depuis'],
  );
}

export function csvProduits(produits: Produit[], profils: Profil[]): string {
  return versCsv(
    produits.map((x) => ({
      id: x.id,
      cle: x.cle,
      nom: x.nom,
      icone: x.icone,
      etat: x.etat,
      indispensable: x.indispensable,
      courses_le: x.courses_le,
      maj_par_id: x.maj_par,
      maj_par: prenomDe(profils, x.maj_par),
      maj_le: x.maj_le,
    })),
    ['id', 'cle', 'nom', 'icone', 'etat', 'indispensable', 'courses_le', 'maj_par_id', 'maj_par', 'maj_le'],
  );
}

export function csvProfils(profils: Profil[]): string {
  return versCsv(
    profils.map((p) => ({ id: p.id, prenom: p.prenom, couleur: p.couleur })),
    ['id', 'prenom', 'couleur'],
  );
}

/** Les colonnes historiques d'abord (compatibles avec les anciens exports), les ids ensuite. */
export function csvHistorique(lignes: Ligne[], profils: Profil[]): string {
  return versCsv(
    lignes.map((l) => ({
      fait_le: l.fait_le,
      piece: l.piece_nom,
      tache: l.tache_nom,
      par: prenomDe(profils, l.profil_id),
      enregistre_le: l.cree_le,
      id: l.id,
      tache_id: l.tache_id,
      profil_id: l.profil_id,
    })),
    ['fait_le', 'piece', 'tache', 'par', 'enregistre_le', 'id', 'tache_id', 'profil_id'],
  );
}

export function csvJournal(lignes: Ligne[], profils: Profil[]): string {
  return versCsv(
    lignes.map((l) => ({
      cree_le: l.cree_le,
      profil: prenomDe(profils, l.profil_id),
      evenement: l.evenement,
      tache_id: l.tache_id,
      details: l.details,
      id: l.id,
      profil_id: l.profil_id,
    })),
    ['cree_le', 'profil', 'evenement', 'tache_id', 'details', 'id', 'profil_id'],
  );
}

// ---------- Livraison ----------

type PartageFichiers = Navigator & {
  canShare?: (d: { files: File[] }) => boolean;
  share?: (d: { files?: File[]; title?: string }) => Promise<void>;
};

function telecharger(fichier: File): void {
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = fichier.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Partage les fichiers (feuille de partage du téléphone) ou, à défaut, les télécharge un par un. */
export async function livrerFichiers(fichiers: Fichier[]): Promise<void> {
  const files = fichiers.map((f) => new File([f.contenu], f.nom, { type: f.type }));
  const nav = navigator as PartageFichiers;
  if (nav.canShare?.({ files }) && nav.share) {
    try {
      await nav.share({ files, title: files.length === 1 ? files[0].name : 'Coup de frais' });
      return;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
    }
  }
  for (const f of files) {
    telecharger(f);
    if (files.length > 1) await new Promise((r) => setTimeout(r, 300));
  }
}

export async function livrerFichier(nom: string, contenu: string, type: string): Promise<void> {
  await livrerFichiers([{ nom, contenu, type }]);
}
