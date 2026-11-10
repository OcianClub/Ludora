import home from '@icons/home.svg';
import shield from '@icons/escudo.svg';
import user from '@icons/user.svg';
import team from '@icons/grupo.svg';
import radar from '@icons/mdi-radar.svg';
import clipboard from '@icons/mdi-clipboard-text-outline.svg';
import star from '@icons/mdi-shield-star.svg';
import info from '@icons/info.svg';
import logout from '@icons/mdi-logout.svg';
import plus from '@icons/add.svg';
import edit from '@icons/lapis.svg';
import trash from '@icons/lixeira.svg';
import check from '@icons/check.svg';
import alert from '@icons/mdi-alert-circle-outline.svg';
import wifiOff from '@icons/mdi-wifi-off.svg';
import search from '@icons/busca.svg';
import live from '@icons/aovivo.svg';
import lock from '@icons/senha.svg';
import swap from '@icons/mdi-swap-horizontal.svg';
import { Icon } from '@web/components/Icon';

const icons = { home, shield, user, team, radar, clipboard, star, info, logout, plus, edit, trash, check, alert, wifiOff, search, live, lock, swap };
export type AdminIconName = keyof typeof icons | 'headset' | 'settings' | 'trophy' | 'people' | 'sidebarExpand' | 'sidebarCollapse' | 'database' | 'terminal' | 'wrench';

// Mesmo desenho do web: o SVG de packages/icons vira máscara e herda a cor do texto.
export function AdminIcon({ name, size = 20 }: { name: AdminIconName; size?: number }) {
  if (name === 'headset' || name === 'settings' || name === 'trophy' || name === 'people' || name === 'sidebarExpand' || name === 'sidebarCollapse') {
    return <Icon name={name} size={size} />;
  }
  if (name === 'database' || name === 'terminal' || name === 'wrench') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    {name === 'database' && <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>}
    {name === 'terminal' && <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 8 4 4-4 4m7 0h3"/></>}
    {name === 'wrench' && <path d="M14.4 6.6 18 3a6 6 0 0 0-7.6 7.6l-7 7a2.1 2.1 0 0 0 3 3l7-7A6 6 0 0 0 21 6l-3.6 3.6Z"/>}
  </svg>;
  const url = `url("${icons[name]}")`;
  return <span className="icon" aria-hidden="true" style={{ width: size, height: size, maskImage: url, WebkitMaskImage: url }} />;
}
