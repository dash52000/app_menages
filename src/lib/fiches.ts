// Fiches « comment faire » des tâches du catalogue : étapes, produits
// (le premier de chaque besoin est l'idéal, les suivants le remplacent),
// matériel, astuce et mises en garde.
// Clé : le nom de la tâche normalisé (« Laver le sol » sert dans toutes les pièces).
import { normaliser } from './normalise.ts';
import type { EtatProduit } from './produits.ts';

export interface Fiche {
  etapes: string[];
  /** Chaque besoin : options par ordre de préférence (clés de produits). */
  besoins?: string[][];
  materiel?: string[];
  astuce?: string;
  attention?: string[];
}

const JAVEL_ACIDE = 'Ne jamais mélanger l’eau de Javel avec du vinaigre ou un détartrant : le mélange dégage un gaz toxique.';

const FICHES_PAR_NOM: Record<string, Fiche> = {
  // ---------- Partout ----------
  'Sortir les poubelles': {
    besoins: [['sacs-poubelle']],
    etapes: [
      'Fermer le sac et le porter au conteneur.',
      'Mettre un sac neuf.',
      'Si la poubelle sent : une cuillère de bicarbonate au fond, sous le sac.',
    ],
  },
  'Sortir le tri': {
    etapes: [
      'Vider bouteilles, pots et boîtes : pas besoin de les laver.',
      'Aplatir les cartons et les bouteilles en plastique.',
      'Les déposer au bac ou au conteneur de tri.',
    ],
    astuce: 'Les consignes changent d’une commune à l’autre : en cas de doute, elles sont sur le bac.',
  },
  Vitres: {
    besoins: [['vinaigre', 'nettoyant-vitres', 'liquide-vaisselle'], ['microfibres', 'essuie-tout']],
    materiel: ['Raclette (idéal)', 'Seau'],
    etapes: [
      'Dépoussiérer les cadres et le rebord avec un chiffon humide.',
      'Dans un seau d’eau tiède : un verre de vinaigre blanc, ou quelques gouttes de liquide vaisselle.',
      'Mouiller la vitre, puis passer la raclette de haut en bas en essuyant la lame à chaque passage.',
      'Finir les bords et les traces avec une microfibre sèche.',
    ],
    astuce: 'Évite le plein soleil : l’eau sèche trop vite et laisse des traces.',
  },
  'Lancer une lessive': {
    besoins: [['lessive']],
    etapes: [
      'Trier : blancs, couleurs, foncés, et ce qui se lave à 60 °C (draps, serviettes).',
      'Vider les poches.',
      'Doser selon l’emballage : en mettre plus ne lave pas mieux.',
      'Laisser une main de place en haut du tambour.',
      'Étendre dès la fin du cycle pour éviter l’odeur d’humidité.',
    ],
  },
  'Interrupteurs et poignées': {
    besoins: [['multi-surfaces', 'vinaigre', 'liquide-vaisselle'], ['microfibres']],
    etapes: [
      'Vaporiser le produit sur le chiffon, jamais directement sur l’interrupteur.',
      'Essuyer interrupteurs, poignées de portes et de placards, télécommandes.',
      'Repasser avec un coin sec du chiffon.',
    ],
  },
  'Bouches de VMC': {
    besoins: [['liquide-vaisselle'], ['eponges']],
    etapes: [
      'Déclipser ou dévisser la bouche d’aération.',
      'La laver à l’eau chaude savonneuse, la rincer, la laisser sécher complètement.',
      'Dépoussiérer l’entrée du conduit avec l’embout de l’aspirateur.',
      'Remettre la bouche en place.',
    ],
    attention: ['Bouche avec une partie électrique ou un réglage automatique de l’humidité (hygroréglable) : ne pas la tremper, juste un chiffon humide.'],
  },
  'Purger les radiateurs': {
    materiel: ['Clé de purge', 'Chiffon', 'Petit récipient'],
    etapes: [
      'Couper le chauffage et attendre que les radiateurs soient froids.',
      'Placer le chiffon et le récipient sous la vis de purge, en haut du radiateur.',
      'Ouvrir doucement la vis avec la clé : l’air siffle.',
      'Refermer dès que l’eau coule sans bulles.',
      'Vérifier la pression de la chaudière (souvent entre 1 et 1,5 bar), la remettre à niveau si besoin, puis rallumer.',
    ],
    attention: ['Si la pression chute souvent, c’est à signaler au propriétaire ou au chauffagiste.'],
  },

  // ---------- Cuisine ----------
  'Vider le lave-vaisselle': {
    besoins: [['pastilles-lv']],
    etapes: [
      'Commencer par le panier du bas : l’eau restée sur les tasses du haut ne coulera pas sur la vaisselle sèche.',
      'Puis le panier du haut et les couverts.',
      'Vérifier qu’il reste des pastilles pour le prochain lavage.',
    ],
    astuce: 'Les voyants sel et liquide de rinçage indiquent quand en remettre.',
  },
  'Nettoyer le plan de travail': {
    besoins: [['multi-surfaces', 'liquide-vaisselle'], ['eponges'], ['microfibres']],
    etapes: [
      'Ranger ce qui traîne et faire tomber les miettes.',
      'Laver à l’éponge avec le produit, en insistant sur les taches grasses.',
      'Rincer si besoin et sécher avec une microfibre.',
    ],
    attention: [
      'Marbre ou pierre naturelle : ni vinaigre ni acide, ça les ternit.',
      'Plan en bois : peu d’eau, et bien sécher.',
    ],
  },
  'Nettoyer l’évier': {
    besoins: [['bicarbonate', 'creme-recurer'], ['vinaigre'], ['eponges']],
    etapes: [
      'Rincer l’évier et vider la bonde.',
      'Saupoudrer du bicarbonate et frotter avec le côté doux de l’éponge.',
      'Contre le calcaire : un peu de vinaigre blanc sur le robinet et les traces blanches.',
      'Rincer et sécher avec un chiffon : c’est ce qui fait briller l’inox.',
    ],
    attention: ['Évier en pierre ou en résine : pas de vinaigre, une crème douce à la place.'],
  },
  'Nettoyer les plaques': {
    besoins: [['liquide-vaisselle', 'multi-surfaces'], ['creme-recurer', 'bicarbonate'], ['microfibres']],
    materiel: ['Grattoir pour vitrocéramique (si c’est brûlé)'],
    etapes: [
      'Attendre que les plaques soient froides.',
      'Laver à l’éponge avec de l’eau chaude et du liquide vaisselle.',
      'Traces brûlées : crème à récurer douce, ou le grattoir tenu à plat sur vitrocéramique et induction.',
      'Sécher avec une microfibre pour éviter les traces.',
    ],
    astuce: 'Plaques au gaz : faire tremper les grilles et les chapeaux dans l’eau chaude savonneuse.',
    attention: ['Pas de côté vert grattant sur le verre : ça raye.'],
  },
  'Laver le sol': {
    besoins: [['savon-noir', 'multi-surfaces']],
    materiel: ['Seau', 'Serpillière ou balai à franges'],
    etapes: [
      'Passer l’aspirateur ou le balai d’abord.',
      'Dans un seau d’eau chaude : une à deux cuillères à soupe de savon noir pour 5 litres.',
      'Laver avec la serpillière bien essorée, du fond de la pièce vers la porte.',
      'Laisser sécher sans marcher dessus.',
    ],
    attention: ['Parquet : serpillière à peine humide, jamais d’eau qui stagne.'],
  },
  'Micro-ondes': {
    besoins: [['vinaigre', 'acide-citrique'], ['eponges']],
    etapes: [
      'Mettre dans le micro-ondes un bol d’eau avec deux cuillères de vinaigre blanc (ou une cuillère d’acide citrique).',
      'Chauffer 3 à 5 minutes, puis laisser la porte fermée 2 minutes : la vapeur décolle tout.',
      'Sortir le bol avec précaution, il est brûlant.',
      'Essuyer l’intérieur, le plateau et la porte avec une éponge.',
    ],
  },
  'Nettoyer le frigo': {
    besoins: [['bicarbonate', 'liquide-vaisselle'], ['eponges'], ['microfibres']],
    etapes: [
      'Sortir les aliments, jeter ce qui est périmé, garder le reste au frais (glacière, sac isotherme).',
      'Sortir clayettes et bacs, les laver à l’eau tiède savonneuse.',
      'Nettoyer l’intérieur et les joints avec de l’eau tiède et une cuillère à soupe de bicarbonate par litre.',
      'Bien sécher, tout remettre en place, ranger les aliments.',
    ],
    astuce: 'Un petit pot de bicarbonate ouvert au fond du frigo absorbe les odeurs.',
    attention: ['Clayettes en verre froides : pas d’eau très chaude d’un coup, le choc peut les fendre.'],
  },
  'Détartrer la bouilloire': {
    besoins: [['acide-citrique', 'vinaigre']],
    etapes: [
      'Remplir à moitié d’eau avec une à deux cuillères à soupe d’acide citrique (ou moitié eau, moitié vinaigre blanc).',
      'Faire chauffer, puis laisser agir 30 minutes, bouilloire éteinte.',
      'Vider et rincer.',
      'Faire bouillir une fois de l’eau claire et la jeter.',
    ],
    attention: ['Débrancher avant de rincer, et ne jamais mouiller le socle électrique.'],
  },
  'Nettoyer le four': {
    besoins: [['bicarbonate', 'nettoyant-four'], ['vinaigre'], ['gants']],
    etapes: [
      'Four froid : sortir les grilles et la lèchefrite, les faire tremper dans l’eau chaude savonneuse.',
      'Mélanger du bicarbonate avec un peu d’eau pour faire une pâte, l’étaler sur les parois sales (pas sur la résistance).',
      'Laisser agir quelques heures, idéalement une nuit.',
      'Retirer à l’éponge humide, passer un peu de vinaigre dilué contre le voile blanc, puis rincer.',
    ],
    astuce: 'Four à pyrolyse : lancer le programme, puis essuyer les cendres une fois le four froid.',
    attention: ['Nettoyant four du commerce : gants, fenêtre ouverte, jamais sur un four chaud ni à pyrolyse.'],
  },
  'Hotte et filtre': {
    besoins: [['liquide-vaisselle', 'degraissant', 'cristaux-soude'], ['eponges']],
    etapes: [
      'Retirer les filtres métalliques.',
      'Les faire tremper 15 à 30 minutes dans de l’eau très chaude avec du liquide vaisselle, puis brosser.',
      'Rincer et laisser sécher avant de les remettre.',
      'Dégraisser l’extérieur de la hotte avec une éponge et de l’eau savonneuse.',
    ],
    astuce: 'Beaucoup de filtres métalliques passent au lave-vaisselle : regarde la notice.',
    attention: [
      'Cristaux de soude : seulement pour les filtres en inox, avec des gants. Ils noircissent l’aluminium.',
      'Filtre à charbon : il ne se lave pas, il se remplace.',
    ],
  },
  'Dégivrer le congélateur': {
    besoins: [['bicarbonate'], ['microfibres', 'essuie-tout']],
    materiel: ['Glacière ou sacs isothermes', 'Serviettes', 'Bassine'],
    etapes: [
      'Débrancher et mettre les aliments au froid (glacière, sacs isothermes, dehors s’il gèle).',
      'Poser des serviettes au pied et une bassine sous l’écoulement.',
      'Laisser fondre porte ouverte. Un bol d’eau chaude à l’intérieur accélère le dégel.',
      'Nettoyer à l’eau tiède avec un peu de bicarbonate, puis sécher parfaitement.',
      'Rebrancher et attendre qu’il soit bien froid avant de remettre les aliments.',
    ],
    attention: ['Ne pas gratter la glace avec un couteau : on risque de percer le circuit de froid.'],
  },

  // ---------- Salle de bain ----------
  'Lavabo et miroir': {
    besoins: [['multi-surfaces', 'vinaigre'], ['microfibres']],
    etapes: [
      'Retirer cheveux et dépôts de la bonde.',
      'Vaporiser le lavabo et le robinet, frotter à l’éponge, rincer.',
      'Miroir : microfibre légèrement humide (un trait de vinaigre dans l’eau s’il y a des traces), puis le côté sec.',
      'Sécher le robinet pour éviter les traces de calcaire.',
    ],
  },
  'Douche ou baignoire': {
    besoins: [['vinaigre', 'anticalcaire'], ['eponges']],
    materiel: ['Raclette', 'Vieille brosse à dents pour les joints'],
    etapes: [
      'Rincer à l’eau chaude.',
      'Vaporiser du vinaigre blanc (pur ou moitié eau) sur les parois, la robinetterie et le bac, laisser agir 10 à 15 minutes.',
      'Frotter à l’éponge, joints compris.',
      'Rincer, puis sécher ou passer la raclette.',
    ],
    astuce: 'Joints noircis : une pâte de bicarbonate et d’eau, frottée avec une vieille brosse à dents. Et un coup de raclette après chaque douche limite le calcaire.',
    attention: ['Baignoire en acrylique ou en émail : pas de côté grattant.', JAVEL_ACIDE],
  },
  'Changer les serviettes': {
    besoins: [['lessive']],
    etapes: [
      'Mettre les serviettes au sale.',
      'Les laver à 60 °C, pour l’hygiène et l’odeur.',
      'Les sécher complètement avant de les ranger.',
      'Sortir des serviettes propres.',
    ],
    astuce: 'Pas d’adoucissant à chaque lavage : il rend les serviettes moins absorbantes.',
  },
  'Détartrer robinets et pommeau': {
    besoins: [['acide-citrique', 'vinaigre'], ['essuie-tout']],
    materiel: ['Sac congélation et élastique', 'Vieille brosse à dents'],
    etapes: [
      'Pommeau : le dévisser et le laisser tremper dans un bol de vinaigre blanc, ou d’eau chaude avec de l’acide citrique, de 1 heure à une nuit.',
      'S’il ne se dévisse pas : l’enfermer dans un sac rempli de vinaigre, tenu par un élastique.',
      'Robinets : enrouler autour de l’essuie-tout imbibé de vinaigre, laisser 30 minutes.',
      'Frotter les trous à la brosse à dents, puis rincer à l’eau claire.',
    ],
    attention: ['Robinetterie dorée, laiton brut ou noir mat : vérifier la notice, l’acide peut abîmer la finition.'],
  },
  'Vider la poubelle': {
    besoins: [['sacs-poubelle']],
    etapes: ['Fermer le sac et le jeter avec les ordures.', 'Mettre un sac neuf.', 'De temps en temps, un coup d’éponge dans la poubelle.'],
  },

  // ---------- WC ----------
  'Nettoyer les toilettes': {
    besoins: [['gel-wc', 'acide-citrique', 'vinaigre'], ['multi-surfaces'], ['gants']],
    materiel: ['Brosse WC', 'Chiffon réservé aux toilettes'],
    etapes: [
      'Mettre le gel sous les rebords et laisser agir au moins 10 minutes.',
      'Pendant ce temps : réservoir, abattant, lunette et pied avec le nettoyant et le chiffon des toilettes.',
      'Brosser la cuvette, rebords compris, puis tirer la chasse.',
      'Laisser la brosse s’égoutter avant de la ranger.',
    ],
    astuce: 'Tartre incrusté : acide citrique ou vinaigre chaud dans la cuvette toute une nuit, puis brosser.',
    attention: [JAVEL_ACIDE, 'Le chiffon des toilettes ne sert jamais ailleurs.'],
  },
  'Recharger le papier': {
    besoins: [['papier-toilette']],
    etapes: ['Remettre un rouleau.', 'Vérifier qu’il en reste au moins deux d’avance.', 'Sinon, « Aux courses » dans le Placard.'],
  },

  // ---------- Salon, chambre, entrée, bureau ----------
  Aspirateur: {
    materiel: ['Aspirateur', 'Embout fin pour les coins'],
    etapes: [
      'Ramasser ce qui traîne au sol (câbles, chaussettes, petits objets).',
      'Commencer par les coins et le long des plinthes, avec l’embout fin.',
      'Puis le centre de la pièce, sous les meubles et derrière les portes.',
      'Vider le bac ou changer le sac quand il est plein aux deux tiers.',
    ],
    astuce: 'Faire la poussière avant l’aspirateur : elle tombe au sol.',
  },
  Poussière: {
    besoins: [['microfibres']],
    etapes: [
      'Commencer en haut (étagères, dessus des meubles) et descendre.',
      'Microfibre sèche ou à peine humide : elle retient la poussière au lieu de la disperser.',
      'Penser aux lampes, cadres, plinthes et appareils éteints.',
      'Passer l’aspirateur ensuite.',
    ],
  },
  Ranger: {
    materiel: ['Un panier pour ce qui va ailleurs'],
    etapes: [
      'Mettre un minuteur de 5 minutes.',
      'Tout ce qui n’est pas à sa place dans la pièce va dans le panier.',
      'Ranger le reste, en commençant par les surfaces (table, canapé).',
      'Vider le panier en passant dans les autres pièces.',
    ],
  },
  'Aspirer le canapé': {
    besoins: [['bicarbonate']],
    materiel: ['Aspirateur avec embout brosse'],
    etapes: [
      'Retirer les coussins et récupérer ce qui est tombé dessous.',
      'Contre les odeurs : saupoudrer un peu de bicarbonate, laisser 30 minutes.',
      'Aspirer l’assise, le dossier, les côtés et les plis avec l’embout brosse.',
      'Remettre les coussins en les tapotant.',
    ],
    attention: ['Tissu fragile : tester le bicarbonate sur un coin caché. Cuir : pas de bicarbonate, un chiffon humide suffit.'],
  },
  'Arroser les plantes': {
    materiel: ['Arrosoir'],
    etapes: [
      'Enfoncer un doigt dans la terre : sèche sur 2 cm, on arrose ; encore humide, on attend.',
      'Arroser doucement jusqu’à ce que l’eau sorte par-dessous.',
      'Vider la soucoupe au bout de 15 minutes : les racines n’aiment pas tremper.',
      'En hiver, la plupart des plantes boivent moins.',
    ],
  },
  'Changer les draps': {
    besoins: [['lessive']],
    etapes: [
      'Défaire le lit et laisser le matelas respirer 10 minutes, fenêtre ouverte.',
      'Laver draps et taies à 60 °C, contre les acariens.',
      'Mettre les draps propres, la housse de couette en dernier.',
      'Sécher complètement le linge lavé avant de le ranger.',
    ],
  },
  'Retourner le matelas': {
    materiel: ['Aspirateur'],
    etapes: [
      'Défaire le lit.',
      'Aspirer le matelas et le sommier.',
      'Faire pivoter le matelas tête-pieds.',
      'S’il a deux faces de couchage, le retourner aussi (voir l’étiquette).',
    ],
    astuce: 'À deux, c’est plus facile et meilleur pour le dos.',
  },
  'Laver couette et oreillers': {
    besoins: [['lessive']],
    etapes: [
      'Lire l’étiquette : température, et si le lavage en machine est possible.',
      'Une couette demande un grand tambour (souvent 8 kg et plus) ; sinon, la laverie.',
      'Programme délicat ou spécial couette, essorage doux.',
      'Sécher entièrement : au sèche-linge avec deux balles de tennis, ou à plat. Une couette encore humide moisit.',
    ],
  },
  'Secouer le paillasson': {
    etapes: ['Secouer le paillasson dehors, ou le taper contre un mur.', 'Aspirer ou balayer dessous.', 'S’il est lavable : en machine de temps en temps, selon l’étiquette.'],
  },
  'Ranger les chaussures': {
    etapes: ['Remettre les chaussures dans le meuble ou par paires.', 'Laisser sécher celles qui sont mouillées avant de les ranger.', 'Sortir de l’entrée celles de la saison passée.'],
  },
  'Ranger le bureau': {
    etapes: ['Jeter les papiers inutiles, classer ceux à garder.', 'Remettre stylos et câbles à leur place.', 'Ne laisser sur le bureau que ce qui sert tous les jours.'],
  },
  'Poussière et écran': {
    besoins: [['microfibres']],
    etapes: [
      'Éteindre l’écran : les traces se voient mieux.',
      'L’essuyer avec une microfibre sèche, sans appuyer.',
      'Traces tenaces : microfibre à peine humide d’eau, jamais de produit vaporisé directement.',
      'Clavier : le retourner, le secouer, puis un chiffon légèrement humide.',
    ],
    attention: ['Pas de vinaigre ni d’alcool sur un écran antireflet.'],
  },

  // ---------- Buanderie et balcon ----------
  'Plier et ranger le linge': {
    etapes: ['Plier dès que c’est sec : moins de repassage.', 'Faire une pile par personne et par pièce.', 'Ranger dans la foulée.'],
  },
  'Filtre du sèche-linge': {
    etapes: [
      'Ouvrir le filtre à peluches (souvent dans la porte).',
      'Retirer les peluches à la main.',
      'De temps en temps, le rincer à l’eau et le laisser sécher.',
      'Modèle à condensation : vider le bac d’eau, et nettoyer le condenseur une fois par mois (voir la notice).',
    ],
    astuce: 'L’idéal : après chaque séchage. Un filtre propre sèche plus vite et consomme moins.',
  },
  'Nettoyer le lave-linge': {
    besoins: [['percarbonate', 'cristaux-soude'], ['vinaigre'], ['gants']],
    materiel: ['Serviette', 'Récipient plat'],
    etapes: [
      'Bac à lessive : le retirer, le laver à l’eau chaude, brosser les dépôts.',
      'Joint du hublot : essuyer les plis avec un chiffon et un peu de vinaigre blanc, retirer cheveux et peluches.',
      'Lancer un cycle à vide à 60 °C ou plus, avec deux cuillères à soupe de percarbonate dans le tambour.',
      'Filtre de vidange (en bas, en façade) : serviette et récipient dessous, dévisser, vider, nettoyer, revisser bien serré.',
      'Laisser le hublot entrouvert pour que le tambour sèche.',
    ],
    attention: ['Percarbonate et cristaux de soude : avec des gants, et jamais avec de la Javel dans le même lavage.'],
  },
  Balayer: {
    materiel: ['Balai', 'Pelle'],
    etapes: ['Ranger ce qui traîne.', 'Balayer du fond vers la sortie, coins compris.', 'Ramasser et jeter, y compris les feuilles dans les évacuations.'],
  },
  'Nettoyer le mobilier': {
    besoins: [['savon-noir', 'liquide-vaisselle'], ['eponges']],
    materiel: ['Brosse', 'Seau'],
    etapes: [
      'Retirer feuilles, poussière et toiles d’araignées.',
      'Laver à la brosse avec de l’eau tiède et du savon noir.',
      'Rincer à l’eau claire.',
      'Laisser sécher avant de remettre les coussins.',
    ],
  },
};

export const FICHES: Record<string, Fiche> = Object.fromEntries(
  Object.entries(FICHES_PAR_NOM).map(([nom, f]) => [normaliser(nom), f]),
);

/** Clé de fiche pour un nom de tâche (ou null s'il n'y en a pas). */
export function cleFiche(nom: string): string | null {
  const c = normaliser(nom);
  return FICHES[c] ? c : null;
}

/** La fiche d'une tâche : sa clé enregistrée, sinon son nom. */
export function ficheDe(t: { nom: string; fiche?: string | null }): Fiche | null {
  return (t.fiche && FICHES[t.fiche]) || FICHES[normaliser(t.nom)] || null;
}

// ---------- Produits à prendre, selon ce qu'il y a dans le placard ----------

export interface ProduitPlacard {
  id: string;
  cle: string | null;
  nom: string;
  icone: string;
  etat: EtatProduit;
}

export interface Besoin {
  /** Le produit idéal (clé du catalogue ou id d'un produit maison). */
  ideal: string;
  /** Ce qu'on a sous la main, dans l'ordre de préférence (null si rien). */
  choisi: string | null;
  /** État de l'idéal dans le placard ; 'absent' s'il n'y est pas du tout. */
  etatIdeal: EtatProduit | 'absent';
  etatChoisi: EtatProduit | null;
}

export function trouverProduit<T extends ProduitPlacard>(ref: string, placard: T[]): T | undefined {
  return placard.find((x) => x.cle === ref) ?? placard.find((x) => x.id === ref);
}

export function resoudreBesoin(options: string[], placard: ProduitPlacard[]): Besoin {
  const ideal = options[0];
  const pi = trouverProduit(ideal, placard);
  let choisi: string | null = null;
  let etatChoisi: EtatProduit | null = null;
  for (const o of options) {
    const x = trouverProduit(o, placard);
    if (x && x.etat !== 'vide') {
      choisi = o;
      etatChoisi = x.etat;
      break;
    }
  }
  return { ideal, choisi, etatIdeal: pi ? pi.etat : 'absent', etatChoisi };
}

/** Les besoins d'une tâche : ses produits choisis à la main, sinon ceux de sa fiche. */
export function besoinsDe(t: { nom: string; fiche?: string | null; produits?: string[] | null }): string[][] {
  if (t.produits && t.produits.length) return t.produits.map((x) => [x]);
  return ficheDe(t)?.besoins ?? [];
}
