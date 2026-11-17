import { BASE_URL } from '../services/api';
import { crestSource, markCrestFailed } from '../services/crestImages';
import { useState } from 'react';
import logo from '../../../mobile/assets/logo.svg';
import { Icon } from './Icon';

export function Brand({ subtitle = true }: { subtitle?: boolean }) {
  return <span className="brand"><img src={logo} alt="" /><span>LUDORA{subtitle && <small>GESTÃO ESPORTIVA</small>}</span></span>;
}

export function ClubBadge({ src, size = 44, name, fallbackWhileLoading = false }: { src?: string | null; size?: number; name?: string; fallbackWhileLoading?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const source = crestSource(src, BASE_URL);
  const initial = name?.trim().charAt(0).toUpperCase();
  const waiting = fallbackWhileLoading && !!source && src !== failedSrc && loadedSrc !== source;
  return <span className="club-badge" style={{ width: size, height: size, ...(waiting ? { position: 'relative' } : {}) }}>
    {waiting && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>{initial || <Icon name="shield" size={size * .55}/>}</span>}
    {source && src !== failedSrc ? <img src={source} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" style={waiting ? { visibility: 'hidden' } : undefined} onLoad={fallbackWhileLoading ? () => setLoadedSrc(source) : undefined} onError={() => { if (src) { markCrestFailed(src); setFailedSrc(src); } }} /> : initial || <Icon name="shield" size={size * .55} />}
  </span>;
}
