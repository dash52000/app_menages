-- =====================================================================
-- Mesures du SPEC.md §4, recalculées HORS sessions de test.
-- Lecture seule : tu peux le lancer quand tu veux (SQL Editor > Run).
--
-- Exclus : les événements marqués details.test = true (interrupteur « Session de test »,
-- Réglages) et, pour la période d'avant F1, les trois jours de test (31/10, 01/11, 10/11).
-- Les lignes d'historique n'ont pas de marque : on exclut celles créées ces trois jours.
-- =====================================================================

with
jours_test as (select unnest(array['2026-10-31', '2026-11-01', '2026-11-10']::date[]) as j),
j as (   -- journal propre
  select * from menage_journal
   where coalesce((details->>'test')::boolean, false) = false
     and cree_le::date not in (select j from jours_test)
),
h as (   -- historique propre
  select h.*, p.prenom
    from menage_historique h
    left join menage_profils p on p.id = h.profil_id
   where h.cree_le::date not in (select j from jours_test)
     and not exists (   -- et pas dans une session de test marquée au journal, même minute
       select 1 from menage_journal x
        where x.foyer_id = h.foyer_id and coalesce((x.details->>'test')::boolean, false)
          and x.tache_id = h.tache_id and abs(extract(epoch from (x.cree_le - h.cree_le))) < 5)
)
select * from (
  select 1 as n, 'Tâches cochées (hors tests)' as mesure,
         count(*)::text as valeur, null::text as detail
    from h
  union all
  select 2, 'Part de chaque profil dans les tâches cochées',
         count(*)::text, prenom || ' : ' || round(100.0 * count(*) / sum(count(*)) over (), 0) || ' %'
    from h group by prenom
  union all
  select 3, '1re proposition du mode quick refusée',
         (select count(*) from j where evenement = 'autre_proposition' and details->>'depuis' = 'quick' and (details->>'rang')::int = 1)::text,
         'sur ' || (select count(*) from j where evenement = 'quick_ouvert') || ' ouvertures de « J''ai 1 min »'
  union all
  select 4, 'Tâches en retard de plus de 2× leur rythme (état actuel)',
         count(*) filter (where derniere_fois is not null and current_date - derniere_fois > 2 * rythme_jours)::text,
         'sur ' || count(*) || ' tâches ; ' || count(*) filter (where derniere_fois is not null and current_date - derniere_fois > rythme_jours) || ' en retard simple'
    from menage_taches
  union all
  select 5, 'Auteur corrigé après coup',
         (select count(*) from j where evenement = 'correction_auteur')::text,
         'sur ' || (select count(*) from h) || ' tâches cochées ('
           || round(100.0 * (select count(*) from j where evenement = 'correction_auteur') / nullif((select count(*) from h), 0), 0) || ' %)'
  union all
  select 6, 'Checks : vus sans action / quittés après action / terminés (depuis F1)',
         (select count(*) from j where evenement = 'check_vu')::text || ' / '
           || (select count(*) from j where evenement = 'check_quitte')::text || ' / '
           || (select count(*) from j where evenement = 'check_termine')::text,
         'avant F1 : ' || (select count(*) from j where evenement = 'check_abandonne') || ' « abandonnés » (mesure non fiable)'
  union all
  select 7, 'Produits mis à jour depuis le 01/11',
         count(*) filter (where maj_le >= '2026-11-01' and maj_le > cree_le + interval '1 minute')::text, 'sur ' || count(*) || ' produits (hors création)'
    from menage_produits
) m
order by n, valeur;
