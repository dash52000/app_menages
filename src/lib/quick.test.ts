import { describe, expect, it } from 'vitest';
import { ajouterJours } from './dates.ts';
import { CATALOGUE, quicksAAjouter } from './catalogue.ts';
import { cleFiche } from './fiches.ts';
import { estQuick, propositionSuivante, quicksDuJour, quicksProposables, refuseeRecemment, selectionCheck } from './fraicheur.ts';
import { normaliser as cleNom } from './normalise.ts';
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

  it('le champ quick l’emporte sur la durée ; sans champ, la durée décide', () => {
    expect(estQuick({ duree_min: 5, quick: true })).toBe(true);
    expect(estQuick({ duree_min: 1, quick: false })).toBe(false);
    expect(estQuick({ duree_min: 1, quick: null })).toBe(true);
    expect(estQuick({ duree_min: 10 })).toBe(false);
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
    const quicks = CATALOGUE.flatMap((p) => p.taches.filter((t) => t.quick));
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

describe('Refus : pas reproposée avant 48 h (F2)', () => {
  const MAINTENANT = Date.parse('2026-11-25T12:00:00Z');
  const il_y_a = (h: number) => new Date(MAINTENANT - h * 3600 * 1000).toISOString();

  it('compte 48 h à partir du refus', () => {
    expect(refuseeRecemment({ refusee_le: il_y_a(1) }, MAINTENANT)).toBe(true);
    expect(refuseeRecemment({ refusee_le: il_y_a(47) }, MAINTENANT)).toBe(true);
    expect(refuseeRecemment({ refusee_le: il_y_a(49) }, MAINTENANT)).toBe(false);
    expect(refuseeRecemment({ refusee_le: null }, MAINTENANT)).toBe(false);
    expect(refuseeRecemment({}, MAINTENANT)).toBe(false);
  });

  it('« Aérer la chambre » refusée laisse la première place à la suivante', () => {
    const t = [
      tache({ id: 'aerer', duree_min: 1, quick: true, rythme_jours: 2, derniere_fois: ajouterJours(J, -9), refusee_le: il_y_a(3) }),
      tache({ id: 'lit', duree_min: 1, quick: true, rythme_jours: 3, derniere_fois: ajouterJours(J, -4) }),
    ];
    expect(quicksProposables(t, J, MAINTENANT).map((x) => x.id)).toEqual(['lit']);
    // La liste complète, elle, la garde : on la choisit soi-même.
    expect(quicksDuJour(t, J).map((x) => x.id)).toEqual(['aerer', 'lit']);
    // Après 48 h, elle revient en tête.
    const plusTard = MAINTENANT + 50 * 3600 * 1000;
    expect(quicksProposables(t, J, plusTard).map((x) => x.id)).toEqual(['aerer', 'lit']);
  });

  it('« Autre » ne remet pas une tâche refusée', () => {
    const t = [
      tache({ id: 'refusee', derniere_fois: ajouterJours(J, -9), refusee_le: il_y_a(5) }),
      tache({ id: 'autre', derniere_fois: ajouterJours(J, -8) }),
    ];
    expect(propositionSuivante(t, J, new Set(), { maintenant: MAINTENANT })?.id).toBe('autre');
    expect(propositionSuivante(t, J, new Set(['autre']), { maintenant: MAINTENANT })).toBeNull();
  });

  it('une tâche prise (« Je prends ») reste dans le check même refusée', () => {
    const t = [tache({ id: 'prise', derniere_fois: ajouterJours(J, -1), reserve_par: 'moi', reserve_le: J, refusee_le: il_y_a(2) })];
    expect(selectionCheck(t, J, 5, new Set(), MAINTENANT).liste.map((x) => x.id)).toEqual(['prise']);
  });
});

describe('Catalogue (F4, F5)', () => {
  it('ne propose pas deux fois la même tâche dans une pièce', () => {
    for (const p of CATALOGUE) {
      const noms = p.taches.map((x) => cleNom(x.nom));
      expect(new Set(noms).size, p.nom).toBe(noms.length);
    }
  });

  it('suit les rythmes réglés par Laeti', () => {
    const rythme = (piece: string, nom: string) => CATALOGUE.find((p) => p.cle === piece)?.taches.find((x) => x.nom === nom)?.rythme;
    expect(rythme('partout', 'Vitres')).toBe(90);
    expect(rythme('partout', 'Sortir le tri')).toBe(10);
    expect(rythme('partout', 'Sortir les poubelles')).toBe(21);
    expect(rythme('partout', 'Lancer une lessive')).toBe(3);
    expect(rythme('buanderie', 'Lancer une lessive')).toBe(3);
    expect(rythme('cuisine', 'Vider le lave-vaisselle')).toBe(4);
    expect(rythme('cuisine', 'Micro-ondes')).toBe(30);
    expect(rythme('salle-de-bain', 'Coup de chiffon sur le miroir')).toBe(30);
    expect(rythme('salle-de-bain', 'Laver le sol')).toBe(14);
    expect(rythme('salle-de-bain', 'Vider la poubelle')).toBe(14);
    expect(rythme('poele', 'Vider le creuset')).toBe(7);
  });
});
