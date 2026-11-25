// Accès à la fonction llm (§9). L'IA est un plus : demanderIA ne lève jamais d'erreur et
// renvoie null dès qu'elle n'a pas de réponse exploitable (réseau, quota, modèles indisponibles).
// L'appli doit toujours avoir un chemin sans IA.

export type RaisonSansIA =
  | 'quota_jour'
  | 'quota_minute'
  | 'indisponible'
  | 'sans_foyer'
  | 'non_connecte'
  | 'reseau'
  | 'inconnue';

export interface ReponseIA<T> {
  sortie: T | null;
  raison?: RaisonSansIA;
}

/** Ce qu'il faut pour appeler la fonction : le client Supabase suffit (son jeton part tout seul). */
export interface AppelFonctions {
  functions: {
    invoke: (nom: string, options: { body: Record<string, unknown> }) => Promise<{ data: unknown; error: unknown }>;
  };
}

const RAISONS: RaisonSansIA[] = ['quota_jour', 'quota_minute', 'indisponible', 'sans_foyer', 'non_connecte'];

/** Délai côté téléphone : la chaîne serveur prend au plus 3 × 8 s. */
export const DELAI_IA_MS = 30_000;
/** Essai depuis Réglages : la fonction accepte jusqu'à 25 s par modèle en session de test. */
export const DELAI_ESSAI_MS = 90_000;

export async function demanderIA<T>(
  client: AppelFonctions,
  consigne: string,
  donnees: unknown = {},
  options: { image?: { base64: string; type: string }; test?: boolean; delaiMs?: number } = {},
): Promise<ReponseIA<T>> {
  const corps: Record<string, unknown> = { consigne, donnees };
  if (options.image) corps.image = options.image;
  if (options.test) corps.test = true;
  try {
    const appel = client.functions.invoke('llm', { body: corps });
    const delai = new Promise<'delai'>((ok) => setTimeout(() => ok('delai'), options.delaiMs ?? DELAI_IA_MS));
    const r = await Promise.race([appel, delai]);
    if (r === 'delai') return { sortie: null, raison: 'reseau' };
    const d = r.data as { ok?: boolean; sortie?: T; raison?: string } | null;
    if (d?.ok === true && d.sortie !== undefined) return { sortie: d.sortie };
    const raison = RAISONS.find((x) => x === d?.raison);
    if (raison) return { sortie: null, raison };
    return { sortie: null, raison: r.error ? 'reseau' : 'inconnue' };
  } catch {
    return { sortie: null, raison: 'reseau' };
  }
}
