/** Couleur d'une fraîcheur entre 0 et 1 : du vert à l'orange clair, jamais de rouge. */
export function couleurFraicheur(f: number): string {
  if (f >= 0.6) return 'var(--frais)';
  if (f >= 0.3) return 'var(--tiede)';
  return 'var(--a-rafraichir)';
}

export function phraseJauge(p: number): string {
  if (p >= 90) return 'Tout est frais.';
  if (p >= 70) return 'Ça tient bien.';
  if (p >= 50) return 'Quelques coins à rafraîchir.';
  return 'Un petit coup de frais, et ça repart.';
}

/** Anneau de fraîcheur. */
export function Anneau({ pourcent, taille = 76 }: { pourcent: number; taille?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg className="anneau" width={taille} height={taille} viewBox="0 0 76 76" aria-hidden>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--piste)" strokeWidth="9" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={couleurFraicheur(pourcent / 100)}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(c * pourcent) / 100} ${c}`}
        transform="rotate(-90 38 38)"
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
      <text x="38" y="44" textAnchor="middle" className="anneau-texte">
        {pourcent}%
      </text>
    </svg>
  );
}

/** Barre de fraîcheur fine. */
export function Barre({ fraicheur }: { fraicheur: number }) {
  return (
    <div className="barre" aria-hidden>
      <div style={{ width: `${Math.max(4, fraicheur * 100)}%`, background: couleurFraicheur(fraicheur) }} />
    </div>
  );
}
