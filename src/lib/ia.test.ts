import { describe, expect, it } from 'vitest';
import { demanderIA, saisirEnLangageNaturel, SAISIE_TEXTE_MAX, type AppelFonctions } from './ia.ts';

const client = (invoke: AppelFonctions['functions']['invoke']): AppelFonctions => ({ functions: { invoke } });

describe('demanderIA : l’appli continue sans IA', () => {
  it('renvoie la sortie quand la fonction répond', async () => {
    const r = await demanderIA(client(async () => ({ data: { ok: true, sortie: { pret: true } }, error: null })), 'essai');
    expect(r).toEqual({ sortie: { pret: true } });
  });

  it.each(['quota_jour', 'quota_minute', 'indisponible'])('%s : sortie nulle, raison transmise', async (raison) => {
    const r = await demanderIA(client(async () => ({ data: { ok: false, raison }, error: null })), 'essai');
    expect(r).toEqual({ sortie: null, raison });
  });

  it('erreur de la fonction ou exception : jamais d’exception côté appli', async () => {
    expect(await demanderIA(client(async () => ({ data: null, error: new Error('500') })), 'essai')).toEqual({
      sortie: null,
      raison: 'reseau',
    });
    expect(await demanderIA(client(async () => { throw new Error('réseau'); }), 'essai')).toEqual({
      sortie: null,
      raison: 'reseau',
    });
  });

  it('fonction qui ne répond pas : abandon au délai', async () => {
    const r = await demanderIA(client(() => new Promise(() => {})), 'essai', {}, { delaiMs: 10 });
    expect(r).toEqual({ sortie: null, raison: 'reseau' });
  });

  it('envoie la consigne, les données, l’image et la marque de test', async () => {
    let vu: unknown;
    await demanderIA(
      client(async (_n, o) => { vu = o.body; return { data: null, error: null }; }),
      'essai_vision', { a: 1 }, { image: { base64: 'AA', type: 'image/png' }, test: true },
    );
    expect(vu).toEqual({ consigne: 'essai_vision', donnees: { a: 1 }, image: { base64: 'AA', type: 'image/png' }, test: true });
  });
});

describe('saisirEnLangageNaturel (IA1)', () => {
  it('envoie la consigne saisie avec le seul texte, rogné et plafonné ; jamais d’id ni de liste de tâches', async () => {
    let vu: Record<string, unknown> = {};
    const c = client(async (_n, o) => { vu = o.body; return { data: { ok: true, sortie: { cartes: [], rejetees: 0 } }, error: null }; });
    const r = await saisirEnLangageNaturel(c, `  ${'a'.repeat(SAISIE_TEXTE_MAX + 50)}  `, { test: true });
    expect(r.sortie).toEqual({ cartes: [], rejetees: 0 });
    expect(vu.consigne).toBe('saisie');
    expect(Object.keys(vu.donnees as object)).toEqual(['texte']);
    expect((vu.donnees as { texte: string }).texte).toHaveLength(SAISIE_TEXTE_MAX);
    expect(vu.test).toBe(true);
    expect(vu.image).toBeUndefined();
  });

  it('IA indisponible : sortie nulle, l’appli continue', async () => {
    const r = await saisirEnLangageNaturel(client(async () => ({ data: { ok: false, raison: 'indisponible' }, error: null })), 'on a fait la douche');
    expect(r).toEqual({ sortie: null, raison: 'indisponible' });
  });
});
