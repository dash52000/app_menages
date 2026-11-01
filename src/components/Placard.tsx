import { useMemo, useState } from 'react';
import { besoinsDe } from '../lib/fiches.ts';
import { ETATS, ICONES_PRODUITS, PRODUITS, type EtatProduit } from '../lib/produits.ts';
import type { Maison } from '../lib/useMaison.ts';
import type { Produit } from '../lib/types.ts';
import { Feuille } from './Feuille.tsx';
import { Illus } from './Illus.tsx';
import type { Message } from './Bandeau.tsx';

/** Les produits ménagers à disposition, en trois états, reliés à la liste de courses. */
export function Placard({ maison, informer }: { maison: Maison; informer: (m: Message) => void }) {
  const [ajout, setAjout] = useState(false);
  const [detail, setDetail] = useState<Produit | null>(null);
  const [envois, setEnvois] = useState<Set<string>>(new Set());
  const [verification, setVerification] = useState(false);

  if (!maison.base15) {
    return (
      <section className="ecran">
        <header className="entete">
          <h1>Placard</h1>
        </header>
        <div className="carte-reglage">
          <h2>Une mise à jour de la base à faire</h2>
          <p className="discret">
            Le placard a besoin d’une nouvelle table. Dans Supabase : SQL Editor → New query, colle le fichier
            supabase/schema.sql en version 1.5 (2e ligne : « schéma Supabase V1.5 ») et lance « Run ». Le résultat
            doit afficher « true » deux fois.
          </p>
          <button
            className="bouton-secondaire"
            disabled={verification}
            onClick={async () => {
              setVerification(true);
              await maison.charger();
              setVerification(false);
            }}
          >
            {verification ? 'Vérification…' : 'Vérifier à nouveau'}
          </button>
          {maison.detailBase && <p className="discret petit">Détail : {maison.detailBase}</p>}
        </div>
      </section>
    );
  }

  if (maison.produits.length === 0) return <ConfigPlacard maison={maison} />;

  const ordre: Record<EtatProduit, number> = { vide: 0, bas: 1, ok: 2 };
  const tri = (a: Produit, b: Produit) => ordre[a.etat] - ordre[b.etat] || a.nom.localeCompare(b.nom, 'fr');
  const aRacheter = maison.produits.filter((x) => x.etat !== 'ok').sort(tri);
  const enStock = maison.produits.filter((x) => x.etat === 'ok').sort(tri);

  const auxCourses = async (x: Produit) => {
    setEnvois((s) => new Set(s).add(x.id));
    const r = await maison.ajouterAuxCourses(x, 'placard');
    setEnvois((s) => {
      const n = new Set(s);
      n.delete(x.id);
      return n;
    });
    informer({
      texte: r === 'ajoute' ? `${x.nom} ajouté aux courses` : r === 'deja' ? `${x.nom} est déjà sur la liste` : 'Pas de réseau : réessaie plus tard.',
    });
  };

  const changer = (x: Produit) => {
    const suivant = ETATS[x.etat].suivant;
    maison.changerEtatProduit(x, suivant, 'placard');
    if (suivant !== 'ok' && !x.courses_le) {
      informer({ texte: `${x.nom} : ${ETATS[suivant].libelle.toLowerCase()}`, action: { libelle: 'Aux courses', faire: () => void auxCourses(x) } });
    }
  };

  const ligne = (x: Produit) => (
    <li key={x.id} className="ligne-placard">
      <button className="ligne-placard-corps" onClick={() => setDetail(x)}>
        <Illus nom={x.icone} taille={36} />
        <span>
          <strong>{x.nom}</strong>
          {x.etat !== 'ok' && x.courses_le && <span className="discret petit">Sur la liste de courses</span>}
        </span>
      </button>
      {x.etat !== 'ok' && !x.courses_le && (
        <button className="bouton-caddie" disabled={envois.has(x.id)} onClick={() => void auxCourses(x)} aria-label={`${x.nom} : ajouter aux courses`}>
          <Illus nom="shopping-cart" taille={24} />
        </button>
      )}
      <button className={`pastille-etat etat-${x.etat}`} onClick={() => changer(x)} aria-label={`${x.nom} : ${ETATS[x.etat].libelle}, toucher pour changer`}>
        {ETATS[x.etat].libelle}
      </button>
    </li>
  );

  return (
    <section className="ecran">
      <header className="entete">
        <h1>Placard</h1>
      </header>
      <p className="discret placard-aide">Un tap sur l’étiquette : En stock → Bientôt fini → Fini. Le caddie l’ajoute à la liste de courses.</p>

      {aRacheter.length > 0 && (
        <section className="bloc">
          <h2 className="titre-section">À racheter · {aRacheter.length}</h2>
          <ul className="liste-placard">{aRacheter.map(ligne)}</ul>
        </section>
      )}
      <section className="bloc">
        <h2 className="titre-section">En stock · {enStock.length}</h2>
        {enStock.length ? <ul className="liste-placard">{enStock.map(ligne)}</ul> : <p className="discret">Rien pour l’instant.</p>}
      </section>

      <button className="bouton-secondaire large" onClick={() => setAjout(true)}>
        + Ajouter un produit
      </button>

      {ajout && <FeuilleAjoutProduit maison={maison} onFermer={() => setAjout(false)} informer={informer} />}
      {detail && (
        <FeuilleProduit
          maison={maison}
          produit={maison.produits.find((x) => x.id === detail.id) ?? detail}
          onFermer={() => setDetail(null)}
          informer={informer}
        />
      )}
    </section>
  );
}

/** Premier passage : on coche ce qu'on a ; les indispensables non cochés passent « à racheter ». */
function ConfigPlacard({ maison }: { maison: Maison }) {
  const [enStock, setEnStock] = useState<Set<string>>(() => new Set(PRODUITS.filter((x) => x.indispensable).map((x) => x.cle)));
  const basculer = (cle: string) =>
    setEnStock((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  const tuile = (x: (typeof PRODUITS)[number]) => {
    const actif = enStock.has(x.cle);
    return (
      <button key={x.cle} className={`tuile-choix ${actif ? 'active' : ''}`} onClick={() => basculer(x.cle)} aria-pressed={actif}>
        <Illus nom={x.icone} taille={36} />
        <span>{x.nom}</span>
        <span className="coche" aria-hidden>
          {actif ? '✓' : ''}
        </span>
      </button>
    );
  };

  const manquants = PRODUITS.filter((x) => x.indispensable && !enStock.has(x.cle)).length;

  return (
    <section className="ecran">
      <header className="entete">
        <h1>Placard</h1>
      </header>
      <p className="discret">
        Les indispensables du ménage. Décoche ce que vous n’avez pas : ça ira dans « À racheter ».
      </p>
      <div className="grille-choix">{PRODUITS.filter((x) => x.indispensable).map(tuile)}</div>
      <h2 className="titre-section">Vous avez aussi ?</h2>
      <div className="grille-choix">{PRODUITS.filter((x) => !x.indispensable).map(tuile)}</div>
      <button className="bouton-principal bouton-collant" onClick={() => maison.configurerPlacard(enStock)}>
        C’est noté{manquants ? ` · ${manquants} à racheter` : ''}
      </button>
    </section>
  );
}

function FeuilleAjoutProduit({ maison, onFermer, informer }: { maison: Maison; onFermer: () => void; informer: (m: Message) => void }) {
  const [nom, setNom] = useState('');
  const [icone, setIcone] = useState('lotion-bottle');
  const presents = new Set(maison.produits.map((x) => x.cle));
  const suggestions = PRODUITS.filter((x) => !presents.has(x.cle));

  const ajouter = (n: { cle?: string; nom: string; icone: string }) => {
    maison.ajouterProduit(n, n.cle ? 'suggestion' : 'libre');
    informer({ texte: `${n.nom} ajouté au placard` });
    onFermer();
  };

  return (
    <Feuille titre="Ajouter un produit" onFermer={onFermer}>
      {suggestions.length > 0 && (
        <div className="bloc">
          <p className="etiquette-champ">Suggestions</p>
          <ul className="liste-suggestions">
            {suggestions.map((x) => (
              <li key={x.cle}>
                <button className="suggestion-produit" onClick={() => ajouter({ cle: x.cle, nom: x.nom, icone: x.icone })}>
                  <Illus nom={x.icone} taille={32} />
                  <span>
                    <strong>{x.nom}</strong>
                    <span className="discret petit">{x.usage}</span>
                  </span>
                  <span className="plus-petit" aria-hidden>
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="champ">
        <span>Autre produit</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nettoyant parquet…" maxLength={40} />
      </label>
      <div className="defilant">
        {ICONES_PRODUITS.map((i) => (
          <button key={i} className={`choix-icone ${i === icone ? 'active' : ''}`} onClick={() => setIcone(i)} aria-label={i}>
            <Illus nom={i} taille={32} />
          </button>
        ))}
      </div>
      <button className="bouton-principal" disabled={!nom.trim()} onClick={() => ajouter({ nom: nom.trim(), icone })}>
        Ajouter
      </button>
    </Feuille>
  );
}

function FeuilleProduit({
  maison,
  produit,
  onFermer,
  informer,
}: {
  maison: Maison;
  produit: Produit;
  onFermer: () => void;
  informer: (m: Message) => void;
}) {
  const [nom, setNom] = useState(produit.nom);
  const catalogue = PRODUITS.find((x) => x.cle === produit.cle);
  const utilisePour = useMemo(
    () =>
      maison.taches.filter((t) =>
        besoinsDe(t)
          .flat()
          .some((r) => r === produit.id || (produit.cle !== null && r === produit.cle)),
      ),
    [maison.taches, produit],
  );

  return (
    <Feuille titre={produit.nom} onFermer={onFermer}>
      <div className="fiche-tete">
        <Illus nom={produit.icone} taille={52} />
        <span className="discret">{catalogue?.usage ?? 'Produit ajouté par vous.'}</span>
      </div>
      <div className="bloc">
        <p className="etiquette-champ">État</p>
        <div className="puces">
          {(Object.keys(ETATS) as EtatProduit[]).map((e) => (
            <button key={e} className={`puce ${produit.etat === e ? 'active' : ''}`} onClick={() => maison.changerEtatProduit(produit, e, 'placard')}>
              {ETATS[e].libelle}
            </button>
          ))}
        </div>
      </div>
      {utilisePour.length > 0 && (
        <div className="bloc">
          <p className="etiquette-champ">Sert pour</p>
          <p>{[...new Set(utilisePour.map((t) => t.nom))].join(' · ')}</p>
        </div>
      )}
      {!produit.cle && (
        <>
          <label className="champ">
            <span>Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} />
          </label>
          <button
            className="bouton-secondaire"
            disabled={!nom.trim() || nom.trim() === produit.nom}
            onClick={() => {
              maison.modifierProduit(produit, { nom: nom.trim() });
              onFermer();
            }}
          >
            Renommer
          </button>
        </>
      )}
      <button
        className="bouton-danger"
        onClick={() => {
          const annuler = maison.supprimerProduit(produit);
          informer({ texte: `${produit.nom} retiré du placard`, action: { libelle: 'Annuler', faire: annuler } });
          onFermer();
        }}
      >
        Retirer du placard
      </button>
    </Feuille>
  );
}
