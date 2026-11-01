// Catalogue des produits ménagers, rangé par famille.
// - indispensable : proposé coché à la configuration du placard ;
// - courant : proposé aussi à la configuration (« Vous avez aussi ? ») ;
// - specialise : dans une fiche, passe devant le basique seulement s'il est
//   au placard ; s'il n'y est pas, il n'est jamais poussé à l'achat.
// `emoji` sert quand on ajoute le produit à la liste de courses de Panier.

export type EtatProduit = 'ok' | 'bas' | 'vide';

export type Famille = 'basiques' | 'cuisine' | 'sdb' | 'sols' | 'linge' | 'surfaces' | 'materiel' | 'poele';

export const FAMILLES: Array<{ cle: Famille; nom: string }> = [
  { cle: 'basiques', nom: 'Basiques multi-usages' },
  { cle: 'cuisine', nom: 'Cuisine' },
  { cle: 'sdb', nom: 'Salle de bain et WC' },
  { cle: 'sols', nom: 'Sols' },
  { cle: 'linge', nom: 'Linge' },
  { cle: 'surfaces', nom: 'Vitres et meubles' },
  { cle: 'materiel', nom: 'Matériel et consommables' },
  { cle: 'poele', nom: 'Poêle à granulés' },
];

export interface ProduitCatalogue {
  cle: string;
  nom: string;
  icone: string;
  emoji: string;
  famille: Famille;
  indispensable: boolean;
  courant: boolean;
  specialise: boolean;
  usage: string;
}

type Options = { indispensable?: boolean; courant?: boolean; specialise?: boolean };

const p = (famille: Famille, cle: string, nom: string, icone: string, emoji: string, usage: string, o: Options = {}): ProduitCatalogue => ({
  cle,
  nom,
  icone,
  emoji,
  famille,
  usage,
  indispensable: Boolean(o.indispensable),
  courant: Boolean(o.courant),
  specialise: Boolean(o.specialise),
});

const I = { indispensable: true };
const C = { courant: true };
const S = { specialise: true };
const CS = { courant: true, specialise: true };

export const PRODUITS: ProduitCatalogue[] = [
  // ---------- Basiques multi-usages ----------
  p('basiques', 'vinaigre', 'Vinaigre blanc', 'sake', '🍶', 'Détartre, dégraisse, fait briller. Jamais sur le marbre ni la pierre.', I),
  p('basiques', 'bicarbonate', 'Bicarbonate de soude', 'salt', '🧂', 'Récure en douceur et absorbe les odeurs.', I),
  p('basiques', 'savon-noir', 'Savon noir', 'olive', '🧼', 'Les sols et les surfaces grasses, dilué dans l’eau chaude.', I),
  p('basiques', 'multi-surfaces', 'Nettoyant multi-surfaces', 'lotion-bottle', '🧴', 'Plan de travail, lavabo, poignées.', I),
  p('basiques', 'acide-citrique', 'Acide citrique', 'lemon', '🍋', 'Détartrant puissant sans odeur : bouilloire, pommeau, WC.', C),
  p('basiques', 'percarbonate', 'Percarbonate de soude', 'test-tube', '🧂', 'Blanchit, désinfecte, joints noircis. Avec des gants.', C),
  p('basiques', 'cristaux-soude', 'Cristaux de soude', 'gem-stone', '🧂', 'Dégraissant fort : four, hotte en inox. Avec des gants.', C),
  p('basiques', 'javel', 'Eau de Javel', 'lotion-bottle', '🧴', 'Désinfecte. Jamais mélangée à un autre produit.', C),
  p('basiques', 'savon-marseille', 'Savon de Marseille', 'soap', '🧼', 'Taches sur le linge, mains, petites surfaces.'),
  p('basiques', 'alcool-menager', 'Alcool ménager', 'lotion-bottle', '🧴', 'Vitres et inox sans traces. Loin des flammes.'),
  p('basiques', 'pierre-argile', 'Pierre d’argile', 'rock', '🪨', 'Nettoie et fait briller inox, plaques, éviers, robinets.', S),
  p('basiques', 'desinfectant', 'Spray désinfectant', 'shield', '🧴', 'Poignées, plan de travail après la viande crue.'),

  // ---------- Cuisine ----------
  p('cuisine', 'liquide-vaisselle', 'Liquide vaisselle', 'bubbles', '🧽', 'La vaisselle, et un dégraissant doux pour presque tout.', I),
  p('cuisine', 'pastilles-lv', 'Pastilles lave-vaisselle', 'pill', '🍽️', 'Une par lavage.', I),
  p('cuisine', 'creme-recurer', 'Crème à récurer', 'jar', '🧴', 'Plaques, évier, traces incrustées.', I),
  p('cuisine', 'nettoyant-vitro', 'Nettoyant vitrocéramique', 'cooking', '🧴', 'Plaques vitrocéramique et induction : enlève les traces et protège le verre.', CS),
  p('cuisine', 'grattoir-vitro', 'Grattoir vitrocéramique', 'razor', '🔪', 'Décolle le brûlé sur le verre des plaques, tenu à plat.', S),
  p('cuisine', 'nettoyant-inox', 'Nettoyant inox', 'potable-water', '🧴', 'Évier, hotte, électroménager inox : sans traces de doigts.', CS),
  p('cuisine', 'degraissant', 'Dégraissant cuisine', 'lotion-bottle', '🧴', 'Hotte, plaques, crédence.', CS),
  p('cuisine', 'nettoyant-four', 'Nettoyant four', 'lotion-bottle', '🧴', 'Four très encrassé. Gants et fenêtre ouverte.', CS),
  p('cuisine', 'sel-lv', 'Sel lave-vaisselle', 'salt', '🧂', 'Quand le voyant du lave-vaisselle s’allume.', CS),
  p('cuisine', 'liquide-rincage', 'Liquide de rinçage', 'droplet', '💧', 'Vaisselle sans traces. Voyant sur le lave-vaisselle.', CS),
  p('cuisine', 'nettoyant-lv', 'Nettoyant lave-vaisselle', 'fork-and-knife-with-plate', '🍽️', 'Un cycle à vide de temps en temps : graisse et calcaire.', S),
  p('cuisine', 'detartrant-cafe', 'Détartrant machine à café', 'hot-beverage', '☕', 'Selon le voyant ou la notice de la machine.', S),
  p('cuisine', 'filtre-hotte', 'Filtre à charbon de hotte', 'cyclone', '🌀', 'Hotte sans évacuation : à changer, il ne se lave pas.', S),

  // ---------- Salle de bain et WC ----------
  p('sdb', 'gel-wc', 'Gel WC', 'toilet', '🚽', 'Nettoie et détartre la cuvette.', I),
  p('sdb', 'papier-toilette', 'Papier toilette', 'roll-of-paper', '🧻', 'Garder deux rouleaux d’avance.', I),
  p('sdb', 'anticalcaire', 'Spray anticalcaire', 'shower', '🚿', 'Douche, parois, robinets.', CS),
  p('sdb', 'nettoyant-sdb', 'Nettoyant salle de bain', 'bathtub', '🧴', 'Lavabo, baignoire, douche : calcaire et traces de savon.', S),
  p('sdb', 'anti-moisissure', 'Anti-moisissure', 'microbe', '🧴', 'Joints noircis, silicone. Pièce aérée, jamais avec un acide.', CS),
  p('sdb', 'deboucheur', 'Déboucheur canalisations', 'plunger', '🪠', 'Évacuation lente. Ventouse ou bicarbonate et vinaigre d’abord.'),
  p('sdb', 'blocs-wc', 'Blocs WC', 'sweat-droplets', '🚽', 'Fraîcheur entre deux nettoyages.'),
  p('sdb', 'brosse-wc', 'Brosse WC', 'toothbrush', '🚽', 'À changer quand les poils s’écrasent.'),

  // ---------- Sols ----------
  p('sols', 'nettoyant-parquet', 'Nettoyant parquet', 'lotion-bottle', '🧴', 'Parquet et stratifié : nettoie sans détremper le bois.', S),
  p('sols', 'nettoyant-sols', 'Nettoyant sols', 'lotion-bottle', '🧴', 'Carrelage et sols durs, dilué dans le seau.', S),
  p('sols', 'serpillere', 'Serpillière ou franges', 'bucket', '🧽', 'À laver à 60 °C après usage.'),
  p('sols', 'lingettes-balai', 'Lingettes pour balai', 'broom', '🧹', 'Recharges du balai plat, sèches ou humides.'),
  p('sols', 'balai', 'Balai', 'broom', '🧹', 'Sols durs, balcon.'),
  p('sols', 'pelle-balayette', 'Pelle et balayette', 'broom', '🧹', 'Miettes et petits dégâts.'),
  p('sols', 'seau', 'Seau', 'bucket', '🪣', 'Lavage des sols et des vitres.'),

  // ---------- Linge ----------
  p('linge', 'lessive', 'Lessive', 'basket', '🧺', 'Le linge, les draps, les serviettes.', I),
  p('linge', 'assouplissant', 'Assouplissant', 'cloud', '🧴', 'Linge plus doux. Pas sur les serviettes ni le sport.', C),
  p('linge', 'detachant', 'Détachant avant lavage', 'magic-wand', '🧴', 'Sur la tache, quelques minutes avant la machine.', S),
  p('linge', 'terre-sommieres', 'Terre de Sommières', 'rock', '🧂', 'Taches de gras sur tissu : saupoudrer, laisser, brosser.'),
  p('linge', 'lingettes-couleur', 'Lingettes anti-décoloration', 'socks', '🧦', 'Pour laver couleurs et blancs ensemble.', S),
  p('linge', 'lessive-delicat', 'Lessive linge délicat', 'dress', '👗', 'Laine, soie, lingerie.'),
  p('linge', 'nettoyant-lave-linge', 'Nettoyant lave-linge', 't-shirt', '🧺', 'Un cycle à vide : odeurs et dépôts.', S),

  // ---------- Vitres et meubles ----------
  p('surfaces', 'nettoyant-vitres', 'Nettoyant vitres', 'window', '🪟', 'Vitres et miroirs.', CS),
  p('surfaces', 'depoussierant', 'Dépoussiérant meubles', 'feather', '🪶', 'Meubles et bois, sur le chiffon.', S),
  p('surfaces', 'nettoyant-ecran', 'Nettoyant écrans', 'television', '🖥️', 'Télé, ordinateur, sur le chiffon, jamais sur l’écran.', S),
  p('surfaces', 'nettoyant-cuir', 'Nettoyant cuir', 'couch-and-lamp', '🛋️', 'Canapé et fauteuils en cuir.', S),
  p('surfaces', 'lingettes', 'Lingettes nettoyantes', 'package', '🧻', 'Dépannage rapide.'),
  p('surfaces', 'raclette', 'Raclette', 'window', '🪟', 'Vitres et paroi de douche sans traces.'),

  // ---------- Matériel et consommables ----------
  p('materiel', 'eponges', 'Éponges', 'sponge', '🧽', 'À changer quand elles sentent ou s’effritent.', I),
  p('materiel', 'microfibres', 'Chiffons microfibre', 'yarn', '🧶', 'Poussière, vitres, séchage sans traces. Lavables en machine.', I),
  p('materiel', 'sacs-poubelle', 'Sacs poubelle', 'wastebasket', '🗑️', 'Poubelle de la cuisine et de la salle de bain.', I),
  p('materiel', 'gants', 'Gants de ménage', 'gloves', '🧤', 'Pour les produits qui irritent et les WC.', I),
  p('materiel', 'essuie-tout', 'Essuie-tout', 'roll-of-paper', '🧻', 'Graisse, éclaboussures, détartrage des robinets.', I),
  p('materiel', 'sacs-tri', 'Sacs de tri', 'recycling-symbol', '♻️', 'Pour la poubelle des emballages.', S),
  p('materiel', 'sacs-aspirateur', 'Sacs d’aspirateur', 'dashing-away', '🌀', 'À changer quand le sac est plein aux deux tiers.', CS),
  p('materiel', 'filtre-aspirateur', 'Filtre d’aspirateur', 'gear', '⚙️', 'À rincer ou changer selon la notice.'),
  p('materiel', 'gants-jetables', 'Gants jetables', 'gloves', '🧤', 'WC, poubelles, cendres.'),
  p('materiel', 'desodorisant', 'Désodorisant d’intérieur', 'leaf-fluttering-in-wind', '🌿', 'Entrée, WC. Aérer reste le plus efficace.'),

  // ---------- Poêle à granulés ----------
  p('poele', 'granules', 'Granulés de bois', 'wood', '🪵', 'Certifiés ENplus A1 ou DINplus : moins de cendres, moins de nettoyage. À stocker au sec.'),
  p('poele', 'nettoyant-vitre-poele', 'Nettoyant vitre de poêle', 'fire', '🧴', 'Vitre froide uniquement. Enlève la suie sans rayer.', S),
  p('poele', 'gants-chaleur', 'Gants anti-chaleur', 'gloves', '🧤', 'Pour manipuler le creuset et le cendrier.', S),
];

export const PRODUITS_PAR_CLE: Record<string, ProduitCatalogue> = Object.fromEntries(PRODUITS.map((x) => [x.cle, x]));

export function estSpecialise(cle: string | null | undefined): boolean {
  return Boolean(cle && PRODUITS_PAR_CLE[cle]?.specialise);
}

/** Illustrations proposées pour un produit ajouté à la main. */
export const ICONES_PRODUITS = [
  'lotion-bottle', 'sake', 'jar', 'salt', 'bubbles', 'soap', 'sponge', 'yarn', 'gloves', 'roll-of-paper',
  'wastebasket', 'basket', 'lemon', 'test-tube', 'gem-stone', 'droplet', 'pill', 'toilet', 'shower', 'window',
  'olive', 'sparkles', 'package', 'wood', 'fire', 'broom', 'bucket', 'microbe', 'shield', 'rock',
];

export const ETATS: Record<EtatProduit, { libelle: string; suivant: EtatProduit }> = {
  ok: { libelle: 'En stock', suivant: 'bas' },
  bas: { libelle: 'Bientôt fini', suivant: 'vide' },
  vide: { libelle: 'Fini', suivant: 'ok' },
};

/** Emoji pour Panier d'un produit ajouté à la main. */
export function emojiPour(cle: string | null): string {
  return (cle && PRODUITS_PAR_CLE[cle]?.emoji) || '🧴';
}
