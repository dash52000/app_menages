import { describe, expect, it } from 'vitest';
import { detailsMarques, evenementFin, evenementSortie } from './journal.ts';

describe('journal du check (F1)', () => {
  it('sortir sans rien faire n’est pas un abandon : check_vu', () => {
    expect(evenementSortie(0)).toBe('check_vu');
  });

  it('sortir après au moins une action : check_quitte', () => {
    expect(evenementSortie(1)).toBe('check_quitte');
    expect(evenementSortie(4)).toBe('check_quitte');
  });

  it('toutes les cartes traitées : check_termine ; « c’est tout » en cours de route : check_quitte', () => {
    expect(evenementFin('complet')).toBe('check_termine');
    expect(evenementFin('arret')).toBe('check_quitte');
  });

  it('plus aucun événement « abandonné »', () => {
    const noms = [evenementSortie(0), evenementSortie(3), evenementFin('complet'), evenementFin('arret')];
    expect(noms.some((n) => /abandon/.test(n))).toBe(false);
  });

  it('marque les détails d’une session de test, sans toucher aux autres', () => {
    expect(detailsMarques({ a: 1 }, true)).toEqual({ a: 1, test: true });
    expect(detailsMarques({ a: 1 }, false)).toEqual({ a: 1 });
  });
});
