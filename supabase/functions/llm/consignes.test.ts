import { describe, expect, it } from 'vitest';
import { CONSIGNES, masquerPrenoms, preparerContexteSaisie, SAISIE_CARTES_MAX } from './consignes.ts';

describe('consignes IA0', () => {
  it('essai : accepte {pret:true, mot}, refuse le reste', () => {
    const v = CONSIGNES.essai.valider;
    expect(v({ pret: true, mot: ' éponge ' })).toEqual({ pret: true, mot: 'éponge' });
    expect(v({ pret: 'true', mot: 'éponge' })).toBeNull();
    expect(v({ pret: true, mot: '' })).toBeNull();
    expect(v({ pret: true, mot: 'x'.repeat(41) })).toBeNull();
    expect(v([])).toBeNull();
  });

  it('essai_vision : exige une image', () => {
    expect(CONSIGNES.essai_vision.demande({})).toBeNull();
    expect(CONSIGNES.essai_vision.demande({}, { base64: 'AA', type: 'image/png' })?.image).toEqual({ base64: 'AA', type: 'image/png' });
    expect(CONSIGNES.essai_vision.valider({ couleur: 'bleu' })).toEqual({ couleur: 'bleu' });
    expect(CONSIGNES.essai_vision.valider({ couleur: 3 })).toBeNull();
  });

  it('les consignes n’embarquent aucune donnée du foyer', () => {
    const d = CONSIGNES.essai.demande({ code: 'ABC123', prenom: 'Laeti' })!;
    expect(JSON.stringify(d)).not.toMatch(/ABC123|Laeti/);
  });
});

// ---------- IA1 : saisie en langage naturel ----------

const PIECES = [
  { id: 'uuid-cuisine', nom: 'Cuisine' },
  { id: 'uuid-sdb', nom: 'Salle de bain' },
];
const TACHES = [
  { id: 'uuid-plan', nom: 'Nettoyer le plan de travail', piece_id: 'uuid-cuisine' },
  { id: 'uuid-douche', nom: 'Nettoyer la douche', piece_id: 'uuid-sdb' },
  { id: 'uuid-miroir', nom: 'Nettoyer le miroir', piece_id: 'uuid-sdb' },
];
const PROFILS = [{ prenom: 'Damien' }, { prenom: 'Laeti' }];
const ctx = () => preparerContexteSaisie(PIECES, TACHES, PROFILS);
const saisie = CONSIGNES.saisie;

describe('saisie : contexte et demande', () => {
  it('donne des références courtes et garde les ids côté serveur', () => {
    const c = ctx();
    expect(c.pieces.map((p) => p.ref)).toEqual(['p1', 'p2']);
    expect(c.taches.map((t) => [t.ref, t.pieceRef])).toEqual([['t1', 'p1'], ['t2', 'p2'], ['t3', 'p2']]);
    const d = saisie.demande({ texte: 'on a fait la salle de bain à fond' }, undefined, c)!;
    expect(d.texte).toContain('t2 (p2) Nettoyer la douche');
    expect(d.texte).not.toMatch(/uuid-/);
  });

  it('les prénoms du foyer ne partent pas chez le modèle', () => {
    const d = saisie.demande({ texte: 'Laeti a fait la douche, damien le miroir (Laetitia aussi)' }, undefined, ctx())!;
    expect(d.texte).not.toMatch(/Laeti\b|Damien/i);
    expect(d.texte).toContain('quelqu’un a fait la douche');
    expect(d.texte).toContain('Laetitia'); // un autre mot, pas le prénom du foyer
    expect(masquerPrenoms('Éloïse et Laeti', ['Laeti'])).toBe('Éloïse et quelqu’un');
  });

  it('refuse un texte vide ou trop long, des données mal formées, un foyer sans pièce', () => {
    expect(saisie.demande({ texte: '   ' }, undefined, ctx())).toBeNull();
    expect(saisie.demande({ texte: 'x'.repeat(301) }, undefined, ctx())).toBeNull();
    expect(saisie.demande({ texte: 42 }, undefined, ctx())).toBeNull();
    expect(saisie.demande(null, undefined, ctx())).toBeNull();
    expect(saisie.demande({ texte: 'ok' })).toBeNull();
    expect(saisie.demande({ texte: 'ok' }, undefined, preparerContexteSaisie([], [], []))).toBeNull();
  });

  it('lire : une lecture qui échoue donne null (pas de quota consommé côté fonction)', async () => {
    const ok = async (t: string) => (t === 'menage_pieces' ? PIECES : t === 'menage_taches' ? TACHES : PROFILS);
    expect((await saisie.lire!(ok))?.taches).toHaveLength(3);
    expect(await saisie.lire!(async (t) => (t === 'menage_taches' ? null : [] ))).toBeNull();
  });

  it('une tâche dont la pièce est inconnue n’est pas proposée au modèle', () => {
    const c = preparerContexteSaisie(PIECES, [...TACHES, { id: 'x', nom: 'Orpheline', piece_id: 'uuid-inconnue' }], PROFILS);
    expect(c.taches).toHaveLength(3);
  });
});

describe('saisie : validateur (le modèle n’écrit jamais en base)', () => {
  const v = (sortie: unknown) => saisie.valider(sortie, ctx());

  it('remappe les références vers les vrais ids', () => {
    const r = v({ cartes: [{ type: 'cocher', tache: 't2', raison: ' la douche ' }, { type: 'cocher', tache: 't3' }] });
    expect(r).toEqual({
      cartes: [
        { type: 'cocher', tache_id: 'uuid-douche', raison: 'la douche' },
        { type: 'cocher', tache_id: 'uuid-miroir' },
      ],
      rejetees: 0,
    });
  });

  it('rejette une référence inconnue ou un vrai id : la carte saute, les autres restent', () => {
    const r = v({ cartes: [{ type: 'cocher', tache: 't2' }, { type: 'cocher', tache: 't99' }, { type: 'cocher', tache: 'uuid-miroir' }] });
    expect(r).toEqual({ cartes: [{ type: 'cocher', tache_id: 'uuid-douche' }], rejetees: 2 });
  });

  it('aucune carte valable sur des cartes proposées : échec du modèle (on passe au suivant)', () => {
    expect(v({ cartes: [{ type: 'cocher', tache: 't99' }] })).toBeNull();
    expect(v({ cartes: [{ type: 'inconnu' }, 'texte', null] })).toBeNull();
  });

  it('liste vide : valable, rien à proposer', () => {
    expect(v({ cartes: [] })).toEqual({ cartes: [], rejetees: 0 });
  });

  it('forme invalide : null', () => {
    expect(v(null)).toBeNull();
    expect(v([])).toBeNull();
    expect(v({ cartes: 'non' })).toBeNull();
    expect(v({})).toBeNull();
    expect(saisie.valider({ cartes: [] })).toBeNull(); // sans contexte
  });

  it('retire les doublons sans bruit', () => {
    const r = v({ cartes: [{ type: 'cocher', tache: 't2' }, { type: 'cocher', tache: 't2' }] });
    expect(r).toEqual({ cartes: [{ type: 'cocher', tache_id: 'uuid-douche' }], rejetees: 0 });
  });

  it('nouvelle tâche : pièce connue, bornes de rythme et de durée', () => {
    const bonne = { type: 'nouvelle', nom: 'Nettoyer le frigo', piece: 'p1', rythme_jours: 30, duree_min: 15, raison: 'pas dans la liste' };
    expect(v({ cartes: [bonne] })).toEqual({
      cartes: [{ type: 'nouvelle', nom: 'Nettoyer le frigo', piece_id: 'uuid-cuisine', rythme_jours: 30, duree_min: 15, raison: 'pas dans la liste' }],
      rejetees: 0,
    });
    const mauvaises = [
      { ...bonne, piece: 'p9' },
      { ...bonne, piece: 'uuid-cuisine' },
      { ...bonne, rythme_jours: 0 },
      { ...bonne, rythme_jours: 366 },
      { ...bonne, rythme_jours: 7.5 },
      { ...bonne, rythme_jours: '30' },
      { ...bonne, duree_min: 0 },
      { ...bonne, duree_min: 121 },
      { ...bonne, nom: 'a' },
      { ...bonne, nom: 'x'.repeat(61) },
      { ...bonne, nom: '' },
    ];
    for (const m of mauvaises) expect(v({ cartes: [m] }), JSON.stringify(m)).toBeNull();
  });

  it('nouvelle tâche : refusée si le nom existe déjà dans la pièce (accents et casse ignorés), permise dans une autre pièce', () => {
    const base = { type: 'nouvelle', rythme_jours: 7, duree_min: 5 };
    expect(v({ cartes: [{ ...base, nom: 'NETTOYER LA DOUCHE', piece: 'p2' }] })).toBeNull();
    expect(v({ cartes: [{ ...base, nom: 'Nettoyer la douche', piece: 'p1' }] })?.cartes).toHaveLength(1);
    // deux fois la même nouvelle dans la même réponse : une seule passe
    const deux = v({ cartes: [{ ...base, nom: 'Frigo', piece: 'p1' }, { ...base, nom: 'frigo', piece: 'p1' }] });
    expect(deux?.cartes).toHaveLength(1);
    expect(deux?.rejetees).toBe(1);
  });

  it('plafonds : 3 nouvelles, 10 cartes', () => {
    const nouvelles = ['A', 'B', 'C', 'D'].map((n) => ({ type: 'nouvelle', nom: `Tâche ${n}`, piece: 'p1', rythme_jours: 7, duree_min: 5 }));
    const r = v({ cartes: nouvelles })!;
    expect(r.cartes).toHaveLength(3);
    expect(r.rejetees).toBe(1);

    const beaucoup = preparerContexteSaisie(
      PIECES,
      Array.from({ length: 15 }, (_, i) => ({ id: `u${i}`, nom: `Tâche ${i}`, piece_id: 'uuid-cuisine' })),
      [],
    );
    const sortie = saisie.valider({ cartes: beaucoup.taches.map((t) => ({ type: 'cocher', tache: t.ref })) }, beaucoup)!;
    expect(sortie.cartes).toHaveLength(SAISIE_CARTES_MAX);
    expect(sortie.rejetees).toBe(5);
  });

  it('la raison est facultative et jamais bloquante', () => {
    const r = v({ cartes: [{ type: 'cocher', tache: 't1', raison: 'x'.repeat(200) }] });
    expect(r).toEqual({ cartes: [{ type: 'cocher', tache_id: 'uuid-plan' }], rejetees: 0 });
  });
});
