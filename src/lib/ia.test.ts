import { describe, expect, it } from 'vitest';
import { demanderIA, type AppelFonctions } from './ia.ts';

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
