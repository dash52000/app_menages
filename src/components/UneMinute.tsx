import { useMemo, useState } from 'react';
import { aujourdhui } from '../lib/dates.ts';
import { MAX_AUTRES, quicksDuJour, tachesActives } from '../lib/fraicheur.ts';
import { quicksAAjouter } from '../lib/catalogue.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Tache } from '../lib/types.ts';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/**
 * « J'ai 1 min » : une seule tâche Quick, la plus en retard. Trois « Autre »
 * au plus, puis la liste des Quick. Une Quick faite suffit à valider le jour.
 */
export function UneMinute({ maison, onFermer, informer }: { maison: Maison; onFermer: () => void; informer: (m: Message) => void }) {
  const jour = aujourdhui();
  const actives = useMemo(() => tachesActives(maison.taches, maison.pieces), [maison.taches, maison.pieces]);
  const quicks = useMemo(() => quicksDuJour(actives, jour), [actives, jour]);
  const [passees, setPassees] = useState<string[]>([]);
  const [liste, setListe] = useState(false);
  const nomPiece = (t: Tache) => maison.pieces.find((p) => p.id === t.piece_id)?.nom ?? '';
  const aAjouter = useMemo(() => quicksAAjouter(maison.pieces, maison.taches), [maison.pieces, maison.taches]);

  const proposee = quicks.find((t) => !passees.includes(t.id)) ?? null;

  const faire = (t: Tache) => {
    const annuler = maison.agir(t.id, 'fait', { depuis: 'quick' });
    maison.terminerCheck();
    maison.noter('quick_fait', { tache: t.nom, autres_avant: passees.length, depuis_liste: liste }, t.id);
    informer({ texte: `${t.nom} ✓ · la journée compte`, action: { libelle: 'Annuler', faire: () => annuler() } });
    onFermer();
  };

  const autre = (t: Tache) => {
    if (passees.length + 1 >= MAX_AUTRES) {
      maison.noter('autre_proposition', { depuis: 'quick', tache: t.nom, rang: passees.length + 1, liste: true }, t.id);
      setListe(true);
      return;
    }
    maison.noter('autre_proposition', { depuis: 'quick', tache: t.nom, rang: passees.length + 1 }, t.id);
    setPassees((p) => [...p, t.id]);
  };

  const ajouterSuggestions = () => {
    for (const a of aAjouter) {
      maison.ajouterTache(a.pieceId, { nom: a.tache.nom, icone: a.tache.icone, rythme: a.tache.rythme, duree: a.tache.duree }, 'catalogue');
    }
    informer({ texte: `${aAjouter.length} tâches Quick ajoutées dans vos pièces` });
  };

  if (!quicks.length) {
    return (
      <Feuille titre="J’ai 1 min" onFermer={onFermer}>
        <div className="vide">
          <Illus nom="sparkles" taille={64} />
          {maison.taches.some((t) => t.duree_min <= 1) ? (
            <>
              <h2>Toutes les Quick sont faites</h2>
              <p className="discret">Rien d’autre à faire en une minute aujourd’hui.</p>
            </>
          ) : (
            <>
              <h2>Pas encore de tâche Quick</h2>
              <p className="discret">Une Quick dure une minute ou moins : essuyer le robinet, un coup de brosse, faire le lit…</p>
              {aAjouter.length > 0 && (
                <button className="bouton-principal" onClick={ajouterSuggestions}>
                  Ajouter {aAjouter.length} Quick dans nos pièces
                </button>
              )}
              <p className="discret petit">Toute tâche réglée sur 1 min devient aussi une Quick.</p>
            </>
          )}
        </div>
      </Feuille>
    );
  }

  if (liste || !proposee) {
    return (
      <Feuille titre="Les tâches Quick" onFermer={onFermer}>
        <p className="discret">Choisis celle qui te va maintenant.</p>
        <ul className="liste-choix-tache">
          {quicks.map((t) => (
            <li key={t.id}>
              <button className="choix-tache" onClick={() => faire(t)}>
                <Illus nom={t.icone} taille={32} />
                <span>
                  {t.nom}
                  <span className="discret petit"> · {nomPiece(t)}</span>
                </span>
                <span className="etiquette">Fait</span>
              </button>
            </li>
          ))}
        </ul>
      </Feuille>
    );
  }

  const restants = MAX_AUTRES - passees.length - 1;
  return (
    <Feuille titre="J’ai 1 min" onFermer={onFermer}>
      <div className="carte une-minute">
        <div className="carte-haut">
          <Illus nom={proposee.icone} taille={56} />
          <span className="carte-texte">
            <strong>{proposee.nom}</strong>
            <span className="discret">{nomPiece(proposee)}</span>
            <span className="etiquette etiquette-quick">Quick</span>
          </span>
        </div>
        <div className="carte-actions">
          <button className="bouton-fait" onClick={() => faire(proposee)}>
            ✓ Fait
          </button>
        </div>
        <div className="carte-actions secondaires">
          <button className="lien-action" onClick={() => autre(proposee)}>
            {restants > 0 ? 'Autre proposition' : 'Voir toutes les Quick'}
          </button>
          <span className="discret petit points-autres" aria-label={`${restants} autres propositions avant la liste`}>
            {Array.from({ length: MAX_AUTRES }, (_, i) => (
              <i key={i} className={i < passees.length ? 'utilise' : ''} />
            ))}
          </span>
        </div>
      </div>
    </Feuille>
  );
}
