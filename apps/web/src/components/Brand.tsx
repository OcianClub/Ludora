import { useState } from 'react';
import logo from '../../../mobile/assets/logo.svg';
import { Icon } from './Icon';

export function Brand() {
  return <span className="brand"><img src={logo} alt="" /><span>LUDORA<small>GESTÃO ESPORTIVA</small></span></span>;
}

export function ClubBadge({ src, size = 44 }: { src?: string | null; size?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <span className="club-badge" style={{ width: size, height: size }}>
    {src && src !== failedSrc ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : <Icon name="shield" size={size * .55} />}
  </span>;
}
