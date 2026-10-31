// Exports CSV / JSON pour analyser l'historique et le journal ailleurs (R, tableur…).

type Ligne = Record<string, unknown>;

function cellule(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV séparé par des virgules, en UTF-8 avec BOM (lisible directement dans Excel). */
export function versCsv(lignes: Ligne[], colonnes?: string[]): string {
  const cols = colonnes ?? [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const corps = lignes.map((l) => cols.map((c) => cellule(l[c])).join(','));
  return '﻿' + [cols.join(','), ...corps].join('\r\n') + '\r\n';
}

/** Partage le fichier (feuille de partage du téléphone) ou, à défaut, le télécharge. */
export async function livrerFichier(nom: string, contenu: string, type: string): Promise<void> {
  const fichier = new File([contenu], nom, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [fichier] }) && nav.share) {
    try {
      await nav.share({ files: [fichier], title: nom });
      return;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
