import { useRef, useState, type FormEvent } from 'react';
import { aujourdhui } from '../lib/dates.ts';
import { DUREES, RYTHMES, libelleDuree, libelleRythme } from '../lib/catalogue.ts';
import { nomProche } from '../lib/doublons.ts';
import { SAISIE_TEXTE_MAX, saisirEnLangageNaturel } from '../lib/ia.ts';
import {
  MESSAGE_RIEN_TROUVE,
  cartesLocales,
  lignesDepuis,
  messageSansIA,
  phraseValidation,
  type LigneSaisie,
} from '../lib/saisie.ts';
import { supabase } from '../lib/supabase.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Message } from './Bandeau.tsx';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';

interface Proposition {
  lignes: LigneSaisie[];
  /** Compteurs pour le journal (jamais le texte tapé). */
  base: Record<string, number>;
}

/**
 * « Dis-le en une phrase » (IA1). Trois taps : écrire, envoyer, OK.
 * Le modèle ne fait que proposer ; rien n'est écrit avant le OK, et c'est le code existant qui écrit
 * (agir pour cocher, ajouterTache pour créer), donc l'annulation habituelle marche.
 */
export function SaisieIA({ maison, informer }: { maison: Maison; informer: (m: Message) => void }) {
  const [texte, setTexte] = useState('');
  const [attente, setAttente] = useState(false);
  const [proposition, setProposition] = useState<Proposition | null>(null);
  const maisonRef = useRef(maison);
  maisonRef.current = maison;

  const nomPiece = (id: string) => maison.pieces.find((p) => p.id === id)?.nom ?? '';

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const t = texte.trim();
    if (!t || attente) return;
    setAttente(true);
    const r = await saisirEnLangageNaturel(supabase, t, { test: maison.enTest });
    setAttente(false);
    const nbChars = t.length;
    if (!r.sortie) {
      maison.noter('ia_saisie', { issue: 'indisponible', raison: r.raison ?? 'inconnue', nb_chars: nbChars });
      informer({ texte: messageSansIA(r.raison) });
      return;
    }
    const { cartes, ecartees } = cartesLocales(r.sortie, maison.taches, maison.pieces);
    const base = {
      nb_chars: nbChars,
      nb_cartes: cartes.length,
      nb_cocher: cartes.filter((c) => c.type === 'cocher').length,
      nb_nouvelles: cartes.filter((c) => c.type === 'nouvelle').length,
      rejetees_serveur: r.sortie.rejetees,
      ecartees_telephone: ecartees,
    };
    if (!cartes.length) {
      maison.noter('ia_saisie', { ...base, issue: 'vide' });
      informer({ texte: MESSAGE_RIEN_TROUVE });
      return;
    }
    setProposition({ lignes: lignesDepuis(cartes, maison.taches, aujourdhui()), base });
  };

  const changer = (cle: string, champs: Partial<LigneSaisie>) =>
    setProposition((p) => p && { ...p, lignes: p.lignes.map((l) => (l.cle === cle ? ({ ...l, ...champs } as LigneSaisie) : l)) });

  const fermer = () => {
    if (proposition) maison.noter('ia_saisie', { ...proposition.base, issue: 'refusee' });
    setProposition(null);
  };

  const valider = () => {
    if (!proposition) return;
    const annulations: Array<() => void> = [];
    let cochees = 0;
    let ajoutees = 0;
    for (const l of proposition.lignes) {
      if (!l.coche) continue;
      if (l.type === 'cocher') {
        const annuler = maison.agir(l.tacheId, 'fait', { depuis: 'ia' });
        annulations.push(() => annuler());
        cochees++;
      } else {
        const nom = l.nom.trim();
        if (!nom) continue;
        const icone = maison.pieces.find((p) => p.id === l.pieceId)?.icone ?? 'sparkles';
        const id = maison.ajouterTache(l.pieceId, { nom, icone, rythme: l.rythme, duree: l.duree }, 'ia');
        annulations.push(() => {
          const t = maisonRef.current.taches.find((x) => x.id === id);
          if (!t) return;
          maisonRef.current.supprimerTache(t);
          maisonRef.current.noter('annulation', { action: 'ia_nouvelle_tache', tache: nom }, id);
        });
        ajoutees++;
      }
    }
    maison.noter('ia_saisie', {
      ...proposition.base,
      issue: cochees + ajoutees ? 'acceptee' : 'refusee',
      nb_cochees: cochees,
      nb_creees: ajoutees,
    });
    setProposition(null);
    if (!cochees && !ajoutees) return;
    setTexte('');
    informer({ texte: phraseValidation(cochees, ajoutees), action: { libelle: 'Annuler', faire: () => annulations.forEach((a) => a()) } });
  };

  const nbCoches = proposition?.lignes.filter((l) => l.coche && (l.type === 'cocher' || l.nom.trim())).length ?? 0;

  return (
    <>
      <form className="saisie-ia" onSubmit={envoyer}>
        <input
          type="text"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={SAISIE_TEXTE_MAX}
          placeholder="Dis-le en une phrase…"
          aria-label="Dis-le en une phrase, par exemple : on a fait la salle de bain à fond"
          enterKeyHint="send"
          disabled={attente}
        />
        <button type="submit" className="bouton-envoyer" disabled={!texte.trim() || attente} aria-label="Envoyer">
          {attente ? '…' : '↑'}
        </button>
      </form>
      {attente && (
        <p className="discret petit centre" role="status">
          Je regarde ce qui correspond…
        </p>
      )}

      {proposition && (
        <Feuille titre="Je propose" onFermer={fermer}>
          <ul className="liste-saisie">
            {proposition.lignes.map((l) => {
              if (l.type === 'cocher') {
                const t = maison.taches.find((x) => x.id === l.tacheId);
                if (!t) return null;
                return (
                  <li key={l.cle}>
                    <label className="ligne-saisie">
                      <input type="checkbox" checked={l.coche} onChange={(e) => changer(l.cle, { coche: e.target.checked })} />
                      <Illus nom={t.icone} taille={36} />
                      <span className="ligne-saisie-texte">
                        <strong>{t.nom}</strong>
                        <span className="discret petit">
                          {nomPiece(t.piece_id)}
                          {l.dejaFaite ? ' · déjà faite aujourd’hui' : l.raison ? ` · ${l.raison}` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              }
              const proche = nomProche(l.nom, maison.taches.filter((t) => t.piece_id === l.pieceId).map((t) => t.nom));
              return (
                <li key={l.cle} className="ligne-saisie nouvelle">
                  <label className="ligne-saisie-haut">
                    <input type="checkbox" checked={l.coche} onChange={(e) => changer(l.cle, { coche: e.target.checked })} />
                    <span className="etiquette">Nouvelle tâche</span>
                  </label>
                  <div className="champ">
                    <input value={l.nom} onChange={(e) => changer(l.cle, { nom: e.target.value })} maxLength={60} aria-label="Nom de la tâche" />
                  </div>
                  <div className="ligne-saisie-champs">
                    <label className="champ">
                      <span>Pièce</span>
                      <select value={l.pieceId} onChange={(e) => changer(l.cle, { pieceId: e.target.value })}>
                        {maison.pieces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nom}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="champ">
                      <span>Rythme</span>
                      <select value={l.rythme} onChange={(e) => changer(l.cle, { rythme: Number(e.target.value) })}>
                        {(RYTHMES.some((r) => r.jours === l.rythme) ? RYTHMES : [...RYTHMES, { jours: l.rythme, libelle: libelleRythme(l.rythme) }]).map((r) => (
                          <option key={r.jours} value={r.jours}>
                            {r.libelle}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="champ">
                      <span>Durée</span>
                      <select value={l.duree} onChange={(e) => changer(l.cle, { duree: Number(e.target.value) })}>
                        {(DUREES.includes(l.duree) ? DUREES : [...DUREES, l.duree].sort((a, b) => a - b)).map((d) => (
                          <option key={d} value={d}>
                            {libelleDuree(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {proche && <p className="discret petit">Proche de « {proche} », déjà dans cette pièce.</p>}
                  {l.raison && <p className="discret petit">{l.raison}</p>}
                </li>
              );
            })}
          </ul>
          <button className="bouton-principal large" onClick={valider} disabled={nbCoches === 0}>
            {nbCoches ? `OK (${nbCoches})` : 'OK'}
          </button>
        </Feuille>
      )}
    </>
  );
}
