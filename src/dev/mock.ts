// Faux client Supabase en mémoire, pour développer et tester l'interface sans réseau.
// Activé seulement avec VITE_MOCK=1 (jamais dans le build de production).
// Il simule un second téléphone : window.mockAutre(tacheNom) marque une tâche
// faite par l'autre profil, comme le ferait le temps réel.

type Ligne = Record<string, any>;

const tables: Record<string, Ligne[]> = {
  menage_foyers: [],
  menage_profils: [],
  menage_membres: [],
  menage_pieces: [],
  menage_taches: [],
  menage_historique: [],
  menage_journal: [],
  menage_produits: [],
  // Tables de Panier (liste de courses), pour tester « Aux courses ».
  produits: [],
  articles_liste: [],
};

let session: { user: { id: string } } | null = null;
const ecouteurs: Array<{ table: string; event: string; cb: (ev: any) => void }> = [];

function emettre(table: string, eventType: string, nouveau: Ligne | null, ancien: Ligne | null) {
  for (const e of ecouteurs) {
    if (e.table === table && (e.event === '*' || e.event === eventType)) {
      setTimeout(() => e.cb({ eventType, new: nouveau, old: ancien }), 0);
    }
  }
}

class Requete {
  private filtres: Array<[string, unknown]> = [];
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private valeurs: any;
  private unique: 'single' | 'maybe' | null = null;
  private tri: { col: string; asc: boolean } | null = null;
  private plage: [number, number] | null = null;
  private max: number | null = null;

  constructor(private table: string) {}

  private colonnes = '*';

  select(colonnes = '*') {
    this.colonnes = colonnes;
    return this;
  }
  insert(v: any) {
    this.action = 'insert';
    this.valeurs = v;
    return this;
  }
  update(v: any) {
    this.action = 'update';
    this.valeurs = v;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filtres.push([col, val]);
    return this;
  }
  order(col: string, o: { ascending: boolean }) {
    this.tri = { col, asc: o.ascending };
    return this;
  }
  range(a: number, b: number) {
    this.plage = [a, b];
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  maybeSingle() {
    this.unique = 'maybe';
    return this;
  }
  single() {
    this.unique = 'single';
    return this;
  }

  private correspond(l: Ligne) {
    return this.filtres.every(([c, v]) => l[c] === v);
  }

  private executer(): { data: any; error: any } {
    const w = window as any;
    // window.mockBaseV1 = true : base pas encore mise à jour (V1).
    if (w.mockBaseV1 && this.table === 'menage_produits') {
      return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.menage_produits' in the schema cache" } };
    }
    if (w.mockBaseV1 && this.table === 'menage_taches' && (this.action === 'insert' || this.action === 'update')) {
      const lignes = Array.isArray(this.valeurs) ? this.valeurs : [this.valeurs];
      if (lignes.some((l: Ligne) => 'fiche' in l || 'note' in l || 'produits' in l)) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'fiche' column of 'menage_taches'" } };
      }
    }
    if ((w.mockBaseV1 || w.mockBaseV15) && this.table === 'menage_pieces' && (this.action === 'insert' || this.action === 'update')) {
      const lignes = Array.isArray(this.valeurs) ? this.valeurs : [this.valeurs];
      if (lignes.some((l: Ligne) => 'en_pause_depuis' in l)) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'en_pause_depuis' column of 'menage_pieces'" } };
      }
    }
    if ((w.mockBaseV1 || w.mockBaseV15) && this.table === 'menage_pieces' && this.action === 'select' && this.colonnes.includes('en_pause_depuis')) {
      return { data: null, error: { code: '42703', message: 'column menage_pieces.en_pause_depuis does not exist' } };
    }
    const t = tables[this.table];
    if (this.action === 'insert') {
      const lignes = (Array.isArray(this.valeurs) ? this.valeurs : [this.valeurs]).map((v: Ligne) => ({
        id: crypto.randomUUID(),
        cree_le: new Date().toISOString(),
        ...structuredClone(v),
      }));
      const doublon = (l: Ligne) =>
        t.some((x) => x.id === l.id || (this.table === 'produits' && x.nom_normalise === l.nom_normalise));
      if (lignes.some(doublon)) return { data: null, error: { code: '23505', message: 'doublon' } };
      if (this.table === 'produits') lignes.forEach((l: Ligne) => Object.assign(l, { masque: false, ...l }));
      if (this.table === 'articles_liste') lignes.forEach((l: Ligne) => Object.assign(l, { coche: false, ...l }));
      if (this.table === 'menage_pieces' && !w.mockBaseV1 && !w.mockBaseV15) {
        lignes.forEach((l: Ligne) => Object.assign(l, { en_pause_depuis: null, ...l }));
      }
      t.push(...lignes);
      lignes.forEach((l: Ligne) => emettre(this.table, 'INSERT', { ...l }, null));
      return { data: this.unique ? lignes[0] : lignes, error: null };
    }
    if (this.action === 'update') {
      for (const l of t.filter((x) => this.correspond(x))) {
        Object.assign(l, structuredClone(this.valeurs));
        emettre(this.table, 'UPDATE', { ...l }, null);
      }
      return { data: null, error: null };
    }
    if (this.action === 'delete') {
      const parties = t.filter((x) => this.correspond(x));
      tables[this.table] = t.filter((x) => !this.correspond(x));
      for (const l of parties) {
        emettre(this.table, 'DELETE', null, { id: l.id });
        if (this.table === 'menage_pieces') {
          for (const tache of tables.menage_taches.filter((x) => x.piece_id === l.id)) emettre('menage_taches', 'DELETE', null, { id: tache.id });
          tables.menage_taches = tables.menage_taches.filter((x) => x.piece_id !== l.id);
        }
      }
      return { data: null, error: null };
    }
    let r = t.filter((x) => this.correspond(x)).map((x) => structuredClone(x));
    if (this.tri) {
      const { col, asc } = this.tri;
      r.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
    }
    if (this.plage) r = r.slice(this.plage[0], this.plage[1] + 1);
    if (this.max !== null) r = r.slice(0, this.max);
    if (this.unique) {
      if (r[0]) return { data: r[0], error: null };
      return this.unique === 'maybe' ? { data: null, error: null } : { data: null, error: { code: 'PGRST116' } };
    }
    return { data: r, error: null };
  }

  then(ok: (v: any) => any, ko?: (e: any) => any) {
    return new Promise((res) => setTimeout(res, 40))
      .then(() =>
        (window as any).mockHorsLigne ? { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } } : this.executer(),
      )
      .then(ok, ko);
  }
}

const COULEURS = ['#3B82F6', '#EC4899', '#F59E0B'];

function rattacher(foyerId: string, prenom: string) {
  let profil = tables.menage_profils.find((p) => p.foyer_id === foyerId && p.prenom.toLowerCase() === prenom.trim().toLowerCase());
  if (!profil) {
    const n = tables.menage_profils.filter((p) => p.foyer_id === foyerId).length;
    profil = { id: crypto.randomUUID(), foyer_id: foyerId, prenom: prenom.trim(), couleur: COULEURS[n % 3], cree_le: new Date().toISOString() };
    tables.menage_profils.push(profil);
    emettre('menage_profils', 'INSERT', { ...profil }, null);
  }
  tables.menage_membres = tables.menage_membres.filter((m) => m.user_id !== session!.user.id);
  tables.menage_membres.push({ user_id: session!.user.id, foyer_id: foyerId, profil_id: profil.id });
  return profil;
}

export function creerClientFactice(): any {
  const w = window as any;
  // Second téléphone simulé : ajoute un profil « Laeti » et peut faire des tâches.
  w.mockAutre = (nomTache?: string) => {
    const foyer = tables.menage_foyers[0];
    if (!foyer) return;
    let laeti = tables.menage_profils.find((p) => p.prenom === 'Laeti');
    if (!laeti) {
      laeti = { id: crypto.randomUUID(), foyer_id: foyer.id, prenom: 'Laeti', couleur: '#EC4899', cree_le: new Date().toISOString() };
      tables.menage_profils.push(laeti);
      emettre('menage_profils', 'INSERT', { ...laeti }, null);
    }
    if (!nomTache) return;
    const t = tables.menage_taches.find((x) => x.nom === nomTache);
    if (!t) return;
    const d = new Date();
    t.derniere_fois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    t.derniere_par = laeti.id;
    emettre('menage_taches', 'UPDATE', { ...t }, null);
  };
  w.mockTables = tables;

  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInAnonymously: async () => {
        session = { user: { id: crypto.randomUUID() } };
        return { data: { session, user: session.user }, error: null };
      },
      signOut: async () => {
        session = null;
        return { error: null };
      },
    },
    from: (t: string) => new Requete(t),
    rpc: async (nom: string, args: any) => {
      if (!session) return { data: null, error: { message: 'non_connecte' } };
      if (nom === 'menage_creer_foyer') {
        const foyer = { id: crypto.randomUUID(), code: 'K7P2QX', dernier_check: null, cree_le: new Date().toISOString() };
        tables.menage_foyers.push(foyer);
        const p = rattacher(foyer.id, args.p_prenom);
        return { data: { foyer_id: foyer.id, profil_id: p.id, code: foyer.code }, error: null };
      }
      if (nom === 'menage_rejoindre_foyer') {
        const code = String(args.p_code).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const foyer = tables.menage_foyers.find((f) => f.code === code);
        if (!foyer) return { data: null, error: { message: 'code_inconnu' } };
        const p = rattacher(foyer.id, args.p_prenom);
        return { data: { foyer_id: foyer.id, profil_id: p.id, code: foyer.code }, error: null };
      }
      return { data: null, error: { message: 'rpc inconnue' } };
    },
    channel: () => {
      const canal = {
        on: (_type: string, filtre: { table: string; event: string }, cb: (ev: any) => void) => {
          ecouteurs.push({ table: filtre.table, event: filtre.event, cb });
          return canal;
        },
        subscribe: (cb?: (etat: string) => void) => {
          setTimeout(() => cb?.('SUBSCRIBED'), 0);
          return canal;
        },
      };
      return canal;
    },
    removeChannel: async () => {
      ecouteurs.length = 0;
    },
  };
}
