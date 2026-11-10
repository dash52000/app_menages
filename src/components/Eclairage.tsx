import { estFaiteLe } from '../lib/fraicheur.ts';
import type { Jour } from '../lib/dates.ts';
import type { Piece, Profil, Tache } from '../lib/types.ts';
import { Illus } from './Illus.tsx';

/**
 * La maison qui s'éclaire : chaque pièce s'allume dès qu'une de ses tâches est
 * faite aujourd'hui, et repart dans la pénombre le lendemain. Rien ne montre
 * ce qui reste : seulement ce qui a été fait, par le foyer et par chacun.
 */
export function Eclairage({
  pieces,
  taches,
  profils,
  moi,
  jour,
  onPiece,
}: {
  pieces: Piece[];
  taches: Tache[];
  profils: Profil[];
  moi: string | null;
  jour: Jour;
  onPiece: () => void;
}) {
  const faites = taches.filter((t) => estFaiteLe(t, jour));
  const visibles = pieces.filter((p) => !p.en_pause_depuis);
  const allumees = new Set(faites.map((t) => t.piece_id));
  const nb = visibles.filter((p) => allumees.has(p.id)).length;
  const ordre = [...profils].sort((a, b) => (a.id === moi ? -1 : b.id === moi ? 1 : 0));

  if (!visibles.length) return null;

  return (
    <section className="eclairage" aria-label="Ce qui a été fait aujourd’hui">
      <div className="eclairage-tete">
        <strong>Aujourd’hui</strong>
        <span className="discret petit">
          {nb ? `${nb} pièce${nb > 1 ? 's' : ''} allumée${nb > 1 ? 's' : ''} sur ${visibles.length}` : 'La maison est dans la pénombre'}
        </span>
      </div>
      <ul className="fenetres">
        {visibles.map((p) => {
          const on = allumees.has(p.id);
          return (
            <li key={p.id}>
              <button className={`fenetre ${on ? 'allumee' : ''}`} onClick={onPiece} aria-label={`${p.nom}${on ? ', allumée' : ''}`}>
                <Illus nom={p.icone} taille={26} />
                <span>{p.nom}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="puces-jour">
        <span className={`puce-jour ${faites.length ? 'on' : ''}`}>
          <i aria-hidden /> Foyer
        </span>
        {ordre.map((p) => {
          const on = faites.some((t) => t.derniere_par === p.id);
          return (
            <span key={p.id} className={`puce-jour ${on ? 'on' : ''}`} style={{ ['--profil' as string]: p.couleur }}>
              <i aria-hidden /> {p.id === moi ? 'Toi' : p.prenom}
            </span>
          );
        })}
      </div>
    </section>
  );
}
