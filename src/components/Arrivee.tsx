import { useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import type { Membre } from '../lib/types.ts';
import { NOM_APPLI } from '../config.ts';
import { Illus } from './Illus.tsx';

type Mode = 'choix' | 'creer' | 'rejoindre';

/** Code d'invitation éventuel dans le lien (…#code=K7P2QX). */
function codeDuLien(): string {
  const m = location.hash.match(/code=([A-Za-z0-9]{4,8})/);
  return m ? m[1].toUpperCase() : '';
}

function messageErreur(e: unknown): string {
  const m = String((e as { message?: string } | null)?.message ?? e ?? '');
  if (/code_inconnu/.test(m)) return 'Ce code ne correspond à aucune maison. Vérifie-le auprès de l’autre.';
  if (/anonymous|anonyme|signups not allowed|disabled/i.test(m)) {
    return 'Les connexions anonymes ne sont pas activées dans Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).';
  }
  if (/fetch|network|load failed/i.test(m)) return 'Pas de réseau. Réessaie une fois connecté.';
  return `Ça n’a pas marché : ${m}`;
}

/**
 * Première ouverture sur un téléphone : on crée la maison, ou on la rejoint
 * avec son code. Ni compte, ni mot de passe.
 */
export function Arrivee({ onPret, alerte }: { onPret: (m: Membre, nouvelle: boolean) => void; alerte?: string }) {
  const codeLien = codeDuLien();
  const [mode, setMode] = useState<Mode>(codeLien ? 'rejoindre' : 'choix');
  const [prenom, setPrenom] = useState('');
  const [code, setCode] = useState(codeLien);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async () => {
    setErreur('');
    setAttente(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const r = await supabase.auth.signInAnonymously();
        if (r.error) throw r.error;
      }
      const r =
        mode === 'creer'
          ? await supabase.rpc('menage_creer_foyer', { p_prenom: prenom.trim() })
          : await supabase.rpc('menage_rejoindre_foyer', { p_code: code.trim(), p_prenom: prenom.trim() });
      if (r.error) throw r.error;
      const d = r.data as { foyer_id: string; profil_id: string };
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      onPret({ foyer_id: d.foyer_id, profil_id: d.profil_id }, mode === 'creer');
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setAttente(false);
    }
  };

  const pret = prenom.trim().length > 0 && (mode === 'creer' || code.replace(/[^A-Za-z0-9]/g, '').length >= 4);

  return (
    <main className="ecran-accueil">
      <div className="accueil-illus">
        <Illus nom="sparkles" taille={72} />
      </div>
      <h1 className="titre-appli">{NOM_APPLI}</h1>
      <p className="accroche">Le ménage à deux, sans prise de tête.</p>

      {alerte && <p className="alerte-douce">{alerte}</p>}

      {mode === 'choix' ? (
        <div className="pile">
          <button className="bouton-principal" onClick={() => setMode('creer')}>
            Créer notre maison
          </button>
          <button className="bouton-secondaire" onClick={() => setMode('rejoindre')}>
            J’ai un code
          </button>
        </div>
      ) : (
        <form
          className="pile"
          onSubmit={(e) => {
            e.preventDefault();
            if (pret && !attente) void valider();
          }}
        >
          <label className="champ">
            <span>Ton prénom</span>
            <input
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Damien, Laeti…"
              autoComplete="given-name"
              autoCapitalize="words"
              maxLength={30}
              autoFocus
            />
          </label>
          {mode === 'rejoindre' && (
            <label className="champ">
              <span>Code de la maison</span>
              <input
                className="champ-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="K7P2QX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={8}
              />
              <small>L’autre le trouve dans Réglages. Avec le même prénom, tu retrouves ton profil.</small>
            </label>
          )}
          {erreur && <p className="erreur">{erreur}</p>}
          <button className="bouton-principal" type="submit" disabled={!pret || attente}>
            {attente ? 'Un instant…' : mode === 'creer' ? 'C’est parti' : 'Rejoindre'}
          </button>
          <button type="button" className="lien" onClick={() => setMode('choix')}>
            Retour
          </button>
        </form>
      )}
    </main>
  );
}
