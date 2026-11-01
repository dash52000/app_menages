import { describe, expect, it } from 'vitest';
import { ajouterJours, ecart, ilYa, jourRelatif } from './dates.ts';
import {
  candidatesCheck,
  dateApresReprise,
  figeeDepuis,
  fraicheurAffichee,
  tachesActives,
  derniereFoisInitiale,
  estDue,
  fraicheur,
  jauge,
  selectionCheck,
} from './fraicheur.ts';
import type { Tache } from './types.ts';

const J = '2026-10-31';

function tache(p: Partial<Tache> & { id: string }): Tache {
  return {
    foyer_id: 'f',
    piece_id: 'p',
    nom: p.id,
    icone: 'broom',
    rythme_jours: 7,
    duree_min: 10,
    derniere_fois: J,
    derniere_par: null,
    reporte_le: null,
    reporte_jusqu_au: null,
    reserve_par: null,
    reserve_le: null,
    ...p,
  };
}

describe('dates', () => {
  it('calcule les écarts et les décalages, y compris au changement d’heure', () => {
    expect(ecart('2026-10-24', '2026-10-31')).toBe(7);
    expect(ajouterJours('2026-10-31', 1)).toBe('2026-11-01');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
    expect(ecart('2026-03-28', '2026-03-30')).toBe(2); // passage à l'heure d'été
  });

  it('écrit les dates en clair', () => {
    expect(jourRelatif(J, J)).toBe("aujourd'hui");
    expect(jourRelatif('2026-10-30', J)).toBe('hier');
    expect(jourRelatif('2026-10-27', J)).toBe('mardi');
    expect(jourRelatif('2026-10-12', J)).toBe('12 oct.');
    expect(ilYa('2026-10-28', J)).toBe('il y a 3 j');
    expect(ilYa('2026-10-10', J)).toBe('il y a 3 sem.');
  });
});

describe('fraîcheur', () => {
  it('vaut 1 le jour même, 0 à l’échéance, et reste à 0 ensuite', () => {
    expect(fraicheur(tache({ id: 'a' }), J)).toBe(1);
    expect(fraicheur(tache({ id: 'a', derniere_fois: '2026-10-28' }), J)).toBeCloseTo(4 / 7);
    expect(fraicheur(tache({ id: 'a', derniere_fois: '2026-10-24' }), J)).toBe(0);
    expect(fraicheur(tache({ id: 'a', derniere_fois: '2026-09-01' }), J)).toBe(0);
  });

  it('se fige pendant un report « Demain »', () => {
    const t = tache({ id: 'a', derniere_fois: '2026-10-25', reporte_le: '2026-10-30', reporte_jusqu_au: J });
    expect(fraicheur(t, J)).toBeCloseTo(2 / 7);
    expect(fraicheur(t, '2026-11-01')).toBe(0);
  });

  it('pondère la jauge par la durée', () => {
    const propre = tache({ id: 'vitres', duree_min: 45 });
    const sale = tache({ id: 'poubelles', duree_min: 2, derniere_fois: '2026-10-01' });
    expect(jauge([propre, sale], J)).toBe(96);
    expect(jauge([], J)).toBeNull();
  });
});

describe('check', () => {
  it('propose une tâche quand il lui reste 10 % de fraîcheur ou moins', () => {
    expect(estDue(tache({ id: 'a', derniere_fois: '2026-10-25' }), J)).toBe(false); // 6 j sur 7
    expect(estDue(tache({ id: 'a', derniere_fois: '2026-10-24' }), J)).toBe(true);
    expect(estDue(tache({ id: 'a', rythme_jours: 30, derniere_fois: '2026-10-04' }), J)).toBe(true); // 27 j sur 30
    expect(estDue(tache({ id: 'a', rythme_jours: 1, derniere_fois: '2026-10-30' }), J)).toBe(true);
    expect(estDue(tache({ id: 'a', derniere_fois: null }), J)).toBe(true);
  });

  it('écarte les tâches reportées ou déjà faites, garde les réservées', () => {
    const vieille = '2026-10-01';
    const ids = candidatesCheck(
      [
        tache({ id: 'due', derniere_fois: vieille }),
        tache({ id: 'reportee', derniere_fois: vieille, reporte_le: J, reporte_jusqu_au: '2026-11-01' }),
        tache({ id: 'revenue', derniere_fois: vieille, reporte_le: '2026-10-30', reporte_jusqu_au: J }),
        tache({ id: 'faite' }),
        tache({ id: 'reservee', derniere_fois: '2026-10-29', reserve_par: 'p1', reserve_le: J }),
        tache({ id: 'reservee-hier', derniere_fois: '2026-10-29', reserve_par: 'p1', reserve_le: '2026-10-30' }),
      ],
      J,
    ).map((t) => t.id);
    expect(ids.sort()).toEqual(['due', 'reservee', 'revenue']);
  });

  it('met les petites victoires en tête, puis la plus urgente, et plafonne à 5', () => {
    const taches = [
      tache({ id: 'vitres', rythme_jours: 30, duree_min: 45, derniere_fois: '2026-09-01' }),
      tache({ id: 'aspirateur', duree_min: 20, derniere_fois: '2026-10-24' }),
      tache({ id: 'sol', duree_min: 15, derniere_fois: '2026-10-10' }),
      tache({ id: 'poubelles', rythme_jours: 3, duree_min: 2, derniere_fois: '2026-10-28' }),
      tache({ id: 'draps', rythme_jours: 14, duree_min: 15, derniere_fois: '2026-10-17' }),
      tache({ id: 'frigo', rythme_jours: 30, duree_min: 20, derniere_fois: '2026-10-01' }),
      tache({ id: 'lave-vaisselle', rythme_jours: 2, duree_min: 2, derniere_fois: '2026-10-29' }),
    ];
    const { liste, reste } = selectionCheck(taches, J);
    expect(liste.map((t) => t.id)).toEqual(['lave-vaisselle', 'poubelles', 'sol', 'vitres', 'aspirateur']);
    expect(reste).toBe(2);
    const suite = selectionCheck(taches, J, 5, new Set(liste.map((t) => t.id)));
    expect(suite.liste.map((t) => t.id)).toEqual(['draps', 'frigo']);
  });

  it('étale les échéances initiales sans laisser le premier check vide', () => {
    const taches = Array.from({ length: 25 }, (_, i) =>
      tache({ id: `t${i}`, rythme_jours: [2, 3, 7, 14, 30][i % 5], derniere_fois: derniereFoisInitiale(i, [2, 3, 7, 14, 30][i % 5], J) }),
    );
    const dues = taches.filter((t) => estDue(t, J)).length;
    expect(dues).toBeGreaterThanOrEqual(2);
    expect(dues).toBeLessThanOrEqual(8);
    const j = jauge(taches, J)!;
    expect(j).toBeGreaterThan(55);
    expect(j).toBeLessThan(90);
  });
});

describe('pièce à l’arrêt (poêle hors saison)', () => {
  const pieces = [
    { id: 'poele', foyer_id: 'f', nom: 'Poêle à granulés', icone: 'fire', ordre: 0, en_pause_depuis: '2026-04-15' },
    { id: 'cuisine', foyer_id: 'f', nom: 'Cuisine', icone: 'cooking', ordre: 1, en_pause_depuis: null },
  ];
  const creuset = tache({ id: 'creuset', nom: 'Vider le creuset', piece_id: 'poele', rythme_jours: 4, derniere_fois: '2026-04-13' });
  const entretien = tache({ id: 'pro', nom: 'Entretien annuel par un pro', piece_id: 'poele', rythme_jours: 365, derniere_fois: '2025-11-01' });
  const evier = tache({ id: 'evier', nom: 'Nettoyer l’évier', piece_id: 'cuisine', derniere_fois: '2026-10-20' });

  it('sort ses tâches du check et de la jauge, sauf l’entretien annuel', () => {
    expect(tachesActives([creuset, entretien, evier], pieces).map((t) => t.id)).toEqual(['pro', 'evier']);
    expect(figeeDepuis(creuset, pieces)).toBe('2026-04-15');
    expect(figeeDepuis(entretien, pieces)).toBeNull();
  });

  it('reprend où elle en était à la remise en marche', () => {
    // Faite 2 jours avant l'arrêt du 15 avril, remise en marche le 31 octobre : « faite il y a 2 jours ».
    expect(dateApresReprise('2026-04-13', '2026-04-15', J)).toBe('2026-10-29');
    // Faite pendant l'arrêt : repart fraîche.
    expect(dateApresReprise('2026-06-01', '2026-04-15', J)).toBe(J);
  });

  it('fige la fraîcheur au jour de l’arrêt', () => {
    expect(fraicheurAffichee(creuset, J, pieces)).toBeCloseTo(0.5); // 2 jours sur 4, comme le 15 avril
    expect(fraicheurAffichee(tache({ id: 'x', piece_id: 'poele', derniere_fois: '2026-05-01' }), J, pieces)).toBe(1);
  });
});
