export interface ActionBandeau {
  libelle: string;
  faire: () => void;
}

export interface Message {
  texte: string;
  action?: ActionBandeau;
  /** Plusieurs boutons (ex. « C'était Laeti ? » et « Annuler »). */
  actions?: ActionBandeau[];
  duree?: number;
}

/** Bandeau non bloquant en bas de l'écran, avec un ou deux boutons. */
export function Bandeau({ message, onFermer }: { message: Message; onFermer: () => void }) {
  const actions = [...(message.actions ?? []), ...(message.action ? [message.action] : [])];
  return (
    <div className={`bandeau ${actions.length > 1 ? 'deux-actions' : ''}`} role="status" aria-live="polite">
      <span>{message.texte}</span>
      {actions.length > 0 && (
        <span className="bandeau-actions">
          {actions.map((a) => (
            <button
              key={a.libelle}
              className="bandeau-action"
              onClick={() => {
                onFermer();
                a.faire();
              }}
            >
              {a.libelle}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
