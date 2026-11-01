import './LoadingSkeleton.css';

type SkeletonKind = 'rows' | 'table' | 'cards' | 'form' | 'match';

export function LoadingSkeleton({ kind = 'rows', label = 'Carregando dados', count = 4 }: {
  kind?: SkeletonKind;
  label?: string;
  count?: number;
}) {
  return (
    <div className={`loading-skeleton loading-skeleton--${kind}`} role="status" aria-label={label}>
      {Array.from({ length: Math.max(1, Math.min(count, 8)) }, (_, index) => (
        <div className="loading-skeleton-item" key={index} aria-hidden="true">
          <span className="loading-skeleton-mark" />
          <div className="loading-skeleton-copy">
            <span className="loading-skeleton-line" />
            <span className="loading-skeleton-line loading-skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}
