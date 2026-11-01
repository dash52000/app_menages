/// <reference types="node" />
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANQUE_ICONES, CATALOGUE, ICONES_INTERFACE } from './catalogue.ts';
import { FICHES, besoinsDe, cleFiche, ficheDe, resoudreBesoin, type ProduitPlacard } from './fiches.ts';
import { ICONES_PRODUITS, PRODUITS, PRODUITS_PAR_CLE } from './produits.ts';

describe('catalogue et fiches', () => {
  it('donne une fiche à chaque tâche du catalogue', () => {
    const sansFiche = CATALOGUE.flatMap((p) => p.taches.filter((t) => !cleFiche(t.nom)).map((t) => `${p.nom} : ${t.nom}`));
    expect(sansFiche).toEqual([]);
  });

  it('ne cite que des produits connus', () => {
    const inconnus = Object.entries(FICHES).flatMap(([cle, f]) =>
      (f.besoins ?? []).flat().filter((x) => !PRODUITS_PAR_CLE[x]).map((x) => `${cle} → ${x}`),
    );
    expect(inconnus).toEqual([]);
  });

  it('a une illustration pour chaque pièce, tâche et produit', () => {
    const noms = new Set([
      ...CATALOGUE.flatMap((p) => [p.icone, ...p.taches.map((t) => t.icone)]),
      ...PRODUITS.map((p) => p.icone),
      ...ICONES_PRODUITS,
      ...BANQUE_ICONES,
      ...ICONES_INTERFACE,
    ]);
    const manquantes = [...noms].filter((n) => !existsSync(`public/illus/${n}.svg`));
    expect(manquantes).toEqual([]);
  });

  it('retrouve la fiche par la clé enregistrée, même après un renommage', () => {
    expect(ficheDe({ nom: 'Nettoyer l\'évier' })).not.toBeNull();
    expect(ficheDe({ nom: 'Mon évier à moi', fiche: cleFiche('Nettoyer l’évier') })).not.toBeNull();
    expect(ficheDe({ nom: 'Tâche inventée' })).toBeNull();
  });
});

describe('produits à prendre', () => {
  const placard: ProduitPlacard[] = [
    { id: 'a', cle: 'vinaigre', nom: 'Vinaigre blanc', icone: 'sake', etat: 'vide' },
    { id: 'b', cle: 'nettoyant-vitres', nom: 'Nettoyant vitres', icone: 'window', etat: 'bas' },
    { id: 'c', cle: null, nom: 'Spray maison', icone: 'lotion-bottle', etat: 'ok' },
  ];

  it('propose ce qu’on a sous la main quand l’idéal est fini', () => {
    expect(resoudreBesoin(['vinaigre', 'nettoyant-vitres', 'liquide-vaisselle'], placard)).toEqual({
      ideal: 'vinaigre',
      choisi: 'nettoyant-vitres',
      etatIdeal: 'vide',
      etatChoisi: 'bas',
    });
  });

  it('signale l’idéal absent du placard', () => {
    expect(resoudreBesoin(['acide-citrique'], placard)).toMatchObject({ ideal: 'acide-citrique', choisi: null, etatIdeal: 'absent' });
  });

  it('préfère les produits choisis à la main à ceux de la fiche', () => {
    expect(besoinsDe({ nom: 'Vitres', produits: ['c'] })).toEqual([['c']]);
    expect(besoinsDe({ nom: 'Vitres', produits: null })[0][0]).toBe('vinaigre');
    expect(resoudreBesoin(['c'], placard)).toMatchObject({ choisi: 'c', etatChoisi: 'ok' });
  });
});
