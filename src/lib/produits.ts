// Catalogue des produits ménagers : les indispensables (proposés à la
// configuration du placard) et les produits utiles en plus.
// `emoji` sert quand on ajoute le produit à la liste de courses de Panier.

export type EtatProduit = 'ok' | 'bas' | 'vide';

export interface ProduitCatalogue {
  cle: string;
  nom: string;
  icone: string;
  emoji: string;
  indispensable: boolean;
  usage: string;
}

const p = (cle: string, nom: string, icone: string, emoji: string, indispensable: boolean, usage: string): ProduitCatalogue => ({
  cle,
  nom,
  icone,
  emoji,
  indispensable,
  usage,
});

export const PRODUITS: ProduitCatalogue[] = [
  // ---------- Indispensables ----------
  p('vinaigre', 'Vinaigre blanc', 'sake', '🍶', true, 'Détartre, dégraisse, fait briller. Jamais sur le marbre ni la pierre.'),
  p('bicarbonate', 'Bicarbonate de soude', 'salt', '🧂', true, 'Récure en douceur et absorbe les odeurs.'),
  p('savon-noir', 'Savon noir', 'olive', '🧼', true, 'Les sols et les surfaces grasses, dilué dans l’eau chaude.'),
  p('liquide-vaisselle', 'Liquide vaisselle', 'bubbles', '🧽', true, 'La vaisselle, et un dégraissant doux pour presque tout.'),
  p('pastilles-lv', 'Pastilles lave-vaisselle', 'pill', '🍽️', true, 'Une par lavage.'),
  p('multi-surfaces', 'Nettoyant multi-surfaces', 'lotion-bottle', '🧴', true, 'Plan de travail, lavabo, poignées.'),
  p('gel-wc', 'Gel WC', 'toilet', '🚽', true, 'Nettoie et détartre la cuvette.'),
  p('creme-recurer', 'Crème à récurer', 'jar', '🧴', true, 'Plaques, évier, traces incrustées.'),
  p('lessive', 'Lessive', 'basket', '🧺', true, 'Le linge, les draps, les serviettes.'),
  p('eponges', 'Éponges', 'sponge', '🧽', true, 'À changer quand elles sentent ou s’effritent.'),
  p('microfibres', 'Chiffons microfibre', 'yarn', '🧶', true, 'Poussière, vitres, séchage sans traces. Lavables en machine.'),
  p('sacs-poubelle', 'Sacs poubelle', 'wastebasket', '🗑️', true, 'Poubelle de la cuisine et de la salle de bain.'),
  p('gants', 'Gants de ménage', 'gloves', '🧤', true, 'Pour les produits qui irritent et les WC.'),
  p('essuie-tout', 'Essuie-tout', 'roll-of-paper', '🧻', true, 'Graisse, éclaboussures, détartrage des robinets.'),
  p('papier-toilette', 'Papier toilette', 'roll-of-paper', '🧻', true, 'Garder deux rouleaux d’avance.'),
  // ---------- Utiles en plus ----------
  p('acide-citrique', 'Acide citrique', 'lemon', '🍋', false, 'Détartrant puissant sans odeur : bouilloire, pommeau, WC.'),
  p('percarbonate', 'Percarbonate de soude', 'test-tube', '🧂', false, 'Blanchit, désinfecte, joints noircis. Avec des gants.'),
  p('cristaux-soude', 'Cristaux de soude', 'gem-stone', '🧂', false, 'Dégraissant fort : four, hotte en inox. Avec des gants.'),
  p('nettoyant-vitres', 'Nettoyant vitres', 'window', '🪟', false, 'Vitres et miroirs.'),
  p('anticalcaire', 'Spray anticalcaire', 'shower', '🚿', false, 'Douche, parois, robinets.'),
  p('degraissant', 'Dégraissant cuisine', 'lotion-bottle', '🧴', false, 'Hotte, plaques, crédence.'),
  p('nettoyant-four', 'Nettoyant four', 'lotion-bottle', '🧴', false, 'Four très encrassé. Gants et fenêtre ouverte.'),
  p('javel', 'Eau de Javel', 'lotion-bottle', '🧴', false, 'Désinfecte. Jamais mélangée à un autre produit.'),
  p('sel-lv', 'Sel lave-vaisselle', 'salt', '🧂', false, 'Quand le voyant du lave-vaisselle s’allume.'),
  p('liquide-rincage', 'Liquide de rinçage', 'droplet', '💧', false, 'Vaisselle sans traces. Voyant sur le lave-vaisselle.'),
];

export const PRODUITS_PAR_CLE: Record<string, ProduitCatalogue> = Object.fromEntries(PRODUITS.map((x) => [x.cle, x]));

/** Illustrations proposées pour un produit ajouté à la main. */
export const ICONES_PRODUITS = [
  'lotion-bottle', 'sake', 'jar', 'salt', 'bubbles', 'soap', 'sponge', 'yarn', 'gloves', 'roll-of-paper',
  'wastebasket', 'basket', 'lemon', 'test-tube', 'gem-stone', 'droplet', 'pill', 'toilet', 'shower', 'window',
  'olive', 'sparkles', 'package',
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
