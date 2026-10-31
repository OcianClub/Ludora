import email from '../../../../packages/icons/src/svg/email.svg?raw';
import home from '../../../../packages/icons/src/svg/home.svg?raw';
import ball from '../../../../packages/icons/src/svg/bola.svg?raw';
import team from '../../../../packages/icons/src/svg/grupo.svg?raw';
import player from '../../../../packages/icons/src/svg/chuteira.svg?raw';
import shirt from '../../../../packages/icons/src/svg/mdi-tshirt-crew-outline.svg?raw';
import alert from '../../../../packages/icons/src/svg/mdi-alert-circle-outline.svg?raw';
import shield from '../../../../packages/icons/src/svg/escudo.svg?raw';
import trophy from '../../../../packages/icons/src/svg/trofeu.svg?raw';
import search from '../../../../packages/icons/src/svg/busca.svg?raw';
import location from '../../../../packages/icons/src/svg/localizacao.svg?raw';
import arrow from '../../../../packages/icons/src/svg/seta-dir.svg?raw';
import logout from '../../../../packages/icons/src/svg/mdi-logout.svg?raw';
import switchClub from '../../../../packages/icons/src/svg/mdi-swap-horizontal.svg?raw';
import user from '../../../../packages/icons/src/svg/user.svg?raw';
import calendar from '../../../../packages/icons/src/svg/calendar.svg?raw';
import live from '../../../../packages/icons/src/svg/aovivo.svg?raw';
import eye from '../../../../packages/icons/src/svg/mdi-eye-outline.svg?raw';
import eyeOff from '../../../../packages/icons/src/svg/olho.svg?raw';
import edit from '../../../../packages/icons/src/svg/lapis.svg?raw';
import whistle from '../../../../packages/icons/src/svg/apito.svg?raw';
import defense from '../../../../packages/icons/src/svg/mdi-shield-check.svg?raw';
import trash from '../../../../packages/icons/src/svg/lixeira.svg?raw';
import plus from '../../../../packages/icons/src/svg/add.svg?raw';
import minus from '../../../../packages/icons/src/svg/mdi-minus.svg?raw';
import chevronRight from '../../../../packages/icons/src/svg/chevron-dir.svg?raw';
import chevronLeft from '../../../../packages/icons/src/svg/chevron-esq.svg?raw';
import bus from '../../../../packages/icons/src/svg/mdi-bus.svg?raw';
import bell from '../../../../packages/icons/src/svg/mdi-bell.svg?raw';
import checkAll from '../../../../packages/icons/src/svg/mdi-check-all.svg?raw';
import settings from '../../../../packages/icons/src/svg/settings.svg?raw';
import clock from '../../../../packages/icons/src/svg/clock.svg?raw';
import radar from '../../../../packages/icons/src/svg/mdi-radar.svg?raw';
import broadcast from '../../../../packages/icons/src/svg/broadcast.svg?raw';
import handshake from '../../../../packages/icons/src/svg/mdi-handshake.svg?raw';

const drawings = { email, home, ball, team, player, shirt, alert, shield, trophy, search, location, arrow, logout, switchClub, user, calendar, live, eye, eyeOff, edit, whistle, defense, trash, plus, minus, chevronRight, chevronLeft, bus, bell, checkAll, settings, clock, radar, broadcast, handshake };
const icons = Object.fromEntries(Object.entries(drawings).map(([name, svg]) => [name, `data:image/svg+xml,${encodeURIComponent(svg)}`])) as Record<keyof typeof drawings, string>;
export type IconName = keyof typeof drawings | 'grid' | 'list' | 'filters' | 'table' | 'desktop' | 'phone' | 'sun' | 'moon' | 'sidebarExpand' | 'sidebarCollapse' | 'info' | 'cancel' | 'archive' | 'undo' | 'share';

// Usa os mesmos desenhos do mobile, sem depender de componentes React Native.
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name === 'share') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8" /></svg>;
  if (name === 'undo') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="m9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6v2"/></svg>;
  if (name === 'archive') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="18" height="5" rx="1.5"/><path d="M5 8v12h14V8m-10 4h6"/>
  </svg>;
  if (name === 'cancel') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" />
  </svg>;
  if (name === 'info') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" />
  </svg>;
  if (name === 'desktop' || name === 'phone' || name === 'sun' || name === 'moon' || name === 'sidebarExpand' || name === 'sidebarCollapse') {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {name === 'desktop' && <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6m-3-4v4"/></>}
      {name === 'phone' && <><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 5h4m-3 14h2"/></>}
      {name === 'sun' && <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></>}
      {name === 'moon' && <path d="M20.5 13.2A8.7 8.7 0 0 1 10.8 3.5a8.7 8.7 0 1 0 9.7 9.7Z"/>}
      {(name === 'sidebarExpand' || name === 'sidebarCollapse') && <><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18"/><path d={name === 'sidebarExpand' ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'}/></>}
    </svg>;
  }
  if (name === 'table') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>
  </svg>;
  if (name === 'filters') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="9" cy="18" r="2" />
  </svg>;
  if (name === 'grid' || name === 'list') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ flexShrink: 0 }}>
    {name === 'grid' ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> : <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></>}
  </svg>;
  return <span className="icon" aria-hidden="true" style={{ width: size, height: size, maskImage: `url("${icons[name]}")`, WebkitMaskImage: `url("${icons[name]}")` }} />;
}
