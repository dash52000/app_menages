import { useEffect, type ReactNode } from 'react';

/** Panneau qui monte du bas de l'écran ; se ferme d'un tap à côté ou avec Échap. */
export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', touche);
    document.body.classList.add('fige');
    return () => {
      document.removeEventListener('keydown', touche);
      document.body.classList.remove('fige');
    };
  }, [onFermer]);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <div className="feuille-poignee" aria-hidden />
        <div className="feuille-tete">
          <h2>{titre}</h2>
          <button className="bouton-rond discret" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="feuille-corps">{children}</div>
      </div>
    </div>
  );
}
