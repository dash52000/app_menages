import { describe, expect, it } from 'vitest';
import { besoinsDe, ficheDe, refsEnIds, resoudreBesoin } from './fiches.ts';
import type { EtatProduit } from './produits.ts';

const placard = [
  { id: 'id-lessive', cle: 'lessive', nom: 'Lessive', icone: 'basket', etat: 'ok' as EtatProduit },
  { id: 'id-maison', cle: null, nom: 'Produit vitre poêle', icone: 'fire', etat: 'ok' as EtatProduit },
];

describe('fiche stable (fiche_id)', () => {
  it('la fiche suit fiche_id, même si la tâche est renommée', () => {
    const renommee = { nom: 'Faire briller le sol', fiche_id: 'laver le sol' };
    expect(ficheDe(renommee)).not.toBeNull();
    expect(ficheDe({ nom: 'Faire briller le sol' })).toBeNull();
  });

  it('fiche_id passe avant l’ancienne clé « fiche », qui passe avant le nom', () => {
    const f = ficheDe({ nom: 'Aspirateur', fiche_id: 'laver le sol', fiche: 'vitre' });
    expect(f).toBe(ficheDe({ nom: 'Laver le sol' }));
    expect(ficheDe({ nom: 'x', fiche: 'vitre' })).toBe(ficheDe({ nom: 'Vitres' }));
  });
});

describe('produits référencés par id', () => {
  it('convertit les clés de catalogue en ids du placard, sans doublon', () => {
    expect(refsEnIds(['lessive', 'id-lessive', 'id-maison'], placard)).toEqual(['id-lessive', 'id-maison']);
  });

  it('une référence inconnue reste telle quelle (rien n’est perdu en silence)', () => {
    expect(refsEnIds(['vinaigre', 'id-maison'], placard)).toEqual(['vinaigre', 'id-maison']);
  });

  it('une tâche aux produits choisis par id retrouve son produit dans le placard', () => {
    const besoins = besoinsDe({ nom: 'Nettoyer la vitre', produits: ['id-maison', 'id-lessive'] });
    expect(besoins).toEqual([['id-maison'], ['id-lessive']]);
    expect(resoudreBesoin(besoins[0], placard)?.choisi).toBe('id-maison');
  });
});
