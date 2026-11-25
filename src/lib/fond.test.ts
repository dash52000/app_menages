import { describe, expect, it } from 'vitest';
import { ajouterJours } from './dates.ts';
import { choisirFond, estDeFond, propositionSuivante, selectionCheck } from './fraicheur.ts';
import type { Tache } from './types.ts';

const J = '2026-11-25';
const MAINTENANT = Date.parse('2026-11-25T12:00:00Z');

function tache(p: Partial<Tache> & { id: string }): Tache {
  return {
    foyer_id: 'f', piece_id: 'p', nom: p.id, icone: 'broom', rythme_jours: 10, duree_min: 10,
    derniere_fois: ajouterJours(J, -9), derniere_par: null, reporte_le: null, reporte_jusqu_au: null, reserve_par: null, reserve_le: null,
    ...p,
  };
}
// Une tâche de fond : 25 jours depuis la dernière fois pour un rythme de 10 (2,5×).
const fond = (id: string, extra: Partial<Tache> = {}) => tache({ id, derniere_fois: ajouterJours(J, -25), ...extra });

describe('Tâches de fond (F3)', () => {
  it('une tâche de fond dépasse deux fois son rythme', () => {
    expect(estDeFond(fond('a'), J)).toBe(true);
    expect(estDeFond(tache({ id: 'b', derniere_fois: ajouterJours(J, -20) }), J)).toBe(false); // exactement 2×
    expect(estDeFond(tache({ id: 'c', derniere_fois: ajouterJours(J, -12) }), J)).toBe(false);
  });

  it('au plus une tâche de fond par check, les autres attendent', () => {
    const t = [fond('f1'), fond('f2'), fond('f3'), tache({ id: 'n1' }), tache({ id: 'n2' })];
    const { liste } = selectionCheck(t, J, 5, new Set(), MAINTENANT);
    expect(liste.filter((x) => estDeFond(x, J))).toHaveLength(1);
    expect(liste.map((x) => x.id)).toEqual(expect.arrayContaining(['n1', 'n2']));
    expect(liste).toHaveLength(3);
  });

  it('la rotation prend celle proposée il y a le plus longtemps', () => {
    const t = [
      fond('recente', { fond_propose_le: ajouterJours(J, -1) }),
      fond('ancienne', { fond_propose_le: ajouterJours(J, -9) }),
      fond('jamais'),
    ];
    expect(choisirFond(t, J)?.id).toBe('jamais');
    expect(choisirFond(t.filter((x) => x.id !== 'jamais'), J)?.id).toBe('ancienne');
  });

  it('sur une série de checks, chaque tâche de fond finit par être proposée', () => {
    const t = [fond('a'), fond('b'), fond('c')];
    const vues: string[] = [];
    for (let i = 0; i < 3; i++) {
      const jour = ajouterJours(J, i);
      const { fond: choisie } = selectionCheck(t, jour, 5, new Set(), MAINTENANT);
      expect(choisie).not.toBeNull();
      vues.push(choisie!.id);
      const cible = t.find((x) => x.id === choisie!.id)!;
      cible.fond_propose_le = jour; // ce que fait marquerFond
    }
    expect(new Set(vues).size).toBe(3);
  });

  it('la tâche de fond choisie tient dans le check même derrière cinq petites victoires', () => {
    const courtes = Array.from({ length: 6 }, (_, i) => tache({ id: `c${i}`, duree_min: 1, derniere_fois: ajouterJours(J, -10) }));
    const { liste } = selectionCheck([...courtes, fond('gros', { duree_min: 45 })], J, 5, new Set(), MAINTENANT);
    expect(liste).toHaveLength(5);
    expect(liste.map((x) => x.id)).toContain('gros');
  });

  it('une tâche de fond prise (« Je prends ») n’est pas écartée', () => {
    const t = [fond('prise', { reserve_par: 'moi', reserve_le: J }), fond('autre')];
    const ids = selectionCheck(t, J, 5, new Set(), MAINTENANT).liste.map((x) => x.id);
    expect(ids).toContain('prise');
  });

  it('« Autre » ne met pas une deuxième tâche de fond dans le check', () => {
    const t = [fond('f1'), tache({ id: 'normale', derniere_fois: ajouterJours(J, -9) })];
    expect(propositionSuivante(t, J, new Set(), { fondPresent: true, maintenant: MAINTENANT })?.id).toBe('normale');
    expect(propositionSuivante([fond('f1')], J, new Set(), { fondPresent: true, maintenant: MAINTENANT })).toBeNull();
    expect(propositionSuivante([fond('f1')], J, new Set(), { fondPresent: false, maintenant: MAINTENANT })?.id).toBe('f1');
  });
});
