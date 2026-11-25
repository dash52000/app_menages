import { describe, expect, it } from 'vitest';
import { versCsv } from './export.ts';

describe('export CSV', () => {
  it('échappe virgules, guillemets et objets', () => {
    const csv = versCsv([
      { evenement: 'bouton_tache', details: { action: 'fait', tache: 'Vitres, salon' } },
      { evenement: 'ouverture', details: null },
    ]);
    const lignes = csv.replace('﻿', '').trim().split('\r\n');
    expect(lignes[0]).toBe('evenement,details');
    expect(lignes[1]).toBe('bouton_tache,"{""action"":""fait"",""tache"":""Vitres, salon""}"');
    expect(lignes[2]).toBe('ouverture,');
  });
});

import { csvHistorique, csvJournal, csvPieces, csvProduits, csvProfils, csvTaches } from './export.ts';
import type { Piece, Produit, Profil, Tache } from './types.ts';

const profils: Profil[] = [
  { id: 'p-damien', foyer_id: 'f', prenom: 'Damien', couleur: '#3B82F6' },
  { id: 'p-laeti', foyer_id: 'f', prenom: 'Laeti', couleur: '#EC4899' },
];
const pieces: Piece[] = [{ id: 'pc-cuisine', foyer_id: 'f', nom: 'Cuisine', icone: 'cooking', ordre: 1 }];
const taches: Tache[] = [
  {
    id: 't-1', foyer_id: 'f', piece_id: 'pc-cuisine', nom: 'Laver le sol, à fond', icone: 'bucket', rythme_jours: 7, duree_min: 15,
    derniere_fois: '2026-11-22', derniere_par: 'p-laeti', reporte_le: null, reporte_jusqu_au: null, reserve_par: null, reserve_le: null,
    fiche_id: 'laver le sol', produits: ['id-a', 'id-b'],
  },
];
const produits: Produit[] = [
  { id: 'x-1', foyer_id: 'f', cle: 'lessive', nom: 'Lessive', icone: 'basket', etat: 'bas', indispensable: true, courses_le: null, maj_par: 'p-damien', maj_le: '2026-11-01T10:00:00Z' },
];

const lignes = (csv: string) => csv.replace('﻿', '').trim().split('\r\n');

describe('export CSV avec ids stables (F7)', () => {
  it('tâches : id, id de la pièce et de l’auteur, produits par id, fiche stable', () => {
    const [entete, ligne] = lignes(csvTaches(taches, pieces, profils));
    expect(entete.split(',').slice(0, 4)).toEqual(['id', 'piece_id', 'piece', 'nom']);
    expect(entete).toContain('derniere_par_id');
    expect(entete).toContain('fiche_id');
    expect(ligne).toContain('t-1,pc-cuisine,Cuisine,"Laver le sol, à fond"');
    expect(ligne).toContain('p-laeti,Laeti');
    expect(ligne).toContain('laver le sol');
    expect(ligne).toContain('id-a|id-b');
  });

  it('produits et pièces : id en première colonne', () => {
    const [h, l] = lignes(csvProduits(produits, profils));
    expect(h.startsWith('id,cle,nom')).toBe(true);
    expect(l.startsWith('x-1,lessive,Lessive')).toBe(true);
    expect(l).toContain('p-damien,Damien');
    expect(lignes(csvPieces(pieces))[1].startsWith('pc-cuisine,Cuisine')).toBe(true);
    expect(lignes(csvProfils(profils))[1]).toBe('p-damien,Damien,#3B82F6');
  });

  it('historique : colonnes historiques d’abord, ids ensuite', () => {
    const csv = csvHistorique(
      [{ id: 'h-1', tache_id: 't-1', profil_id: 'p-laeti', fait_le: '2026-11-22', piece_nom: 'Cuisine', tache_nom: 'Laver le sol', cree_le: '2026-11-22T18:00:00Z' }],
      profils,
    );
    const [h, l] = lignes(csv);
    expect(h).toBe('fait_le,piece,tache,par,enregistre_le,id,tache_id,profil_id');
    expect(l).toBe('2026-11-22,Cuisine,Laver le sol,Laeti,2026-11-22T18:00:00Z,h-1,t-1,p-laeti');
  });

  it('journal : l’id de l’événement et celui du profil suivent', () => {
    const csv = csvJournal([{ id: 7, cree_le: '2026-11-22T18:00:00Z', profil_id: 'p-damien', evenement: 'check_vu', tache_id: null, details: { test: true } }], profils);
    const [h, l] = lignes(csv);
    expect(h).toBe('cree_le,profil,evenement,tache_id,details,id,profil_id');
    expect(l).toBe('2026-11-22T18:00:00Z,Damien,check_vu,,"{""test"":true}",7,p-damien');
  });
});
