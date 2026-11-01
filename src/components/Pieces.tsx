import { useEffect, useMemo, useState } from 'react';
import { BANQUE_ICONES, CATALOGUE, estSaisonniere, rythmeCourt } from '../lib/catalogue.ts';
import { aujourdhui, ilYa, jourRelatif } from '../lib/dates.ts';
import { estDue, estFaiteLe, figeeDepuis, fraicheurAffichee, jauge, tachesActives, urgence } from '../lib/fraicheur.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Piece, Tache } from '../lib/types.ts';
import { Anneau, Barre } from './Jauge.tsx';
import { Feuille } from './Feuille.tsx';
import { FeuilleTache } from './FeuilleTache.tsx';
import { FicheTache } from './FicheTache.tsx';
import { SuiviProduit } from './Produits.tsx';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/** Grille des pièces, chacune avec sa jauge ; un tap ouvre la pièce. */
export function Pieces({
  maison,
  informer,
  pieceOuverte,
  setPieceOuverte,
}: {
  maison: Maison;
  informer: (m: Message) => void;
  pieceOuverte: string | null;
  setPieceOuverte: (id: string | null) => void;
}) {
  const jour = aujourdhui();
  const [ajout, setAjout] = useState(false);
  const piece = maison.pieces.find((p) => p.id === pieceOuverte);

  useEffect(() => {
    if (pieceOuverte && !piece) setPieceOuverte(null);
  }, [pieceOuverte, piece, setPieceOuverte]);

  if (piece) {
    return <DetailPiece maison={maison} piece={piece} informer={informer} retour={() => setPieceOuverte(null)} />;
  }

  return (
    <section className="ecran">
      <header className="entete">
        <h1>Pièces</h1>
      </header>
      <div className="grille-pieces">
        {maison.pieces.map((p) => {
          const toutes = maison.taches.filter((t) => t.piece_id === p.id);
          const taches = tachesActives(toutes, maison.pieces);
          const j = jauge(taches, jour);
          const dues = taches.filter((t) => estDue(t, jour)).length;
          const arret = Boolean(p.en_pause_depuis);
          return (
            <button key={p.id} className={`tuile-piece ${arret ? 'a-l-arret' : ''}`} onClick={() => setPieceOuverte(p.id)}>
              <Illus nom={p.icone} taille={52} />
              <strong>{p.nom}</strong>
              {arret ? (
                <span className="etiquette etiquette-arret">À l’arrêt</span>
              ) : j === null ? (
                <span className="discret petit">Aucune tâche</span>
              ) : (
                <>
                  <Barre fraicheur={j / 100} />
                  <span className="discret petit">{dues ? `${dues} qui tire${dues > 1 ? 'nt' : ''}` : j >= 75 ? 'Tout est frais' : 'Rien d’urgent'}</span>
                </>
              )}
            </button>
          );
        })}
        <button className="tuile-piece ajout" onClick={() => setAjout(true)}>
          <span className="plus" aria-hidden>
            +
          </span>
          <strong>Ajouter une pièce</strong>
        </button>
      </div>
      {ajout && (
        <FeuilleNouvellePiece
          maison={maison}
          onFermer={() => setAjout(false)}
          onCreee={(id) => {
            setAjout(false);
            setPieceOuverte(id);
          }}
          informer={informer}
        />
      )}
    </section>
  );
}

function DetailPiece({
  maison,
  piece,
  informer,
  retour,
}: {
  maison: Maison;
  piece: Piece;
  informer: (m: Message) => void;
  retour: () => void;
}) {
  const jour = aujourdhui();
  const [edition, setEdition] = useState<Tache | 'nouvelle' | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState<string | null>(null);
  const [reglages, setReglages] = useState(false);
  const { noter } = maison;

  useEffect(() => {
    noter('vue_piece', { piece: piece.nom });
  }, [noter, piece.nom]);

  const taches = useMemo(
    () =>
      maison.taches
        .filter((t) => t.piece_id === piece.id)
        .sort((a, b) => urgence(b, jour) - urgence(a, jour) || a.nom.localeCompare(b.nom, 'fr')),
    [maison.taches, piece.id, jour],
  );
  const arret = Boolean(piece.en_pause_depuis);
  const j = arret ? null : jauge(tachesActives(taches, maison.pieces), jour);
  const basculer = () => {
    if (arret) {
      maison.remettreEnMarche(piece);
      informer({ texte: `${piece.nom} en marche : ses tâches reprennent où elles en étaient.` });
    } else if (maison.mettreALArret(piece)) {
      informer({ texte: `${piece.nom} à l’arrêt : ses tâches sortent du check jusqu’à la remise en marche.` });
    } else {
      informer({ texte: 'Recolle schema.sql dans Supabase pour activer l’interrupteur.', duree: 7000 });
    }
  };
  const nomProfil = (id: string | null) => maison.profils.find((p) => p.id === id)?.prenom;

  /** ✓ = moi ; le bandeau propose de corriger (« C'était Laeti ? ») ou d'annuler. */
  const faire = (t: Tache) => {
    const annuler = maison.agir(t.id, 'fait', { depuis: 'piece' });
    informer({
      texte: `${t.nom} : fait ✓`,
      duree: 7000,
      actions: [
        ...maison.autres.map((autre) => ({
          libelle: `C’était ${autre.prenom} ?`,
          faire: () => {
            annuler(true);
            const annulerAutre = maison.agir(t.id, 'fait_autre', { depuis: 'piece', profilId: autre.id, silencieux: true });
            maison.noter('correction_auteur', { tache: t.nom, vers: 'autre', depuis: 'piece' }, t.id);
            informer({ texte: `${t.nom} : fait par ${autre.prenom} ✓`, action: { libelle: 'Annuler', faire: () => annulerAutre() } });
          },
        })),
        { libelle: 'Annuler', faire: () => annuler() },
      ],
    });
  };

  return (
    <section className="ecran">
      <header className="entete entete-piece">
        <button className="bouton-retour" onClick={retour} aria-label="Retour aux pièces">
          ‹ Pièces
        </button>
        <button className="bouton-rond discret" onClick={() => setReglages(true)} aria-label="Modifier la pièce">
          •••
        </button>
      </header>
      <div className="titre-piece">
        <Illus nom={piece.icone} taille={60} />
        <h1>{piece.nom}</h1>
        {j !== null && <Anneau pourcent={j} taille={60} />}
      </div>

      {(estSaisonniere(piece) || arret) && (
        <button className={`interrupteur ${arret ? '' : 'marche'}`} onClick={basculer} role="switch" aria-checked={!arret}>
          <span className="interrupteur-texte">
            <strong>{arret ? 'À l’arrêt' : 'En marche'}</strong>
            <span className="discret petit">
              {arret
                ? `Depuis ${jourRelatif(piece.en_pause_depuis!, jour)} · tâches figées, hors du check`
                : 'Ses tâches comptent dans le check et la jauge'}
            </span>
          </span>
          <span className="interrupteur-curseur" aria-hidden>
            <span />
          </span>
        </button>
      )}
      {estSaisonniere(piece) && <SuiviProduit cle="granules" maison={maison} informer={informer} />}

      <ul className="liste-taches">
        {taches.map((t) => {
          const f = fraicheurAffichee(t, jour, maison.pieces);
          const fige = Boolean(figeeDepuis(t, maison.pieces));
          const faite = estFaiteLe(t, jour);
          const qui = nomProfil(t.derniere_par);
          const quand = !t.derniere_fois
            ? 'jamais faite'
            : t.derniere_par
              ? `${ilYa(t.derniere_fois, jour)}${qui ? ` · ${qui}` : ''}`
              : 'pas encore notée';
          return (
            <li key={t.id} className={`ligne-tache ${fige ? 'figee' : ''}`}>
              <button className="ligne-tache-corps" onClick={() => setFicheOuverte(t.id)}>
                <Illus nom={t.icone} taille={40} />
                <span className="ligne-tache-texte">
                  <strong>{t.nom}</strong>
                  <span className="discret petit">
                    {quand} · {rythmeCourt(t.rythme_jours)}
                    {arret && !fige ? ' · toute l’année' : ''}
                  </span>
                  <Barre fraicheur={f} />
                </span>
              </button>
              <button
                className={`coche-ronde ${faite ? 'faite' : ''}`}
                onClick={() => faire(t)}
                disabled={faite}
                aria-label={faite ? `${t.nom} : déjà faite aujourd’hui` : `${t.nom} : fait`}
              >
                ✓
              </button>
            </li>
          );
        })}
      </ul>

      <button className="bouton-secondaire large" onClick={() => setEdition('nouvelle')}>
        + Ajouter une tâche
      </button>

      {ficheOuverte && !edition && taches.some((t) => t.id === ficheOuverte) && (
        <FicheTache
          maison={maison}
          tache={taches.find((t) => t.id === ficheOuverte)!}
          depuis="piece"
          onFermer={() => setFicheOuverte(null)}
          onFait={() => faire(taches.find((t) => t.id === ficheOuverte)!)}
          onModifier={() => {
            setEdition(taches.find((t) => t.id === ficheOuverte)!);
            setFicheOuverte(null);
          }}
          informer={informer}
        />
      )}
      {edition && (
        <FeuilleTache
          maison={maison}
          piece={piece}
          tache={edition === 'nouvelle' ? null : edition}
          onFermer={() => setEdition(null)}
          informer={informer}
        />
      )}
      {reglages && (
        <FeuillePiece
          maison={maison}
          piece={piece}
          onFermer={() => setReglages(false)}
          onSupprimee={() => {
            setReglages(false);
            retour();
          }}
          informer={informer}
        />
      )}
    </section>
  );
}

function FeuillePiece({
  maison,
  piece,
  onFermer,
  onSupprimee,
  informer,
}: {
  maison: Maison;
  piece: Piece;
  onFermer: () => void;
  onSupprimee: () => void;
  informer: (m: Message) => void;
}) {
  const [nom, setNom] = useState(piece.nom);
  const [icone, setIcone] = useState(piece.icone);
  const icones = BANQUE_ICONES.includes(icone) ? BANQUE_ICONES : [icone, ...BANQUE_ICONES];

  return (
    <Feuille titre="Modifier la pièce" onFermer={onFermer}>
      <label className="champ">
        <span>Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={30} />
      </label>
      <div className="bloc">
        <p className="etiquette-champ">Illustration</p>
        <div className="defilant">
          {icones.map((i) => (
            <button key={i} className={`choix-icone ${i === icone ? 'active' : ''}`} onClick={() => setIcone(i)} aria-label={i}>
              <Illus nom={i} taille={34} />
            </button>
          ))}
        </div>
      </div>
      <button
        className="bouton-principal"
        disabled={!nom.trim()}
        onClick={() => {
          if (nom.trim() !== piece.nom || icone !== piece.icone) maison.modifierPiece(piece, { nom: nom.trim(), icone });
          onFermer();
        }}
      >
        Enregistrer
      </button>
      <button
        className="bouton-secondaire"
        onClick={() => {
          if (piece.en_pause_depuis) {
            maison.remettreEnMarche(piece);
            informer({ texte: `${piece.nom} en marche` });
          } else if (maison.mettreALArret(piece)) {
            informer({ texte: `${piece.nom} à l’arrêt : ses tâches sortent du check.` });
          } else {
            informer({ texte: 'Recolle schema.sql dans Supabase pour activer la mise à l’arrêt.', duree: 7000 });
          }
          onFermer();
        }}
      >
        {piece.en_pause_depuis ? 'Remettre en marche' : 'Mettre à l’arrêt (hors saison, pièce inutilisée)'}
      </button>
      <button
        className="bouton-danger"
        onClick={() => {
          const annuler = maison.supprimerPiece(piece);
          informer({ texte: `${piece.nom} supprimée`, action: { libelle: 'Annuler', faire: annuler }, duree: 8000 });
          onSupprimee();
        }}
      >
        Supprimer la pièce et ses tâches
      </button>
    </Feuille>
  );
}

function FeuilleNouvellePiece({
  maison,
  onFermer,
  onCreee,
  informer,
}: {
  maison: Maison;
  onFermer: () => void;
  onCreee: (id: string) => void;
  informer: (m: Message) => void;
}) {
  const [libre, setLibre] = useState(false);
  const [nom, setNom] = useState('');
  const [icone, setIcone] = useState('sparkles');

  /** « Chambre » existe déjà : la nouvelle s'appelle « Chambre 2 ». */
  const nomLibre = (base: string) => {
    const noms = new Set(maison.pieces.map((p) => p.nom.toLowerCase()));
    if (!noms.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!noms.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
  };

  const creer = (n: string, i: string, taches: Array<{ nom: string; icone: string; rythme: number; duree: number }>, depuis: string) => {
    const nomFinal = nomLibre(n);
    const [id] = maison.creerPieces([{ nom: nomFinal, icone: i, taches }]);
    // Un poêle à granulés : les granulés entrent au placard.
    if (estSaisonniere({ nom: n, icone: i }) && maison.base15 && maison.produits.length && !maison.produits.some((x) => x.cle === 'granules')) {
      maison.ajouterProduit({ cle: 'granules', nom: 'Granulés de bois', icone: 'wood' }, 'poele');
    }
    maison.noter('piece_creee', { piece: nomFinal, nb_taches: taches.length, depuis });
    informer({ texte: taches.length ? `${nomFinal} ajoutée avec ${taches.length} tâches` : `${nomFinal} ajoutée` });
    onCreee(id);
  };

  return (
    <Feuille titre="Ajouter une pièce" onFermer={onFermer}>
      {!libre ? (
        <>
          <div className="grille-choix">
            {CATALOGUE.map((p) => (
              <button
                key={p.cle}
                className="tuile-choix"
                onClick={() =>
                  creer(
                    p.nom,
                    p.icone,
                    p.taches.filter((t) => t.coche).map((t) => ({ nom: t.nom, icone: t.icone, rythme: t.rythme, duree: t.duree })),
                    'catalogue',
                  )
                }
              >
                <Illus nom={p.icone} taille={40} />
                <span>{p.nom}</span>
              </button>
            ))}
          </div>
          <button className="bouton-secondaire large" onClick={() => setLibre(true)}>
            Autre pièce…
          </button>
        </>
      ) : (
        <>
          <label className="champ">
            <span>Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Cellier, garage…" maxLength={30} autoFocus />
          </label>
          <div className="bloc">
            <p className="etiquette-champ">Illustration</p>
            <div className="defilant">
              {BANQUE_ICONES.map((i) => (
                <button key={i} className={`choix-icone ${i === icone ? 'active' : ''}`} onClick={() => setIcone(i)} aria-label={i}>
                  <Illus nom={i} taille={34} />
                </button>
              ))}
            </div>
          </div>
          <button className="bouton-principal" disabled={!nom.trim()} onClick={() => creer(nom.trim(), icone, [], 'libre')}>
            Ajouter
          </button>
        </>
      )}
    </Feuille>
  );
}
