-- =====================================================================
-- J3 · §8 Sécurité : code du foyer et règles d'accès.
--
-- À lancer APRÈS supabase/schema.sql (V1.9) et APRÈS le déploiement de l'appli 1.11.0
-- (l'écran d'arrivée 1.11 comprend la nouvelle réponse { erreur } de ces fonctions).
-- Ne touche à aucune ligne de données existante : nouvelle table, fonctions, règles, index.
-- Relançable sans casse.
--
--   1. menage_tentatives : trace des essais de code et des créations de foyer (jamais le
--      code tapé). Invisible depuis l'API (RLS sans règle, aucun droit pour anon/authenticated).
--   2. menage_rejoindre_foyer : 5 codes faux par téléphone en 15 min, 30 codes faux en 1 h
--      pour tout le projet ; au-delà, réponse « trop_essais ». L'échec renvoie { erreur }
--      au lieu d'une exception, sinon l'annulation effacerait la trace de l'essai.
--   3. menage_creer_foyer : code tiré avec gen_random_bytes (aléa cryptographique, sans
--      biais) au lieu de random() ; 3 créations par téléphone et 20 pour tout le projet en 24 h.
--   4. Règles RLS : (select …) autour de auth.uid() et menage_mon_foyer() (évalués une fois
--      par requête, pas une fois par ligne) ; aucun droit de table pour le rôle anon.
--   5. Index manquants sur les clés étrangères utiles (membres, pièces).
-- =====================================================================

-- ---------- 1. Trace des essais ------------------------------------------------
create table if not exists menage_tentatives (
  id       bigint generated always as identity primary key,
  user_id  uuid not null,
  action   text not null check (action in ('rejoindre', 'creer')),
  ok       boolean not null,
  cree_le  timestamptz not null default now()
);
create index if not exists menage_tentatives_action on menage_tentatives (action, ok, cree_le);
create index if not exists menage_tentatives_user on menage_tentatives (user_id, action, cree_le);
alter table menage_tentatives enable row level security;
revoke all on menage_tentatives from public, anon, authenticated;

-- ---------- 2. Rejoindre un foyer (limité) ---------------------------------------
create or replace function menage_rejoindre_foyer(p_code text, p_prenom text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couleurs text[] := array['#3B82F6', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6'];
  v_uid      uuid := auth.uid();
  v_code     text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_foyer    uuid;
  v_profil   uuid;
  v_nb       integer;
begin
  if v_uid is null then
    raise exception 'non_connecte';
  end if;
  if coalesce(trim(p_prenom), '') = '' then
    raise exception 'prenom_manquant';
  end if;

  -- Ménage de la trace (30 jours suffisent).
  delete from menage_tentatives where cree_le < now() - interval '30 days';

  if (select count(*) from menage_tentatives
       where user_id = v_uid and action = 'rejoindre' and not ok
         and cree_le > now() - interval '15 minutes') >= 5
     or (select count(*) from menage_tentatives
       where action = 'rejoindre' and not ok
         and cree_le > now() - interval '1 hour') >= 30 then
    return json_build_object('erreur', 'trop_essais');
  end if;

  if length(v_code) = 6 then
    select id into v_foyer from menage_foyers where code = v_code;
  end if;

  if v_foyer is null then
    insert into menage_tentatives (user_id, action, ok) values (v_uid, 'rejoindre', false);
    return json_build_object('erreur', 'code_inconnu');
  end if;

  insert into menage_tentatives (user_id, action, ok) values (v_uid, 'rejoindre', true);

  select id into v_profil
  from menage_profils
  where foyer_id = v_foyer and lower(prenom) = lower(trim(p_prenom));

  if v_profil is null then
    select count(*) into v_nb from menage_profils where foyer_id = v_foyer;
    insert into menage_profils (foyer_id, prenom, couleur)
      values (v_foyer, trim(p_prenom), v_couleurs[1 + (v_nb % array_length(v_couleurs, 1))])
      returning id into v_profil;
  end if;

  insert into menage_membres (user_id, foyer_id, profil_id)
    values (v_uid, v_foyer, v_profil)
    on conflict (user_id) do update set foyer_id = excluded.foyer_id, profil_id = excluded.profil_id;

  return json_build_object('foyer_id', v_foyer, 'profil_id', v_profil, 'code', v_code);
end;
$$;

-- ---------- 3. Créer un foyer (code cryptographique, limité) ---------------------
create or replace function menage_creer_foyer(p_prenom text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 signes, sans 0/O, 1/I/L
  v_uid      uuid := auth.uid();
  v_code     text;
  v_octets   bytea;
  v_b        integer;
  v_foyer    uuid;
  v_profil   uuid;
begin
  if v_uid is null then
    raise exception 'non_connecte';
  end if;
  if coalesce(trim(p_prenom), '') = '' then
    raise exception 'prenom_manquant';
  end if;

  if (select count(*) from menage_tentatives
       where user_id = v_uid and action = 'creer' and cree_le > now() - interval '24 hours') >= 3
     or (select count(*) from menage_tentatives
       where action = 'creer' and cree_le > now() - interval '24 hours') >= 20 then
    return json_build_object('erreur', 'trop_essais');
  end if;

  loop
    v_code := '';
    while length(v_code) < 6 loop
      v_octets := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        v_b := get_byte(v_octets, i);
        -- 248 = 8 × 31 : on écarte 248..255 pour que chaque signe ait la même chance.
        if v_b < 248 and length(v_code) < 6 then
          v_code := v_code || substr(v_alphabet, 1 + (v_b % 31), 1);
        end if;
      end loop;
    end loop;
    exit when not exists (select 1 from menage_foyers where code = v_code);
  end loop;

  insert into menage_tentatives (user_id, action, ok) values (v_uid, 'creer', true);
  insert into menage_foyers (code) values (v_code) returning id into v_foyer;
  insert into menage_profils (foyer_id, prenom, couleur)
    values (v_foyer, trim(p_prenom), '#3B82F6') returning id into v_profil;
  insert into menage_membres (user_id, foyer_id, profil_id)
    values (v_uid, v_foyer, v_profil)
    on conflict (user_id) do update set foyer_id = excluded.foyer_id, profil_id = excluded.profil_id;

  return json_build_object('foyer_id', v_foyer, 'profil_id', v_profil, 'code', v_code);
end;
$$;

revoke execute on function menage_creer_foyer(text) from public, anon;
revoke execute on function menage_rejoindre_foyer(text, text) from public, anon;
grant execute on function menage_creer_foyer(text) to authenticated;
grant execute on function menage_rejoindre_foyer(text, text) to authenticated;

-- ---------- 4. Règles RLS (même logique, évaluation une fois par requête) ----------
drop policy if exists mon_foyer     on menage_foyers;
drop policy if exists mon_foyer_maj on menage_foyers;
create policy mon_foyer on menage_foyers for select to authenticated
  using (id = (select menage_mon_foyer()));
create policy mon_foyer_maj on menage_foyers for update to authenticated
  using (id = (select menage_mon_foyer())) with check (id = (select menage_mon_foyer()));

drop policy if exists mon_foyer     on menage_profils;
drop policy if exists mon_foyer_maj on menage_profils;
create policy mon_foyer on menage_profils for select to authenticated
  using (foyer_id = (select menage_mon_foyer()));
create policy mon_foyer_maj on menage_profils for update to authenticated
  using (foyer_id = (select menage_mon_foyer())) with check (foyer_id = (select menage_mon_foyer()));

drop policy if exists moi on menage_membres;
create policy moi on menage_membres for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['menage_pieces', 'menage_taches', 'menage_historique', 'menage_journal', 'menage_produits'] loop
    execute format('drop policy if exists mon_foyer on %I', t);
    execute format(
      'create policy mon_foyer on %I for all to authenticated using (foyer_id = (select menage_mon_foyer())) with check (foyer_id = (select menage_mon_foyer()))',
      t);
  end loop;
end;
$$;

-- Le rôle anon (avant connexion anonyme) n'a rien à lire ni écrire dans menage_*.
-- Les téléphones connectés en anonyme ont le rôle authenticated : rien ne change pour eux.
revoke all on
  menage_foyers, menage_profils, menage_membres, menage_pieces,
  menage_taches, menage_historique, menage_journal, menage_produits
from anon;

-- ---------- 5. Index ---------------------------------------------------------------
create index if not exists menage_membres_foyer  on menage_membres (foyer_id);
create index if not exists menage_membres_profil on menage_membres (profil_id);
create index if not exists menage_pieces_foyer   on menage_pieces (foyer_id);

notify pgrst, 'reload schema';
