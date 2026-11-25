import { describe, expect, it } from 'vitest';
import { CATALOGUE } from './catalogue.ts';
import { FICHES, cleFiche, resoudreBesoin } from './fiches.ts';
import { aRacheter, pasEncoreAuxCourses, produitDuBesoin, tachesPourProduit, verifieDepuis } from './placard.ts';
import { PRODUITS } from './produits.ts';
import type { Produit, Tache } from './types.ts';

const tache = (nom: string, extra: Partial<Tache> = {}): Tache => ({
  id: nom, foyer_id: 'f', piece_id: 'p', nom, icone: 'broom', rythme_jours: 7, duree_min: 5,
  derniere_fois: null, derniere_par: null, reporte_le: null, reporte_jusqu_au: null, reserve_par: null, reserve_le: null,
  ...extra,
});
const produit = (id: string, cle: string | null, etat: Produit['etat'], extra: Partial<Produit> = {}): Produit => ({
  id, foyer_id: 'f', cle, nom: id, icone: 'jar', etat, indispensable: false, courses_le: null, maj_par: null, maj_le: '2026-11-20T10:00:00', ...extra,
});

describe('Placard utile (F6)', () => {
  it('les produits de base sont liés à des tâches du catalogue (lessive, sacs, papier, gel WC)', () => {
    const noms = new Set(CATALOGUE.flatMap((c) => c.taches.map((t) => cleFiche(t.nom))).filter(Boolean) as string[]);
    for (const cle of ['lessive', 'sacs-poubelle', 'sacs-tri', 'papier-toilette', 'gel-wc', 'detartrant-cafe']) {
      const liees = [...noms].filter((n) => FICHES[n]?.besoins?.flat().includes(cle));
      expect(liees.length, cle).toBeGreaterThan(0);
    }
  });

  it('chaque produit cité par une fiche existe au catalogue', () => {
    const connus = new Set(PRODUITS.map((p) => p.cle));
    for (const [nom, f] of Object.entries(FICHES)) for (const o of f.besoins?.flat() ?? []) expect(connus.has(o), `${nom} → ${o}`).toBe(true);
  });

  it('retrouve les tâches d’un produit, par id (tâche perso) ou par clé (fiche)', () => {
    const lessive = produit('p-lessive', 'lessive', 'ok');
    const taches = [
      tache('Lancer une lessive'), // fiche par son nom
      tache('Nettoyer le frigo'),
      tache('Autre', { produits: ['p-lessive'] }), // choisi à la main, par id
    ];
    expect(tachesPourProduit(lessive, taches).map((t) => t.nom)).toEqual(['Lancer une lessive', 'Autre']);
  });

  it('le produit d’un besoin est celui qu’on a sous la main, sinon l’idéal', () => {
    const placard = [produit('a', 'vinaigre', 'ok'), produit('b', 'acide-citrique', 'vide')];
    const b = resoudreBesoin(['acide-citrique', 'vinaigre'], placard)!;
    expect(produitDuBesoin(b, placard)?.id).toBe('a'); // l'idéal est fini : on prend le vinaigre
    const tout = [produit('b', 'acide-citrique', 'vide')];
    expect(produitDuBesoin(resoudreBesoin(['acide-citrique', 'vinaigre'], tout)!, tout)?.id).toBe('b');
  });

  it('dit depuis quand l’état est vérifié, sans alarme', () => {
    const j = '2026-11-25';
    expect(verifieDepuis('2026-11-25T08:00:00', j)).toBe('Vérifié aujourd’hui');
    expect(verifieDepuis('2026-11-24T20:00:00', j)).toBe('Vérifié hier');
    expect(verifieDepuis('2026-11-20T10:00:00', j)).toBe('Vérifié il y a 5 j');
    expect(verifieDepuis('2026-10-01T10:00:00', j)).toBe('Vérifié il y a 8 sem.');
    expect(verifieDepuis('pas une date', j)).toBe('Jamais vérifié');
  });

  it('déduit la liste de courses des produits bas ou vides, sans doublon', () => {
    const l = [
      produit('ok', 'a', 'ok'),
      produit('bas', 'b', 'bas'),
      produit('vide', 'c', 'vide', { courses_le: '2026-11-24T10:00:00Z' }),
    ];
    expect(aRacheter(l).map((x) => x.id)).toEqual(['bas', 'vide']);
    expect(pasEncoreAuxCourses(l).map((x) => x.id)).toEqual(['bas']);
  });
});
