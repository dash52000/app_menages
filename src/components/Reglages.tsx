import { useState } from 'react';
import { NOM_APPLI, VERSION } from '../config.ts';
import { aujourdhui } from '../lib/dates.ts';
import {
  csvHistorique,
  csvJournal,
  csvPieces,
  csvProduits,
  csvProfils,
  csvTaches,
  livrerFichier,
  livrerFichiers,
  type Fichier,
} from '../lib/export.ts';
import { demanderIA, type RaisonSansIA } from '../lib/ia.ts';
import { supabase } from '../lib/supabase.ts';
import { DUREE_TEST_H, lireTout, type Maison } from '../lib/useMaison.ts';
import type { Message } from './Bandeau.tsx';
import { Illus } from './Illus.tsx';

export function Reglages({ maison, informer }: { maison: Maison; informer: (m: Message) => void }) {
  const [attente, setAttente] = useState<string | null>(null);
  const foyer = maison.foyer;
  const moi = maison.profils.find((p) => p.id === maison.moi);
  const installee = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;

  // IA0 : essai réel de la fonction llm, seulement pendant une session de test.
  const essayerIA = async (vision: boolean) => {
    setAttente(vision ? 'ia_photo' : 'ia');
    const image = vision ? imageEssai() : undefined;
    const r = vision
      ? await demanderIA<{ couleur: string }>(supabase, 'essai_vision', {}, { image, test: true })
      : await demanderIA<{ mot: string }>(supabase, 'essai', {}, { test: true });
    setAttente(null);
    if (r.sortie) {
      const vu = 'couleur' in r.sortie ? r.sortie.couleur : r.sortie.mot;
      informer({ texte: `IA prête : « ${vu} ».` });
    } else {
      informer({ texte: `IA indisponible (${libelleRaison(r.raison)}) : l’appli continue sans.` });
    }
  };

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

  type Export = 'taches' | 'produits' | 'historique' | 'journal' | 'csv' | 'json';

  const exporter = async (type: Export) => {
    if (!foyer) return;
    setAttente(type);
    try {
      const jour = aujourdhui();
      const csv = (nom: string, contenu: string): Fichier => ({ nom: `menage-${nom}-${jour}.csv`, contenu, type: 'text/csv' });
      const historique = () => lireTout('menage_historique', foyer.id, 'fait_le');
      const journal = () => lireTout('menage_journal', foyer.id, 'cree_le');
      if (type === 'taches') {
        await livrerFichiers([csv('taches', csvTaches(maison.taches, maison.pieces, maison.profils))]);
      } else if (type === 'produits') {
        await livrerFichiers([csv('produits', csvProduits(maison.produits, maison.profils))]);
      } else if (type === 'historique') {
        await livrerFichiers([csv('historique', csvHistorique(await historique(), maison.profils))]);
      } else if (type === 'journal') {
        await livrerFichiers([csv('journal', csvJournal(await journal(), maison.profils))]);
      } else if (type === 'csv') {
        // Tout en CSV, d'un coup : chaque ligne garde son id, les fichiers se recoupent entre eux.
        const [h, j] = await Promise.all([historique(), journal()]);
        await livrerFichiers([
          csv('pieces', csvPieces(maison.pieces)),
          csv('taches', csvTaches(maison.taches, maison.pieces, maison.profils)),
          csv('produits', csvProduits(maison.produits, maison.profils)),
          csv('profils', csvProfils(maison.profils)),
          csv('historique', csvHistorique(h, maison.profils)),
          csv('journal', csvJournal(j, maison.profils)),
        ]);
      } else {
        const [h, j] = await Promise.all([historique(), journal()]);
        const tout = {
          exporte_le: new Date().toISOString(),
          version: VERSION,
          foyer,
          profils: maison.profils,
          pieces: maison.pieces,
          taches: maison.taches,
          produits: maison.produits,
          historique: h,
          journal: j,
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
        <p className="discret">Tout est à vous : un fichier CSV par sujet, chaque ligne avec son id, pour les analyser ailleurs.</p>
        <div className="pile">
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('csv')}>
            {attente === 'csv' ? 'Préparation…' : 'Tout en CSV (6 fichiers)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('taches')}>
            {attente === 'taches' ? 'Préparation…' : 'Tâches (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('produits')}>
            {attente === 'produits' ? 'Préparation…' : 'Produits du placard (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('historique')}>
            {attente === 'historique' ? 'Préparation…' : 'Historique des tâches (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('journal')}>
            {attente === 'journal' ? 'Préparation…' : 'Journal d’utilisation (CSV)'}
          </button>
          <button className="bouton-secondaire" disabled={attente !== null} onClick={() => exporter('json')}>
            {attente === 'json' ? 'Préparation…' : 'Sauvegarde complète (JSON)'}
          </button>
        </div>
        <p className="discret petit">La sauvegarde JSON contient le code de la maison : ne la partage pas.</p>
      </div>

      <div className="carte-reglage">
        <h2>Session de test</h2>
        <p className="discret">
          Pour essayer l’appli sans fausser les mesures : les événements du journal sont marqués « test » et écartés des
          analyses. S’éteint toute seule au bout de {DUREE_TEST_H} h.
        </p>
        <button
          className={`interrupteur ${maison.enTest ? 'marche' : ''}`}
          onClick={() => maison.basculerTest(!maison.enTest)}
          role="switch"
          aria-checked={maison.enTest}
        >
          <span className="interrupteur-texte">
            <strong>{maison.enTest ? 'Session de test en cours' : 'Session de test éteinte'}</strong>
            <span className="discret petit">{maison.enTest ? 'Touche pour l’éteindre' : 'Touche pour l’allumer sur ce téléphone'}</span>
          </span>
          <span className="interrupteur-curseur" aria-hidden>
            <span />
          </span>
        </button>
        {maison.enTest && (
          <div className="pile">
            <button className="bouton-secondaire" disabled={attente !== null} onClick={() => essayerIA(false)}>
              {attente === 'ia' ? 'Essai en cours…' : 'Essai IA (texte)'}
            </button>
            <button className="bouton-secondaire" disabled={attente !== null} onClick={() => essayerIA(true)}>
              {attente === 'ia_photo' ? 'Essai en cours…' : 'Essai IA (image)'}
            </button>
          </div>
        )}
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

function libelleRaison(r?: RaisonSansIA): string {
  switch (r) {
    case 'quota_jour': return 'quota du jour atteint';
    case 'quota_minute': return 'trop d’appels cette minute';
    case 'reseau': return 'pas de réponse';
    case 'sans_foyer': return 'téléphone sans maison';
    case 'non_connecte': return 'pas connecté';
    default: return 'modèles indisponibles';
  }
}

/** Petite image bleue unie (PNG en base64), pour l'essai de la chaîne vision sans photo. */
function imageEssai(): { base64: string; type: string } | undefined {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(0, 0, 64, 64);
    return { base64: c.toDataURL('image/png').split(',')[1], type: 'image/png' };
  } catch {
    return undefined;
  }
}
