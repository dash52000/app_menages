# SPEC — Coup de frais

Repo : `dash52000/app_menages` · Version au 25/11/2026 : 1.12.2 en ligne ; 1.13.0 (IA1) en PR, pas encore mergée · J0 à J2 en ligne, migrations F4, `quick`, J3 sécurité et IA0 passées ; fonction `llm` en version 8 depuis le 25/11 (IA1 ; essai réel IA0 du 25/11 : texte et image OK avec Gemini, délai de 8 s confirmé) · Fiche mise à jour : 25/11/2026
À lire d'abord : `SOCLE.md` (planchers et conventions). Cette fiche ne répète pas le socle.

---

## 1. Résumé

Web app de suivi du ménage à la maison, partagée à deux (Damien sur Android, Laeti sur iPhone). Pot commun : pas de tâches attitrées. Un check court « Aujourd'hui », un mode quick (tâches de 30 s à 1 min, « J'ai 1 min »), des tâches classées par pièce avec fiches illustrées, un placard de produits, et un journal d'usage pour orienter les mises à jour. Données sur Supabase.

## 2. Public et moment d'usage

- **Damien** : ouvre l'appli surtout vers 12-13 h et 16-19 h ; passe par Aujourd'hui et quick.
- **Laeti** : ouvre l'appli surtout vers 17-18 h ; passe par les pièces et les fiches ; c'est elle qui règle les tâches (20 modifications, Damien 0).
- Foyer de 2 profils. Pas de troisième utilisateur prévu.

## 3. Ce qu'elle remplace

Tody, utilisée puis abandonnée : trop d'options payantes, trop de friction, oubli de cocher, et un « mur rouge » décourageant. Coup de frais doit faire mieux sur ces quatre points.

## 4. Mesures de départ (journal du 31/10 au 25/11/2026)

Les jours de test (31/10, 01/11, 10/11) gonflent certains chiffres. `supabase/mesures.sql` recalcule tout hors tests (événements marqués `details.test` et ces trois jours).

| Mesure | Départ brut | Départ hors tests (25/11) | Cible (proposée, à confirmer) |
|---|---|---|---|
| Part de Laeti dans les tâches cochées | 68 sur 114 (59 %) | 59 sur 99 (60 %) | aucune, descriptive |
| 1re proposition du mode quick refusée | 11 ouvertures sur 13 | 9 ouvertures sur 11 | moins de 50 % |
| Tâches en retard de plus de 2× leur rythme | 8 sur 56 (17 en retard) | idem (état actuel, pas de filtre possible) | 4 ou moins |
| Auteur corrigé après coup (« fait par l'autre ») | 16 sur 114 (14 %) | 13 sur 99 (13 %) | moins de 10 % |
| Checks terminés / « abandonnés » | 1 / 129 (mesure non fiable, voir F1) | 1 terminé / 62 « abandonnés » avant F1 ; `check_vu` et `check_quitte` à zéro tant que la V1.8 n'est pas en usage | à redéfinir après 2 semaines de V1.8 |
| Produits du placard mis à jour après leur création depuis le 01/11 | 3 sur 18, tous des granulés ou un produit libre | 2 sur 18 | à mesurer après F6 |

## 5. Modèle de données

**Existant (export 1.10.0)** : `foyer` (id, code, dernier_check), `profils`, `pieces` (en_pause_depuis), `taches` (rythme_jours, duree_min, derniere_fois, derniere_par, reporte_le, reporte_jusqu_au, reserve_par, reserve_le, fiche, **fiche_id**, **quick**, **refusee_le**, **fond_propose_le**, note, produits), `produits` (cle, etat ok/bas/vide, indispensable, courses_le), `historique` (tache_nom et piece_nom copiés, donc conservés si la tâche est supprimée), `journal` (evenement, details JSON).

**Réalisé en V1.8 (J0)**
- `taches.fiche_id` : clé stable de la fiche du catalogue (clé normalisée du nom). Renommer une tâche ne casse plus sa fiche. L'ancienne colonne `fiche` reste en place pour les appareils pas encore à jour ; l'appli lit `fiche_id` d'abord. 51 tâches sur 56 l'ont après migration ; 3 tâches libres n'ont pas de fiche.
- `taches.produits` : liste d'**ids de produits uniquement** (fin du mélange slug / UUID). `produits.cle` ne sert plus de référence.
- `journal.details.test` : marque les événements d'une session de test (interrupteur dans Réglages, extinction automatique après 3 h).
- Événements : `check_vu` (0 action), `check_quitte` (au moins 1 action), `check_termine` conservé, `session_test`, `fusion_taches`, `migration_donnees`. `check_abandonne` n'est plus écrit (les anciennes lignes restent).
- Chaque check enregistre `ids` des tâches proposées (remplacements « Autre » compris).

**Réalisé en V1.9 (J1)**
- `taches.quick` (booléen, décidé le 25/11) : sépare le tag « quick » de la durée. Le mode « J'ai 1 min » s'appuie sur ce champ ; vide (null), l'appli se fie à la durée (1 min ou moins) comme avant. Un interrupteur « Quick » dans la fiche de tâche permet de le choisir sans toucher à la durée.
- `taches.refusee_le` (horodatage) : écrit à chaque « Autre proposition » (check et « J'ai 1 min »), lu sur les deux téléphones.
- `taches.fond_propose_le` (jour) : rotation des tâches de fond.
- Catalogue : champ `quick` par tâche, rythmes alignés sur Laeti ; « Coup d'éponge sur le plan » retiré du catalogue (c'était la source du doublon avec « Nettoyer le plan de travail »).

**Réalisé en V1.10 (J2)** : aucun changement de schéma. Nouvel événement `produit_verifie`. Le lien produit ↔ tâche passe par les fiches (`besoins`) et par `taches.produits` (ids) ; « Sert pour » en est déduit.

**Réalisé en V1.11 (J3, sécurité)**
- `menage_tentatives` (id, user_id, action `rejoindre`/`creer`, ok, cree_le) : trace des essais de code et des créations de foyer, **jamais le code tapé**. RLS sans règle et aucun droit pour `anon`/`authenticated` : invisible depuis l'API. Purgée au-delà de 30 jours.
- `menage_rejoindre_foyer` et `menage_creer_foyer` renvoient `{ erreur: 'code_inconnu' | 'trop_essais' }` au lieu d'une exception (une exception annulerait la trace de l'essai). L'écran d'arrivée 1.11 lit ce champ.

**Réalisé en V1.12 (IA0)** (`supabase/migrations/2026-11-25_ia0_quota.sql`, repris dans `schema.sql`)
- `menage_ia_usage` (foyer_id, jour, nb_appels, minute_debut, nb_minute) : quota par foyer et par jour (heure de Paris), fenêtre d'une minute. Gardé 90 jours.
- `menage_ia_pauses` (modele, jusqu_au) : modèle en pause après 429, 5xx ou délai dépassé, partagé entre les instances de la fonction.
- Ces deux tables : RLS sans règle, aucun droit pour `anon`/`authenticated` ; seules les fonctions `menage_ia_reserver(foyer)` et `menage_ia_pause(modele, jusqu_au)`, exécutables par `service_role` uniquement, y touchent.
- Événement `llm_appel` (details : consigne, usage, modele, succes, latence_ms, bascules, essais [modèle, issue, ms], arret, test), **sans contenu**. Deux règles RLS restrictives empêchent un téléphone d'écrire ou de modifier un `llm_appel` ; il peut toujours le lire (export CSV).

**Réalisé en V1.13 (IA1)** : aucun changement de schéma, aucune migration (décidé le 25/11).
- Les cartes de proposition ne sont pas stockées : elles vivent dans l'état du téléphone le temps du « OK ».
- Nouvel événement `ia_saisie` (écrit par l'appli, **sans le texte tapé ni le contenu des cartes**) : `issue` (`acceptee` | `refusee` | `vide` | `indisponible`), `nb_chars`, `nb_cartes`, `nb_cocher`, `nb_nouvelles`, `rejetees_serveur`, `ecartees_telephone`, et pour `acceptee` : `nb_cochees`, `nb_creees` ; `raison` quand l'IA n'a pas répondu ; `test` en session de test. Les cartes cochées passent par `agir` (`bouton_tache` avec `depuis: 'ia'`), les créations par `ajouterTache` (`tache_creee` avec `depuis: 'ia'`).
- `llm_appel` reçoit la consigne `saisie` (même forme, sans contenu).

**Prévu**
- `propositions_ia` (id, foyer_id, type, payload JSON, statut proposée/acceptée/refusée, cree_le, traite_par) : **reportée à IA3**, où le résultat mis en cache 7 jours a besoin d'un stockage. Pas utile à IA1 (voir §16, 25/11 IA1).

## 6. Écrans et parcours

Quatre onglets : **Aujourd'hui** (check, quick, « autre proposition » jusqu'à 3 refus puis liste), **Pièces** (tâches par pièce, fiches), **Placard** (produits, courses), **Réglages** (dont export CSV et JSON, session de test).

Parcours de Laeti à protéger : Pièces → cocher en 1 tap ; fiche en 1 tap.
Ajout : champ « Dis-le en une phrase » dans Aujourd'hui (V1.13, IA1 : écrire, envoyer, OK), bouton photo et badge de propositions dans Réglages (à venir, voir §9).

## 7. Fini quand… (sans IA)

**F1 — Journal fiable** · *fait en V1.8*
- Quitter le check sans action n'écrit plus « abandonné » : `check_vu` (0 action), `check_quitte` (au moins 1 action, avec nb_actions), `check_termine` (toutes traitées).
- Chaque check enregistre les ids des tâches proposées.
- Un interrupteur « session de test » dans Réglages marque les événements du moment (`details.test`).
- Les mesures du §4 se recalculent en excluant les sessions de test (`supabase/mesures.sql`).

**F2 — Mode quick qui apprend des refus** · *code fait en V1.9 ; effet à mesurer sur 2 semaines*
- Une tâche refusée via « autre proposition » n'est pas reproposée avant 48 h (décidé le 25/11).
- « Aérer la chambre » ne peut plus occuper la première place à chaque ouverture.
- Sur 2 semaines, la 1re proposition est acceptée dans plus de 50 % des ouvertures.

**F3 — Tâches de fond qui ne s'enlisent pas, sans mur rouge** · *code fait en V1.9 ; effet à mesurer sur 2 semaines*
- Chaque check peut contenir au plus une tâche de fond en retard (plus de 2× son rythme), choisie par rotation.
- Le libellé est neutre, sans rouge ni compteur de jours de retard. Reporter est sans pénalité.
- Sur 2 semaines, aucune tâche n'atteint 3× son rythme sans avoir été proposée au moins 2 fois dans un check.

**F4 — Données propres** · *code fait en V1.8 ; migration à lancer par Damien*
- Migration unique (`supabase/migrations/2026-11-25_j0_donnees_propres.sql`) : fusion de « Lancer une lessive » (Buanderie et Partout), fusion de « Nettoyer le plan de travail » et « Coup d'éponge sur le plan », correction de « Aspirer la salade de bain » en « salle de bain ». L'historique des tâches fusionnées est rattaché à la tâche gardée.
- À la création d'une tâche, avertissement doux et non bloquant si un nom proche existe dans la même pièce.
- Produits référencés par id uniquement ; `fiche_id` stable (voir §5).
- Aucun historique perdu par la migration : comptage avant/après vérifié dans la migration elle-même (annulation si écart) ; essai à blanc sur la vraie base le 25/11 : 56 tâches → 54, historique 114 → 114.

**F5 — Catalogue recalibré** · *catalogue et champ `quick` faits en V1.9 ; restauration des durées en attente de Laeti (Q8)*
- Rythmes par défaut alignés sur ce que Laeti a réglé : miroir 30 j, vitres 90 j, micro-ondes 30 j, lave-vaisselle 4 j, tri 10 j, poubelles noires 21 j, sol et poubelle de la salle de bain 14 j, lessive 3 j, poêle 7 j.
- `quick` devient un champ séparé de la durée (Q1 : Laeti avait mis des tâches à 1 min pour les faire entrer en quick). Migration : les 8 tâches passées à 1 min le 23/11 passent `quick = vrai` et retrouvent leur durée d'avant (lessive 5, interrupteurs 10, VMC 15, plan de travail 5, lave-vaisselle 2, plaques 5, évier 5, toilettes 10 min) ; à valider avec Laeti avant la migration.

**F6 — Placard utile** · *fait en V1.10*
- Les produits du catalogue sont liés aux tâches qui les utilisent (lessive, sacs poubelle, papier toilette, gel WC, etc.) : par les fiches, qui retrouvent leur tâche par `fiche_id` (donc après la migration F4 pour les tâches de Laeti sans fiche, comme les lessives). Un test vérifie ces liens et que chaque produit cité par une fiche existe au catalogue.
- Depuis la fiche d'une tâche, 1 tap « Il en reste peu » sur le produit qu'on a sous la main (puis « Il n'y en a plus »), avec « Aux courses » proposé dans le bandeau, jamais imposé.
- La liste de courses se déduit des produits bas ou vides : section « À racheter » du placard et bouton « Tout ajouter aux courses » (seulement ceux pas déjà sur la liste), aucune relance.
- Chaque produit affiche depuis combien de temps son état a été vérifié (« Vérifié il y a 3 j », neutre, sans alerte) ; « Je viens de vérifier » dans sa fiche le remet à aujourd'hui sans changer l'état.

**F7 — Export** · *fait en V1.8*
- Export CSV (tâches, produits, historique, journal, plus pièces et profils) avec ids stables, en plus de la sauvegarde JSON actuelle.

**F8 — Parcours de Laeti** · *code fait en V1.9 ; taux de correction à mesurer sur 2 semaines*
- Cocher depuis une pièce = 1 tap. Fiche = 1 tap.
- Auteur par défaut = profil connecté ; « fait par l'autre » en 1 tap : un second rond coloré, à l'initiale de l'autre profil, à côté du ✓ de chaque ligne de pièce (l'ancien « C'était Laeti ? » reste après un ✓).
- Taux de correction d'auteur sous 10 % sur 2 semaines.

## 8. Sécurité · *relue le 25/11 (J3) ; correctif lancé en prod le 25/11 après déploiement de la 1.11.0*

**Audit du 25/11** (règles en base, fonctions, advisors Supabase sécurité et performance)
- Toutes les tables `menage_*` ont la RLS ; seules les identités connectées (`authenticated`, y compris anonymes) voient des lignes, et seulement celles de leur foyer via `menage_mon_foyer()`. `menage_membres` ne s'écrit que par les fonctions de création et de jonction.
- Fonctions `security definer` (`menage_mon_foyer`, `menage_creer_foyer`, `menage_rejoindre_foyer`) : `search_path` fixé, exécution refusée à `anon`. L'alerte des advisors à leur sujet est voulue (c'est leur rôle).
- `menage_sauvegarde` : aucun droit sur le schéma pour `anon`/`authenticated`, RLS active sans règle → inaccessible par l'API. L'alerte « RLS sans règle » est voulue. Copies à supprimer après validation par Damien.
- Code du foyer : absent du repo, de son historique et de la fiche (vérifié le 25/11 sans l'afficher). Affiché seulement dans Réglages (partage du lien d'invitation) ; la sauvegarde JSON le contient, avec un avertissement dans Réglages.
- Alerte « connexions anonymes » des advisors : voulue (pas de compte, choix du 30/10).

**Problèmes trouvés et correctif** (`supabase/migrations/2026-11-25_j3_securite.sql`, repris dans `schema.sql`)
- Aucune limite aux essais de code, alors que la clé publique est lisible dans l'appli : **5 codes faux par téléphone en 15 min, 30 pour tout le projet en 1 h**, puis « trop_essais ». Avec 31⁶ ≈ 887 millions de codes, deviner un foyer prendrait des milliers d'années.
- Code tiré avec `random()` (non cryptographique) : remplacé par `gen_random_bytes`, sans biais (tirage par rejet).
- Création de foyers illimitée : 3 par téléphone et 20 pour tout le projet en 24 h.
- Règles RLS réécrites avec `(select …)` (évaluées une fois par requête) ; droits de table retirés au rôle `anon` ; index ajoutés (`menage_membres.foyer_id`, `.profil_id`, `menage_pieces.foyer_id`).
- Essai à blanc le 25/11 dans une transaction annulée : 6e code faux bloqué, 4e création bloquée, bon code accepté, `anon` refusé, téléphone sans foyer voit 0 tâche, membre voit 54 tâches ; comptages identiques avant/après (foyers 1, profils 2, membres 3, pièces 9, tâches 54, historique 114, journal 830, produits 18).

**Ordre de mise en ligne** : déployer l'appli 1.11.0 (écran d'arrivée), puis lancer la migration. Les téléphones déjà rattachés ne voient aucune différence.

**Mise en prod du 25/11** : migration `j3_securite` appliquée après un nouvel essai à blanc sur l'état du jour. Comptages avant = après : foyers 1, profils 2, membres 3, pièces 9, tâches 54, historique 114, produits 18, journal 850. Contrôles : 10 règles réécrites avec `(select …)`, 0 droit de table pour `anon`, `anon` ne peut plus exécuter les fonctions de foyer ; vérification en transaction annulée : un membre voit ses 54 tâches, un code faux renvoie `code_inconnu` et laisse une trace. Advisors après migration : plus d'alerte « RLS réévaluée par ligne » sur `menage_*` ; restent les alertes voulues (connexions anonymes, fonctions `security definer`, RLS sans règle sur `menage_tentatives` et `menage_sauvegarde`) et des clés étrangères non indexées en INFO sur de petites tables (sans effet à cette taille). Les alertes des autres applis du projet (Panier, Chevet) sont hors périmètre.

**Identification de l'appelant par la fonction `llm`** (décidé le 25/11) : l'appli appelle `supabase.functions.invoke('llm')`, qui envoie le jeton de la session anonyme ; la fonction est déployée avec `verify_jwt` (passerelle). Le foyer et le profil sont lus dans `menage_membres` **avec le jeton de l'appelant** (règle « moi »), jamais pris dans la requête ; sans foyer → 403. Quota, pauses et journal s'écrivent côté serveur avec la clé `service_role`, fournie d'office à la fonction et absente du client.

**Mise en prod IA0 du 25/11** : migration `ia0_quota` appliquée après essai à blanc (10 appels passent puis `quota_minute`, `quota_jour` à 100, téléphone refusé sur la réservation, la lecture du compteur et l'écriture d'un `llm_appel`, `check_vu` toujours accepté). Comptages avant = après (journal 852). `schema.sql` complet rejoué à blanc sur la vraie base. Advisors : seules nouvelles alertes, « RLS sans règle » sur `menage_ia_usage` et `menage_ia_pauses`, voulues.

## 9. IA

**Dérogation au socle** : le socle dit « pas d'IA sauf si la fiche le demande ». Cette fiche le demande, dans le cadre ci-dessous.

**Architecture**
- Une Edge Function Supabase `llm` (`supabase/functions/llm/`, déployée le 25/11, `verify_jwt` activé). Les clés Gemini et Groq sont des secrets Supabase (`MENAGE_GEMINI_API_KEY`, `MENAGE_GROQ_API_KEY`) : jamais dans le repo, jamais dans le client.
- Le téléphone n'envoie pas de texte libre au modèle : il choisit une **consigne** par son nom (`consignes.ts`) et envoie des données ; chaque consigne a son validateur JSON. En IA0 : `essai` (texte) et `essai_vision` (image). En IA1 : `saisie` (texte), seule consigne qui reçoit une phrase de la personne (300 signes au plus), insérée comme **donnée** dans une consigne fixe qui dit au modèle de n'en suivre aucune instruction ; ce n'est pas un chat : une phrase, une réponse, des cartes.
- Une consigne peut demander des données du foyer (`lire`) : la fonction les lit **elle-même avec le jeton de l'appelant** (RLS : son foyer, rien d'autre), avant de réserver le quota ; si la lecture échoue, réponse `indisponible` sans quota consommé. Le téléphone n'envoie jamais d'id ni de liste de tâches.
- Chaînes (choisies le 25/11 d'après les docs du jour) : **texte** `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → Groq `openai/gpt-oss-120b` ; **vision** `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → Groq `qwen/qwen3.8-27b` (seul modèle vision de Groq, en préversion : peut disparaître sans préavis).
- Basculement : un seul essai par modèle ; sur 429 (en lisant `Retry-After`, sinon le `RetryInfo` de Gemini, sinon 60 s), 5xx dont 503 (30 s par défaut) ou délai dépassé (8 s, pause 30 s), le modèle passe en pause et on essaie le suivant ; sur 400, 401, 403 ou 404, on s'arrête sans basculer (bug ou réglage côté nous). Modèle en pause ou sans clé : sauté. Toute la chaîne en échec : réponse `{ ok: false, raison: 'indisponible' }`, et `demanderIA` (`src/lib/ia.ts`) renvoie `null` sans jamais lever d'erreur : l'appli continue sans IA.
- **Essai réel du 25/11 (clés enfin lues)** : texte OK (`gemini-3.5-flash-lite`, 1,2 s, aucune bascule) ; image : les deux Gemini dépassent 8 s, la bascule joue pour de vrai et Groq `qwen/qwen3.8-27b` répond en 0,5 s (16,5 s au total). Cause de la lenteur de Gemini non établie : `gemini-3.5-flash-lite` raisonne déjà au niveau minimal par défaut et les modèles 3.x n'ont pas de réglage « sans réflexion », donc ce n'est pas la réflexion. **Mesure du 25/11 au soir (1.12.1, délai de 25 s réservé aux essais)** : 8 appels, tous servis par `gemini-3.5-flash-lite` sans bascule ; image 0,6 à 2,5 s (médiane 1,1 s), texte 0,6 à 0,8 s. Les dépassements de 14 h étaient ponctuels (coup de mou ou démarrage à froid de Gemini), et la bascule a fait son travail. **1.12.2** : échafaudage retiré, 8 s par modèle pour tous les appels. Limite : l'image d'essai est minuscule ; à revérifier avec de vraies photos (jusqu'à 2 Mo) à IA4 (IA1 n'envoie pas d'image).
- Sorties en JSON validé côté serveur. Un JSON invalide est traité comme un échec du modèle : on essaie le suivant, sans pause.
- Quota : 100 appels par jour et par foyer, 10 par minute (décidés le 25/11), réservés avant l'appel en une requête verrouillée. Chaque appel réservé est journalisé (`llm_appel`, voir §5), sans le contenu ; les refus de quota ne sont pas journalisés (une boucle ne remplit pas le journal).

**IA1 : saisie en langage naturel (V1.13)**
- Le modèle reçoit les pièces et les tâches sous forme de références courtes (`p1…`, `t1…`), jamais les ids ; la phrase est envoyée avec les **prénoms du foyer remplacés par « quelqu'un »** (§9 « données envoyées »). Le serveur remappe les références vers les vrais ids.
- Sortie : `{ cartes, rejetees }`. Carte `cocher` (tâche existante) ou `nouvelle` (nom de 2 à 60 signes, pièce existante, rythme de 1 à 365 j, durée de 1 à 120 min). Validateur : référence inconnue, vrai id donné à la place d'une référence, forme ou bornes hors limites, nom déjà présent dans la même pièce (accents et casse ignorés) → carte rejetée (comptée dans `rejetees`) ; doublons ignorés ; 10 cartes et 3 nouvelles au plus. Des cartes proposées mais aucune valable : échec de ce modèle, on passe au suivant (sans pause). Liste vide : réponse valable, l'appli dit qu'elle n'a rien trouvé.
- Côté téléphone : deuxième barrière (carte écartée si la tâche ou la pièce n'existe plus localement). Les cartes s'affichent dans une feuille « Je propose », **toutes cochées sauf une tâche déjà faite aujourd'hui** ; la carte « nouvelle » est pré-remplie et modifiable (avertissement doux si un nom proche existe). Un seul « OK » écrit : `agir` pour cocher (auteur = profil connecté, « fait par l'autre » reste possible ensuite), `ajouterTache` pour créer. Bandeau « Annuler » pour l'ensemble. Fermer la feuille ne change rien.
- IA indisponible, quota ou délai : message neutre qui propose de cocher à la main, rien ne bloque (P1, P2).

**Règle centrale** : le LLM n'écrit jamais en base. Il renvoie des **cartes de proposition** (type, tâche ciblée, avant/après, raison courte). L'appli les affiche avec « OK / Non » ; en cas de OK, le code existant écrit, donc l'annulation actuelle fonctionne. Toute proposition citant un id inconnu est rejetée côté serveur.

**Forme** : invisible, sans chat. Pas de chat libre.

**Fini quand…**
- **IA0 — Brique** : bascule testée en simulant 429 puis 503 sur chaque modèle de la chaîne ; échec complet sans erreur bloquante ; aucun secret dans le client ni le repo. · *code et tests faits en V1.12 (`supabase/functions/llm/chaine.test.ts` : 429 et 503 sur chacun des 6 modèles, délai, JSON invalide, 400/401, réseau coupé, tout en échec ; `src/lib/ia.test.ts` : l'appli reçoit `null`, jamais d'exception) ; essai réel depuis Réglages (« Essai IA », visible en session de test) fait le 25/11 : texte et image OK, bascule observée une fois en vrai*
- **IA1 — Saisie en langage naturel** : « on a fait la salle de bain à fond » → cartes de cases à cocher parmi les tâches existantes (la liste est fournie au modèle sous forme de références, lue côté serveur), ou carte de nouvelle tâche (pièce, rythme, durée). 3 taps au maximum : écrire, envoyer, OK. · *code et tests faits en V1.13 (`consignes.test.ts` : références, prénoms, bornes, doublons, plafonds ; `chaine.test.ts` : un modèle qui invente des ids fait passer au suivant ; `saisie.test.ts` et `ia.test.ts` côté appli) ; `llm` v8 déployée le 25/11 (version en ligne vérifiée avant : v7 ; code en ligne relu après, conforme au repo) ; **reste** : mise en ligne de la 1.13.0 (merge de la PR) et essai réel avec de vraies phrases*
- **IA2 — Tâches du jour** : le LLM transforme « j'ai 20 min, Laeti rentre à 18 h » en paramètres (minutes, pièces à éviter) ; le **classement est fait par le code** (retard, durée, refus récents). Sans IA, un curseur de durée prend le relais.
- **IA3 — Revue du journal** : le journal est agrégé en SQL (retards, refus, rythmes modifiés, doublons probables) ; le LLM ne reçoit pas les lignes brutes, formule des propositions et juge les cas ambigus. Résultat mis en cache 7 jours. À lancer seulement après F1 et au moins 2 semaines de journal propre.
- **IA4 — Photo** : une photo de pièce suggère des tâches, une photo de produit l'ajoute au placard. Image réduite sur le téléphone avant envoi, non stockée, chaîne vision uniquement.

**Données envoyées au LLM** : noms de tâches, pièces, rythmes, durées, agrégats. Jamais le code du foyer ni les prénoms. Les photos d'intérieur partent chez un tiers : accord de Laeti obtenu le 25/11 ; lire les conditions du palier gratuit de Gemini avant IA4.

## 10. Notifications

Rappel unique calé sur la routine du foyer : accord de principe du 30/10, **pas encore réalisé** au 25/11 (Q4). À spécifier avant de coder : heure, canal (notification web sur iPhone : à vérifier, elle demande en général d'installer l'appli sur l'écran d'accueil) et contenu. Aucune autre notification dans cette fiche.

## 11. Dérogations aux planchers

- Aucune, hors IA (§9). « Il propose, je valide » ajoute un tap, dans la limite des 3 taps.

## 12. Hors périmètre

NFC ; tâches attitrées ; suivi de rivaux, classements, niveaux, XP ; chat libre avec le LLM ; modification de données par le LLM sans validation ; stockage des photos ; options payantes ; série punitive ou compteur de jours de retard en rouge.

## 13. V2 / idées reportées

- Fiches générées à la demande (« Comment faire ? »), stockées en base : retenues pour la V2 (décidé le 25/11), à reprendre après IA1 à IA4.
- Fiches illustrées pour les tâches créées librement.
- IA1, à voir après usage réel : qui l'a fait (« Laeti l'a fait ») et quand (« hier ») dits dans la phrase ; pour l'instant l'auteur est le profil connecté et le jour est aujourd'hui, corrigeables en 1 tap. Une tâche créée par la saisie n'est pas cochée « faite aujourd'hui » d'office.
- Photo réelle (jusqu'à 2 Mo) à tester avec la chaîne vision : revient à IA4.

## 14. Questions ouvertes

Q1 à Q5 et Q7 tranchées le 25/11 (voir §16). Restent :
- **Q6** : heure, canal et contenu du rappel unique (J8).
- **Q9** : les tables de Panier (`produits`, `produits_alias`, `articles_liste`, `courses`, `courses_articles`), dans lesquelles Coup de frais écrit pour « Aux courses », ont une règle « toujours vrai » pour `anon` et `authenticated` : n'importe qui ayant la clé publique peut les lire et les modifier. Hors périmètre de cette fiche (autre appli) ; à traiter dans Panier (Opus).
- **Q8** : valider avec Laeti la restauration des durées d'avant pour les 8 tâches passées à 1 min (F5).

## 15. Jalons (modèle indiqué pour économiser les crédits)

| Jalon | Contenu | Modèle |
|---|---|---|
| J0 | F1, F4, F7 | Sonnet · code livré en 1.8.0 |
| J1 | F2, F3, F5, F8 | Sonnet · code livré en 1.9.0 |
| J2 | F6 | Sonnet · code livré en 1.10.0 |
| J3 | §8 sécurité et RLS, puis IA0 | Opus · sécurité en 1.11.0, IA0 en 1.12.0 |
| J4 | IA1 | Sonnet · code livré en 1.13.0 (PR) ; `llm` v8 déployée le 25/11 |
| J5 | IA2 | Sonnet |
| J6 | IA3 (après 2 semaines de journal propre) | Sonnet |
| J7 | IA4 | Sonnet |
| J8 | Rappel unique (spec à écrire d'abord, voir §10) | Sonnet |

## 16. Journal des décisions

- **30/10/2026** : app de ménage partagée, dans l'esprit de Tody mais en mieux ; pas de NFC ; check tous les 1 ou 2 jours ; pas de tâches attitrées ; rappel unique calé sur la routine ; listes par pièce illustrées ; web app (Laeti sur iPhone) ; Supabase ; V1 avec journal d'usage.
- **10/11/2026** : ajout de « autre proposition » (3 refus maximum puis liste) et des tâches quick de 30 s à 1 min.
- **25/11/2026** : clés Gemini et Groq stockées dans Supabase (Edge Function) ; usages IA retenus : saisie en langage naturel, tâches du jour, revue du journal, photo ; forme invisible ; l'IA propose et Damien valide ; accessible aux deux profils ; corrections sans IA acceptées (F1 à F8).
- **25/11/2026 (réponses Q1 à Q5)** : les tâches à 1 min de Laeti servaient à les faire entrer en quick, donc champ `quick` séparé ; pause de 48 h après un refus ; quota IA de 100 appels par jour et par foyer ; fiches à la demande reportées en V2 ; rappel unique pas encore fait ; Laeti d'accord pour les photos (IA4).
- **25/11/2026 (J2, choix d'implémentation)** : « Vérifié » se lit sur `maj_le` (dernier changement d'état ou « Je viens de vérifier »), pas de colonne en plus ; le bouton « Il en reste peu » agit sur le produit réellement utilisé (celui « sous la main »), pas sur l'idéal absent ; « Tout ajouter aux courses » reste un geste volontaire, aucun ajout automatique à la liste partagée de Panier ; seul `detartrant-cafe` est ajouté aux fiches (bouilloire, spécialisé donc invisible tant qu'il n'est pas au placard) : les produits basiques sans tâche claire (assouplissant, javel…) ne sont pas rattachés pour ne pas pousser à l'achat.
- **25/11/2026 (J1, choix d'implémentation)** : un refus (« Autre proposition ») met la tâche en pause 48 h dans le check comme dans « J'ai 1 min », sauf si quelqu'un l'a prise (« Je prends ») ; la liste complète des Quick, choisie à la main, garde les tâches refusées ; tâche de fond = plus de 2× son rythme (exactement 2× n'en est pas une) ; une seule par lot de cartes, la rotation prend celle proposée le plus anciennement, et elle est toujours placée dans les cinq cartes ; libellé neutre « Tâche de fond », gris, sans compteur de jours ; `quick` reste vide pour les tâches existantes (repli sur la durée), la migration ne le pose que sur les tâches d'1 min et les 8 tâches de Laeti.
- **25/11/2026 (J0, choix d'implémentation)** : fusion lessive : on garde la tâche de la Buanderie (5 min, tous les 3 j), « Partout » (celle que Laeti avait passée à 1 min) disparaît, et la tâche gardée reçoit `quick` par la migration J1 ; fusion plan de travail : on garde « Nettoyer le plan de travail » ; l'historique des tâches fusionnées est rattaché à la tâche gardée (renommé en conséquence) et chaque fusion laisse un événement `fusion_taches` ; la session de test s'éteint seule après 3 h ; l'avertissement de nom proche ne s'affiche qu'à la création, jamais à la modification ; copies de sécurité de la migration dans le schéma `menage_sauvegarde`, conservées jusqu'à validation par Damien.

- **25/11/2026 (J3/IA0, fonction `llm`)** : le foyer de l'appelant est lu avec son propre jeton (RLS), jamais pris dans la requête ; quota, pauses et `llm_appel` écrits par le serveur seulement, un téléphone ne peut pas écrire de `llm_appel` (Q7 : plafond de 10 appels par minute et par foyer) ; consignes nommées côté serveur, pas de texte libre ; 403 et 404 s'ajoutent à 400/401 (arrêt sans bascule) ; tout 5xx bascule comme 503 ; un JSON invalide fait passer au modèle suivant sans pause ; quota compté en jour de Paris ; essai réel par deux boutons dans Réglages, visibles seulement en session de test.
- **25/11/2026 (IA0, mesure du délai Gemini)** : on ne coupe pas de « réflexion » (déjà au minimum) ; on mesure d'abord, avec un délai de 25 s réservé aux appels de test, avant tout correctif. Résultat : Gemini répond en 0,6 à 2,5 s, aucun correctif ; on garde 8 s et la bascule (1.12.2).
- **25/11/2026 (IA1, découpage validé)** : pas de table `propositions_ia` en IA1 (reportée à IA3) : événement journal `ia_saisie` avec seulement des compteurs, aucune migration ; le téléphone n'envoie que la phrase, la fonction lit tâches, pièces et prénoms avec le jeton de l'appelant et donne des références courtes au modèle ; prénoms remplacés par « quelqu'un » avant l'envoi ; validateur strict, carte rejetée plutôt que réponse entière (sauf si plus aucune carte valable) ; cartes cochées par défaut, sauf tâche déjà faite aujourd'hui ; une seule validation « OK », annulation en bloc ; une tâche créée n'est pas cochée faite d'office ; `agir` et `ajouterTache` reçoivent `depuis: 'ia'`.
- **25/11/2026 (J3, sécurité)** : limites d'essais 5 par téléphone / 15 min et 30 pour le projet / 1 h (jonction), 3 par téléphone et 20 pour le projet / 24 h (création) ; code toujours à 6 signes (la limite suffit) ; un essai bloqué l'est sans sermon (« laisse passer un quart d'heure ») ; trace des essais sans le code tapé, gardée 30 jours ; les règles de Panier ne sont pas touchées depuis cette appli (Q9).

## 17. Checklist « terminé » pour cette itération

- [ ] J0 à J2 livrés (PR #2 mergée le 25/11) et vérifiés sur le journal (mesures du §4 recalculées hors tests)
- [x] Copie de sécurité avant migration F4 (`menage_sauvegarde`, tables `*_20261125`), comptage avant/après identique : F4 lancée le 25/11 (56 → 54 tâches, historique 114 → 114)
- [ ] Champ `quick` migré (`2026-11-25_j1_quick.sql`, fait le 25/11), puis durées des 8 tâches de Laeti restaurées après son accord (`2026-11-25_j1_durees_a_valider.sql`, Q8)
- [x] RLS relue (J3, fait le 25/11) et correctif `2026-11-25_j3_securite.sql` lancé après déploiement de la 1.11.0 (lancé le 25/11), avant toute mise en ligne de l'IA
- [x] Bascule 429 / 503 testée sur chaque modèle (IA0, tests simulés le 25/11) ; essai réel avec les vraies clés fait le 25/11
- [x] Aucun secret dans le repo ni dans le client (vérifié le 25/11 : code et build)
- [ ] IA1 : `llm` v8 déployée le 25/11 (version en ligne vérifiée avant : v7 ; code relu après) ; reste : 1.13.0 en ligne, essai réel avec de vraies phrases, événements `ia_saisie` relus dans le journal
- [ ] SPEC.md à jour dans le même commit que chaque jalon
