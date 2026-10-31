import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase.ts';
import { CLES, ecrire, lire } from './lib/stockage.ts';
import { useMaison } from './lib/useMaison.ts';
import type { Membre } from './lib/types.ts';
import { Arrivee } from './components/Arrivee.tsx';
import { Configuration } from './components/Configuration.tsx';
import { Aujourdhui } from './components/Aujourdhui.tsx';
import { Pieces } from './components/Pieces.tsx';
import { Reglages } from './components/Reglages.tsx';
import { Bandeau, type Message } from './components/Bandeau.tsx';
import { Illus } from './components/Illus.tsx';

type Onglet = 'aujourdhui' | 'pieces' | 'reglages';

/** Une « ouverture » de plus si l'on revient après au moins une minute ailleurs. */
const RETOUR_MIN_MS = 60_000;

export default function App() {
  const [membre, setMembre] = useState<Membre | null>(() => lire<Membre | null>(CLES.membre, null));
  const [verifie, setVerifie] = useState(false);
  const [alerte, setAlerte] = useState('');

  const definir = useCallback((m: Membre | null) => {
    ecrire(CLES.membre, m);
    if (!m) ecrire(CLES.cache, null);
    setMembre(m);
  }, []);

  // Au démarrage : retrouver le foyer de ce téléphone (identité anonyme gardée sur l'appareil).
  useEffect(() => {
    let annule = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (annule) return;
      if (!data.session) {
        if (membre) definir(null);
        setVerifie(true);
        return;
      }
      const r = await supabase.from('menage_membres').select('foyer_id, profil_id').eq('user_id', data.session.user.id).maybeSingle();
      if (annule) return;
      if (!r.error) {
        const m = r.data as Membre | null;
        if (!m) definir(null);
        else if (!membre || m.foyer_id !== membre.foyer_id || m.profil_id !== membre.profil_id) definir(m);
      }
      // Erreur réseau : on garde le foyer connu et on démarre sur le cache.
      setVerifie(true);
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!membre) {
    if (!verifie) return <Demarrage />;
    return <Arrivee alerte={alerte} onPret={(m) => definir(m)} />;
  }

  return (
    <Maison
      key={`${membre.foyer_id}-${membre.profil_id}`}
      membre={membre}
      onPerdu={() => {
        setAlerte('Ce téléphone n’est plus rattaché à la maison. Entre à nouveau son code.');
        definir(null);
      }}
    />
  );
}

function Demarrage() {
  return (
    <main className="ecran-accueil">
      <div className="accueil-illus pulse">
        <Illus nom="sparkles" taille={72} />
      </div>
    </main>
  );
}

function Maison({ membre, onPerdu }: { membre: Membre; onPerdu: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');
  const [pieceOuverte, setPieceOuverte] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const minuteur = useRef<number | undefined>(undefined);

  const informer = useCallback((m: Message) => {
    window.clearTimeout(minuteur.current);
    setMessage(m);
    minuteur.current = window.setTimeout(() => setMessage(null), m.duree ?? 5000);
  }, []);

  const fermer = useCallback(() => {
    window.clearTimeout(minuteur.current);
    setMessage(null);
  }, []);

  const maison = useMaison(membre, () => informer({ texte: 'Une modification n’a pas pu être enregistrée.' }));
  const { noter, statut } = maison;

  useEffect(() => {
    if (statut === 'introuvable') onPerdu();
  }, [statut, onPerdu]);

  // Journal : ouvertures de l'appli (source, heure, installée ou non).
  useEffect(() => {
    const parametres = new URLSearchParams(location.search);
    const installee = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    noter('ouverture', { source: parametres.get('src') ?? 'directe', heure: new Date().getHours(), installee });
    let cachee = 0;
    const visibilite = () => {
      if (document.visibilityState === 'hidden') cachee = Date.now();
      else if (cachee && Date.now() - cachee >= RETOUR_MIN_MS) {
        noter('ouverture', { source: 'retour', heure: new Date().getHours(), installee });
      }
    };
    document.addEventListener('visibilitychange', visibilite);
    return () => document.removeEventListener('visibilitychange', visibilite);
  }, [noter]);

  const changerOnglet = (o: Onglet) => {
    if (o === onglet) {
      if (o === 'pieces') setPieceOuverte(null);
      return;
    }
    setOnglet(o);
    noter('vue_onglet', { onglet: o });
  };

  useEffect(() => () => window.clearTimeout(minuteur.current), []);

  const pret = Boolean(maison.foyer);
  if (!pret) {
    return (
      <main className="ecran-accueil">
        <div className="accueil-illus pulse">
          <Illus nom="house" taille={72} />
        </div>
        <p className="discret">{statut === 'hors-ligne' ? 'Pas de réseau pour charger la maison. Elle s’affichera au retour de la connexion.' : 'Chargement de la maison…'}</p>
      </main>
    );
  }

  if (maison.pieces.length === 0 && statut === 'ok') return <Configuration maison={maison} />;

  return (
    <div className="app">
      {statut === 'hors-ligne' && (
        <div className="alerte" role="status">
          Hors ligne · tes changements partiront au retour du réseau
          {maison.enAttente > 0 ? ` (${maison.enAttente} en attente)` : ''}.
        </div>
      )}

      <div className="contenu">
        <div hidden={onglet !== 'aujourdhui'}>
          <Aujourdhui maison={maison} actif={onglet === 'aujourdhui'} allerPieces={() => changerOnglet('pieces')} />
        </div>
        {onglet === 'pieces' && (
          <Pieces maison={maison} informer={informer} pieceOuverte={pieceOuverte} setPieceOuverte={setPieceOuverte} />
        )}
        {onglet === 'reglages' && <Reglages maison={maison} informer={informer} />}
      </div>

      {message && <Bandeau message={message} onFermer={fermer} />}

      <nav className="onglets" aria-label="Sections">
        <button className={onglet === 'aujourdhui' ? 'actif' : ''} onClick={() => changerOnglet('aujourdhui')} aria-current={onglet === 'aujourdhui'}>
          <Illus nom="sparkles" taille={26} />
          Aujourd’hui
        </button>
        <button className={onglet === 'pieces' ? 'actif' : ''} onClick={() => changerOnglet('pieces')} aria-current={onglet === 'pieces'}>
          <Illus nom="house" taille={26} />
          Pièces
        </button>
        <button className={onglet === 'reglages' ? 'actif' : ''} onClick={() => changerOnglet('reglages')} aria-current={onglet === 'reglages'}>
          <Illus nom="key" taille={26} />
          Réglages
        </button>
      </nav>
    </div>
  );
}
