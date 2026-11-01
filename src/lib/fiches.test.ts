/// <reference types="node" />
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANQUE_ICONES, CATALOGUE, ICONES_INTERFACE } from './catalogue.ts';
import { FICHES, besoinsDe, besoinsVisibles, cleFiche, ficheDe, resoudreBesoin, type ProduitPlacard } from './fiches.ts';
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
    { id: 'b', cle: 'liquide-vaisselle', nom: 'Liquide vaisselle', icone: 'bubbles', etat: 'bas' },
    { id: 'c', cle: null, nom: 'Spray maison', icone: 'lotion-bottle', etat: 'ok' },
  ];

  it('propose ce qu’on a sous la main quand l’idéal basique est fini', () => {
    expect(resoudreBesoin(['vinaigre', 'liquide-vaisselle'], placard)).toEqual({
      ideal: 'vinaigre',
      choisi: 'liquide-vaisselle',
      etatIdeal: 'vide',
      etatChoisi: 'bas',
    });
  });

  it('signale l’idéal basique absent du placard', () => {
    expect(resoudreBesoin(['acide-citrique'], placard)).toMatchObject({ ideal: 'acide-citrique', choisi: null, etatIdeal: 'absent' });
  });

  it('ne pousse jamais un produit spécialisé absent', () => {
    // Plaques sans nettoyant vitro au placard : l'idéal reste le basique.
    expect(resoudreBesoin(['nettoyant-vitro', 'liquide-vaisselle', 'multi-surfaces'], placard)).toMatchObject({
      ideal: 'liquide-vaisselle',
      choisi: 'liquide-vaisselle',
    });
    // Un besoin fait seulement de spécialisés absents est masqué.
    expect(resoudreBesoin(['grattoir-vitro'], placard)).toBeNull();
  });

  it('fait passer devant un spécialisé présent, même fini', () => {
    const avecVitro = [...placard, { id: 'd', cle: 'nettoyant-vitro', nom: 'Nettoyant vitrocéramique', icone: 'cooking', etat: 'ok' as const }];
    expect(resoudreBesoin(['nettoyant-vitro', 'liquide-vaisselle'], avecVitro)).toMatchObject({ ideal: 'nettoyant-vitro', choisi: 'nettoyant-vitro' });
    const vitroFini = [...placard, { id: 'd', cle: 'nettoyant-vitro', nom: 'Nettoyant vitrocéramique', icone: 'cooking', etat: 'vide' as const }];
    expect(resoudreBesoin(['nettoyant-vitro', 'liquide-vaisselle'], vitroFini)).toMatchObject({
      ideal: 'nettoyant-vitro',
      etatIdeal: 'vide',
      choisi: 'liquide-vaisselle',
    });
  });

  it('masque les besoins optionnels de la fiche selon le placard', () => {
    const plaques = { nom: 'Nettoyer les plaques' };
    expect(besoinsVisibles(plaques, placard).map((o) => o[0])).toEqual(['nettoyant-vitro', 'pierre-argile', 'microfibres']);
    const avecGrattoir = [...placard, { id: 'g', cle: 'grattoir-vitro', nom: 'Grattoir', icone: 'razor', etat: 'ok' as const }];
    expect(besoinsVisibles(plaques, avecGrattoir)).toHaveLength(4);
  });

  it('préfère les produits choisis à la main à ceux de la fiche', () => {
    expect(besoinsDe({ nom: 'Vitres', produits: ['c'] })).toEqual([['c']]);
    expect(besoinsDe({ nom: 'Vitres', produits: null })[0]).toContain('vinaigre');
    expect(resoudreBesoin(['c'], placard)).toMatchObject({ choisi: 'c', etatChoisi: 'ok' });
  });

  it('a des familles et des clés uniques', () => {
    const cles = PRODUITS.map((x) => x.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(PRODUITS.length).toBeGreaterThanOrEqual(60);
    expect(PRODUITS.filter((x) => x.indispensable)).toHaveLength(15);
  });
});
