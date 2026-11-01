import { useState } from 'react';
import { resoudreBesoin, trouverProduit, type Besoin } from '../lib/fiches.ts';
import { PRODUITS_PAR_CLE } from '../lib/produits.ts';
import type { Maison } from '../lib/useMaison.ts';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/** Nom et illustration d'un produit : celui du placard, sinon celui du catalogue. */
export function infoProduit(ref: string, maison: Maison): { nom: string; icone: string; cle: string | null } {
  const x = trouverProduit(ref, maison.produits);
  if (x) return { nom: x.nom, icone: x.icone, cle: x.cle };
  const c = PRODUITS_PAR_CLE[ref];
  return c ? { nom: c.nom, icone: c.icone, cle: c.cle } : { nom: 'Produit retiré du placard', icone: 'lotion-bottle', cle: null };
}

/** Le produit à prendre pour une tâche, en une ligne (sur les cartes du check). */
export function LigneProduit({ options, maison }: { options: string[]; maison: Maison }) {
  const b = resoudreBesoin(options, maison.produits);
  const placardVide = maison.produits.length === 0;
  const ref = b.choisi ?? b.ideal;
  const info = infoProduit(ref, maison);
  const manque = !b.choisi && !placardVide;
  return (
    <span className={`ligne-produit ${manque ? 'manque' : ''}`}>
      <Illus nom={info.icone} taille={18} />
      <span>
        {info.nom}
        {!manque && b.etatChoisi === 'bas' && <span className="discret"> · bientôt fini</span>}
        {manque && <span className="discret"> · à racheter</span>}
      </span>
      {manque && <span className="point-manque" aria-hidden />}
    </span>
  );
}

/** Un besoin dans la fiche : l'idéal, ce qu'on a à la place, ou le bouton « Aux courses ». */
export function BesoinFiche({
  options,
  maison,
  informer,
}: {
  options: string[];
  maison: Maison;
  informer: (m: Message) => void;
}) {
  const b: Besoin = resoudreBesoin(options, maison.produits);
  const ideal = infoProduit(b.ideal, maison);
  const choisi = b.choisi ? infoProduit(b.choisi, maison) : null;
  const [envoi, setEnvoi] = useState<'non' | 'encours' | 'fait'>('non');
  const xIdeal = trouverProduit(b.ideal, maison.produits);
  const dejaAuxCourses = Boolean(xIdeal?.courses_le);
  const alternatives = options.slice(1).map((o) => infoProduit(o, maison).nom);

  const auxCourses = async () => {
    setEnvoi('encours');
    const r = await maison.ajouterAuxCourses({ cle: ideal.cle, nom: ideal.nom, icone: ideal.icone }, 'fiche');
    setEnvoi(r === 'erreur' ? 'non' : 'fait');
    informer({
      texte: r === 'ajoute' ? `${ideal.nom} ajouté aux courses` : r === 'deja' ? `${ideal.nom} est déjà sur la liste` : 'Pas de réseau : réessaie plus tard.',
    });
  };

  let statut: string;
  let classe = 'ok';
  if (b.choisi === b.ideal) {
    statut = b.etatChoisi === 'bas' ? 'Dans le placard · bientôt fini' : 'Dans le placard';
    if (b.etatChoisi === 'bas') classe = 'bas';
  } else if (choisi) {
    statut = `Idéal : ${ideal.nom}. À la place, vous avez ${choisi.nom}.`;
    classe = 'remplace';
  } else if (maison.produits.length === 0) {
    statut = alternatives.length ? `Sinon : ${alternatives.join(', ')}` : 'Le produit conseillé';
    classe = 'neutre';
  } else {
    statut = b.etatIdeal === 'absent' ? 'Pas dans le placard' : 'Fini';
    classe = 'manque';
  }

  return (
    <li className={`besoin ${classe}`}>
      <Illus nom={(choisi ?? ideal).icone} taille={36} />
      <span className="besoin-texte">
        <strong>{(choisi ?? ideal).nom}</strong>
        <span className="discret petit">{statut}</span>
      </span>
      {classe === 'manque' &&
        (dejaAuxCourses || envoi === 'fait' ? (
          <span className="etiquette">Aux courses ✓</span>
        ) : (
          <button className="bouton-courses" disabled={envoi === 'encours'} onClick={auxCourses}>
            Aux courses
          </button>
        ))}
    </li>
  );
}
