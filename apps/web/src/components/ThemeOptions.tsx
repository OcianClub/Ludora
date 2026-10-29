import { useEffect, useState } from 'react';
import { applyTheme, getThemePreference, setThemePreference, type ThemePreference } from '../styles/theme';
import { Icon } from './Icon';
import './AccountMenu.css';

const THEMES: { value: ThemePreference; label: string; icon: 'desktop' | 'sun' | 'moon' }[] = [
  { value: 'system', label: 'Tema do sistema', icon: 'desktop' },
  { value: 'light', label: 'Tema claro', icon: 'sun' },
  { value: 'dark', label: 'Tema escuro', icon: 'moon' },
];

export function ThemeOptions() {
  const [theme, setTheme] = useState(getThemePreference);
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const sync = () => { applyTheme(); setTheme(getThemePreference()); };
    const media = matchMedia('(max-width: 760px)');
    const resize = () => setMobile(media.matches);
    window.addEventListener('ludora:theme-change', sync);
    window.addEventListener('storage', sync);
    media.addEventListener('change', resize);
    return () => { window.removeEventListener('ludora:theme-change', sync); window.removeEventListener('storage', sync); media.removeEventListener('change', resize); };
  }, []);
  function choose(value: ThemePreference) {
    try { setThemePreference(value); setError(''); }
    catch { setError('Não foi possível salvar o tema. Tente novamente.'); }
  }
  return <div className="theme-options-control">
    <div className="account-theme-options" role="radiogroup" aria-label="Aparência">
      {THEMES.map((item, index) => <button key={item.value} type="button" role="radio" aria-label={item.label} title={item.label}
        aria-checked={theme === item.value} tabIndex={theme === item.value ? 0 : -1}
        onClick={() => choose(item.value)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3;
          choose(THEMES[next].value);
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        }}><Icon name={item.value === 'system' && mobile ? 'phone' : item.icon} size={17}/></button>)}
    </div>
    {error && <small role="alert">{error}</small>}
  </div>;
}
