// Copie dans public/illus/ les illustrations utilisées par l'appli
// (Fluent Emoji « flat », Microsoft, licence MIT), une par fichier SVG.
// Usage : npm run gen:illustrations (après avoir modifié le catalogue).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BANQUE_ICONES, CATALOGUE, ICONES_INTERFACE } from '../src/lib/catalogue.ts';
import { ICONES_PRODUITS, PRODUITS } from '../src/lib/produits.ts';

interface Jeu {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
}

const jeu: Jeu = JSON.parse(
  readFileSync('node_modules/@iconify-json/fluent-emoji-flat/icons.json', 'utf8'),
);

const noms = new Set<string>([...BANQUE_ICONES, ...ICONES_INTERFACE, ...ICONES_PRODUITS, ...PRODUITS.map((p) => p.icone)]);
for (const p of CATALOGUE) {
  noms.add(p.icone);
  for (const t of p.taches) noms.add(t.icone);
}

rmSync('public/illus', { recursive: true, force: true });
mkdirSync('public/illus', { recursive: true });

for (const nom of [...noms].sort()) {
  const reel = jeu.icons[nom] ? nom : jeu.aliases?.[nom]?.parent;
  const icone = reel ? jeu.icons[reel] : undefined;
  if (!icone) throw new Error(`Illustration inconnue : ${nom}`);
  const l = icone.width ?? jeu.width ?? 32;
  const h = icone.height ?? jeu.height ?? 32;
  writeFileSync(
    `public/illus/${nom}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}">${icone.body}</svg>\n`,
  );
}

writeFileSync(
  'public/illus/LICENCE.txt',
  'Illustrations : Fluent Emoji (Microsoft Corporation), licence MIT.\nhttps://github.com/microsoft/fluentui-emoji\n',
);

console.log(`${noms.size} illustrations écrites dans public/illus/.`);
