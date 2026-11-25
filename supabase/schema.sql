-- =====================================================================
-- Coup de frais (appli ménage) — schéma Supabase V1.11 (J3 : sécurité)
--
-- Installation : Supabase > SQL Editor > New query, coller ce fichier, « Run ».
-- Le script peut être relancé sans casse (il ne supprime rien) : pour passer
-- d'une version à la suivante, il suffit de le coller et de le lancer à nouveau.
--
-- Toutes les tables sont préfixées menage_ : elles cohabitent sans risque
-- avec celles de Panier dans le même projet Supabase.
--
-- Sécurité : chaque téléphone a une identité anonyme Supabase (aucun compte),
-- rattachée à un foyer par son code. Chaque ligne porte foyer_id et les règles
-- RLS ne laissent voir que les lignes de son propre foyer.
-- Prérequis : Authentication > Sign In / Providers > « Allow anonymous sign-ins ».
-- =====================================================================

-- ---------- Foyers, profils, membres ------------------------------------
create table if not exists menage_foyers (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,         -- 6 caractères, à taper une fois par téléphone
  dernier_check date,                         -- dernier check terminé (rattrapage, rappel V2)
  cree_le       timestamptz not null default now()
);

create table if not exists menage_profils (
  id       uuid primary key default gen_random_uuid(),
  foyer_id uuid not null references menage_foyers(id) on delete cascade,
  prenom   text not null,
  couleur  text not null,
  cree_le  timestamptz not null default now()
);

create unique index if not exists menage_profils_prenom on menage_profils (foyer_id, lower(prenom));

-- Un téléphone (identité anonyme) = un membre, rattaché à un profil.
-- Si un téléphone perd sa session, il rejoint avec le même code et le même
-- prénom : il retrouve son profil et son historique.
create table if not exists menage_membres (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  foyer_id  uuid not null references menage_foyers(id) on delete cascade,
  profil_id uuid not null references menage_profils(id) on delete cascade,
  cree_le   timestamptz not null default now()
);

-- ---------- Pièces et tâches ----------------------------------------------
create table if not exists menage_pieces (
  id       uuid primary key default gen_random_uuid(),
  foyer_id uuid not null references menage_foyers(id) on delete cascade,
  nom      text not null,
  icone    text not null,
  ordre    integer not null default 0,
  cree_le  timestamptz not null default now()
);

create table if not exists menage_taches (
  id              uuid primary key default gen_random_uuid(),
  foyer_id        uuid not null references menage_foyers(id) on delete cascade,
  piece_id        uuid not null references menage_pieces(id) on delete cascade,
  nom             text not null,
  icone           text not null,
  rythme_jours    integer not null check (rythme_jours between 1 and 730),
  duree_min       integer not null check (duree_min between 1 and 480),
  derniere_fois   date,                                              -- dernière fois faite
  derniere_par    uuid references menage_profils(id) on delete set null,
  reporte_le      date,                                              -- bouton « Demain »
  reporte_jusqu_au date,
  reserve_par     uuid references menage_profils(id) on delete set null,  -- bouton « Je prends »
  reserve_le      date,
  cree_le         timestamptz not null default now()
);

-- V1.6 : une pièce peut être mise à l'arrêt (poêle hors saison).
alter table menage_pieces add column if not exists en_pause_depuis date;

create index if not exists menage_taches_foyer on menage_taches (foyer_id);
create index if not exists menage_taches_piece on menage_taches (piece_id);

-- V1.5 : fiche « comment faire », consignes perso, produits choisis à la main.
alter table menage_taches add column if not exists fiche text;      -- clé de la fiche du catalogue
alter table menage_taches add column if not exists note text;       -- « Mes consignes »
alter table menage_taches add column if not exists produits text[]; -- null = ceux de la fiche

-- V1.8 : clé stable de la fiche « comment faire » (catalogue). Renommer une tâche ne casse
-- plus sa fiche. L'ancienne colonne `fiche` reste en place (compatible avec l'appli déjà
-- installée) ; l'appli lit fiche_id d'abord. Rempli par supabase/migrations/2026-11-25_j0_donnees_propres.sql.
alter table menage_taches add column if not exists fiche_id text;

-- V1.9 : `quick` (tâche proposée par « J'ai 1 min », séparé de la durée ; null = on se fie à
-- la durée), `refusee_le` (« Autre proposition » : pas reproposée avant 48 h) et
-- `fond_propose_le` (rotation des tâches de fond). Rien n'est rempli automatiquement :
-- l'appli fonctionne comme avant tant que ces colonnes sont vides.
alter table menage_taches add column if not exists quick boolean;
alter table menage_taches add column if not exists refusee_le timestamptz;
alter table menage_taches add column if not exists fond_propose_le date;

-- ---------- Placard : produits ménagers à disposition (V1.5) -------------------
create table if not exists menage_produits (
  id            uuid primary key default gen_random_uuid(),
  foyer_id      uuid not null references menage_foyers(id) on delete cascade,
  cle           text,                          -- clé du catalogue, null pour un produit maison
  nom           text not null,
  icone         text not null,
  etat          text not null default 'ok' check (etat in ('ok', 'bas', 'vide')),
  indispensable boolean not null default false,
  courses_le    timestamptz,                   -- ajouté à la liste de Panier
  maj_par       uuid references menage_profils(id) on delete set null,
  maj_le        timestamptz not null default now(),
  cree_le       timestamptz not null default now()
);

create unique index if not exists menage_produits_cle on menage_produits (foyer_id, cle) where cle is not null;
create index if not exists menage_produits_foyer on menage_produits (foyer_id);

-- ---------- Historique : une ligne par tâche faite ----------------------------
create table if not exists menage_historique (
  id        uuid primary key default gen_random_uuid(),
  foyer_id  uuid not null references menage_foyers(id) on delete cascade,
  tache_id  uuid references menage_taches(id) on delete set null,
  tache_nom text not null,                 -- copie : l'historique survit à la suppression
  piece_nom text,
  profil_id uuid references menage_profils(id) on delete set null,
  fait_le   date not null,
  cree_le   timestamptz not null default now()
);

create index if not exists menage_historique_foyer on menage_historique (foyer_id, fait_le);

-- ---------- Journal d'utilisation ---------------------------------------------
-- Un événement par usage (ouverture, check, bouton, écran consulté, réglage…),
-- pour décider des mises à jour sur des faits. Rien ne sort de la base.
create table if not exists menage_journal (
  id        bigint generated always as identity primary key,
  foyer_id  uuid not null references menage_foyers(id) on delete cascade,
  profil_id uuid references menage_profils(id) on delete set null,
  evenement text not null,
  tache_id  uuid,
  details   jsonb not null default '{}'::jsonb,
  cree_le   timestamptz not null default now()
);

create index if not exists menage_journal_foyer on menage_journal (foyer_id, cree_le);

-- ---------- Foyer de l'utilisateur courant --------------------------------------
create or replace function menage_mon_foyer()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select foyer_id from menage_membres where user_id = auth.uid()
$$;

-- ---------- Trace des essais de code et des créations (J3, invisible depuis l'API) ------------------------------------------------
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

-- ---------- Créer un foyer (code cryptographique, limité — J3) ---------------------
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

-- ---------- Rejoindre un foyer (limité — J3) ---------------------------------------
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

revoke execute on function menage_mon_foyer() from public, anon;
revoke execute on function menage_creer_foyer(text) from public, anon;
revoke execute on function menage_rejoindre_foyer(text, text) from public, anon;
grant execute on function menage_mon_foyer() to authenticated;
grant execute on function menage_creer_foyer(text) to authenticated;
grant execute on function menage_rejoindre_foyer(text, text) to authenticated;

-- ---------- Règles d'accès (RLS) : chacun ne voit que son foyer ----------------------
alter table menage_foyers     enable row level security;
alter table menage_profils    enable row level security;
alter table menage_membres    enable row level security;
alter table menage_pieces     enable row level security;
alter table menage_taches     enable row level security;
alter table menage_historique enable row level security;
alter table menage_journal    enable row level security;
alter table menage_produits   enable row level security;

-- J3 : règles recréées à chaque passage ; (select …) = évalué une fois par requête.
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


-- ---------- Temps réel : ce que l'un fait apparaît chez l'autre ---------------------
do $$
declare
  t text;
begin
  foreach t in array array['menage_foyers', 'menage_profils', 'menage_pieces', 'menage_taches', 'menage_produits'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end;
$$;

-- ---------- Droits d'accès explicites (au cas où le projet n'expose pas les nouvelles tables) ----
grant select, insert, update, delete on
  menage_foyers, menage_profils, menage_membres, menage_pieces,
  menage_taches, menage_historique, menage_journal, menage_produits
to authenticated;

-- ---------- Index (J3) ---------------------------------------------------------------
create index if not exists menage_membres_foyer  on menage_membres (foyer_id);
create index if not exists menage_membres_profil on menage_membres (profil_id);
create index if not exists menage_pieces_foyer   on menage_pieces (foyer_id);

-- ---------- Fait voir tout de suite les nouvelles tables et colonnes à l'API ----------------
notify pgrst, 'reload schema';

-- ---------- Vérification : les six colonnes doivent afficher « true » -----------------------
select
  to_regclass('public.menage_produits') is not null as placard_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_taches' and column_name = 'fiche'
  ) as fiches_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_pieces' and column_name = 'en_pause_depuis'
  ) as poele_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_taches' and column_name = 'fiche_id'
  ) as v18_ok,
  (
    select count(*) = 3 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_taches'
      and column_name in ('quick', 'refusee_le', 'fond_propose_le')
  ) as v19_ok,
  to_regclass('public.menage_tentatives') is not null as securite_j3_ok;
