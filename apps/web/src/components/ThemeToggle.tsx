import { useEffect, useState } from 'react';
import { getThemePreference, setThemePreference } from '../styles/theme';
import './ThemeToggle.css';

export function ThemeToggle() {
  const [theme, setTheme] = useState(getThemePreference);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setTheme(getThemePreference());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <div className="appearance-control">
    <span className="field-label">Aparência</span>
    <div className="appearance-options" role="group" aria-label="Tema do Ludora">
      {(['light', 'dark'] as const).map(value => <button type="button" key={value} aria-pressed={(theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme) === value} onClick={() => {
        try { setThemePreference(value); setTheme(value); setError(''); }
        catch { setError('Não foi possível salvar a aparência.'); }
      }}>{value === 'light' ? 'Claro' : 'Escuro'}</button>)}
    </div>
    {error && <small role="alert">{error}</small>}
  </div>;
}
