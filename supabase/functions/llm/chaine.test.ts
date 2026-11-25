import { describe, expect, it } from 'vitest';
import { appelerChaine, attenteDemandee, CHAINES, cleModele, DELAI_MS, type Modele, type Usage } from './chaine.ts';
import { CONSIGNES, preparerContexteSaisie } from './consignes.ts';

const T0 = new Date('2026-11-25T14:00:00Z');
const maintenant = () => T0;
const cles = { gemini: 'g', groq: 'q' };

/** Modèle visé par une requête (Gemini : dans l'URL ; Groq : dans le corps). */
function modeleVise(url: string, init?: RequestInit): string {
  if (url.includes('generativelanguage')) return 'gemini:' + url.split('/models/')[1].split(':')[0];
  return 'groq:' + JSON.parse(String(init?.body)).model;
}

function repOk(cle: string, contenu: string): Response {
  const corps = cle.startsWith('gemini')
    ? { candidates: [{ content: { parts: [{ text: contenu }] } }] }
    : { choices: [{ message: { content: contenu } }] };
  return new Response(JSON.stringify(corps), { status: 200 });
}

type Comportement = { statut: number; entetes?: Record<string, string>; corps?: unknown } | 'lent' | 'json_faux';

/** Faux fetch : chaque modèle a un comportement, les autres répondent un JSON valide. */
function fauxFetch(regles: Record<string, Comportement>, appels: string[], bon: string) {
  return (async (url: string, init?: RequestInit) => {
    const cle = modeleVise(url, init);
    appels.push(cle);
    const r = regles[cle];
    if (r === 'lent') {
      return new Promise<Response>((_, rejeter) => {
        init?.signal?.addEventListener('abort', () => rejeter(Object.assign(new Error('abort'), { name: 'AbortError' })));
      });
    }
    if (r === 'json_faux') return repOk(cle, 'pas du json');
    if (r) return new Response(JSON.stringify(r.corps ?? { error: {} }), { status: r.statut, headers: r.entetes });
    return repOk(cle, bon);
  }) as unknown as typeof fetch;
}

const essai = CONSIGNES.essai;
const demandeTexte = essai.demande({})!;
const demandeVision = CONSIGNES.essai_vision.demande({}, { base64: 'AAAA', type: 'image/png' })!;
const BON_TEXTE = '{"pret": true, "mot": "éponge"}';
const BON_VISION = '{"couleur": "bleu"}';

function cas(usage: Usage) {
  return usage === 'texte'
    ? { chaine: CHAINES.texte, demande: demandeTexte, valider: essai.valider, bon: BON_TEXTE }
    : { chaine: CHAINES.vision, demande: demandeVision, valider: CONSIGNES.essai_vision.valider, bon: BON_VISION };
}

describe.each(['texte', 'vision'] as Usage[])('chaîne %s : bascule modèle par modèle', (usage) => {
  const { chaine, demande, valider, bon } = cas(usage);

  it.each(chaine.map((m, i) => [cleModele(m), i] as const))('429 puis 503 sur %s', async (nom, i) => {
    for (const [statut, entetes, pauseS] of [
      [429, { 'Retry-After': '120' }, 120],
      [503, {}, 30],
    ] as const) {
      // Les modèles avant i ne répondent pas non plus, sinon i ne serait jamais essayé.
      const regles: Record<string, Comportement> = {};
      chaine.slice(0, i + 1).forEach((m) => (regles[cleModele(m)] = { statut, entetes }));
      const appels: string[] = [];
      const r = await appelerChaine(chaine, demande, valider, {
        fetch: fauxFetch(regles, appels, bon), cles, pauses: {}, maintenant,
      });

      const p = r.pauses.find((x) => x.modele === nom);
      expect(p?.jusqu_au.getTime()).toBe(T0.getTime() + pauseS * 1000);
      expect(r.essais.find((e) => e.modele === nom)?.issue).toBe(`http_${statut}`);
      if (i < chaine.length - 1) {
        // Le suivant prend le relais.
        expect(r.modele).toBe(cleModele(chaine[i + 1]));
        expect(r.sortie).not.toBeNull();
        expect(r.bascules).toBe(i + 1);
      } else {
        // Dernier modèle en échec : l'appli continue sans IA.
        expect(r.sortie).toBeNull();
        expect(r.modele).toBeNull();
      }
      expect(appels).toEqual(chaine.slice(0, Math.min(i + 2, chaine.length)).map(cleModele));
    }
  });

  it('délai dépassé : pause de 30 s et modèle suivant', async () => {
    const premier = cleModele(chaine[0]);
    const appels: string[] = [];
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: fauxFetch({ [premier]: 'lent' }, appels, bon), cles, pauses: {}, maintenant, delaiMs: 20,
    });
    expect(r.essais[0]).toMatchObject({ modele: premier, issue: 'delai' });
    expect(r.pauses[0]).toEqual({ modele: premier, jusqu_au: new Date(T0.getTime() + 30_000) });
    expect(r.modele).toBe(cleModele(chaine[1]));
  });

  it.each([400, 401])('%i : pas de bascule, arrêt sans erreur', async (statut) => {
    const appels: string[] = [];
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: fauxFetch({ [cleModele(chaine[0])]: { statut } }, appels, bon), cles, pauses: {}, maintenant,
    });
    expect(appels).toHaveLength(1);
    expect(r).toMatchObject({ sortie: null, arret: true, bascules: 0, pauses: [] });
  });

  it('JSON invalide : échec du modèle, suivant essayé, sans pause', async () => {
    const appels: string[] = [];
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: fauxFetch({ [cleModele(chaine[0])]: 'json_faux' }, appels, bon), cles, pauses: {}, maintenant,
    });
    expect(r.essais[0].issue).toBe('json_invalide');
    expect(r.pauses).toEqual([]);
    expect(r.modele).toBe(cleModele(chaine[1]));
  });

  it('modèle en pause sauté, pause échue ignorée', async () => {
    const [a, b] = chaine.map(cleModele);
    const appels: string[] = [];
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: fauxFetch({}, appels, bon), cles, maintenant,
      pauses: { [a]: new Date(T0.getTime() + 1000).toISOString(), [b]: new Date(T0.getTime() - 1000).toISOString() },
    });
    expect(appels).toEqual([b]);
    expect(r.essais[0]).toMatchObject({ modele: a, issue: 'en_pause' });
  });

  it('tout en échec (429 partout) : aucune exception, sortie nulle, chaque modèle en pause', async () => {
    const regles = Object.fromEntries(chaine.map((m) => [cleModele(m), { statut: 429 }]));
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: fauxFetch(regles, [], bon), cles, pauses: {}, maintenant,
    });
    expect(r.sortie).toBeNull();
    expect(r.pauses.map((p) => p.modele)).toEqual(chaine.map(cleModele));
    expect(r.pauses[0].jusqu_au.getTime()).toBe(T0.getTime() + 60_000);
  });

  it('réseau coupé partout : aucune exception', async () => {
    const r = await appelerChaine(chaine, demande, valider, {
      fetch: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch,
      cles, pauses: {}, maintenant,
    });
    expect(r.sortie).toBeNull();
    expect(r.essais.every((e) => e.issue === 'reseau')).toBe(true);
  });
});

describe('délai par modèle', () => {
  it('8 s pour tous les appels, essais compris', () => {
    expect(DELAI_MS).toBe(8000);
  });
});

describe('détails', () => {
  it('sans clé Gemini : on passe directement à Groq', async () => {
    const appels: string[] = [];
    const r = await appelerChaine(CHAINES.texte, demandeTexte, essai.valider, {
      fetch: fauxFetch({}, appels, BON_TEXTE), cles: { groq: 'q' }, pauses: {}, maintenant,
    });
    expect(appels).toEqual(['groq:openai/gpt-oss-120b']);
    expect(r.essais.slice(0, 2).map((e) => e.issue)).toEqual(['sans_cle', 'sans_cle']);
  });

  it('Retry-After en date, puis RetryInfo de Gemini', () => {
    const h = new Headers({ 'Retry-After': new Date(T0.getTime() + 90_000).toUTCString() });
    expect(attenteDemandee(h, null, T0)).toBe(90);
    const corps = { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } };
    expect(attenteDemandee(new Headers(), corps, T0)).toBe(37);
    expect(attenteDemandee(new Headers(), {}, T0)).toBeNull();
  });

  it('les clés ne partent que dans les en-têtes, l’image dans le bon format', async () => {
    const vus: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      vus.push({ url, init });
      return new Response('{}', { status: 503 });
    }) as unknown as typeof fetch;
    await appelerChaine(CHAINES.vision, demandeVision, CONSIGNES.essai_vision.valider, { fetch: f, cles, pauses: {}, maintenant });
    const [gem, , groq] = vus;
    expect(gem.url).not.toContain('key=');
    expect((gem.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g');
    expect(String(gem.init.body)).toContain('"inline_data"');
    expect(String(groq.init.body)).toContain('data:image/png;base64,AAAA');
    expect((groq.init.headers as Record<string, string>).Authorization).toBe('Bearer q');
  });

  it('JSON entouré de ``` accepté ; sortie hors schéma refusée', async () => {
    const m: Modele[] = [CHAINES.texte[2]];
    const ok = await appelerChaine(m, demandeTexte, essai.valider, {
      fetch: fauxFetch({}, [], '```json\n{"pret": true, "mot": "balai"}\n```'), cles, pauses: {}, maintenant,
    });
    expect(ok.sortie).toEqual({ pret: true, mot: 'balai' });
    const ko = await appelerChaine(m, demandeTexte, essai.valider, {
      fetch: fauxFetch({}, [], '{"pret": "oui"}'), cles, pauses: {}, maintenant,
    });
    expect(ko.sortie).toBeNull();
    expect(ko.essais[0].issue).toBe('json_invalide');
  });
});

describe('saisie (IA1) dans la vraie chaîne : un id inventé fait passer au modèle suivant', () => {
  const ctx = preparerContexteSaisie(
    [{ id: 'uuid-sdb', nom: 'Salle de bain' }],
    [{ id: 'uuid-douche', nom: 'Nettoyer la douche', piece_id: 'uuid-sdb' }],
    [{ prenom: 'Laeti' }],
  );
  const demande = CONSIGNES.saisie.demande({ texte: 'on a fait la douche' }, undefined, ctx)!;
  const valider = (v: unknown) => CONSIGNES.saisie.valider(v, ctx);
  const inventee = '{"cartes":[{"type":"cocher","tache":"t42"},{"type":"cocher","tache":"uuid-douche"}]}';
  const bonne = '{"cartes":[{"type":"cocher","tache":"t1","raison":"la douche"}]}';

  it('modèle 1 : ids inventés seulement → rejeté, sans pause ; modèle 2 : carte valable', async () => {
    const appels: string[] = [];
    const premier = cleModele(CHAINES.texte[0]);
    const f = (async (url: string, init?: RequestInit) => {
      const cle = modeleVise(url, init);
      appels.push(cle);
      return repOk(cle, cle === premier ? inventee : bonne);
    }) as unknown as typeof fetch;
    const r = await appelerChaine(CHAINES.texte, demande, valider, { fetch: f, cles, pauses: {}, maintenant });
    expect(appels).toEqual([premier, cleModele(CHAINES.texte[1])]);
    expect(r.essais[0].issue).toBe('json_invalide');
    expect(r.pauses).toEqual([]);
    expect(r.sortie).toEqual({ cartes: [{ type: 'cocher', tache_id: 'uuid-douche', raison: 'la douche' }], rejetees: 0 });
  });

  it('tous les modèles inventent : échec complet, jamais de carte', async () => {
    const f = (async (url: string, init?: RequestInit) => repOk(modeleVise(url, init), inventee)) as unknown as typeof fetch;
    const r = await appelerChaine(CHAINES.texte, demande, valider, { fetch: f, cles, pauses: {}, maintenant });
    expect(r.sortie).toBeNull();
    expect(r.essais.map((e) => e.issue)).toEqual(['json_invalide', 'json_invalide', 'json_invalide']);
  });

  it('la demande envoyée au modèle ne contient ni id ni prénom', async () => {
    let corps = '';
    const f = (async (url: string, init?: RequestInit) => {
      corps = String(init?.body);
      return repOk(modeleVise(url, init), bonne);
    }) as unknown as typeof fetch;
    const d = CONSIGNES.saisie.demande({ texte: 'Laeti a fait la douche' }, undefined, ctx)!;
    await appelerChaine(CHAINES.texte, d, valider, { fetch: f, cles, pauses: {}, maintenant });
    expect(corps).not.toMatch(/uuid-|Laeti/);
    expect(corps).toContain('quelqu’un a fait la douche');
  });
});
