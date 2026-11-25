# SPEC — Coup de frais

Repo : `dash52000/app_menages` · Version au 25/11/2026 : 1.10.0 (jalons J0 à J2 livrés dans le code, migrations à lancer) · Fiche mise à jour : 25/11/2026
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

**Prévu**
- `llm_appel` (événement du journal) pour la brique IA.
- `ia_usage` (foyer_id, jour, nb_appels) : quota.
- `propositions_ia` (id, foyer_id, type, payload JSON, statut proposée/acceptée/refusée, cree_le, traite_par) : trace de chaque carte de proposition.

## 6. Écrans et parcours

Quatre onglets : **Aujourd'hui** (check, quick, « autre proposition » jusqu'à 3 refus puis liste), **Pièces** (tâches par pièce, fiches), **Placard** (produits, courses), **Réglages** (dont export CSV et JSON, session de test).

Parcours de Laeti à protéger : Pièces → cocher en 1 tap ; fiche en 1 tap.
Ajout : champ « Dis-le en une phrase » dans Aujourd'hui, bouton photo, badge de propositions dans Réglages (voir §9).

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

## 8. Sécurité (à traiter avant la brique IA, sur Opus)

- Relire les règles RLS Supabase pour toutes les tables.
- Le code du foyer (6 caractères) donne accès au foyer : vérifier qu'il n'est pas devinable, limiter les tentatives, ne jamais le mettre dans un repo ni dans une fiche.
- Le fichier de sauvegarde JSON contient ce code : le traiter comme sensible.
- Les copies de sécurité du schéma `menage_sauvegarde` (créées par la migration F4) ont la RLS activée et ne sont pas exposées par l'API ; à relire en J3.
- Définir comment la fonction `llm` identifie le foyer appelant.

## 9. IA

**Dérogation au socle** : le socle dit « pas d'IA sauf si la fiche le demande ». Cette fiche le demande, dans le cadre ci-dessous.

**Architecture**
- Une Edge Function Supabase `llm`. Les clés Gemini et Groq sont des secrets Supabase : jamais dans le repo, jamais dans le client.
- Chaîne de modèles par type de besoin : une chaîne **texte** (Gemini puis Groq) et une chaîne **vision** (Gemini en priorité ; vérifier ce que Groq propose). Modèles choisis au moment du code.
- Basculement : un seul essai par modèle ; sur 429 (en lisant `Retry-After`), 503 ou délai dépassé (8 s), le modèle passe en pause et on essaie le suivant ; sur 400 ou 401, on ne bascule pas (bug côté nous). Toute la chaîne en échec : l'appli continue sans IA.
- Sorties en JSON validé côté serveur. Un JSON invalide est traité comme un échec.
- Quota : 100 appels par jour et par foyer (décidé le 25/11). Garde-fou ajouté, à confirmer : un plafond par minute (10 par exemple) pour qu'un bug en boucle ne vide pas le palier gratuit en quelques minutes. Chaque appel est journalisé (`llm_appel` : modèle, latence, nombre de bascules, succès), sans le contenu.

**Règle centrale** : le LLM n'écrit jamais en base. Il renvoie des **cartes de proposition** (type, tâche ciblée, avant/après, raison courte). L'appli les affiche avec « OK / Non » ; en cas de OK, le code existant écrit, donc l'annulation actuelle fonctionne. Toute proposition citant un id inconnu est rejetée côté serveur.

**Forme** : invisible, sans chat. Pas de chat libre.

**Fini quand…**
- **IA0 — Brique** : bascule testée en simulant 429 puis 503 sur chaque modèle de la chaîne ; échec complet sans erreur bloquante ; aucun secret dans le client ni le repo.
- **IA1 — Saisie en langage naturel** : « on a fait la salle de bain à fond » → cartes de cases à cocher parmi les tâches existantes (la liste avec ids est fournie au modèle), ou carte de nouvelle tâche (pièce, rythme, durée). 3 taps au maximum : écrire, envoyer, OK.
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

## 14. Questions ouvertes

Q1 à Q5 tranchées le 25/11 (voir §16). Restent :
- **Q6** : heure, canal et contenu du rappel unique (J8).
- **Q7** : plafond par minute pour les appels IA (10 proposé).
- **Q8** : valider avec Laeti la restauration des durées d'avant pour les 8 tâches passées à 1 min (F5).

## 15. Jalons (modèle indiqué pour économiser les crédits)

| Jalon | Contenu | Modèle |
|---|---|---|
| J0 | F1, F4, F7 | Sonnet · code livré en 1.8.0 |
| J1 | F2, F3, F5, F8 | Sonnet · code livré en 1.9.0 |
| J2 | F6 | Sonnet · code livré en 1.10.0 |
| J3 | §8 sécurité et RLS, puis IA0 | Opus |
| J4 | IA1 | Sonnet |
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
- **25/11/2026 (J0, choix d'implémentation)** : fusion lessive : on garde la tâche de la Buanderie (rythme 5 j), « Partout » disparaît ; fusion plan de travail : on garde « Nettoyer le plan de travail » ; l'historique des tâches fusionnées est rattaché à la tâche gardée (renommé en conséquence) et chaque fusion laisse un événement `fusion_taches` ; la session de test s'éteint seule après 3 h ; l'avertissement de nom proche ne s'affiche qu'à la création, jamais à la modification ; copies de sécurité de la migration dans le schéma `menage_sauvegarde`, conservées jusqu'à validation par Damien.

## 17. Checklist « terminé » pour cette itération

- [ ] J0 à J2 livrés et vérifiés sur le journal (mesures du §4 recalculées hors tests)
- [ ] Sauvegarde JSON avant migration F4 et F5, comptage avant/après identique (F4 : essai à blanc OK le 25/11, reste à lancer pour de vrai)
- [ ] Champ `quick` migré (`2026-11-25_j1_quick.sql`), puis durées des 8 tâches de Laeti restaurées après son accord (`2026-11-25_j1_durees_a_valider.sql`, Q8)
- [ ] RLS relue (J3) avant toute mise en ligne de l'IA
- [ ] Bascule 429 / 503 testée sur chaque modèle (IA0)
- [ ] Aucun secret dans le repo ni dans le client
- [ ] SPEC.md à jour dans le même commit que chaque jalon
