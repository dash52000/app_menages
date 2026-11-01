import { useState } from 'react';
import { NOM_APPLI, VERSION } from '../config.ts';
import { aujourdhui } from '../lib/dates.ts';
import { livrerFichier, versCsv } from '../lib/export.ts';
import { lireTout, type Maison } from '../lib/useMaison.ts';
import type { Message } from './Bandeau.tsx';
import { Illus } from './Illus.tsx';

export function Reglages({ maison, informer }: { maison: Maison; informer: (m: Message) => void }) {
  const [attente, setAttente] = useState<string | null>(null);
  const foyer = maison.foyer;
  const moi = maison.profils.find((p) => p.id === maison.moi);
  const installee = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  const inviter = async () => {
    if (!foyer) return;
    const lien = `${location.origin}${location.pathname}#code=${foyer.code}`;
    const texte = `Rejoins notre maison sur ${NOM_APPLI} : ${lien} (code ${foyer.code})`;
    maison.noter('invitation');
    try {
      if (navigator.share) {
        await navigator.share({ title: NOM_APPLI, text: texte });
        return;
      }
      await navigator.clipboard.writeText(texte);
      informer({ texte: 'Invitation copiée, colle-la dans un message.' });
    } catch {
      /* partage annulé */
    }
  };

  const exporter = async (type: 'historique' | 'journal' | 'tout') => {
    if (!foyer) return;
    setAttente(type);
    try {
      const jour = aujourdhui();
      const prenom = (id: unknown) => maison.profils.find((p) => p.id === id)?.prenom ?? '';
      if (type === 'historique') {
        const lignes = await lireTout('menage_historique', foyer.id, 'fait_le');
        const csv = versCsv(
          lignes.map((l) => ({ fait_le: l.fait_le, piece: l.piece_nom, tache: l.tache_nom, par: prenom(l.profil_id), enregistre_le: l.cree_le })),
        );
        await livrerFichier(`menage-historique-${jour}.csv`, csv, 'text/csv');
      } else if (type === 'journal') {
        const lignes = await lireTout('menage_journal', foyer.id, 'cree_le');
        const csv = versCsv(
          lignes.map((l) => ({ cree_le: l.cree_le, profil: prenom(l.profil_id), evenement: l.evenement, tache_id: l.tache_id, details: l.details })),
        );
        await livrerFichier(`menage-journal-${jour}.csv`, csv, 'text/csv');
      } else {
        const [historique, journal] = await Promise.all([
          lireTout('menage_historique', foyer.id, 'fait_le'),
          lireTout('menage_journal', foyer.id, 'cree_le'),
        ]);
        const tout = {
          exporte_le: new Date().toISOString(),
          version: VERSION,
          foyer,
          profils: maison.profils,
          pieces: maison.pieces,
          taches: maison.taches,
          produits: maison.produits,
          historique,
          journal,
        };
        await livrerFichier(`menage-sauvegarde-${jour}.json`, JSON.stringify(tout, null, 2), 'application/json');
      }
      maison.noter('export', { type });
    } catch {
      informer({ texte: 'Export impossible sans réseau.' });
    } finally {
      setAttente(null);
    }
  };

  return (
    <section className="ecran">
      <header className="entete">
        <h1>Réglages</h1>
      </header>

      <div className="carte-reglage">
        <h2>La maison</h2>
        <p className="discret">Code à taper une fois sur chaque téléphone :</p>
        <p className="code-maison" aria-label={`Code ${foyer?.code.split('').join(' ')}`}>
          {foyer?.code}
        </p>
        <button className="bouton-secondaire large" onClick={inviter}>
          Inviter quelqu’un
        </button>
        <ul className="profils">
          {maison.profils.map((p) => (
            <li key={p.id}>
              <span className="pastille" style={{ background: p.couleur }} aria-hidden />
              {p.prenom}
              {p.id === moi?.id && <span className="discret"> (ce téléphone)</span>}
            </li>
          ))}
        </ul>
      </div>

      {!installee && (
        <div className="carte-reglage">
          <h2>Sur l’écran d’accueil</h2>
          <p className="discret">
            iPhone : bouton Partager, puis « Sur l’écran d’accueil ». Android : menu ⋮, puis « Installer l’application ».
            Une fois installée, ouvre-la depuis l’icône et entre le code de la maison.
          </p>
        </div>
      )}

      <div className="carte-reglage">
        <h2>Vos données</h2>
        <p className="discret">Tout l’historique et le journal d’utilisation, pour les analyser ailleurs.</p>
        <div className="pile">
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('historique')}>
            {attente === 'historique' ? 'Préparation…' : 'Historique des tâches (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('journal')}>
            {attente === 'journal' ? 'Préparation…' : 'Journal d’utilisation (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('tout')}>
            {attente === 'tout' ? 'Préparation…' : 'Sauvegarde complète (JSON)'}
          </button>
        </div>
      </div>

      <footer className="pied">
        <Illus nom="sparkles" taille={24} />
        <p>
          {NOM_APPLI} {VERSION}
          <br />
          Illustrations : Fluent Emoji (Microsoft), licence MIT.
        </p>
      </footer>
    </section>
  );
}
