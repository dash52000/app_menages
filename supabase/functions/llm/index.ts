// Edge Function llm (§9 IA0) : un seul point d'entrée vers les modèles, côté serveur.
//
// Appel (POST, avec le jeton de la session anonyme, envoyé par supabase.functions.invoke) :
//   { "consigne": "essai", "donnees": {...}, "image": { "base64": "...", "type": "image/jpeg" } }
// Réponse (toujours 200 quand la demande est bien formée, pour que l'appli continue sans IA) :
//   { "ok": true, "sortie": {...} }  ou  { "ok": false, "raison": "quota_jour" | "quota_minute" | "indisponible" }
//
// Sécurité :
// - verify_jwt = true : la passerelle refuse tout appel sans jeton valide ;
// - le foyer et le profil viennent de menage_membres lu AVEC le jeton de l'appelant (RLS « moi »),
//   jamais du corps de la requête ; pas de foyer → 403 ;
// - quota, pauses et journal llm_appel s'écrivent avec la clé service_role, fournie d'office à la
//   fonction, jamais au téléphone ; le journal ne contient aucun contenu (ni consigne remplie, ni réponse) ;
// - clés Gemini et Groq : secrets Supabase MENAGE_GEMINI_API_KEY et MENAGE_GROQ_API_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { appelerChaine, CHAINES, delaiAppel } from './chaine.ts';
import { CONSIGNES, IMAGE_MAX_BASE64, TYPES_IMAGE } from './consignes.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CLE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse(405, { ok: false, raison: 'methode' });

  // ---------- Qui appelle ? ----------
  const jeton = req.headers.get('Authorization') ?? '';
  const appelant = createClient(URL_SUPABASE, CLE_ANON, {
    global: { headers: { Authorization: jeton } },
    auth: { persistSession: false },
  });
  const { data: membre, error: errMembre } = await appelant
    .from('menage_membres')
    .select('foyer_id, profil_id')
    .maybeSingle();
  if (errMembre) return reponse(401, { ok: false, raison: 'non_connecte' });
  if (!membre?.foyer_id) return reponse(403, { ok: false, raison: 'sans_foyer' });

  // ---------- Demande bien formée ? ----------
  let corps: any;
  try {
    corps = await req.json();
  } catch {
    return reponse(400, { ok: false, raison: 'requete' });
  }
  const consigne = typeof corps?.consigne === 'string' ? CONSIGNES[corps.consigne] : undefined;
  if (!consigne) return reponse(400, { ok: false, raison: 'consigne_inconnue' });
  let image: { base64: string; type: string } | undefined;
  if (corps.image !== undefined) {
    const b = corps.image?.base64, t = corps.image?.type;
    if (consigne.usage !== 'vision' || typeof b !== 'string' || b.length > IMAGE_MAX_BASE64 || !TYPES_IMAGE.includes(t)) {
      return reponse(400, { ok: false, raison: 'image' });
    }
    image = { base64: b, type: t };
  }
  const demande = consigne.demande(corps.donnees, image);
  if (!demande) return reponse(400, { ok: false, raison: 'donnees' });

  // ---------- Quota (réservé avant l'appel, en une requête verrouillée) ----------
  const serveur = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });
  const { data: resa, error: errResa } = await serveur.rpc('menage_ia_reserver', { p_foyer: membre.foyer_id });
  if (errResa || !resa) return reponse(200, { ok: false, raison: 'indisponible' });
  if (resa.statut !== 'ok') return reponse(200, { ok: false, raison: resa.statut });

  // ---------- Chaîne de modèles ----------
  const debut = Date.now();
  const r = await appelerChaine(CHAINES[consigne.usage], demande, consigne.valider, {
    fetch,
    cles: {
      gemini: Deno.env.get('MENAGE_GEMINI_API_KEY') ?? undefined,
      groq: Deno.env.get('MENAGE_GROQ_API_KEY') ?? undefined,
    },
    pauses: resa.pauses ?? {},
    delaiMs: delaiAppel(corps?.test === true),
  });
  const latence = Date.now() - debut;

  // ---------- Pauses et journal (sans contenu) ----------
  await Promise.all([
    ...r.pauses.map((p) =>
      serveur.rpc('menage_ia_pause', { p_modele: p.modele, p_jusqu_au: p.jusqu_au.toISOString() }),
    ),
    serveur.from('menage_journal').insert({
      foyer_id: membre.foyer_id,
      profil_id: membre.profil_id,
      evenement: 'llm_appel',
      details: {
        consigne: corps.consigne,
        usage: consigne.usage,
        modele: r.modele,
        succes: r.sortie !== null,
        latence_ms: latence,
        bascules: r.bascules,
        essais: r.essais,
        ...(r.arret ? { arret: true } : {}),
        ...(corps?.test === true ? { test: true } : {}),
      },
    }),
  ]);

  if (r.sortie === null) return reponse(200, { ok: false, raison: 'indisponible' });
  return reponse(200, { ok: true, sortie: r.sortie });
});
