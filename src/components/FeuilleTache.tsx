import { useState } from 'react';
import { BANQUE_ICONES, CATALOGUE, DUREES, RYTHMES, libelleDuree, libelleRythme } from '../lib/catalogue.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Piece, Tache } from '../lib/types.ts';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/** Ajouter ou modifier une tâche d'une pièce. */
export function FeuilleTache({
  maison,
  piece,
  tache,
  onFermer,
  informer,
}: {
  maison: Maison;
  piece: Piece;
  tache: Tache | null;
  onFermer: () => void;
  informer: (m: Message) => void;
}) {
  const [nom, setNom] = useState(tache?.nom ?? '');
  const [icone, setIcone] = useState(tache?.icone ?? piece.icone);
  const [rythme, setRythme] = useState(tache?.rythme_jours ?? 7);
  const [duree, setDuree] = useState(tache?.duree_min ?? 10);
  const [depuisCatalogue, setDepuisCatalogue] = useState(false);

  // Suggestions : les tâches du catalogue pour ce type de pièce, pas encore présentes.
  const presentes = new Set(maison.taches.filter((t) => t.piece_id === piece.id).map((t) => t.nom.toLowerCase()));
  const modele = CATALOGUE.find((p) => p.icone === piece.icone || p.nom.toLowerCase() === piece.nom.toLowerCase());
  const suggestions = tache ? [] : (modele?.taches ?? []).filter((t) => !presentes.has(t.nom.toLowerCase()));

  const icones = BANQUE_ICONES.includes(icone) ? BANQUE_ICONES : [icone, ...BANQUE_ICONES];
  const dureesProposees = DUREES.includes(duree) ? DUREES : [...DUREES, duree].sort((a, b) => a - b);
  const rythmes = RYTHMES.some((r) => r.jours === rythme) ? RYTHMES : [...RYTHMES, { jours: rythme, libelle: libelleRythme(rythme) }];

  const enregistrer = () => {
    const n = nom.trim();
    if (!n) return;
    if (tache) {
      maison.modifierTache(tache, { nom: n, icone, rythme_jours: rythme, duree_min: duree });
    } else {
      maison.ajouterTache(piece.id, { nom: n, icone, rythme, duree }, depuisCatalogue ? 'catalogue' : 'libre');
      informer({ texte: `${n} ajoutée à ${piece.nom}` });
    }
    onFermer();
  };

  const supprimer = () => {
    if (!tache) return;
    const annuler = maison.supprimerTache(tache);
    informer({ texte: `${tache.nom} supprimée`, action: { libelle: 'Annuler', faire: annuler } });
    onFermer();
  };

  return (
    <Feuille titre={tache ? 'Modifier la tâche' : `Nouvelle tâche · ${piece.nom}`} onFermer={onFermer}>
      {suggestions.length > 0 && (
        <div className="bloc">
          <p className="etiquette-champ">Suggestions</p>
          <div className="puces">
            {suggestions.map((s) => (
              <button
                key={s.nom}
                className={`puce ${nom === s.nom ? 'active' : ''}`}
                onClick={() => {
                  setNom(s.nom);
                  setIcone(s.icone);
                  setRythme(s.rythme);
                  setDuree(s.duree);
                  setDepuisCatalogue(true);
                }}
              >
                {s.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="champ">
        <span>Nom</span>
        <input
          value={nom}
          onChange={(e) => {
            setNom(e.target.value);
            setDepuisCatalogue(false);
          }}
          placeholder="Nettoyer le four…"
          maxLength={50}
          autoCapitalize="sentences"
        />
      </label>

      <div className="bloc">
        <p className="etiquette-champ">Illustration</p>
        <div className="defilant" role="radiogroup" aria-label="Illustration">
          {icones.map((i) => (
            <button
              key={i}
              className={`choix-icone ${i === icone ? 'active' : ''}`}
              onClick={() => setIcone(i)}
              role="radio"
              aria-checked={i === icone}
              aria-label={i}
            >
              <Illus nom={i} taille={34} />
            </button>
          ))}
        </div>
      </div>

      <label className="champ">
        <span>Rythme</span>
        <select value={rythme} onChange={(e) => setRythme(Number(e.target.value))}>
          {rythmes.map((r) => (
            <option key={r.jours} value={r.jours}>
              {r.libelle}
            </option>
          ))}
        </select>
      </label>

      <div className="bloc">
        <p className="etiquette-champ">Durée</p>
        <div className="puces">
          {dureesProposees.map((d) => (
            <button key={d} className={`puce ${d === duree ? 'active' : ''}`} onClick={() => setDuree(d)}>
              {libelleDuree(d)}
            </button>
          ))}
        </div>
      </div>

      <button className="bouton-principal" disabled={!nom.trim()} onClick={enregistrer}>
        {tache ? 'Enregistrer' : 'Ajouter'}
      </button>
      {tache && (
        <button className="bouton-danger" onClick={supprimer}>
          Supprimer la tâche
        </button>
      )}
    </Feuille>
  );
}
