// Chaîne de modèles de la fonction llm (§9 IA0). Logique pure, sans Deno ni Supabase :
// testée dans chaine.test.ts avec un faux fetch.
//
// Règles :
// - un seul essai par modèle ;
// - 429 (en lisant Retry-After), 5xx (dont 503), délai dépassé (8 s) ou réseau coupé :
//   le modèle passe en pause et on essaie le suivant ;
// - réponse illisible ou JSON refusé par le validateur : échec de ce modèle, on essaie le suivant
//   (sans pause : le modèle répond, il s'est juste trompé) ;
// - 400, 401, 403, 404 : on s'arrête (bug ou réglage de notre côté, basculer ne servirait à rien) ;
// - modèle en pause ou sans clé : sauté.

export type Fournisseur = 'gemini' | 'groq';
export type Usage = 'texte' | 'vision';

export interface Modele {
  fournisseur: Fournisseur;
  nom: string;
}

/** Ordre d'essai, choisi le 25/11/2026 d'après les docs Gemini et Groq du jour. */
export const CHAINES: Record<Usage, Modele[]> = {
  texte: [
    { fournisseur: 'gemini', nom: 'gemini-3.5-flash-lite' },
    { fournisseur: 'gemini', nom: 'gemini-3.1-flash-lite' },
    { fournisseur: 'groq', nom: 'openai/gpt-oss-120b' },
  ],
  vision: [
    { fournisseur: 'gemini', nom: 'gemini-3.5-flash-lite' },
    { fournisseur: 'gemini', nom: 'gemini-3.1-flash-lite' },
    { fournisseur: 'groq', nom: 'qwen/qwen3.8-27b' }, // seul modèle vision de Groq, en préversion
  ],
};

export const DELAI_MS = 8000;
const PAUSE_429_DEFAUT_S = 60;
const PAUSE_5XX_DEFAUT_S = 30;
const PAUSE_DELAI_S = 30;
const PAUSE_MAX_S = 24 * 3600;

export interface Demande {
  systeme: string;
  texte: string;
  /** Image en base64 (sans préfixe data:), chaîne vision seulement. */
  image?: { base64: string; type: string };
}

export type Issue =
  | 'ok'
  | 'en_pause'
  | 'sans_cle'
  | 'delai'
  | 'reseau'
  | 'json_invalide'
  | `http_${number}`;

export interface Essai {
  modele: string;
  issue: Issue;
  ms: number;
}

export interface Resultat<T> {
  sortie: T | null;
  modele: string | null;
  essais: Essai[];
  /** Nombre de fois où l'on est passé au modèle suivant après un échec. */
  bascules: number;
  /** Pauses à enregistrer (modèle → fin de pause). */
  pauses: { modele: string; jusqu_au: Date }[];
  /** Vrai si la chaîne s'est arrêtée sur une erreur de notre côté (400/401/403/404). */
  arret: boolean;
}

export interface Contexte {
  fetch: typeof fetch;
  cles: Partial<Record<Fournisseur, string>>;
  /** Modèles en pause (nom → fin de pause), lus en base. */
  pauses: Record<string, string | Date>;
  maintenant?: () => Date;
  delaiMs?: number;
}

export function cleModele(m: Modele): string {
  return `${m.fournisseur}:${m.nom}`;
}

// ---------- Appels aux fournisseurs ----------------------------------------------------

function requeteGemini(m: Modele, d: Demande, cle: string): [string, RequestInit] {
  const parts: unknown[] = [{ text: d.texte }];
  if (d.image) parts.push({ inline_data: { mime_type: d.image.type, data: d.image.base64 } });
  return [
    `https://generativelanguage.googleapis.com/v1beta/models/${m.nom}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: d.systeme }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    },
  ];
}

function requeteGroq(m: Modele, d: Demande, cle: string): [string, RequestInit] {
  const contenu = d.image
    ? [
        { type: 'text', text: d.texte },
        { type: 'image_url', image_url: { url: `data:${d.image.type};base64,${d.image.base64}` } },
      ]
    : d.texte;
  const corps: Record<string, unknown> = {
    model: m.nom,
    messages: [
      { role: 'system', content: d.systeme },
      { role: 'user', content: contenu },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };
  if (m.nom.startsWith('openai/gpt-oss')) corps.reasoning_effort = 'low';
  return [
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
      body: JSON.stringify(corps),
    },
  ];
}

/** Texte renvoyé par le modèle, ou null si la réponse n'a pas la forme attendue. */
export function texteReponse(f: Fournisseur, corps: unknown): string | null {
  try {
    const c = corps as any;
    const t =
      f === 'gemini'
        ? (c.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('')
        : c.choices?.[0]?.message?.content;
    return typeof t === 'string' && t.trim() ? t : null;
  } catch {
    return null;
  }
}

/** Lit un JSON, en tolérant une clôture ```json … ``` autour. */
export function lireJson(t: string): unknown {
  const nu = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(nu);
  } catch {
    return undefined;
  }
}

// ---------- Durée de pause --------------------------------------------------------------

/** Secondes d'attente demandées : en-tête Retry-After (secondes ou date), sinon RetryInfo de Gemini. */
export function attenteDemandee(entetes: Headers, corps: unknown, maintenant: Date): number | null {
  const ra = entetes.get('retry-after');
  if (ra) {
    const s = Number(ra);
    if (Number.isFinite(s) && s >= 0) return s;
    const date = Date.parse(ra);
    if (!Number.isNaN(date)) return Math.max(0, (date - maintenant.getTime()) / 1000);
  }
  try {
    const details = (corps as any)?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        const m = typeof d?.retryDelay === 'string' && d.retryDelay.match(/^([\d.]+)s$/);
        if (m) return Number(m[1]);
      }
    }
  } catch {
    /* rien */
  }
  return null;
}

function finDePause(maintenant: Date, secondes: number): Date {
  const s = Math.min(Math.max(secondes, 1), PAUSE_MAX_S);
  return new Date(maintenant.getTime() + s * 1000);
}

// ---------- Chaîne -----------------------------------------------------------------------

export async function appelerChaine<T>(
  chaine: Modele[],
  demande: Demande,
  valider: (v: unknown) => T | null,
  ctx: Contexte,
): Promise<Resultat<T>> {
  const maintenant = ctx.maintenant ?? (() => new Date());
  const delai = ctx.delaiMs ?? DELAI_MS;
  const r: Resultat<T> = { sortie: null, modele: null, essais: [], bascules: 0, pauses: [], arret: false };

  for (const m of chaine) {
    const nom = cleModele(m);
    const pause = ctx.pauses[nom];
    if (pause && new Date(pause).getTime() > maintenant().getTime()) {
      r.essais.push({ modele: nom, issue: 'en_pause', ms: 0 });
      continue;
    }
    const cle = ctx.cles[m.fournisseur];
    if (!cle) {
      r.essais.push({ modele: nom, issue: 'sans_cle', ms: 0 });
      continue;
    }

    const debut = maintenant().getTime();
    const [url, init] = m.fournisseur === 'gemini' ? requeteGemini(m, demande, cle) : requeteGroq(m, demande, cle);
    const ac = new AbortController();
    const minuteur = setTimeout(() => ac.abort(), delai);
    let issue: Issue;
    try {
      const rep = await ctx.fetch(url, { ...init, signal: ac.signal });
      const corps = await rep.json().catch(() => null);
      if (rep.ok) {
        const t = texteReponse(m.fournisseur, corps);
        const v = t === null ? undefined : lireJson(t);
        const sortie = v === undefined ? null : valider(v);
        if (sortie !== null) {
          r.essais.push({ modele: nom, issue: 'ok', ms: maintenant().getTime() - debut });
          r.sortie = sortie;
          r.modele = nom;
          return r;
        }
        issue = 'json_invalide';
      } else {
        issue = `http_${rep.status}`;
        if (rep.status === 429 || rep.status >= 500) {
          const attente = attenteDemandee(rep.headers, corps, maintenant());
          const defaut = rep.status === 429 ? PAUSE_429_DEFAUT_S : PAUSE_5XX_DEFAUT_S;
          r.pauses.push({ modele: nom, jusqu_au: finDePause(maintenant(), attente ?? defaut) });
        }
      }
    } catch (e) {
      const avorte = ac.signal.aborted || (e as Error)?.name === 'AbortError';
      issue = avorte ? 'delai' : 'reseau';
      r.pauses.push({ modele: nom, jusqu_au: finDePause(maintenant(), PAUSE_DELAI_S) });
    } finally {
      clearTimeout(minuteur);
    }

    r.essais.push({ modele: nom, issue, ms: maintenant().getTime() - debut });
    if (issue === 'http_400' || issue === 'http_401' || issue === 'http_403' || issue === 'http_404') {
      r.arret = true;
      return r;
    }
    r.bascules++;
  }
  // Tous les modèles ont échoué : la dernière « bascule » ne mène nulle part.
  if (r.bascules > 0 && r.sortie === null) r.bascules--;
  return r;
}
