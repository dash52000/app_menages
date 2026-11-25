-- =====================================================================
-- J0 · F4 « Données propres » : migration UNIQUE (SPEC.md, §7)
--
-- À lancer une seule fois, dans cet ordre :
--   1. Réglages > « Sauvegarde complète (JSON) » (copie sur ton téléphone) ;
--   2. supabase/schema.sql (V1.8) : ajoute la colonne menage_taches.fiche_id ;
--   3. ce fichier : Supabase > SQL Editor > New query > coller > Run.
--
-- Ce que fait la migration (par foyer) :
--   a. copie de sécurité des tables dans le schéma menage_sauvegarde (hors API) ;
--   b. fusion de « Lancer une lessive » (Buanderie et Partout) : on garde celle de la
--      Buanderie, l'historique de l'autre y est rattaché ;
--   c. fusion de « Nettoyer le plan de travail » et « Coup d'éponge sur le plan » :
--      on garde « Nettoyer le plan de travail » (la plus utilisée, avec sa fiche) ;
--   d. « Aspirer la salade de bain » devient « Aspirer la salle de bain » ;
--   e. fiche_id rempli pour chaque tâche qui a une fiche au catalogue ;
--   f. produits des tâches : clés de catalogue remplacées par des ids de produits.
--
-- Garde-fous : si le nombre de lignes d'historique change, ou si une tâche garde une
-- clé de produit sans produit correspondant au placard, tout est annulé (rien n'est
-- écrit). Chaque fusion laisse un événement « fusion_taches » dans le journal.
-- Les durées et le champ « Quick » (F5) ne sont PAS touchés ici.
-- =====================================================================

begin;

-- 0. Le schéma V1.8 doit être passé.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_taches' and column_name = 'fiche_id'
  ) then
    raise exception 'Colle et lance d''abord supabase/schema.sql (V1.8) : la colonne menage_taches.fiche_id manque.';
  end if;
end;
$$;

-- 1. Copies de sécurité (créées une seule fois : un second passage ne les écrase pas).
create schema if not exists menage_sauvegarde;
create table if not exists menage_sauvegarde.pieces_20261125     as select * from public.menage_pieces;
create table if not exists menage_sauvegarde.taches_20261125     as select * from public.menage_taches;
create table if not exists menage_sauvegarde.produits_20261125   as select * from public.menage_produits;
create table if not exists menage_sauvegarde.historique_20261125 as select * from public.menage_historique;
create table if not exists menage_sauvegarde.journal_20261125    as select * from public.menage_journal;
alter table menage_sauvegarde.pieces_20261125     enable row level security;
alter table menage_sauvegarde.taches_20261125     enable row level security;
alter table menage_sauvegarde.produits_20261125   enable row level security;
alter table menage_sauvegarde.historique_20261125 enable row level security;
alter table menage_sauvegarde.journal_20261125    enable row level security;

-- 2. Outils temporaires (disparaissent à la fin de la session).

-- Même normalisation que src/lib/normalise.ts (accents, pluriels, ponctuation).
create or replace function pg_temp.norm(t text) returns text language sql immutable as $$
  select coalesce(string_agg(case when length(w.m) > 3 and w.m ~ '[sx]$' and w.m !~ 'ss$' then left(w.m, -1) else w.m end, ' ' order by w.n), '')
  from regexp_split_to_table(
    regexp_replace(
      translate(replace(replace(lower(t), 'œ', 'oe'), 'æ', 'ae'), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9 ]+', ' ', 'g'),
    '\s+') with ordinality as w(m, n)
  where w.m <> ''
$$;

-- Fusionne la tâche p_supprime dans p_garde : l'historique et le journal suivent, rien n'est perdu.
create or replace function pg_temp.fusionner(p_garde uuid, p_supprime uuid) returns void language plpgsql as $$
declare
  g          menage_taches%rowtype;
  s          menage_taches%rowtype;
  piece_g    text;
  piece_s    text;
  nb_hist    integer;
begin
  select * into g from menage_taches where id = p_garde;
  select * into s from menage_taches where id = p_supprime;
  select nom into piece_g from menage_pieces where id = g.piece_id;
  select nom into piece_s from menage_pieces where id = s.piece_id;
  select count(*) into nb_hist from menage_historique where tache_id = p_supprime;

  update menage_historique
     set tache_id = p_garde, tache_nom = g.nom, piece_nom = piece_g
   where tache_id = p_supprime;
  update menage_journal set tache_id = p_garde where tache_id = p_supprime;

  -- La « dernière fois » la plus récente des deux l'emporte.
  if s.derniere_fois is not null and (g.derniere_fois is null or s.derniere_fois > g.derniere_fois) then
    update menage_taches set derniere_fois = s.derniere_fois, derniere_par = s.derniere_par where id = p_garde;
  end if;

  delete from menage_taches where id = p_supprime;

  insert into menage_journal (foyer_id, evenement, tache_id, details)
  values (g.foyer_id, 'fusion_taches', p_garde, jsonb_build_object(
    'migration', 'j0-f4', 'gardee', g.nom, 'piece_gardee', piece_g,
    'supprimee', s.nom, 'piece_supprimee', piece_s, 'historique_deplace', nb_hist, 'test', true));
end;
$$;

-- 3. La migration, foyer par foyer, avec comptage avant / après.
do $$
declare
  -- Clés des fiches du catalogue au 25/11/2026 (src/lib/fiches.ts), liste figée pour cette migration.
  cles constant text[] := array[
    'aerer la chambre', 'arroser les plante', 'aspirateur', 'aspirer le canape', 'balayer', 'bouche de vmc',
    'cendrier et aspiration', 'changer les drap', 'changer les serviette', 'coup d eponge sur le plan', 'coup de brosse',
    'coup de chiffon sur le miroir', 'degivrer le congelateur', 'detartrer la bouilloire', 'detartrer robinet et pommeau',
    'douche ou baignoire', 'entretien annuel par un pro', 'essuyer la facade du frigo', 'essuyer le robinet', 'faire le lit',
    'filtre du seche linge', 'hotte et filtre', 'interrupteur et poignee', 'lancer une lessive', 'lavabo et miroir',
    'laver couette et oreiller', 'laver le sol', 'micro onde', 'nettoyer l evier', 'nettoyer la vitre', 'nettoyer le four',
    'nettoyer le frigo', 'nettoyer le lave linge', 'nettoyer le mobilier', 'nettoyer le plan de travail', 'nettoyer les plaque',
    'nettoyer les toilette', 'plier et ranger le linge', 'poussiere', 'poussiere et ecran', 'purger les radiateur', 'ranger',
    'ranger la table basse', 'ranger le bureau', 'ranger les chaussure', 'recharger le papier', 'retourner le matela',
    'secouer le paillasson', 'sortir le tri', 'sortir les poubelle', 'taper les coussin', 'vider la poubelle', 'vider le creuset',
    'vider le lave vaisselle', 'vider le vide poche', 'vitre'
  ];
  f             record;
  garde         uuid;
  supprime      uuid;
  hist_avant    integer;
  hist_apres    integer;
  taches_avant  integer;
  taches_apres  integer;
  fusions       integer;
  fiches_posees integer;
  slugs         text;
begin
  for f in select id from menage_foyers loop
    select count(*) into hist_avant   from menage_historique where foyer_id = f.id;
    select count(*) into taches_avant from menage_taches     where foyer_id = f.id;
    fusions := 0;

    -- b. « Lancer une lessive » : on garde la Buanderie, on retire Partout.
    select t.id into garde from menage_taches t join menage_pieces p on p.id = t.piece_id
     where t.foyer_id = f.id and pg_temp.norm(t.nom) = 'lancer une lessive' and pg_temp.norm(p.nom) = 'buanderie' limit 1;
    select t.id into supprime from menage_taches t join menage_pieces p on p.id = t.piece_id
     where t.foyer_id = f.id and pg_temp.norm(t.nom) = 'lancer une lessive' and pg_temp.norm(p.nom) = 'partout' limit 1;
    if garde is not null and supprime is not null then
      perform pg_temp.fusionner(garde, supprime);
      fusions := fusions + 1;
    end if;

    -- c. Plan de travail : on garde « Nettoyer le plan de travail », même pièce que « Coup d'éponge sur le plan ».
    select t.id into garde from menage_taches t
     where t.foyer_id = f.id and pg_temp.norm(t.nom) = 'nettoyer le plan de travail' limit 1;
    select t.id into supprime from menage_taches t
     where t.foyer_id = f.id and pg_temp.norm(t.nom) = 'coup d eponge sur le plan'
       and t.piece_id = (select piece_id from menage_taches where id = garde) limit 1;
    if garde is not null and supprime is not null then
      perform pg_temp.fusionner(garde, supprime);
      fusions := fusions + 1;
    end if;

    -- d. Faute de frappe.
    update menage_taches set nom = 'Aspirer la salle de bain'
     where foyer_id = f.id and pg_temp.norm(nom) = 'aspirer la salade de bain';
    update menage_historique set tache_nom = 'Aspirer la salle de bain'
     where foyer_id = f.id and pg_temp.norm(tache_nom) = 'aspirer la salade de bain';

    -- e. fiche_id : l'ancienne clé `fiche` si elle existe au catalogue, sinon la clé du nom.
    update menage_taches t
       set fiche_id = case when t.fiche = any (cles) then t.fiche else pg_temp.norm(t.nom) end
     where t.foyer_id = f.id
       and t.fiche_id is null
       and (t.fiche = any (cles) or pg_temp.norm(t.nom) = any (cles));
    select count(*) into fiches_posees from menage_taches where foyer_id = f.id and fiche_id is not null;

    -- f. Produits des tâches : les clés de catalogue deviennent des ids de produits du placard.
    update menage_taches t
       set produits = (
         select array_agg(coalesce((select p.id::text from menage_produits p where p.foyer_id = t.foyer_id and p.cle = u.ref), u.ref) order by u.ord)
           from unnest(t.produits) with ordinality as u(ref, ord)
       )
     where t.foyer_id = f.id and t.produits is not null and cardinality(t.produits) > 0;

    select string_agg(distinct t.nom || ' → ' || r.ref, ' ; ') into slugs
      from menage_taches t, unnest(t.produits) as r(ref)
     where t.foyer_id = f.id
       and r.ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    if slugs is not null then
      raise exception 'Produit(s) sans équivalent dans le placard (ajoute-les au placard, puis relance) : %', slugs;
    end if;

    -- Garde-fous : aucun historique perdu, seules les fusions retirent des tâches.
    select count(*) into hist_apres   from menage_historique where foyer_id = f.id;
    select count(*) into taches_apres from menage_taches     where foyer_id = f.id;
    if hist_apres <> hist_avant then
      raise exception 'Foyer % : historique % avant, % après. Migration annulée.', f.id, hist_avant, hist_apres;
    end if;
    if taches_apres <> taches_avant - fusions then
      raise exception 'Foyer % : % tâches avant, % après pour % fusion(s). Migration annulée.', f.id, taches_avant, taches_apres, fusions;
    end if;

    insert into menage_journal (foyer_id, evenement, details)
    values (f.id, 'migration_donnees', jsonb_build_object(
      'migration', 'j0-f4', 'fusions', fusions, 'historique', hist_apres,
      'taches_avant', taches_avant, 'taches_apres', taches_apres, 'fiche_id_posees', fiches_posees, 'test', true));
  end loop;
end;
$$;

-- 4. Vérification (comptage avant / après, par foyer).
select
  f.code as foyer,
  (select count(*) from menage_sauvegarde.taches_20261125     s where s.foyer_id = f.id) as taches_avant,
  (select count(*) from menage_taches     t where t.foyer_id = f.id)                      as taches_apres,
  (select count(*) from menage_sauvegarde.historique_20261125 s where s.foyer_id = f.id) as historique_avant,
  (select count(*) from menage_historique h where h.foyer_id = f.id)                      as historique_apres,
  (select count(*) from menage_taches t where t.foyer_id = f.id and t.fiche_id is not null) as avec_fiche_id,
  (select count(*) from menage_taches t where t.foyer_id = f.id and t.produits is not null) as avec_produits
from menage_foyers f;

commit;
