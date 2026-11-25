-- =====================================================================
-- J1 · F5 : le champ « quick » devient indépendant de la durée.
--
-- À lancer APRÈS supabase/schema.sql (V1.9). Ne touche à aucune durée.
--   · quick = vrai pour toute tâche d'une minute ou moins ;
--   · quick = vrai pour les 8 tâches que Laeti avait passées à 1 min le 23/11 pour les
--     faire entrer dans « J'ai 1 min » (lessive, interrupteurs, VMC, plan de travail,
--     lave-vaisselle, plaques, évier, toilettes), quelle que soit leur durée actuelle.
-- Les autres tâches restent à null : l'appli se fie alors à leur durée, comme avant.
-- Rien n'est supprimé ; un seul UPDATE, annulable avec la sauvegarde JSON.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'menage_taches' and column_name = 'quick'
  ) then
    raise exception 'Colle et lance d''abord supabase/schema.sql (V1.9) : la colonne menage_taches.quick manque.';
  end if;
end;
$$;

create or replace function pg_temp.norm(t text) returns text language sql immutable as $$
  select coalesce(string_agg(case when length(w.m) > 3 and w.m ~ '[sx]$' and w.m !~ 'ss$' then left(w.m, -1) else w.m end, ' ' order by w.n), '')
  from regexp_split_to_table(
    regexp_replace(
      translate(replace(replace(lower(t), 'œ', 'oe'), 'æ', 'ae'), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9 ]+', ' ', 'g'),
    '\s+') with ordinality as w(m, n)
  where w.m <> ''
$$;

update menage_taches
   set quick = true
 where quick is null
   and (
     duree_min <= 1
     or pg_temp.norm(nom) in (
       'lancer une lessive', 'interrupteur et poignee', 'bouche de vmc', 'nettoyer le plan de travail',
       'vider le lave vaisselle', 'nettoyer les plaque', 'nettoyer l evier', 'nettoyer les toilette'
     )
   );

select
  count(*) filter (where quick is true)  as quick_vrai,
  count(*) filter (where quick is null)  as quick_inchange,
  count(*) filter (where duree_min <= 1) as durees_a_1_min
from menage_taches;
