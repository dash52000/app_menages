import { describe, expect, it } from 'vitest';
import type { SortieSaisie } from './ia.ts';
import { cartesLocales, lignesDepuis, messageSansIA, phraseValidation } from './saisie.ts';
import type { Tache } from './types.ts';

const tache = (id: string, derniere_fois: string | null = null): Tache =>
  ({ id, foyer_id: 'f', piece_id: 'p1', nom: `Tâche ${id}`, icone: 'broom', rythme_jours: 7, duree_min: 5, derniere_fois }) as Tache;

describe('cartesLocales : deuxième barrière côté téléphone', () => {
  const taches = [tache('a'), tache('b')];
  const pieces = [{ id: 'p1' }];
  const nouvelle = { type: 'nouvelle' as const, nom: 'Frigo', piece_id: 'p1', rythme_jours: 30, duree_min: 15 };

  it('écarte une tâche ou une pièce absente de l’état local', () => {
    const sortie: SortieSaisie = {
      cartes: [
        { type: 'cocher', tache_id: 'a' },
        { type: 'cocher', tache_id: 'supprimee' },
        nouvelle,
        { ...nouvelle, piece_id: 'p9' },
      ],
      rejetees: 0,
    };
    const r = cartesLocales(sortie, taches, pieces);
    expect(r.cartes).toEqual([{ type: 'cocher', tache_id: 'a' }, nouvelle]);
    expect(r.ecartees).toBe(2);
  });

  it('retire les doublons de tâche', () => {
    const r = cartesLocales({ cartes: [{ type: 'cocher', tache_id: 'a' }, { type: 'cocher', tache_id: 'a' }], rejetees: 0 }, taches, pieces);
    expect(r.cartes).toHaveLength(1);
  });
});

describe('lignesDepuis : bons défauts', () => {
  it('tout est coché, sauf une tâche déjà faite aujourd’hui (pas de doublon d’historique)', () => {
    const taches = [tache('a'), tache('b', '2026-11-25'), tache('c', '2026-11-20')];
    const lignes = lignesDepuis(
      [
        { type: 'cocher', tache_id: 'a' },
        { type: 'cocher', tache_id: 'b', raison: 'la douche' },
        { type: 'cocher', tache_id: 'c' },
        { type: 'nouvelle', nom: 'Frigo', piece_id: 'p1', rythme_jours: 30, duree_min: 15 },
      ],
      taches,
      '2026-11-25',
    );
    expect(lignes.map((l) => l.coche)).toEqual([true, false, true, true]);
    expect(lignes[1]).toMatchObject({ type: 'cocher', dejaFaite: true, raison: 'la douche' });
    expect(new Set(lignes.map((l) => l.cle)).size).toBe(4);
  });
});

describe('phrases', () => {
  it('bandeau après le OK', () => {
    expect(phraseValidation(1, 0)).toBe('1 tâche cochée ✓');
    expect(phraseValidation(3, 0)).toBe('3 tâches cochées ✓');
    expect(phraseValidation(2, 1)).toBe('2 tâches cochées · 1 tâche ajoutée ✓');
    expect(phraseValidation(0, 2)).toBe('2 tâches ajoutées ✓');
  });

  it('quand l’IA ne répond pas : neutre, jamais de reproche, toujours une sortie à la main', () => {
    for (const r of ['quota_jour', 'quota_minute', 'indisponible', 'reseau', 'inconnue', undefined] as const) {
      const m = messageSansIA(r);
      expect(m).not.toMatch(/erreur|échec|trop|limite|interdit/i);
    }
    expect(messageSansIA('indisponible')).toMatch(/à la main/);
    expect(messageSansIA('quota_jour')).toMatch(/à la main/);
  });
});
