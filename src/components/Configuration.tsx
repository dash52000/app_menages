import { useRef, useState } from 'react';
import { CATALOGUE, RYTHMES, libelleDuree, type TacheCatalogue } from '../lib/catalogue.ts';
import type { Maison } from '../lib/useMaison.ts';
import { Illus } from './Illus.tsx';

/**
 * Configuration en 5 minutes : l'appli propose les pièces et leurs tâches
 * classiques, le foyer coche et ajuste. Tout reste modifiable ensuite.
 */
export function Configuration({ maison }: { maison: Maison }) {
  const debut = useRef(Date.now());
  const [etape, setEtape] = useState<1 | 2>(1);
  const [pieces, setPieces] = useState<Set<string>>(() => new Set(CATALOGUE.filter((p) => p.coche).map((p) => p.cle)));
  const [taches, setTaches] = useState<Record<string, TacheCatalogue[]>>(() =>
    Object.fromEntries(CATALOGUE.map((p) => [p.cle, p.taches.map((t) => ({ ...t }))])),
  );

  const choisies = CATALOGUE.filter((p) => pieces.has(p.cle));
  const nbTaches = choisies.reduce((s, p) => s + taches[p.cle].filter((t) => t.coche).length, 0);

  const basculerPiece = (cle: string) =>
    setPieces((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const majTache = (cle: string, i: number, champs: Partial<TacheCatalogue>) =>
    setTaches((m) => ({ ...m, [cle]: m[cle].map((t, j) => (j === i ? { ...t, ...champs } : t)) }));

  const terminer = () => {
    const ajustees = choisies.reduce(
      (s, p) => s + taches[p.cle].filter((t, i) => t.coche !== p.taches[i].coche || t.rythme !== p.taches[i].rythme).length,
      0,
    );
    maison.creerPieces(
      choisies.map((p) => ({
        nom: p.nom,
        icone: p.icone,
        taches: taches[p.cle].filter((t) => t.coche).map((t) => ({ nom: t.nom, icone: t.icone, rythme: t.rythme, duree: t.duree })),
      })),
    );
    maison.noter('configuration_terminee', {
      nb_pieces: choisies.length,
      nb_taches: nbTaches,
      taches_ajustees: ajustees,
      duree_s: Math.round((Date.now() - debut.current) / 1000),
    });
  };

  if (etape === 1) {
    return (
      <main className="ecran config">
        <p className="etape">Étape 1 sur 2</p>
        <h1>Quelles pièces chez vous ?</h1>
        <p className="discret">Une deuxième chambre ou une autre pièce s’ajoute plus tard en un tap.</p>
        <div className="grille-choix">
          {CATALOGUE.map((p) => {
            const actif = pieces.has(p.cle);
            return (
              <button
                key={p.cle}
                className={`tuile-choix ${actif ? 'active' : ''}`}
                onClick={() => basculerPiece(p.cle)}
                aria-pressed={actif}
              >
                <Illus nom={p.icone} taille={44} />
                <span>{p.nom}</span>
                <span className="coche" aria-hidden>
                  {actif ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <div className="barre-bas">
          <button className="bouton-principal" disabled={!choisies.length} onClick={() => setEtape(2)}>
            Suivant · {choisies.length} pièce{choisies.length > 1 ? 's' : ''}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="ecran config">
      <p className="etape">Étape 2 sur 2</p>
      <h1>Les tâches</h1>
      <p className="discret">Les plus courantes sont déjà cochées. Ajuste le rythme si besoin, l’appli s’adaptera ensuite.</p>
      {choisies.map((p) => (
        <section key={p.cle} className="config-piece">
          <h2>
            <Illus nom={p.icone} taille={28} /> {p.nom}
          </h2>
          <ul className="liste-config">
            {taches[p.cle].map((t, i) => (
              <li key={t.nom} className={t.coche ? 'cochee' : ''}>
                <button className="config-tache" onClick={() => majTache(p.cle, i, { coche: !t.coche })} aria-pressed={t.coche}>
                  <span className="case" aria-hidden>
                    {t.coche ? '✓' : ''}
                  </span>
                  <Illus nom={t.icone} taille={30} />
                  <span className="config-nom">
                    {t.nom}
                    <small>{libelleDuree(t.duree)}</small>
                  </span>
                </button>
                {t.coche && (
                  <select
                    className="select-rythme"
                    value={t.rythme}
                    onChange={(e) => majTache(p.cle, i, { rythme: Number(e.target.value) })}
                    aria-label={`Rythme : ${t.nom}`}
                  >
                    {RYTHMES.map((r) => (
                      <option key={r.jours} value={r.jours}>
                        {r.libelle}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="barre-bas">
        <button className="bouton-secondaire petit" onClick={() => setEtape(1)}>
          Retour
        </button>
        <button className="bouton-principal" disabled={!nbTaches} onClick={terminer}>
          C’est parti · {nbTaches} tâches
        </button>
      </div>
    </main>
  );
}
