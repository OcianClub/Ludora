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
          {(kind === 'cards' || kind === 'match') ? <>
            <span className="loading-skeleton-line loading-skeleton-line--short"/>
            <div className="loading-skeleton-teams"><span className="loading-skeleton-mark"/><span className="loading-skeleton-score loading-skeleton-line"/><span className="loading-skeleton-mark"/></div>
            <span className="loading-skeleton-line"/><span className="loading-skeleton-action loading-skeleton-line"/>
          </> : kind === 'form' ? <>
            <span className="loading-skeleton-line loading-skeleton-line--short"/>
            <span className="loading-skeleton-field loading-skeleton-line"/>
          </> : <>
          <span className="loading-skeleton-mark" />
          <div className="loading-skeleton-copy">
            <span className="loading-skeleton-line" />
            <span className="loading-skeleton-line loading-skeleton-line--short" />
          </div>
          {kind === 'table' && <><span className="loading-skeleton-cell loading-skeleton-line"/><span className="loading-skeleton-cell loading-skeleton-line"/></>}
          </>}
        </div>
      ))}
    </div>
  );
}
