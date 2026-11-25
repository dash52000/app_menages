import { describe, expect, it } from 'vitest';
import { nomProche } from './doublons.ts';

const CUISINE = ['Nettoyer le plan de travail', 'Nettoyer l’évier', 'Vider le lave-vaisselle', 'Laver le sol', 'Micro-ondes'];

describe('nom proche d’une tâche existante (F4)', () => {
  it('reconnaît le même nom, aux accents, pluriels et majuscules près', () => {
    expect(nomProche('nettoyer le evier', CUISINE)).toBe('Nettoyer l’évier');
    expect(nomProche('LAVER LE SOL', CUISINE)).toBe('Laver le sol');
  });

  it('reconnaît un nom dont tous les mots sont dans l’autre', () => {
    expect(nomProche('Nettoyer plan de travail', CUISINE)).toBe('Nettoyer le plan de travail');
    expect(nomProche('Nettoyer le plan de travail de la cuisine', CUISINE)).toBe('Nettoyer le plan de travail');
  });

  it('ne s’alarme pas pour des tâches différentes', () => {
    expect(nomProche('Nettoyer le four', CUISINE)).toBeNull();
    expect(nomProche('Arroser les plantes', CUISINE)).toBeNull();
    expect(nomProche('', CUISINE)).toBeNull();
  });

  it('ne s’alarme pas sur un seul mot en commun dans un nom long', () => {
    expect(nomProche('Nettoyer le frigo', CUISINE)).toBeNull();
  });

  it('rien à comparer : null', () => {
    expect(nomProche('Aspirateur', [])).toBeNull();
  });
});
