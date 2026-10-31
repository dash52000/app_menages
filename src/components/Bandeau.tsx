export interface Message {
  texte: string;
  action?: { libelle: string; faire: () => void };
  duree?: number;
}

/** Bandeau non bloquant en bas de l'écran, avec un bouton (souvent « Annuler »). */
export function Bandeau({ message, onFermer }: { message: Message; onFermer: () => void }) {
  return (
    <div className="bandeau" role="status" aria-live="polite">
      <span>{message.texte}</span>
      {message.action && (
        <button
          className="bandeau-action"
          onClick={() => {
            message.action!.faire();
            onFermer();
          }}
        >
          {message.action.libelle}
        </button>
      )}
    </div>
  );
}
