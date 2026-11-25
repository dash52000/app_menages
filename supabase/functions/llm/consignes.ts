// Consignes de la fonction llm. Le téléphone choisit une consigne par son nom et envoie des
// données ; il n'envoie jamais de texte libre au modèle (pas de chat libre, §9 et §12).
// Chaque consigne a son validateur : une sortie qui ne passe pas compte comme un échec.
// Logique pure, testée dans consignes.test.ts.

import type { Demande, Usage } from './chaine.ts';

export interface Consigne<T> {
  usage: Usage;
  /** Construit la demande, ou null si les données reçues ne conviennent pas. */
  demande(donnees: unknown, image?: Demande['image']): Demande | null;
  valider(v: unknown): T | null;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const texteCourt = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

// IA0 : essais de la brique, sans donnée du foyer.
const essai: Consigne<{ pret: true; mot: string }> = {
  usage: 'texte',
  demande: () => ({
    systeme: 'Tu réponds uniquement en JSON, sans texte autour.',
    texte: 'Réponds {"pret": true, "mot": "<un mot français lié au ménage>"}.',
  }),
  valider: (v) => {
    if (!estObjet(v) || v.pret !== true) return null;
    const mot = texteCourt(v.mot, 40);
    return mot ? { pret: true, mot } : null;
  },
};

const essaiVision: Consigne<{ couleur: string }> = {
  usage: 'vision',
  demande: (_d, image) =>
    image
      ? {
          systeme: 'Tu réponds uniquement en JSON, sans texte autour.',
          texte: 'Quelle est la couleur dominante de cette image ? Réponds {"couleur": "<un mot en français>"}.',
          image,
        }
      : null,
  valider: (v) => {
    if (!estObjet(v)) return null;
    const couleur = texteCourt(v.couleur, 40);
    return couleur ? { couleur } : null;
  },
};

export const CONSIGNES: Record<string, Consigne<unknown>> = {
  essai,
  essai_vision: essaiVision,
};

/** Taille maximale d'une image en base64 (environ 1,5 Mo d'image : le téléphone la réduit avant). */
export const IMAGE_MAX_BASE64 = 2_000_000;
export const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
