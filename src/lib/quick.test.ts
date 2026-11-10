import { describe, expect, it } from 'vitest';
import { ajouterJours } from './dates.ts';
import { CATALOGUE, quicksAAjouter } from './catalogue.ts';
import { cleFiche } from './fiches.ts';
import { estQuick, propositionSuivante, quicksDuJour } from './fraicheur.ts';
import type { Tache } from './types.ts';

const J = '2026-11-10';

function tache(p: Partial<Tache> & { id: string }): Tache {
  return {
    foyer_id: 'f', piece_id: 'p', nom: p.id, icone: 'broom', rythme_jours: 7, duree_min: 10,
    derniere_fois: J, derniere_par: null, reporte_le: null, reporte_jusqu_au: null, reserve_par: null, reserve_le: null,
    ...p,
  };
}

describe('Quick', () => {
  it('reconnaît une tâche d’une minute ou moins', () => {
    expect(estQuick({ duree_min: 1 })).toBe(true);
    expect(estQuick({ duree_min: 2 })).toBe(false);
  });

  it('propose la Quick la plus en retard, sans les faites ou reportées', () => {
    const t = [
      tache({ id: 'a', duree_min: 1, rythme_jours: 3, derniere_fois: ajouterJours(J, -2) }),
      tache({ id: 'b', duree_min: 1, rythme_jours: 3, derniere_fois: ajouterJours(J, -6) }),
      tache({ id: 'c', duree_min: 1, derniere_fois: J }),
      tache({ id: 'd', duree_min: 1, derniere_fois: ajouterJours(J, -20), reporte_le: J, reporte_jusqu_au: ajouterJours(J, 1) }),
      tache({ id: 'e', duree_min: 5, derniere_fois: ajouterJours(J, -30) }),
    ];
    expect(quicksDuJour(t, J).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('a une fiche pour chaque Quick du catalogue', () => {
    const quicks = CATALOGUE.flatMap((p) => p.taches.filter((t) => t.duree <= 1));
    expect(quicks.length).toBeGreaterThanOrEqual(8);
    expect(quicks.filter((t) => !cleFiche(t.nom))).toEqual([]);
  });

  it('range les Quick manquantes dans les pièces du foyer, sans doublon', () => {
    const pieces = [
      { id: 'sdb', nom: 'Salle de bain', icone: 'bathtub' },
      { id: 'lit', nom: 'Chambre parentale', icone: 'bed' },
    ];
    const existantes = [{ piece_id: 'sdb', nom: 'Essuyer le robinet' }];
    const res = quicksAAjouter(pieces, existantes);
    expect(res.some((r) => r.tache.nom === 'Essuyer le robinet')).toBe(false);
    expect(res.some((r) => r.pieceId === 'sdb' && r.tache.nom === 'Coup de chiffon sur le miroir')).toBe(true);
    expect(res.some((r) => r.pieceId === 'lit' && r.tache.nom === 'Faire le lit')).toBe(true);
  });
});

describe('Autre proposition', () => {
  it('prend d’abord une tâche due pas encore vue', () => {
    const t = [
      tache({ id: 'due1', derniere_fois: ajouterJours(J, -7) }),
      tache({ id: 'due2', derniere_fois: ajouterJours(J, -8) }),
      tache({ id: 'pasdue', derniere_fois: ajouterJours(J, -1) }),
    ];
    expect(propositionSuivante(t, J, new Set(['due2']))?.id).toBe('due1');
  });

  it('sinon la plus avancée des autres, jamais une faite ou reportée aujourd’hui', () => {
    const t = [
      tache({ id: 'faite', derniere_fois: J }),
      tache({ id: 'jeune', derniere_fois: ajouterJours(J, -1) }),
      tache({ id: 'mure', derniere_fois: ajouterJours(J, -5) }),
      tache({ id: 'reportee', derniere_fois: ajouterJours(J, -6), reporte_le: J, reporte_jusqu_au: ajouterJours(J, 1) }),
    ];
    expect(propositionSuivante(t, J, new Set())?.id).toBe('mure');
    expect(propositionSuivante(t, J, new Set(['mure', 'jeune']))).toBeNull();
  });
});
