import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ajouterJours, aujourdhui, ecart, jourRelatif, type Jour } from '../lib/dates.ts';
import {
  MAX_CHECK,
  candidatesCheck,
  estDue,
  estFaiteLe,
  estReportee,
  estReserveeLe,
  jauge as calculerJauge,
  selectionCheck,
} from '../lib/fraicheur.ts';
import { libelleDuree } from '../lib/catalogue.ts';
import { besoinsDe } from '../lib/fiches.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Action, Profil, Tache } from '../lib/types.ts';
import { Anneau, phraseJauge } from './Jauge.tsx';
import { Illus } from './Illus.tsx';
import { LigneProduit } from './Produits.tsx';
import { FicheTache } from './FicheTache.tsx';
import { AutreFait } from './AutreFait.tsx';
import type { Message } from './Bandeau.tsx';

interface Fait {
  action: Action;
  quand: Jour;
  profilId?: string;
  annuler: (silencieux?: boolean) => void;
}

interface Session {
  jour: Jour;
  ids: string[];
  vus: string[];
  debut: number;
  faits: Record<string, Fait>;
  termine: boolean;
  /** Le journal a déjà reçu la fin (ou l'abandon) de cette session. */
  journalise: boolean;
  reprise: boolean;
}

/** Au-delà de 10 minutes hors de l'appli, on repart sur un check neuf. */
const REPRISE_MAX_MS = 10 * 60 * 1000;

function salutation(prenom: string): string {
  const h = new Date().getHours();
  const mot = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return prenom ? `${mot} ${prenom}` : mot;
}

function nouvelleSession(taches: Tache[], jour: Jour, vus: string[] = []): Session {
  const { liste } = selectionCheck(taches, jour, MAX_CHECK, new Set(vus));
  const ids = liste.map((t) => t.id);
  return { jour, ids, vus: [...vus, ...ids], debut: Date.now(), faits: {}, termine: false, journalise: false, reprise: false };
}

export function Aujourdhui({
  maison,
  actif,
  allerPieces,
  informer,
}: {
  maison: Maison;
  actif: boolean;
  allerPieces: () => void;
  informer: (m: Message) => void;
}) {
  const jour = aujourdhui();
  const { taches, pieces, profils, autres, moi, foyer } = maison;
  const [session, setSession] = useState<Session | null>(null);
  const [choixJour, setChoixJour] = useState<string | null>(null);
  const [ficheOuverte, setFicheOuverte] = useState<string | null>(null);
  const [autreFait, setAutreFait] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const videNote = useRef<Jour | null>(null);
  const cache = useRef<{ depuis: number } | null>(null);

  const pret = Boolean(foyer);
  const joursCouverts = foyer?.dernier_check ? ecart(foyer.dernier_check, jour) : 0;
  const rattrapage = joursCouverts >= 2;

  // Le check est figé à son ouverture : les cartes ne sautent pas pendant qu'on coche.
  useEffect(() => {
    if (pret && (!session || session.jour !== jour)) setSession(nouvelleSession(taches, jour));
  }, [pret, session, jour, taches]);

  const cartes = useMemo(
    () => (session ? session.ids.map((id) => taches.find((t) => t.id === id)).filter((t): t is Tache => Boolean(t)) : []),
    [session, taches],
  );

  /** Faite sur l'autre téléphone, ou notée via « Autre chose de fait ? », pendant le check. */
  const faiteAilleurs = useCallback(
    (t: Tache) =>
      !session?.faits[t.id] && (estFaiteLe(t, jour) || (!estDue(t, jour) && !estReportee(t, jour) && !estReserveeLe(t, jour))),
    [session, jour],
  );
  const reporteeAilleurs = useCallback((t: Tache) => !session?.faits[t.id] && estReportee(t, jour), [session, jour]);
  const traitee = useCallback(
    (t: Tache) => Boolean(session?.faits[t.id]) || faiteAilleurs(t) || reporteeAilleurs(t),
    [session, faiteAilleurs, reporteeAilleurs],
  );
  const nbTraitees = cartes.filter(traitee).length;
  const complet = cartes.length > 0 && nbTraitees === cartes.length;
  const reste = useMemo(
    () => (session ? candidatesCheck(taches, jour).filter((t) => !session.vus.includes(t.id)).length : 0),
    [session, taches, jour],
  );

  const terminer = useCallback(
    (raison: 'complet' | 'arret') => {
      const s = sessionRef.current;
      if (!s || s.termine) return;
      const compte: Record<Action, number> = { fait: 0, fait_autre: 0, demain: 0, je_prends: 0 };
      for (const f of Object.values(s.faits)) compte[f.action] += 1;
      const ailleurs = cartes.filter((t) => !s.faits[t.id] && faiteAilleurs(t)).length;
      maison.terminerCheck({
        raison,
        duree_s: Math.round((Date.now() - s.debut) / 1000),
        nb_taches: cartes.length,
        ...compte,
        faites_ailleurs: ailleurs,
        ignorees: cartes.length - cartes.filter(traitee).length,
        jours_couverts: joursCouverts,
        reprise: s.reprise,
      });
      setSession({ ...s, termine: true, journalise: true });
    },
    [cartes, faiteAilleurs, joursCouverts, maison, traitee],
  );

  useEffect(() => {
    if (complet && session && !session.termine) terminer('complet');
  }, [complet, session, terminer]);

  // Rien à faire aujourd'hui : le check compte quand même comme fait.
  useEffect(() => {
    if (actif && session && session.ids.length === 0 && videNote.current !== jour && foyer?.dernier_check !== jour) {
      videNote.current = jour;
      maison.terminerCheck({ vide: true, jours_couverts: joursCouverts });
    }
  }, [actif, session, jour, foyer, joursCouverts, maison]);

  // Quitter l'appli au milieu d'un check = abandon (journalisé une fois) ;
  // revenir vite reprend le même check, revenir tard en ouvre un neuf.
  useEffect(() => {
    const visibilite = () => {
      const s = sessionRef.current;
      if (document.visibilityState === 'hidden') {
        cache.current = { depuis: Date.now() };
        if (s && !s.termine && !s.journalise && s.ids.length) {
          maison.noter('check_abandonne', {
            duree_s: Math.round((Date.now() - s.debut) / 1000),
            nb_actions: Object.keys(s.faits).length,
            nb_taches: s.ids.length,
          });
          setSession({ ...s, journalise: true });
        }
      } else if (cache.current) {
        const absent = Date.now() - cache.current.depuis;
        cache.current = null;
        if (!s) return;
        if (absent > REPRISE_MAX_MS) setSession(nouvelleSession(maison.taches, aujourdhui()));
        else if (!s.termine) setSession({ ...s, debut: Date.now(), journalise: false, reprise: true });
      }
    };
    document.addEventListener('visibilitychange', visibilite);
    return () => document.removeEventListener('visibilitychange', visibilite);
  }, [maison]);

  const nomProfil = (id: string | null) => profils.find((p) => p.id === id)?.prenom ?? '';
  const moiProfil = profils.find((p) => p.id === moi);

  const agir = (t: Tache, action: Action, autre?: Profil) => {
    const annuler = maison.agir(t.id, action, { depuis: 'check', profilId: autre?.id });
    setSession((s) =>
      s ? { ...s, faits: { ...s.faits, [t.id]: { action, quand: jour, profilId: autre?.id, annuler } } } : s,
    );
  };

  const annuler = (t: Tache) => {
    session?.faits[t.id]?.annuler();
    setChoixJour(null);
    setSession((s) => {
      if (!s) return s;
      const faits = { ...s.faits };
      delete faits[t.id];
      return { ...s, faits, termine: false };
    });
  };

  const changerJour = (t: Tache, quand: Jour) => {
    const f = session?.faits[t.id];
    if (!f) return;
    f.annuler(true);
    const annulerNouveau = maison.agir(t.id, f.action, { depuis: 'check', jour: quand, profilId: f.profilId, silencieux: true });
    maison.noter('changement_jour', { action: f.action, decalage_jours: ecart(quand, jour), tache: t.nom }, t.id);
    setSession((s) => (s ? { ...s, faits: { ...s.faits, [t.id]: { ...f, quand, annuler: annulerNouveau } } } : s));
    setChoixJour(null);
  };

  const continuer = () => {
    setSession(nouvelleSession(taches, jour, session?.vus ?? []));
    maison.noter('check_suite', { reste });
  };

  const joursPossibles = useMemo(() => {
    const n = Math.min(6, Math.max(2, joursCouverts));
    return Array.from({ length: n + 1 }, (_, i) => ajouterJours(jour, -i));
  }, [jour, joursCouverts]);

  const pourcent = calculerJauge(taches, jour);

  if (!pret || !session) {
    return (
      <section className="ecran">
        <p className="discret centre">Chargement de la maison…</p>
      </section>
    );
  }

  const nomPiece = (t: Tache) => pieces.find((p) => p.id === t.piece_id)?.nom ?? '';

  return (
    <section className="ecran aujourdhui">
      <header className="entete">
        <h1>{salutation(moiProfil?.prenom ?? '')}</h1>
      </header>

      {pourcent !== null && (
        <button className="carte-jauge" onClick={allerPieces} aria-label={`Maison à ${pourcent} %, voir les pièces`}>
          <Anneau pourcent={pourcent} />
          <span>
            <strong>Maison à {pourcent} %</strong>
            <span className="discret">{phraseJauge(pourcent)}</span>
          </span>
        </button>
      )}

      {taches.length === 0 ? (
        <div className="vide">
          <Illus nom="house" taille={72} />
          <h2>Aucune tâche pour l’instant</h2>
          <button className="bouton-secondaire" onClick={allerPieces}>
            Ajouter des tâches dans les pièces
          </button>
        </div>
      ) : session.ids.length === 0 ? (
        <div className="vide">
          <Illus nom="sun-with-face" taille={72} />
          <h2>Rien qui tire aujourd’hui</h2>
          <p className="discret">Profitez-en.</p>
        </div>
      ) : session.termine ? (
        <div className="vide fin">
          <Illus nom="clapping-hands" taille={72} />
          <h2>Check fait !</h2>
          <p className="discret">{resume(session)}</p>
          {cartes
            .filter((t) => session.faits[t.id]?.action === 'je_prends' && !estFaiteLe(t, jour))
            .map((t) => (
              <div key={t.id} className="pour-moi">
                <Illus nom={t.icone} taille={32} />
                <span>
                  <strong>{t.nom}</strong>
                  <span className="discret">Pour toi aujourd’hui</span>
                </span>
                <button className="bouton-fait petit" onClick={() => agir(t, 'fait')}>
                  ✓ Fait
                </button>
              </div>
            ))}
          {reste > 0 ? (
            <>
              <button className="bouton-secondaire" onClick={continuer}>
                Encore {reste} qui {reste > 1 ? 'tirent' : 'tire'} · on continue ?
              </button>
              <p className="discret petit">Sinon, à demain.</p>
            </>
          ) : (
            <p className="discret petit">À demain.</p>
          )}
        </div>
      ) : (
        <>
          <p className="sous-titre">
            {rattrapage
              ? `Depuis ${jourRelatif(foyer!.dernier_check!, jour)}, qu’est-ce qui a été fait ?`
              : cartes.length === 1
                ? 'Une petite chose aujourd’hui.'
                : `${cartes.length} petites choses aujourd’hui.`}
          </p>

          <ul className="cartes">
            {cartes.map((t) => {
              const f = session.faits[t.id];
              if (f && f.action !== 'je_prends') {
                const texte =
                  f.action === 'demain'
                    ? 'Pour demain'
                    : `${f.action === 'fait_autre' ? `Fait par ${nomProfil(f.profilId ?? null)}` : 'Fait'} ${jourRelatif(f.quand, jour)}`;
                return (
                  <li key={t.id} className={`carte compacte ${f.action === 'demain' ? 'reportee' : 'faite'}`}>
                    <span className="pastille-ok" aria-hidden>
                      {f.action === 'demain' ? '→' : '✓'}
                    </span>
                    <div className="carte-texte">
                      <strong>{t.nom}</strong>
                      <span className="discret">{texte}</span>
                      {f.action !== 'demain' && (
                        <button className="lien lien-petit" onClick={() => setChoixJour(choixJour === t.id ? null : t.id)}>
                          {choixJour === t.id ? 'C’était quel jour ?' : 'Changer le jour'}
                        </button>
                      )}
                      {choixJour === t.id && (
                        <div className="puces" role="group" aria-label="Fait quel jour ?">
                          {joursPossibles.map((j) => (
                            <button key={j} className={`puce ${j === f.quand ? 'active' : ''}`} onClick={() => changerJour(t, j)}>
                              {jourRelatif(j, jour)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="lien" onClick={() => annuler(t)}>
                      Annuler
                    </button>
                  </li>
                );
              }

              if (faiteAilleurs(t) || reporteeAilleurs(t)) {
                const reportee = reporteeAilleurs(t);
                return (
                  <li key={t.id} className={`carte compacte ${reportee ? 'reportee' : 'faite'}`}>
                    <span className="pastille-ok" aria-hidden>
                      {reportee ? '→' : '✓'}
                    </span>
                    <div className="carte-texte">
                      <strong>{t.nom}</strong>
                      <span className="discret">
                        {reportee
                          ? 'Pour demain'
                          : `${t.derniere_par === moi ? 'Fait' : `Fait par ${nomProfil(t.derniere_par)}`} ${jourRelatif(t.derniere_fois ?? jour, jour)}`}
                      </span>
                    </div>
                  </li>
                );
              }

              const prisePar = estReserveeLe(t, jour) ? t.reserve_par : null;
              return (
                <li key={t.id} className="carte">
                  <button className="carte-haut" onClick={() => setFicheOuverte(t.id)} aria-label={`${t.nom} : comment faire`}>
                    <Illus nom={t.icone} taille={48} />
                    <span className="carte-texte">
                      <strong>{t.nom}</strong>
                      <span className="discret">
                        {nomPiece(t)} · {libelleDuree(t.duree_min)}
                      </span>
                      {besoinsDe(t).length > 0 && <LigneProduit options={besoinsDe(t)[0]} maison={maison} />}
                      {prisePar && (
                        <span className="etiquette">{prisePar === moi ? 'Pour toi aujourd’hui' : `${nomProfil(prisePar)} la prend`}</span>
                      )}
                    </span>
                    <span className="chevron" aria-hidden>
                      ›
                    </span>
                  </button>
                  <div className="carte-actions">
                    <button className="bouton-fait" onClick={() => agir(t, 'fait')}>
                      ✓ Fait
                    </button>
                    {autres.map((p) => (
                      <button
                        key={p.id}
                        className="bouton-fait-autre"
                        style={{ ['--profil' as string]: p.couleur }}
                        onClick={() => agir(t, 'fait_autre', p)}
                      >
                        Fait par {p.prenom}
                      </button>
                    ))}
                  </div>
                  <div className="carte-actions secondaires">
                    <button className="lien-action" onClick={() => agir(t, 'demain')}>
                      Demain
                    </button>
                    {!prisePar && (
                      <button className="lien-action" onClick={() => agir(t, 'je_prends')}>
                        Je prends
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {nbTraitees > 0 && (
            <button className="lien centre" onClick={() => terminer('arret')}>
              C’est tout pour aujourd’hui
            </button>
          )}
        </>
      )}

      {taches.length > 0 && (
        <button className="bouton-autre" onClick={() => setAutreFait(true)}>
          <Illus nom="check-mark-button" taille={22} />
          Autre chose de fait ?
        </button>
      )}

      {ficheOuverte && taches.some((t) => t.id === ficheOuverte) && (
        <FicheTache
          maison={maison}
          tache={taches.find((t) => t.id === ficheOuverte)!}
          depuis="check"
          onFermer={() => setFicheOuverte(null)}
          onFait={
            session.ids.includes(ficheOuverte) && !session.faits[ficheOuverte]
              ? () => agir(taches.find((t) => t.id === ficheOuverte)!, 'fait')
              : undefined
          }
          informer={informer}
        />
      )}
      {autreFait && <AutreFait maison={maison} onFermer={() => setAutreFait(false)} informer={informer} />}
    </section>
  );
}

function resume(s: Session): string {
  const f = Object.values(s.faits);
  const faites = f.filter((x) => x.action === 'fait' || x.action === 'fait_autre').length;
  const demain = f.filter((x) => x.action === 'demain').length;
  const prises = f.filter((x) => x.action === 'je_prends').length;
  const parts = [];
  if (faites) parts.push(`${faites} faite${faites > 1 ? 's' : ''}`);
  if (prises) parts.push(`${prises} prise${prises > 1 ? 's' : ''} pour aujourd’hui`);
  if (demain) parts.push(`${demain} pour demain`);
  return parts.length ? `${parts.join(', ')}. Merci !` : 'Merci !';
}
