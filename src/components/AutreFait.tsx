import { useMemo, useState } from 'react';
import { ajouterJours, aujourdhui, jourRelatif, type Jour } from '../lib/dates.ts';
import { normaliser } from '../lib/normalise.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Tache } from '../lib/types.ts';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/** « Autre chose de fait ? » : une tâche faite hors du check, par qui, quel jour. */
export function AutreFait({ maison, onFermer, informer }: { maison: Maison; onFermer: () => void; informer: (m: Message) => void }) {
  const jour = aujourdhui();
  const [recherche, setRecherche] = useState('');
  const [tache, setTache] = useState<Tache | null>(null);
  const [qui, setQui] = useState(maison.moi);
  const [quand, setQuand] = useState<Jour>(jour);

  const groupes = useMemo(() => {
    const q = normaliser(recherche);
    return maison.pieces
      .map((p) => ({
        piece: p,
        taches: maison.taches
          .filter((t) => t.piece_id === p.id && (!q || normaliser(t.nom).includes(q) || normaliser(p.nom).includes(q)))
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      }))
      .filter((g) => g.taches.length);
  }, [maison.pieces, maison.taches, recherche]);

  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(jour, -i));
  const profils = [...maison.profils].sort((a, b) => (a.id === maison.moi ? -1 : b.id === maison.moi ? 1 : 0));

  const valider = () => {
    if (!tache) return;
    const moi = qui === maison.moi;
    const annuler = maison.agir(tache.id, moi ? 'fait' : 'fait_autre', { depuis: 'autre', jour: quand, profilId: qui });
    const prenom = maison.profils.find((p) => p.id === qui)?.prenom ?? '';
    informer({
      texte: `${tache.nom} : fait${moi ? '' : ` par ${prenom}`} ${jourRelatif(quand, jour)} ✓`,
      action: { libelle: 'Annuler', faire: () => annuler() },
    });
    onFermer();
  };

  if (tache) {
    return (
      <Feuille titre="Autre chose de fait" onFermer={onFermer}>
        <button className="tache-choisie" onClick={() => setTache(null)}>
          <Illus nom={tache.icone} taille={40} />
          <span>
            <strong>{tache.nom}</strong>
            <span className="discret petit">{maison.pieces.find((p) => p.id === tache.piece_id)?.nom} · changer</span>
          </span>
        </button>
        <div className="bloc">
          <p className="etiquette-champ">Qui l’a fait ?</p>
          <div className="puces">
            {profils.map((p) => (
              <button
                key={p.id}
                className={`puce puce-profil ${qui === p.id ? 'active' : ''}`}
                style={{ ['--profil' as string]: p.couleur }}
                onClick={() => setQui(p.id)}
              >
                {p.id === maison.moi ? `Moi (${p.prenom})` : p.prenom}
              </button>
            ))}
          </div>
        </div>
        <div className="bloc">
          <p className="etiquette-champ">Quand ?</p>
          <div className="puces">
            {jours.map((j) => (
              <button key={j} className={`puce ${quand === j ? 'active' : ''}`} onClick={() => setQuand(j)}>
                {jourRelatif(j, jour)}
              </button>
            ))}
          </div>
        </div>
        <button className="bouton-principal" onClick={valider}>
          C’est noté
        </button>
      </Feuille>
    );
  }

  return (
    <Feuille titre="Autre chose de fait ?" onFermer={onFermer}>
      <label className="champ">
        <span>Quelle tâche ?</span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher : vitres, cuisine…" type="search" />
      </label>
      {groupes.map((g) => (
        <section key={g.piece.id} className="bloc">
          <p className="etiquette-champ groupe-piece">
            <Illus nom={g.piece.icone} taille={20} /> {g.piece.nom}
          </p>
          <ul className="liste-choix-tache">
            {g.taches.map((t) => (
              <li key={t.id}>
                <button className="choix-tache" onClick={() => setTache(t)}>
                  <Illus nom={t.icone} taille={32} />
                  <span>{t.nom}</span>
                  {t.derniere_fois === jour && <span className="etiquette">fait aujourd’hui</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groupes.length === 0 && <p className="discret">Aucune tâche ne correspond.</p>}
    </Feuille>
  );
}
