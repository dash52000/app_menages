# SOCLE : règles communes à toutes mes applis

**Usage :** copier ce fichier à la racine de chaque repo, à côté de `SPEC.md` (la fiche de l'appli).
Claude lit les deux avant toute modification. Si la fiche et le socle se contredisent, **le socle gagne**, sauf dérogation écrite dans la section « Dérogations » de la fiche.

---

## 1. Planchers (non négociables)

### P1. Zéro culpabilité
- Pas de série qui punit, pas de « mur rouge », pas de compteur d'échecs, pas de message qui reproche.
- Une série qui casse, casse : elle repart de zéro, sans sermon.
- Ton bienveillant, jamais moralisateur.

### P2. Anti-friction
- Rien d'obligatoire : aucune saisie ou action n'est imposée pour continuer à utiliser l'appli.
- L'action la plus fréquente se fait en 3 taps maximum (la fiche précise le chiffre exact).
- Aucun écran de configuration avant la première utilisation.
- Si une fonction demande plus d'effort qu'elle ne rapporte, on ne la construit pas.

### P3. Données exportables
- Export CSV de toutes les données de l'utilisateur, depuis l'appli.
- Chaque enregistrement a un identifiant stable (id) pour permettre les échanges entre applis.
- Aucun format propriétaire.

### P4. Nudges et ergonomie
- Bons défauts pré-remplis : l'utilisateur corrige plutôt que de saisir.
- L'appli guide doucement (suggestion, jamais obligation).
- Le parcours le plus court est mis en avant ; le reste est accessible mais discret.
- Lisible d'un coup d'œil, utilisable d'une main.

---

## 2. Stack par défaut (à confirmer, la fiche peut y déroger)

- **Code :** écrit par Claude dans un repo GitHub (compte `dash52000`). Pas d'AI Studio pour les nouvelles applis.
- **Plateforme :** Android natif quand l'appli est pour moi seul ; web app quand elle est partagée avec quelqu'un sur iPhone.
- **Build :** APK généré par GitHub Actions.
- **Langage / framework Android :** `[À CONFIRMER]`
- **Base de données :** Supabase quand il faut synchroniser ou partager ; sinon stockage local.
- **IA dans l'appli :** aucune par défaut (règles fixes). Si la fiche en demande, préciser le modèle et le fournisseur.
- **Secrets :** jamais de clé API dans le repo. Les règles d'accès Supabase (RLS) sont relues avant la mise en usage réel.
- **Langue :** français, tutoiement, ton bienveillant.

---

## 3. Conventions de travail avec Claude

1. **Lire `SOCLE.md` et `SPEC.md` avant toute modification.**
2. **Définir « fini » avant de coder** : reprendre le critère « Fini quand… » de la fiche, ou l'écrire s'il manque.
3. **Rester dans le périmètre.** Une idée hors fiche va dans « Idées reportées », elle n'est pas codée.
4. **Modifications ciblées**, une à la fois. Vérifier par observation (le build passe, l'écran affiche bien ce qui est attendu), pas par déclaration.
5. **Bug qui revient :** reproduire d'abord, annoncer la cause, puis corriger. Après 3 essais ratés, s'arrêter et exposer l'état au lieu de continuer à tâtons.
6. **Tenir la fiche à jour** : toute modification qui touche le modèle de données, le périmètre ou une décision met à jour `SPEC.md` dans le même commit.
7. **Jamais de suppression de données utilisateur** sans confirmation explicite.
8. **Choix du modèle Claude :** Sonnet pour les itérations (écran, bug, mise en page, mise à jour de specs) ; Opus pour poser l'architecture d'une nouvelle appli, un bug coriace touchant beaucoup de fichiers, la fusion d'applis, la sécurité (RLS Supabase, clés API).
