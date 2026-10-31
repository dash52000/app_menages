/** Illustration dessinée (Fluent Emoji, licence MIT), servie depuis public/illus. */
export function Illus({ nom, taille = 40, className = '' }: { nom: string; taille?: number; className?: string }) {
  return (
    <img
      className={`illus ${className}`}
      src={`illus/${nom}.svg`}
      width={taille}
      height={taille}
      alt=""
      draggable={false}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith('/sparkles.svg')) img.src = 'illus/sparkles.svg';
      }}
    />
  );
}
