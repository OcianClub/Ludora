import { useEffect, useState } from 'react';
import { applyTheme, getThemePreference, setThemePreference } from '../styles/theme';
import './ThemeToggle.css';

function temaEscuro() {
  const preference = getThemePreference();
  return preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(temaEscuro);
  const [error, setError] = useState('');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      applyTheme();
      setDark(temaEscuro());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('ludora:theme-change', sync);
    media.addEventListener('change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('ludora:theme-change', sync);
      media.removeEventListener('change', sync);
    };
  }, []);

  function toggle() {
    try {
      setThemePreference(dark ? 'light' : 'dark');
      setError('');
    } catch {
      setError('Não foi possível salvar a aparência.');
    }
  }

  return (
    <div className="appearance-control">
      <button
        className="theme-switch"
        type="button"
        role="switch"
        aria-label="Tema escuro"
        aria-checked={dark}
        title={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
        onClick={toggle}
      >
        <span className="theme-switch-thumb" aria-hidden="true" />
        <svg className="theme-switch-sun" width="19" height="19" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg className="theme-switch-moon" width="19" height="19" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 13.2A8.7 8.7 0 0 1 10.8 3.5a8.7 8.7 0 1 0 9.7 9.7Z" />
        </svg>
      </button>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
