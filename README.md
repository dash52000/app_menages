# Coup de frais

Le suivi du ménage à deux, pour Damien et Laeti. Web app installable (PWA) sur iPhone et Android, synchronisée en temps réel via Supabase, hébergée sur GitHub Pages. Nom provisoire : il se change dans `src/config.ts`, `index.html` et `vite.config.ts`.

Ce dépôt contient la **V1.5** :

- **Configuration en 5 minutes** : on coche ses pièces, l'appli propose les tâches courantes avec un rythme et une durée par défaut.
- **Le check du jour** : 5 tâches au plus, les petites victoires d'abord, quatre boutons (Fait, Fait par l'autre, Demain, Je prends). Un check manqué se rattrape au suivant (« Depuis mardi, qu'est-ce qui a été fait ? »), avec « Changer le jour » après coup.
- **Jauge positive** : « Maison à 82 % », moyenne des fraîcheurs pondérée par la durée. Jamais de rouge, jamais de dette.
- **Vue par pièce** : jauge par pièce, tâche faite en un tap, ajout et modification des tâches et des pièces.
- **Synchro des deux téléphones** en temps réel, **hors ligne** compris (les changements attendent le réseau).
- **Journal d'utilisation** pour décider des mises à jour sur des faits (voir plus bas), exportable en CSV.

Nouveautés de la **V1.5** :

- **Placard** : les produits ménagers à disposition, en trois états (En stock → Bientôt fini → Fini, un tap). Les indispensables sont proposés à la première ouverture ; ceux qui manquent passent « À racheter ». Le caddie ajoute le produit à la liste de courses de **Panier** (même base Supabase, sans doublon s'il y est déjà).
- **Fiche de chaque tâche** (un tap sur la tâche) : produit idéal et ce que vous avez à la place, matériel, étapes, astuce, mises en garde (jamais Javel + vinaigre…). Les 40 tâches du catalogue ont leur fiche ; chaque tâche peut avoir ses propres consignes et ses propres produits.
- **Le produit à prendre** sur chaque carte du check, avec un point orange s'il manque.
- **« Autre chose de fait ? »** sur Aujourd'hui : une tâche faite hors du check, par qui, quel jour. Dans les pièces, ✓ = moi, et le bandeau propose « C'était Laeti ? ».

Les nudges (rappel, merci, équilibre, repartir à zéro, mode absence) arrivent en V2 ; les rythmes adaptatifs, le lissage et les tâches saisonnières en V3.

### Passer de la V1 à la V1.5

Une seule chose à faire : dans Supabase, *SQL Editor* → *New query*, recoller `supabase/schema.sql` et *Run*. Le script ne touche pas aux données existantes. Tant que ce n'est pas fait, l'appli fonctionne comme avant et l'onglet Placard affiche un rappel.

## Mise en route (une seule fois)

1. **Base de données** : dans Supabase (le même projet que Panier), *SQL Editor* → *New query*, coller `supabase/schema.sql`, *Run*. Les tables sont préfixées `menage_` et ne touchent pas à celles de Panier. Le script peut être relancé sans risque.
2. **Identité anonyme** : *Authentication* → *Sign In / Providers* → activer **Allow anonymous sign-ins**. Chaque téléphone reçoit ainsi une identité sans compte ni mot de passe.
3. **Hébergement** : sur GitHub, *Settings* → *Pages* → *Source* : **GitHub Actions**. L'appli est ensuite en ligne sur `https://dash52000.github.io/app_menages/`.

## Installer sur les téléphones

1. Ouvrir le lien de l'appli et l'installer : **iPhone (Safari)** bouton Partager → « Sur l'écran d'accueil » ; **Android (Chrome)** menu ⋮ → « Installer l'application ».
2. Ouvrir l'appli **depuis l'icône** (sur iPhone, l'appli installée ne partage pas les données de Safari).
3. Le premier : « Créer notre maison ». Le second : « J'ai un code », avec le code affiché dans Réglages (ou le lien d'invitation).

Si un téléphone perd sa session, il rejoint avec le même code et le même prénom : il retrouve son profil.

## Sécurité

Chaque ligne porte l'identifiant du foyer, et les règles RLS de Supabase ne laissent un téléphone voir que les lignes de son foyer, une fois rattaché par le code. La clé publique `anon` dans `src/config.ts` est publique par nature.

## Journal d'utilisation

Table `menage_journal` (un événement par ligne, `details` en JSON), exportable depuis Réglages.

| Événement | Détails | Ce qu'il éclaire |
| --- | --- | --- |
| `ouverture` | source (`directe`, `retour`, `rappel` en V2), heure, appli installée ou non | Quand et comment on ouvre l'appli |
| `check_termine` | durée, nombre de tâches, actions par bouton, faites sur l'autre téléphone, ignorées, jours couverts, reprise | Le check tient-il en 15 secondes |
| `check_abandonne` | durée, actions faites avant de quitter | Où le check décourage |
| `check_vide`, `check_suite` | jours couverts, tâches restantes | Charge réelle de la maison |
| `bouton_tache` | action, depuis le check, une pièce ou « Autre chose de fait ? », tâche, rythme, décalage de jour | Tâches toujours reportées, rythmes mal calés, tâches faites hors check |
| `changement_jour`, `annulation` | action, tâche | Erreurs de saisie, rattrapages |
| `vue_onglet`, `vue_piece` | onglet, pièce | Quels écrans servent vraiment |
| `tache_creee`, `tache_modifiee`, `tache_supprimee` | ancien et nouveau rythme ou durée, origine | Le catalogue de départ est-il juste |
| `piece_creee`, `piece_modifiee`, `piece_supprimee`, `configuration_terminee` | nombre de tâches, ajustements, durée | Coût de la configuration |
| `vue_fiche` | tâche, depuis le check ou une pièce | Les fiches servent-elles, pour quelles tâches |
| `placard_configure`, `produit_etat`, `produit_cree`, `produit_modifie`, `produit_supprime` | produit, état avant et après | Rythme de consommation des produits |
| `ajout_courses` | produit, résultat (ajouté, déjà sur la liste, erreur), depuis | Le lien avec Panier sert-il |
| `correction_auteur` | tâche | Le ✓ = moi est-il le bon réglage par défaut |
| `invitation`, `export` | type | Usages annexes |

Premiers indicateurs : durée médiane du check, taux de report par tâche, jours sans check par semaine, part des ouvertures venues du rappel.

## Développer

```bash
npm install
npm run dev              # contre la vraie base
VITE_MOCK=1 npm run dev  # base factice en mémoire, sans réseau
npm test                 # fraîcheur, jauge, choix du check, fiches, produits, export CSV
npm run build
npm run gen:illustrations  # après avoir changé le catalogue (src/lib/catalogue.ts)
```

En mode factice, `window.mockAutre()` simule le second téléphone (profil Laeti) et `window.mockAutre('Aspirateur')` lui fait faire une tâche ; `window.mockHorsLigne = true` coupe le réseau ; `window.mockBaseV1 = true` (avant le chargement) simule une base pas encore passée en V1.5.

Chaque push sur `main` est testé, construit et déployé sur GitHub Pages par `.github/workflows/deploy.yml`.

## Organisation du code

- `src/lib/fraicheur.ts` : fraîcheur, jauge, sélection du check (fonctions pures, testées).
- `src/lib/useMaison.ts` : données, temps réel, cache, file d'attente hors ligne, journal.
- `src/lib/catalogue.ts` : pièces et tâches proposées, rythmes, durées.
- `src/lib/fiches.ts` : fiches « comment faire » et choix du produit selon le placard (testés).
- `src/lib/produits.ts` : produits ménagers du catalogue (indispensables et utiles en plus).
- `src/components/` : écrans (Arrivée, Configuration, Aujourd'hui, Pièces, Placard, Réglages, fiche de tâche).
- `supabase/schema.sql` : tables, règles d'accès, fonctions créer / rejoindre un foyer.

Illustrations : [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (Microsoft), licence MIT.
