import { expect, it } from 'vitest';
import { CATALOGUE } from './catalogue.ts';
import { derniereFoisInitiale, estDue, estFaiteLe, jauge } from './fraicheur.ts';

it('démarre une maison configurée par défaut autour de 70 %, avec un premier check non vide', () => {
  const J = '2026-11-01';
  const taches = CATALOGUE.filter((p) => p.coche)
    .flatMap((p) => p.taches.filter((t) => t.coche))
    .map((t, i) => ({
      id: String(i), foyer_id: 'f', piece_id: 'p', nom: t.nom, icone: t.icone, rythme_jours: t.rythme, duree_min: t.duree,
      derniere_fois: derniereFoisInitiale(i, t.rythme, J), derniere_par: null,
      reporte_le: null, reporte_jusqu_au: null, reserve_par: null, reserve_le: null,
    }));
  const j = jauge(taches, J)!;
  const dues = taches.filter((t) => estDue(t, J)).length;
  expect(taches.some((t) => estFaiteLe(t, J))).toBe(false);
  expect(dues).toBeGreaterThanOrEqual(2);
  expect(j).toBeGreaterThan(60);
  expect(j).toBeLessThan(85);
});
