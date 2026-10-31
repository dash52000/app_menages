// Dates « locales » au format AAAA-MM-JJ : une tâche faite à 23 h compte pour
// le jour du téléphone, pas pour le jour UTC.

export type Jour = string; // 'AAAA-MM-JJ'

export function versJour(d: Date): Jour {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

export function aujourdhui(): Jour {
  return versJour(new Date());
}

function enJours(j: Jour): number {
  const [a, m, d] = j.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/** Nombre de jours de `debut` à `fin` (positif si fin est après debut). */
export function ecart(debut: Jour, fin: Jour): number {
  return Math.round(enJours(fin) - enJours(debut));
}

export function ajouterJours(j: Jour, n: number): Jour {
  const d = new Date(Date.UTC(0, 0, 1));
  d.setTime((enJours(j) + n) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function nomDuJour(j: Jour): string {
  return JOURS.at(new Date(enJours(j) * 86_400_000).getUTCDay()) ?? '';
}

/** « aujourd'hui », « hier », « mardi » (dans la semaine), sinon « 12 oct. ». */
export function jourRelatif(j: Jour, reference: Jour): string {
  const n = ecart(j, reference);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n > 1 && n < 7) return nomDuJour(j);
  const [, m, d] = j.split('-').map(Number);
  return `${d} ${MOIS.at(m - 1)}`;
}

/** « il y a 3 j », « il y a 2 sem. », « il y a 3 mois ». */
export function ilYa(j: Jour, reference: Jour): string {
  const n = ecart(j, reference);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n < 14) return `il y a ${n} j`;
  if (n < 60) return `il y a ${Math.round(n / 7)} sem.`;
  return `il y a ${Math.round(n / 30)} mois`;
}
