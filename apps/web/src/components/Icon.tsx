import home from '../../../../packages/icons/src/svg/home.svg';
import ball from '../../../../packages/icons/src/svg/bola.svg';
import team from '../../../../packages/icons/src/svg/grupo.svg';
import player from '../../../../packages/icons/src/svg/chuteira.svg';
import shirt from '../../../../packages/icons/src/svg/mdi-tshirt-crew-outline.svg';
import alert from '../../../../packages/icons/src/svg/mdi-alert-circle-outline.svg';
import shield from '../../../../packages/icons/src/svg/escudo.svg';
import trophy from '../../../../packages/icons/src/svg/trofeu.svg';
import search from '../../../../packages/icons/src/svg/busca.svg';
import location from '../../../../packages/icons/src/svg/localizacao.svg';
import arrow from '../../../../packages/icons/src/svg/seta-dir.svg';
import logout from '../../../../packages/icons/src/svg/mdi-logout.svg';
import switchClub from '../../../../packages/icons/src/svg/mdi-swap-horizontal.svg';
import user from '../../../../packages/icons/src/svg/user.svg';
import calendar from '../../../../packages/icons/src/svg/calendar.svg';
import live from '../../../../packages/icons/src/svg/aovivo.svg';
import eye from '../../../../packages/icons/src/svg/mdi-eye-outline.svg';
import eyeOff from '../../../../packages/icons/src/svg/olho.svg';
import edit from '../../../../packages/icons/src/svg/lapis.svg';
import whistle from '../../../../packages/icons/src/svg/apito.svg';
import defense from '../../../../packages/icons/src/svg/mdi-shield-check.svg';
import trash from '../../../../packages/icons/src/svg/lixeira.svg';
import plus from '../../../../packages/icons/src/svg/add.svg';
import minus from '../../../../packages/icons/src/svg/mdi-minus.svg';
import chevronRight from '../../../../packages/icons/src/svg/chevron-dir.svg';
import chevronLeft from '../../../../packages/icons/src/svg/chevron-esq.svg';
import bus from '../../../../packages/icons/src/svg/mdi-bus.svg';
import bell from '../../../../packages/icons/src/svg/mdi-bell.svg';
import checkAll from '../../../../packages/icons/src/svg/mdi-check-all.svg';
import settings from '../../../../packages/icons/src/svg/settings.svg';
import clock from '../../../../packages/icons/src/svg/clock.svg';
import radar from '../../../../packages/icons/src/svg/mdi-radar.svg';
import handshake from '../../../../packages/icons/src/svg/mdi-handshake.svg';

const icons = { home, ball, team, player, shirt, alert, shield, trophy, search, location, arrow, logout, switchClub, user, calendar, live, eye, eyeOff, edit, whistle, defense, trash, plus, minus, chevronRight, chevronLeft, bus, bell, checkAll, settings, clock, radar, handshake };
export type IconName = keyof typeof icons | 'grid' | 'list' | 'filters' | 'table' | 'desktop' | 'phone' | 'sun' | 'moon' | 'sidebarExpand' | 'sidebarCollapse' | 'info';

// Usa os mesmos desenhos do mobile, sem depender de componentes React Native.
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
