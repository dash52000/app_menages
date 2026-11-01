// Le cœur de l'appli : fraîcheur des tâches, jauge de la maison et choix
// des tâches du check. Fonctions pures, testées dans fraicheur.test.ts.
import { ajouterJours, ecart, type Jour } from './dates.ts';
import type { Piece, Tache } from './types.ts';
import { ficheDe } from './fiches.ts';

/** Une tâche entre dans le check quand il lui reste 10 % de fraîcheur ou moins. */
export const SEUIL_DUE = 0.1;
/** Tâches « petites victoires », mises en tête du check. */
export const DUREE_COURTE = 2;
/** Jamais plus de tâches à la fois dans le check. */
export const MAX_CHECK = 5;

function joursDepuis(t: Tache, jour: Jour): number {
  if (!t.derniere_fois) return t.rythme_jours; // jamais faite : à faire
  return Math.max(0, ecart(t.derniere_fois, jour));
}

/** Reportée avec « Demain » et pas encore revenue. */
export function estReportee(t: Tache, jour: Jour): boolean {
  return Boolean(t.reporte_jusqu_au && t.reporte_jusqu_au > jour);
}

export function estFaiteLe(t: Tache, jour: Jour): boolean {
  return t.derniere_fois === jour;
}

export function estReserveeLe(t: Tache, jour: Jour): boolean {
  return Boolean(t.reserve_par && t.reserve_le === jour);
}

/**
 * Fraîcheur entre 0 et 1 : 1 juste après avoir fait la tâche, 0 à l'échéance
 * de son rythme, puis bloquée à 0 (aucune dette ne s'accumule).
 * Pendant un report (« Demain »), la fraîcheur est figée au jour du report :
 * reporter ne fait pas baisser la jauge.
 */
export function fraicheur(t: Tache, jour: Jour): number {
  let reference = jour;
  if (t.reporte_le && t.reporte_jusqu_au && t.reporte_le <= jour && jour <= t.reporte_jusqu_au) {
    reference = t.reporte_le;
  }
  const f = 1 - joursDepuis(t, reference) / t.rythme_jours;
  return Math.min(1, Math.max(0, f));
}

/** Urgence, sans plafond : 1 = pile à l'échéance, 2 = deux rythmes de retard. */
export function urgence(t: Tache, jour: Jour): number {
  return joursDepuis(t, jour) / t.rythme_jours;
}

export function estDue(t: Tache, jour: Jour): boolean {
  if (estFaiteLe(t, jour) || estReportee(t, jour)) return false;
  return 1 - urgence(t, jour) <= SEUIL_DUE + 1e-9;
}

/**
 * Jauge de la maison, en % : moyenne des fraîcheurs pondérée par la durée,
 * pour qu'oublier les poubelles ne pèse pas autant que les vitres.
 */
export function jauge(taches: Tache[], jour: Jour): number | null {
  const poids = taches.reduce((s, t) => s + t.duree_min, 0);
  if (!poids) return null;
  const somme = taches.reduce((s, t) => s + fraicheur(t, jour) * t.duree_min, 0);
  return Math.round((100 * somme) / poids);
}

/** Ordre du check : petites victoires d'abord, puis la plus urgente. */
export function trierPourCheck(taches: Tache[], jour: Jour): Tache[] {
  return [...taches].sort((a, b) => {
    const ca = a.duree_min <= DUREE_COURTE ? 0 : 1;
    const cb = b.duree_min <= DUREE_COURTE ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return urgence(b, jour) - urgence(a, jour) || a.nom.localeCompare(b.nom, 'fr');
  });
}

/** Tâches candidates au check : dues, ou réservées pour aujourd'hui et pas encore faites. */
export function candidatesCheck(taches: Tache[], jour: Jour): Tache[] {
  return trierPourCheck(
    taches.filter((t) => estDue(t, jour) || (estReserveeLe(t, jour) && !estFaiteLe(t, jour))),
    jour,
  );
}

/** Les tâches du check (au plus `max`) et le nombre restant derrière. */
export function selectionCheck(
  taches: Tache[],
  jour: Jour,
  max = MAX_CHECK,
  exclure: ReadonlySet<string> = new Set(),
): { liste: Tache[]; reste: number } {
  const c = candidatesCheck(taches, jour).filter((t) => !exclure.has(t.id));
  return { liste: c.slice(0, max), reste: Math.max(0, c.length - max) };
}

/**
 * Date de « dernière fois » estimée pour une tâche créée à la configuration.
 * Les échéances sont étalées pour que chaque jour reste léger, avec environ
 * une tâche sur sept due tout de suite : le premier check n'est jamais vide,
 * et la maison démarre autour de 65 %. Jamais « faite aujourd'hui » : elle reste cochable.
 */
export function derniereFoisInitiale(index: number, rythme: number, jour: Jour): Jour {
  const k = (index * 0.6180339887 + 0.37) % 1;
  const jours = k > 0.86 ? rythme : Math.max(1, Math.round(k * 0.4 * rythme));
  return ajouterJours(jour, -jours);
}

// ---------- Pièces à l'arrêt (poêle hors saison) ----------

/** Jour depuis lequel la tâche est figée (pièce à l'arrêt), sinon null. */
export function figeeDepuis(t: Tache, pieces: Piece[]): Jour | null {
  const p = pieces.find((x) => x.id === t.piece_id);
  if (!p?.en_pause_depuis) return null;
  return ficheDe(t)?.touteAnnee ? null : p.en_pause_depuis;
}

/** Les tâches qui comptent : celles des pièces à l'arrêt sortent du check et de la jauge. */
export function tachesActives(taches: Tache[], pieces: Piece[]): Tache[] {
  if (!pieces.some((p) => p.en_pause_depuis)) return taches;
  return taches.filter((t) => !figeeDepuis(t, pieces));
}

/**
 * Date de référence d'une tâche à la remise en marche : elle avance de la
 * durée de l'arrêt, pour que la fraîcheur figée reparte telle quelle.
 * Faite pendant l'arrêt : elle repart fraîche, au jour de la remise en marche.
 */
export function dateApresReprise(derniere: Jour, arretDepuis: Jour, jour: Jour): Jour {
  const debut = derniere > arretDepuis ? derniere : arretDepuis;
  const nouvelle = ajouterJours(derniere, Math.max(0, ecart(debut, jour)));
  return nouvelle > jour ? jour : nouvelle;
}

/** Fraîcheur affichée : figée au jour de l'arrêt pour une pièce à l'arrêt. */
export function fraicheurAffichee(t: Tache, jour: Jour, pieces: Piece[]): number {
  const fige = figeeDepuis(t, pieces);
  return fraicheur(t, fige && fige < jour ? fige : jour);
}
