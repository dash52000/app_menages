-- =====================================================================
-- J1 · F5 : restaurer les durées d'avant le 23/11 des 8 tâches passées à 1 min.
--
-- NE PAS LANCER avant l'accord de Laeti (question ouverte Q8 du SPEC) : c'est elle qui
-- avait mis ces tâches à 1 min pour les faire entrer dans « J'ai 1 min ». Maintenant que
-- le champ quick existe, elles restent Quick (migration 2026-11-25_j1_quick.sql, à lancer
-- avant) et peuvent retrouver leur vraie durée, donc compter correctement dans la jauge.
--
-- Garde-fou : on ne touche qu'à une tâche encore à 1 min. Si Laeti a changé la durée
-- depuis, on ne l'écrase pas.
-- =====================================================================

create or replace function pg_temp.norm(t text) returns text language sql immutable as $$
  select coalesce(string_agg(case when length(w.m) > 3 and w.m ~ '[sx]$' and w.m !~ 'ss$' then left(w.m, -1) else w.m end, ' ' order by w.n), '')
  from regexp_split_to_table(
    regexp_replace(
      translate(replace(replace(lower(t), 'œ', 'oe'), 'æ', 'ae'), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9 ]+', ' ', 'g'),
    '\s+') with ordinality as w(m, n)
  where w.m <> ''
$$;

update menage_taches t
   set duree_min = d.minutes, quick = true
  from (values
    ('lancer une lessive', 5),
    ('interrupteur et poignee', 10),
    ('bouche de vmc', 15),
    ('nettoyer le plan de travail', 5),
    ('vider le lave vaisselle', 2),
    ('nettoyer les plaque', 5),
    ('nettoyer l evier', 5),
    ('nettoyer les toilette', 10)
  ) as d(cle, minutes)
 where pg_temp.norm(t.nom) = d.cle
   and t.duree_min = 1;

select nom, duree_min, quick from menage_taches
 where pg_temp.norm(nom) in ('lancer une lessive', 'interrupteur et poignee', 'bouche de vmc', 'nettoyer le plan de travail',
   'vider le lave vaisselle', 'nettoyer les plaque', 'nettoyer l evier', 'nettoyer les toilette')
 order by nom;
