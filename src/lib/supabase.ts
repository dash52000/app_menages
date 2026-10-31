import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config.ts';
import { creerClientFactice } from '../dev/mock.ts';

// VITE_MOCK=1 : base factice en mémoire, pour développer sans réseau.
const factice = import.meta.env.VITE_MOCK === '1';

export const supabase: SupabaseClient = factice
  ? (creerClientFactice() as SupabaseClient)
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Identité anonyme gardée sur le téléphone : pas de compte, pas de mot de passe.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'coupdefrais.auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });

/** Erreur réseau (pas de connexion), par opposition à un refus de la base. */
export function estErreurReseau(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const m = String((e as { message?: string } | null)?.message ?? e ?? '');
  return /fetch|network|load failed|connexion|timeout/i.test(m);
}
