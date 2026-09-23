import home from '../../../../packages/icons/src/svg/home.svg';
import ball from '../../../../packages/icons/src/svg/bola.svg';
import team from '../../../../packages/icons/src/svg/grupo.svg';
import player from '../../../../packages/icons/src/svg/chuteira.svg';
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

const icons = { home, ball, team, player, shield, trophy, search, location, arrow, logout, switchClub, user, calendar, live, eye, eyeOff, edit, whistle, defense, trash, plus, minus };
export type IconName = keyof typeof icons | 'grid' | 'list';

// Usa os mesmos desenhos do mobile, sem depender de componentes React Native.
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name === 'grid' || name === 'list') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ flexShrink: 0 }}>
    {name === 'grid' ? <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> : <><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></>}
  </svg>;
  return <span className="icon" aria-hidden="true" style={{ width: size, height: size, maskImage: `url("${icons[name]}")`, WebkitMaskImage: `url("${icons[name]}")` }} />;
}
