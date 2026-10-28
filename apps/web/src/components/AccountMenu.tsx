import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { applyTheme, getThemePreference, setThemePreference, type ThemePreference } from '../styles/theme';
import { Icon } from './Icon';
import { LogoutDialog } from './LogoutButton';
import './AccountMenu.css';

const THEMES: { value: ThemePreference; label: string; icon: 'desktop' | 'sun' | 'moon' }[] = [
  { value: 'system', label: 'Tema do sistema', icon: 'desktop' },
  { value: 'light', label: 'Tema claro', icon: 'sun' },
  { value: 'dark', label: 'Tema escuro', icon: 'moon' },
];

export function AccountMenu({ header = false }: { header?: boolean }) {
  const { usuario, clube } = useAuth();
  const location = useLocation();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [theme, setTheme] = useState(getThemePreference);
  const [themeError, setThemeError] = useState('');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const sync = () => { applyTheme(); setTheme(getThemePreference()); };
    const media = matchMedia('(max-width: 760px)');
    const resize = () => { setMobile(media.matches); setOpen(false); };
    window.addEventListener('ludora:theme-change', sync);
    window.addEventListener('storage', sync);
    media.addEventListener('change', resize);
    return () => {
      window.removeEventListener('ludora:theme-change', sync);
      window.removeEventListener('storage', sync);
      media.removeEventListener('change', resize);
    };
  }, []);

  useEffect(() => { setOpen(false); }, [location.key, clube?.id]);

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const element = panel.current;
    const anchor = trigger.current;
    const viewport = window.visualViewport;
    function position() {
      const box = anchor.getBoundingClientRect();
      const top = viewport?.offsetTop || 0;
      const left = viewport?.offsetLeft || 0;
      const width = viewport?.width || innerWidth;
      const height = viewport?.height || innerHeight;
      if (!anchor.getClientRects().length || box.bottom < top || box.top > top + height) {
        setOpen(false);
        return;
      }
      const panelWidth = Math.min(280, width - 24);
      const collapsed = !header && (anchor.closest('aside')?.getBoundingClientRect().width || 0) < 100;
      const availableHeight = header ? top + height - box.bottom - 20 : collapsed ? height - 24 : box.top - top - 20;
      element.style.width = `${panelWidth}px`;
      element.style.maxHeight = `${Math.max(160, Math.min(440, availableHeight))}px`;
      const x = header ? box.right - panelWidth : collapsed ? box.right + 12 : box.left;
      const y = header ? box.bottom + 8 : collapsed ? box.bottom - element.offsetHeight : box.top - element.offsetHeight - 8;
      element.style.left = `${Math.max(left + 12, Math.min(x, left + width - panelWidth - 12))}px`;
      element.style.top = `${Math.max(top + 12, Math.min(y, top + height - element.offsetHeight - 12))}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    observer.observe(anchor);
    const sidebar = anchor.closest('aside');
    if (sidebar) observer.observe(sidebar);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    const activeTheme = element.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    activeTheme?.focus({ preventScroll: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
  }, [open, header]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function chooseTheme(value: ThemePreference) {
    try {
      setThemePreference(value);
      setThemeError('');
    } catch { setThemeError('Não foi possível salvar o tema. Tente novamente.'); }
  }

  return <>
    <button ref={trigger} type="button" className={header ? 'profile-link header-profile-link account-trigger' : 'sidebar-usuario account-trigger'}
      aria-label="Menu da conta" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}>
      {header ? <Icon name="user" size={24} /> : <>
        <span className="usuario-avatar">{usuario?.nome?.trim().charAt(0).toUpperCase() || '?'}</span>
        <span className="usuario-info"><strong>{usuario?.nome || 'Minha conta'}</strong><small>Minha conta</small></span>
        <Icon name="chevronRight" size={16} />
      </>}
    </button>
    {open && createPortal(<div id={id} ref={panel} className={`account-popover${header ? ' account-popover-header' : ''}`}
      role="dialog" aria-label="Conta e aparência" data-account-popover
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) close();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([tabindex="-1"])')];
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault(); close(true);
        } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
          event.preventDefault();
          const outside = [...document.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
            .filter(item => item.getClientRects().length && !item.closest('[inert]') && !panel.current?.contains(item));
          const next = outside[outside.indexOf(trigger.current!) + 1] || outside[0];
          close(); next?.focus({ preventScroll: true });
        }
      }}>
      <div className="account-popover-heading">
        <p title={usuario?.email}>{usuario?.email || usuario?.nome || 'Minha conta'}</p>
        <div className="account-theme-options" role="radiogroup" aria-label="Aparência">
          {THEMES.map((item, index) => <button key={item.value} type="button" role="radio" aria-label={item.label} title={item.label}
            aria-checked={theme === item.value} tabIndex={theme === item.value ? 0 : -1}
            onClick={() => chooseTheme(item.value)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3;
              chooseTheme(THEMES[next].value);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}>
            <Icon name={item.value === 'system' && mobile ? 'phone' : item.icon} size={17} />
          </button>)}
        </div>
        {themeError && <small role="alert">{themeError}</small>}
      </div>
      <nav className="account-popover-links" aria-label="Minha conta">
        <Link to="/perfil" className="account-menu-profile" aria-label="Meu perfil" onClick={() => close()}>
          <span className="usuario-avatar">{usuario?.nome?.trim().charAt(0).toUpperCase() || '?'}</span>
          <span><strong>Meu perfil</strong><small>Dados pessoais</small></span><Icon name="chevronRight" size={16} />
        </Link>
        <Link to="/perfil?secao=preferencias" onClick={() => close()}><Icon name="settings" size={18} /><span>Preferências</span></Link>
        <Link to="/perfil?secao=clubes" onClick={() => close()}><Icon name="shield" size={18} /><span>Meus clubes</span></Link>
        <Link to="/perfil?secao=conta" onClick={() => close()}><Icon name="defense" size={18} /><span>Conta e segurança</span></Link>
      </nav>
      <div className="account-popover-footer"><button type="button" onClick={() => { close(true); setLogoutOpen(true); }}><Icon name="logout" size={18} /><span>Sair da conta</span></button></div>
    </div>, document.body)}
    <LogoutDialog open={logoutOpen} onClose={() => { setLogoutOpen(false); trigger.current?.focus({ preventScroll: true }); }} />
  </>;
}
