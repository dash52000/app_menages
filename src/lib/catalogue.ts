// Catalogue de départ : les pièces courantes et leurs tâches classiques,
// avec un rythme et une durée par défaut. Le foyer coche ce qui le concerne
// à la configuration, puis ajuste à l'usage.
// Les icônes sont des noms d'illustrations (dossier public/illus, généré par
// scripts/gen-illustrations.ts à partir de Fluent Emoji, licence MIT).

export interface TacheCatalogue {
  nom: string;
  icone: string;
  rythme: number; // jours
  duree: number; // minutes
  /** Cochée par défaut à la configuration. */
  coche: boolean;
}

export interface PieceCatalogue {
  cle: string;
  nom: string;
  icone: string;
  /** Proposée par défaut à la configuration. */
  coche: boolean;
  taches: TacheCatalogue[];
}

const t = (nom: string, icone: string, rythme: number, duree: number, coche = true): TacheCatalogue => ({
  nom,
  icone,
  rythme,
  duree,
  coche,
});

export const CATALOGUE: PieceCatalogue[] = [
  {
    cle: 'partout',
    nom: 'Partout',
    icone: 'house',
    coche: true,
    taches: [
      t('Sortir les poubelles', 'wastebasket', 3, 2),
      t('Sortir le tri', 'recycling-symbol', 7, 2),
      t('Vitres', 'window', 30, 45),
      t('Lancer une lessive', 't-shirt', 4, 5, false),
      t('Interrupteurs et poignées', 'light-bulb', 30, 10, false),
      t('Bouches de VMC', 'dashing-away', 180, 15, false),
      t('Purger les radiateurs', 'thermometer', 365, 20, false),
    ],
  },
  {
    cle: 'cuisine',
    nom: 'Cuisine',
    icone: 'cooking',
    coche: true,
    taches: [
      t('Vider le lave-vaisselle', 'fork-and-knife-with-plate', 2, 2),
      t('Nettoyer le plan de travail', 'sponge', 2, 5),
      t("Nettoyer l'évier", 'potable-water', 7, 5),
      t('Nettoyer les plaques', 'fire', 7, 5),
      t('Laver le sol', 'bucket', 7, 15),
      t('Micro-ondes', 'timer-clock', 14, 5),
      t('Nettoyer le frigo', 'ice', 30, 20),
      t('Détartrer la bouilloire', 'hot-beverage', 30, 10, false),
      t('Nettoyer le four', 'bread', 60, 30, false),
      t('Hotte et filtre', 'cyclone', 90, 20, false),
      t('Dégivrer le congélateur', 'snowflake', 180, 45, false),
    ],
  },
  {
    cle: 'salle-de-bain',
    nom: 'Salle de bain',
    icone: 'bathtub',
    coche: true,
    taches: [
      t('Lavabo et miroir', 'mirror', 7, 10),
      t('Douche ou baignoire', 'shower', 7, 15),
      t('Laver le sol', 'bucket', 7, 10),
      t('Changer les serviettes', 'soap', 7, 2),
      t('Détartrer robinets et pommeau', 'droplet', 30, 15, false),
      t('Vider la poubelle', 'wastebasket', 7, 2, false),
    ],
  },
  {
    cle: 'wc',
    nom: 'WC',
    icone: 'toilet',
    coche: true,
    taches: [
      t('Nettoyer les toilettes', 'toilet', 7, 10),
      t('Laver le sol', 'bucket', 14, 5),
      t('Recharger le papier', 'roll-of-paper', 7, 2, false),
    ],
  },
  {
    cle: 'salon',
    nom: 'Salon',
    icone: 'couch-and-lamp',
    coche: true,
    taches: [
      t('Aspirateur', 'broom', 7, 20),
      t('Poussière', 'feather', 14, 15),
      t('Ranger', 'package', 3, 5, false),
      t('Laver le sol', 'bucket', 14, 15, false),
      t('Aspirer le canapé', 'couch-and-lamp', 30, 10, false),
      t('Arroser les plantes', 'potted-plant', 7, 5, false),
    ],
  },
  {
    cle: 'chambre',
    nom: 'Chambre',
    icone: 'bed',
    coche: true,
    taches: [
      t('Changer les draps', 'bed', 14, 15),
      t('Aspirateur', 'broom', 7, 15),
      t('Poussière', 'feather', 14, 10),
      t('Retourner le matelas', 'zzz', 90, 10, false),
      t('Laver couette et oreillers', 'cloud', 180, 15, false),
    ],
  },
  {
    cle: 'entree',
    nom: 'Entrée',
    icone: 'door',
    coche: true,
    taches: [
      t('Aspirateur', 'broom', 7, 5),
      t('Secouer le paillasson', 'door', 14, 2),
      t('Ranger les chaussures', 'running-shoe', 7, 5, false),
    ],
  },
  {
    cle: 'bureau',
    nom: 'Bureau',
    icone: 'desktop-computer',
    coche: false,
    taches: [
      t('Ranger le bureau', 'card-file-box', 7, 10),
      t('Poussière et écran', 'feather', 14, 10),
      t('Aspirateur', 'broom', 7, 10),
    ],
  },
  {
    cle: 'buanderie',
    nom: 'Buanderie',
    icone: 'basket',
    coche: false,
    taches: [
      t('Lancer une lessive', 't-shirt', 3, 5),
      t('Plier et ranger le linge', 'basket', 3, 15),
      t('Filtre du sèche-linge', 'dashing-away', 7, 2, false),
      t('Nettoyer le lave-linge', 'bubbles', 30, 15, false),
    ],
  },
  {
    cle: 'balcon',
    nom: 'Balcon',
    icone: 'potted-plant',
    coche: false,
    taches: [
      t('Arroser les plantes', 'droplet', 3, 5),
      t('Balayer', 'broom', 30, 10),
      t('Nettoyer le mobilier', 'chair', 90, 20, false),
    ],
  },
];

/** Banque d'illustrations proposées pour une pièce ou une tâche ajoutée à la main. */
export const BANQUE_ICONES = [
  'sparkles', 'broom', 'sponge', 'bucket', 'soap', 'bubbles', 'feather', 'droplet',
  'wastebasket', 'recycling-symbol', 'window', 'mirror', 'shower', 'bathtub', 'toilet', 'bed',
  'couch-and-lamp', 'door', 'cooking', 'fork-and-knife-with-plate', 'ice', 'fire', 'hot-beverage',
  'potted-plant', 'seedling', 't-shirt', 'basket', 'package', 'card-file-box', 'desktop-computer',
  'light-bulb', 'thermometer', 'dashing-away', 'running-shoe', 'teddy-bear', 'books', 'key',
  'hammer-and-wrench', 'house', 'chair',
];

/** Illustrations utilisées par l'interface elle-même. */
export const ICONES_INTERFACE = ['sparkles', 'house', 'check-mark-button', 'clapping-hands', 'sun-with-face', 'waving-hand'];

export const RYTHMES: Array<{ jours: number; libelle: string }> = [
  { jours: 1, libelle: 'Chaque jour' },
  { jours: 2, libelle: 'Tous les 2 jours' },
  { jours: 3, libelle: 'Tous les 3 jours' },
  { jours: 4, libelle: 'Tous les 4 jours' },
  { jours: 7, libelle: 'Chaque semaine' },
  { jours: 10, libelle: 'Tous les 10 jours' },
  { jours: 14, libelle: 'Toutes les 2 semaines' },
  { jours: 21, libelle: 'Toutes les 3 semaines' },
  { jours: 30, libelle: 'Chaque mois' },
  { jours: 60, libelle: 'Tous les 2 mois' },
  { jours: 90, libelle: 'Chaque trimestre' },
  { jours: 180, libelle: 'Tous les 6 mois' },
  { jours: 365, libelle: 'Chaque année' },
];

export const DUREES = [2, 5, 10, 15, 20, 30, 45, 60];

export function libelleRythme(jours: number): string {
  return RYTHMES.find((r) => r.jours === jours)?.libelle ?? `Tous les ${jours} jours`;
}

/** Version courte pour les listes : « tous les 2 j », « chaque sem. ». */
export function rythmeCourt(jours: number): string {
  if (jours === 1) return 'chaque jour';
  if (jours === 7) return 'chaque sem.';
  if (jours === 30) return 'chaque mois';
  if (jours === 90) return 'chaque trim.';
  if (jours === 365) return 'chaque année';
  if (jours % 30 === 0) return `tous les ${jours / 30} mois`;
  if (jours % 7 === 0) return `toutes les ${jours / 7} sem.`;
  return `tous les ${jours} j`;
}

export function libelleDuree(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`;
}
