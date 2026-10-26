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

const icons = { home, shield, user, team, radar, clipboard, star, info, logout, plus, edit, trash, check, alert, wifiOff, search, live, lock, swap };
export type AdminIconName = keyof typeof icons;

// Mesmo desenho do web: o SVG de packages/icons vira máscara e herda a cor do texto.
export function AdminIcon({ name, size = 20 }: { name: AdminIconName; size?: number }) {
  const url = `url("${icons[name]}")`;
  return <span className="icon" aria-hidden="true" style={{ width: size, height: size, maskImage: url, WebkitMaskImage: url }} />;
}
