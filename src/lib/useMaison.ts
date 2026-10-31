// Données de la maison : chargement, temps réel, cache hors ligne,
// file d'attente des écritures et journal d'utilisation.
//
// Toute modification est appliquée tout de suite à l'écran, puis envoyée
// à Supabase dans l'ordre. Sans réseau, elle attend dans une file gardée
// sur le téléphone et part au retour de la connexion.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { estErreurReseau, supabase } from './supabase.ts';
import { CLES, ecrire, lire } from './stockage.ts';
import { ajouterJours, aujourdhui, ecart, type Jour } from './dates.ts';
import { derniereFoisInitiale } from './fraicheur.ts';
import type { Action, Foyer, Membre, Piece, Profil, Tache } from './types.ts';

export type Statut = 'chargement' | 'ok' | 'hors-ligne' | 'introuvable';

type Table =
  | 'menage_foyers'
  | 'menage_profils'
  | 'menage_pieces'
  | 'menage_taches'
  | 'menage_historique'
  | 'menage_journal';

type Ligne = Record<string, unknown>;

interface Operation {
  table: Table;
  type: 'insert' | 'update' | 'delete';
  id?: string;
  valeurs?: Ligne | Ligne[];
}

interface Etat {
  foyer: Foyer | null;
  profils: Profil[];
  pieces: Piece[];
  taches: Tache[];
}

interface Cache extends Etat {
  foyerId: string;
}

const VIDE: Etat = { foyer: null, profils: [], pieces: [], taches: [] };

const LISTES = {
  menage_profils: 'profils',
  menage_pieces: 'pieces',
  menage_taches: 'taches',
} as const;

/** Champs d'une tâche qui bougent quand on la fait, la reporte ou la réserve. */
const CHAMPS_ETAT = ['derniere_fois', 'derniere_par', 'reporte_le', 'reporte_jusqu_au', 'reserve_par', 'reserve_le'] as const;

export interface NouvelleTache {
  nom: string;
  icone: string;
  rythme: number;
  duree: number;
}

export interface NouvellePiece {
  nom: string;
  icone: string;
  taches: NouvelleTache[];
}

function uuid(): string {
  return crypto.randomUUID();
}

function enListe<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function fusionner<T extends { id: string }>(liste: T[], lignes: T[]): T[] {
  const copie = liste.slice();
  for (const l of lignes) {
    const i = copie.findIndex((x) => x.id === l.id);
    if (i === -1) copie.push(l);
    else copie[i] = { ...copie[i], ...l };
  }
  return copie;
}

function appliquer(e: Etat, op: Operation): Etat {
  if (op.table === 'menage_foyers') {
    return op.type === 'update' && e.foyer && e.foyer.id === op.id
      ? { ...e, foyer: { ...e.foyer, ...(op.valeurs as Partial<Foyer>) } }
      : e;
  }
  const cle = LISTES[op.table as keyof typeof LISTES];
  if (!cle) return e; // historique et journal : pas gardés à l'écran
  const liste = e[cle] as Array<{ id: string }>;
  if (op.type === 'insert') {
    return { ...e, [cle]: fusionner(liste, enListe(op.valeurs) as Array<{ id: string }>) };
  }
  if (op.type === 'update') {
    return { ...e, [cle]: liste.map((x) => (x.id === op.id ? { ...x, ...(op.valeurs as Ligne) } : x)) };
  }
  const suite = { ...e, [cle]: liste.filter((x) => x.id !== op.id) };
  if (op.table === 'menage_pieces') suite.taches = suite.taches.filter((t) => t.piece_id !== op.id);
  return suite;
}

async function envoyer(op: Operation): Promise<'ok' | 'reseau' | 'refus'> {
  try {
    const q = supabase.from(op.table);
    const r =
      op.type === 'insert'
        ? await q.insert(op.valeurs as Ligne[])
        : op.type === 'update'
          ? await q.update(op.valeurs as Ligne).eq('id', op.id as string)
          : await q.delete().eq('id', op.id as string);
    if (!r.error) return 'ok';
    if (r.error.code === '23505') return 'ok'; // déjà enregistrée lors d'un envoi précédent
    if (estErreurReseau(r.error)) return 'reseau';
    console.warn('Écriture refusée par la base', op, r.error);
    return 'refus';
  } catch (e) {
    return estErreurReseau(e) ? 'reseau' : 'refus';
  }
}

/** Lit toutes les lignes d'une table du foyer, par pages de 1000. */
export async function lireTout(table: Table, foyerId: string, tri: string): Promise<Ligne[]> {
  const toutes: Ligne[] = [];
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('foyer_id', foyerId)
      .order(tri, { ascending: true })
      .range(debut, debut + 999);
    if (error) throw error;
    toutes.push(...(data as Ligne[]));
    if (!data || data.length < 1000) return toutes;
  }
}

export function useMaison(membre: Membre, onRefus?: () => void) {
  const foyerId = membre.foyer_id;
  const moi = membre.profil_id;

  const [etat, setEtat] = useState<Etat>(() => {
    const c = lire<Cache | null>(CLES.cache, null);
    return c && c.foyerId === foyerId ? { foyer: c.foyer, profils: c.profils, pieces: c.pieces, taches: c.taches } : VIDE;
  });
  const [statut, setStatut] = useState<Statut>('chargement');
  const [enAttente, setEnAttente] = useState(() => lire<Operation[]>(CLES.fileAttente, []).length);

  const etatRef = useRef(etat);
  etatRef.current = etat;
  const statutRef = useRef(statut);
  statutRef.current = statut;
  const file = useRef<Operation[]>(lire<Operation[]>(CLES.fileAttente, []));
  const envoiEnCours = useRef<Promise<boolean> | null>(null);
  const onRefusRef = useRef(onRefus);
  onRefusRef.current = onRefus;

  // Cache : l'appli s'ouvre sur le dernier état connu, même sans réseau.
  useEffect(() => {
    if (etat.foyer) ecrire(CLES.cache, { ...etat, foyerId } satisfies Cache);
  }, [etat, foyerId]);

  const sauverFile = () => {
    ecrire(CLES.fileAttente, file.current.length ? file.current : null);
    setEnAttente(file.current.length);
  };

  /**
   * Envoie la file dans l'ordre ; s'arrête au premier souci de réseau.
   * Un seul envoi à la fois : un second appel attend le même envoi.
   */
  const vider = useCallback((): Promise<boolean> => {
    if (envoiEnCours.current) return envoiEnCours.current;
    // Démarre au prochain tour : la référence est posée avant que l'envoi ne se termine.
    const envoi = Promise.resolve().then(async () => {
      try {
        while (file.current.length) {
          const r = await envoyer(file.current[0]);
          if (r === 'reseau') {
            setStatut('hors-ligne');
            return false;
          }
          if (r === 'refus') onRefusRef.current?.();
          file.current.shift();
          sauverFile();
        }
        return true;
      } finally {
        envoiEnCours.current = null;
      }
    });
    envoiEnCours.current = envoi;
    return envoi;
  }, []);

  const executer = useCallback(
    (op: Operation) => {
      setEtat((e) => appliquer(e, op));
      file.current.push(op);
      sauverFile();
      void vider();
    },
    [vider],
  );

  const charger = useCallback(async () => {
    if (!(await vider())) return; // pas de réseau : on garde l'écran tel quel
    const [f, p, pi, t] = await Promise.all([
      supabase.from('menage_foyers').select('*').eq('id', foyerId).maybeSingle(),
      supabase.from('menage_profils').select('*').eq('foyer_id', foyerId).order('cree_le', { ascending: true }),
      supabase.from('menage_pieces').select('*').eq('foyer_id', foyerId).order('ordre', { ascending: true }),
      supabase.from('menage_taches').select('*').eq('foyer_id', foyerId),
    ]);
    if (f.error || p.error || pi.error || t.error) {
      setStatut('hors-ligne');
      return;
    }
    if (!f.data) {
      setStatut('introuvable');
      return;
    }
    // Les modifications faites pendant le chargement (pas encore envoyées) restent visibles.
    let e: Etat = {
      foyer: f.data as Foyer,
      profils: p.data as Profil[],
      pieces: pi.data as Piece[],
      taches: t.data as Tache[],
    };
    for (const op of file.current) e = appliquer(e, op);
    setEtat(e);
    setStatut('ok');
  }, [foyerId, vider]);

  // Chargement, temps réel, rechargement au retour sur l'appli ou du réseau.
  useEffect(() => {
    void charger();

    const distant = (table: keyof typeof LISTES | 'menage_foyers') => (ev: { eventType: string; new: Ligne; old: Ligne }) => {
      if (ev.eventType === 'DELETE') {
        const id = ev.old?.id as string | undefined;
        if (id) setEtat((e) => appliquer(e, { table, type: 'delete', id }));
      } else if (table === 'menage_foyers') {
        setEtat((e) => appliquer(e, { table, type: 'update', id: ev.new.id as string, valeurs: ev.new }));
      } else {
        setEtat((e) => appliquer(e, { table, type: 'insert', valeurs: ev.new }));
      }
    };

    let canal = supabase.channel(`maison-${foyerId}`);
    for (const table of ['menage_profils', 'menage_pieces', 'menage_taches'] as const) {
      const filtre = `foyer_id=eq.${foyerId}`;
      canal = canal
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: filtre }, distant(table))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: filtre }, distant(table))
        // Les suppressions ne se filtrent pas côté Supabase : on ignore celles des autres foyers (id inconnus).
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, distant(table));
    }
    canal = canal.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'menage_foyers', filter: `id=eq.${foyerId}` },
      distant('menage_foyers'),
    );
    canal.subscribe((s: string) => {
      if (s === 'SUBSCRIBED') void charger();
    });

    const auRetour = () => {
      if (document.visibilityState === 'visible') void charger();
    };
    const relance = () => void charger();
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', relance);
    // Tant que tout n'est pas envoyé ou chargé, on réessaie régulièrement.
    const minuteur = window.setInterval(() => {
      if (file.current.length || statutRef.current !== 'ok') void charger();
    }, 30_000);

    return () => {
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', relance);
      window.clearInterval(minuteur);
      void supabase.removeChannel(canal);
    };
  }, [foyerId, charger]);

  // ---------- Journal d'utilisation ----------------------------------------

  const noter = useCallback(
    (evenement: string, details: Ligne = {}, tacheId: string | null = null) => {
      executer({
        table: 'menage_journal',
        type: 'insert',
        valeurs: {
          foyer_id: foyerId,
          profil_id: moi,
          evenement,
          tache_id: tacheId,
          details,
          cree_le: new Date().toISOString(), // heure réelle, même si l'envoi attend le réseau
        },
      });
    },
    [executer, foyerId, moi],
  );

  // ---------- Actions sur les tâches ------------------------------------------

  const tacheActuelle = (id: string) => etatRef.current.taches.find((x) => x.id === id);

  const majTache = useCallback(
    (id: string, champs: Partial<Tache>) => executer({ table: 'menage_taches', type: 'update', id, valeurs: champs }),
    [executer],
  );

  /**
   * Fait, fait par l'autre, demain ou « je prends ».
   * Renvoie une fonction d'annulation (bouton « Annuler » pendant quelques secondes).
   */
  const agir = useCallback(
    (
      tacheId: string,
      action: Action,
      o: { depuis: 'check' | 'piece'; jour?: Jour; profilId?: string; silencieux?: boolean },
    ): ((silencieux?: boolean) => void) => {
      const t = tacheActuelle(tacheId);
      if (!t) return () => {};
      const jour = aujourdhui();
      const avant = Object.fromEntries(CHAMPS_ETAT.map((c) => [c, t[c]])) as Partial<Tache>;
      let historiqueId: string | null = null;

      if (action === 'fait' || action === 'fait_autre') {
        const quand = o.jour ?? jour;
        const par = action === 'fait' ? moi : (o.profilId ?? moi);
        const plusRecent = !t.derniere_fois || quand >= t.derniere_fois;
        majTache(t.id, {
          derniere_fois: plusRecent ? quand : t.derniere_fois,
          derniere_par: plusRecent ? par : t.derniere_par,
          reporte_le: null,
          reporte_jusqu_au: null,
          reserve_par: null,
          reserve_le: null,
        });
        historiqueId = uuid();
        executer({
          table: 'menage_historique',
          type: 'insert',
          valeurs: {
            id: historiqueId,
            foyer_id: foyerId,
            tache_id: t.id,
            tache_nom: t.nom,
            piece_nom: etatRef.current.pieces.find((p) => p.id === t.piece_id)?.nom ?? null,
            profil_id: par,
            fait_le: quand,
            cree_le: new Date().toISOString(),
          },
        });
      } else if (action === 'demain') {
        majTache(t.id, { reporte_le: jour, reporte_jusqu_au: ajouterJours(jour, 1), reserve_par: null, reserve_le: null });
      } else {
        majTache(t.id, { reserve_par: moi, reserve_le: jour });
      }

      if (!o.silencieux) {
        noter(
          'bouton_tache',
          { action, depuis: o.depuis, tache: t.nom, decalage_jours: o.jour ? ecart(o.jour, jour) : 0, rythme: t.rythme_jours },
          t.id,
        );
      }

      return (silencieux = false) => {
        majTache(t.id, avant);
        if (historiqueId) executer({ table: 'menage_historique', type: 'delete', id: historiqueId });
        if (!silencieux) noter('annulation', { action, depuis: o.depuis, tache: t.nom }, t.id);
      };
    },
    [executer, foyerId, majTache, moi, noter],
  );

  /** Fin d'un check : mémorise le jour (rattrapage et futur rappel) et le journalise. */
  const terminerCheck = useCallback(
    (details: Ligne) => {
      const jour = aujourdhui();
      if (etatRef.current.foyer?.dernier_check !== jour) {
        executer({ table: 'menage_foyers', type: 'update', id: foyerId, valeurs: { dernier_check: jour } });
      }
      if (details) noter(details.vide ? 'check_vide' : 'check_termine', details);
    },
    [executer, foyerId, noter],
  );

  // ---------- Pièces et tâches ---------------------------------------------------

  const creerPieces = useCallback(
    (nouvelles: NouvellePiece[]) => {
      const jour = aujourdhui();
      const e = etatRef.current;
      let index = e.taches.length;
      const ordre0 = e.pieces.reduce((m, p) => Math.max(m, p.ordre + 1), 0);
      const pieces = nouvelles.map((p, i) => ({ id: uuid(), foyer_id: foyerId, nom: p.nom, icone: p.icone, ordre: ordre0 + i }));
      const taches = nouvelles.flatMap((p, i) =>
        p.taches.map((t) => ({
          id: uuid(),
          foyer_id: foyerId,
          piece_id: pieces[i].id,
          nom: t.nom,
          icone: t.icone,
          rythme_jours: t.rythme,
          duree_min: t.duree,
          derniere_fois: derniereFoisInitiale(index++, t.rythme, jour),
          derniere_par: null,
          reporte_le: null,
          reporte_jusqu_au: null,
          reserve_par: null,
          reserve_le: null,
        })),
      );
      if (pieces.length) executer({ table: 'menage_pieces', type: 'insert', valeurs: pieces });
      if (taches.length) executer({ table: 'menage_taches', type: 'insert', valeurs: taches });
      return pieces.map((p) => p.id);
    },
    [executer, foyerId],
  );

  const modifierPiece = useCallback(
    (p: Piece, champs: Partial<Pick<Piece, 'nom' | 'icone'>>) => {
      executer({ table: 'menage_pieces', type: 'update', id: p.id, valeurs: champs });
      noter('piece_modifiee', { avant: { nom: p.nom, icone: p.icone }, apres: champs });
    },
    [executer, noter],
  );

  const supprimerPiece = useCallback(
    (p: Piece) => {
      const taches = etatRef.current.taches.filter((t) => t.piece_id === p.id);
      executer({ table: 'menage_pieces', type: 'delete', id: p.id });
      noter('piece_supprimee', { piece: p.nom, nb_taches: taches.length });
      return () => {
        executer({ table: 'menage_pieces', type: 'insert', valeurs: { ...p } });
        if (taches.length) executer({ table: 'menage_taches', type: 'insert', valeurs: taches.map((t) => ({ ...t })) });
        noter('annulation', { action: 'piece_supprimee', piece: p.nom });
      };
    },
    [executer, noter],
  );

  const ajouterTache = useCallback(
    (pieceId: string, n: NouvelleTache, depuis: 'catalogue' | 'libre') => {
      const id = uuid();
      executer({
        table: 'menage_taches',
        type: 'insert',
        valeurs: {
          id,
          foyer_id: foyerId,
          piece_id: pieceId,
          nom: n.nom,
          icone: n.icone,
          rythme_jours: n.rythme,
          duree_min: n.duree,
          derniere_fois: derniereFoisInitiale(etatRef.current.taches.length, n.rythme, aujourdhui()),
          derniere_par: null,
          reporte_le: null,
          reporte_jusqu_au: null,
          reserve_par: null,
          reserve_le: null,
        },
      });
      noter('tache_creee', { tache: n.nom, rythme: n.rythme, duree: n.duree, depuis }, id);
      return id;
    },
    [executer, foyerId, noter],
  );

  const modifierTache = useCallback(
    (t: Tache, champs: Partial<Pick<Tache, 'nom' | 'icone' | 'rythme_jours' | 'duree_min'>>) => {
      const changes = Object.fromEntries(
        Object.entries(champs).filter(([k, v]) => t[k as keyof Tache] !== v),
      ) as Partial<Tache>;
      if (!Object.keys(changes).length) return;
      executer({ table: 'menage_taches', type: 'update', id: t.id, valeurs: changes });
      const avantChamps = Object.fromEntries(Object.keys(changes).map((k) => [k, t[k as keyof Tache]]));
      noter('tache_modifiee', { tache: t.nom, avant: avantChamps, apres: changes }, t.id);
    },
    [executer, noter],
  );

  const supprimerTache = useCallback(
    (t: Tache) => {
      const copie = { ...t };
      executer({ table: 'menage_taches', type: 'delete', id: t.id });
      noter('tache_supprimee', { tache: t.nom, rythme: t.rythme_jours, duree: t.duree_min }, t.id);
      return () => {
        executer({ table: 'menage_taches', type: 'insert', valeurs: copie });
        noter('annulation', { action: 'tache_supprimee', tache: t.nom }, t.id);
      };
    },
    [executer, noter],
  );

  const autres = useMemo(() => etat.profils.filter((p) => p.id !== moi), [etat.profils, moi]);

  return {
    ...etat,
    statut,
    enAttente,
    moi,
    autres,
    charger,
    noter,
    agir,
    terminerCheck,
    creerPieces,
    modifierPiece,
    supprimerPiece,
    ajouterTache,
    modifierTache,
    supprimerTache,
  };
}

export type Maison = ReturnType<typeof useMaison>;
