import { useEffect } from 'react';
import { libelleDuree, rythmeCourt } from '../lib/catalogue.ts';
import { aujourdhui, ilYa } from '../lib/dates.ts';
import { besoinsVisibles, ficheDe } from '../lib/fiches.ts';
import { estFaiteLe } from '../lib/fraicheur.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Tache } from '../lib/types.ts';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';
import { BesoinFiche } from './Produits.tsx';
import type { Message } from './Bandeau.tsx';

/** « Comment faire » : produits, matériel, étapes, astuce et mises en garde. */
export function FicheTache({
  maison,
  tache,
  depuis,
  onFermer,
  onFait,
  onModifier,
  informer,
}: {
  maison: Maison;
  tache: Tache;
  depuis: 'check' | 'piece';
  onFermer: () => void;
  onFait?: () => void;
  onModifier?: () => void;
  informer: (m: Message) => void;
}) {
  const jour = aujourdhui();
  const fiche = ficheDe(tache);
  const besoins = besoinsVisibles(tache, maison.produits);
  const piece = maison.pieces.find((p) => p.id === tache.piece_id);
  const qui = maison.profils.find((p) => p.id === tache.derniere_par)?.prenom;
  const faite = estFaiteLe(tache, jour);
  const { noter } = maison;

  useEffect(() => {
    noter('vue_fiche', { tache: tache.nom, depuis, avec_fiche: Boolean(fiche) }, tache.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Feuille titre={tache.nom} onFermer={onFermer}>
      <div className="fiche-tete">
        <Illus nom={tache.icone} taille={52} />
        <span className="discret">
          {piece?.nom} · {libelleDuree(tache.duree_min)} · {rythmeCourt(tache.rythme_jours)}
          <br />
          {tache.derniere_fois && tache.derniere_par
            ? `Fait ${ilYa(tache.derniere_fois, jour)}${qui ? ` par ${qui}` : ''}`
            : 'Pas encore notée'}
        </span>
      </div>

      {tache.note && (
        <div className="encart consignes">
          <Illus nom="memo" taille={22} />
          <p>{tache.note}</p>
        </div>
      )}

      {besoins.length > 0 && (
        <section className="bloc">
          <p className="etiquette-champ">Produits</p>
          <ul className="besoins">
            {besoins.map((options) => (
              <BesoinFiche key={options.join('|')} options={options} maison={maison} informer={informer} />
            ))}
          </ul>
        </section>
      )}

      {fiche?.materiel && (
        <p className="materiel">
          <Illus nom="hammer-and-wrench" taille={20} />
          <span>{fiche.materiel.join(' · ')}</span>
        </p>
      )}

      {fiche ? (
        <section className="bloc">
          <p className="etiquette-champ">Comment faire</p>
          <ol className="etapes">
            {fiche.etapes.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
        </section>
      ) : (
        !tache.note && <p className="discret">Pas de fiche pour cette tâche. Tu peux noter tes consignes dans « Modifier ».</p>
      )}

      {fiche?.astuce && (
        <div className="encart astuce">
          <Illus nom="light-bulb" taille={22} />
          <p>{fiche.astuce}</p>
        </div>
      )}
      {fiche?.attention?.map((a) => (
        <div key={a} className="encart attention">
          <Illus nom="warning" taille={22} />
          <p>{a}</p>
        </div>
      ))}

      <div className="pile">
        {onFait && !faite && (
          <button
            className="bouton-principal"
            onClick={() => {
              onFait();
              onFermer();
            }}
          >
            ✓ Fait
          </button>
        )}
        {onModifier && (
          <button className="bouton-secondaire" onClick={onModifier}>
            Modifier la tâche
          </button>
        )}
      </div>
    </Feuille>
  );
}
