-- =====================================================================
-- IA0 · §9 : quota des appels IA, pause des modèles, journal llm_appel réservé au serveur.
--
-- À lancer APRÈS 2026-11-25_j3_securite.sql. Ne touche à aucune ligne existante.
-- Relançable sans casse.
--
--   1. menage_ia_usage : compteur par foyer et par jour (heure de Paris) + fenêtre d'une minute.
--      Invisible depuis l'API (RLS sans règle, aucun droit pour anon/authenticated).
--   2. menage_ia_pauses : modèle en pause jusqu'à telle heure (après 429 / 503 / délai dépassé),
--      partagé entre toutes les instances de la fonction llm. Invisible depuis l'API.
--   3. menage_ia_reserver(foyer) : réserve un appel en une seule requête verrouillée.
--      100 appels / jour / foyer, 10 / minute / foyer (Q7). Renvoie le statut et les pauses en cours.
--      menage_ia_pause(modele, jusqu_au) : met un modèle en pause.
--      Exécutables par service_role seulement (la fonction llm), jamais par un téléphone.
--   4. menage_journal : un téléphone ne peut ni écrire ni modifier un événement llm_appel
--      (seule la fonction llm l'écrit). Il peut toujours le lire (export CSV).
-- =====================================================================

-- ---------- 1. Compteur ------------------------------------------------------------
create table if not exists menage_ia_usage (
  foyer_id      uuid not null references menage_foyers(id) on delete cascade,
  jour          date not null,
  nb_appels     integer not null default 0,
  minute_debut  timestamptz not null default now(),
  nb_minute     integer not null default 0,
  primary key (foyer_id, jour)
);
alter table menage_ia_usage enable row level security;
revoke all on menage_ia_usage from public, anon, authenticated;

-- ---------- 2. Pauses des modèles ----------------------------------------------------
create table if not exists menage_ia_pauses (
  modele    text primary key,
  jusqu_au  timestamptz not null
);
alter table menage_ia_pauses enable row level security;
revoke all on menage_ia_pauses from public, anon, authenticated;

-- ---------- 3. Fonctions du serveur --------------------------------------------------
create or replace function menage_ia_reserver(p_foyer uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_jour   constant integer := 100;  -- décidé le 25/11
  c_max_minute constant integer := 10;   -- Q7, décidé le 25/11
  v_jour  date := (now() at time zone 'Europe/Paris')::date;
  v_u     menage_ia_usage;
  v_neuve boolean;
begin
  if p_foyer is null then
    return json_build_object('statut', 'sans_foyer');
  end if;

  insert into menage_ia_usage (foyer_id, jour) values (p_foyer, v_jour)
    on conflict (foyer_id, jour) do nothing;
  select * into v_u from menage_ia_usage where foyer_id = p_foyer and jour = v_jour for update;

  if v_u.nb_appels >= c_max_jour then
    return json_build_object('statut', 'quota_jour');
  end if;

  v_neuve := v_u.minute_debut <= now() - interval '1 minute';
  if not v_neuve and v_u.nb_minute >= c_max_minute then
    return json_build_object('statut', 'quota_minute');
  end if;

  update menage_ia_usage
     set nb_appels    = nb_appels + 1,
         minute_debut = case when v_neuve then now() else minute_debut end,
         nb_minute    = case when v_neuve then 1 else nb_minute + 1 end
   where foyer_id = p_foyer and jour = v_jour;

  -- 90 jours de compteurs suffisent.
  delete from menage_ia_usage where jour < v_jour - 90;

  return json_build_object(
    'statut', 'ok',
    'pauses', coalesce((select json_object_agg(modele, jusqu_au)
                          from menage_ia_pauses where jusqu_au > now()), '{}'::json));
end;
$$;

create or replace function menage_ia_pause(p_modele text, p_jusqu_au timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  insert into menage_ia_pauses (modele, jusqu_au) values (p_modele, p_jusqu_au)
  on conflict (modele) do update set jusqu_au = greatest(menage_ia_pauses.jusqu_au, excluded.jusqu_au);
$$;

revoke execute on function menage_ia_reserver(uuid) from public, anon, authenticated;
revoke execute on function menage_ia_pause(text, timestamptz) from public, anon, authenticated;
grant execute on function menage_ia_reserver(uuid) to service_role;
grant execute on function menage_ia_pause(text, timestamptz) to service_role;

-- ---------- 4. llm_appel : écrit par le serveur seulement ----------------------------
-- Règles « restrictives » : elles s'ajoutent à la règle mon_foyer (les deux doivent passer).
drop policy if exists sans_llm_appel     on menage_journal;
drop policy if exists sans_llm_appel_maj on menage_journal;
create policy sans_llm_appel on menage_journal as restrictive for insert to authenticated
  with check (evenement <> 'llm_appel');
create policy sans_llm_appel_maj on menage_journal as restrictive for update to authenticated
  using (evenement <> 'llm_appel') with check (evenement <> 'llm_appel');

notify pgrst, 'reload schema';
