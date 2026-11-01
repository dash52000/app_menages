// Connexion au projet Supabase (le même que Panier : les tables de cette appli
// sont préfixées menage_ et protégées par foyer, cf. supabase/schema.sql).
// La clé « anon » est publique par nature : elle peut figurer ici.
// Ne jamais mettre la clé « service_role / secret » dans ce fichier.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://iolmjlqcvipzsihvrxlj.supabase.co';

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbG1qbHFjdmlwenNpaHZyeGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNDgzNDMsImV4cCI6MjEwODcyNDM0M30.WVYQtlX69QpBYjsIUnH2srL0bSpavVM3dO9pH6mAv0I';

/** Nom provisoire de l'appli : à changer ici, dans index.html et vite.config.ts. */
export const NOM_APPLI = 'Coup de frais';

export const VERSION = '1.5.0';
