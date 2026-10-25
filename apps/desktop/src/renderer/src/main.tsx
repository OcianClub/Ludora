import React from 'react';
import ReactDOM from 'react-dom/client';
// Fontes empacotadas: mesmas famílias/pesos do web, mas funcionam offline.
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
// Estilos e tema do web, reaproveitados sem cópia.
import '@web/styles/global.css';
import '@web/components/UI.css';
import '@web/components/Layout.css';
import '@web/components/ThemeToggle.css';
import '@web/pages/Auth.css';
import './styles/desktop.css';
import { applyTheme, setThemePreference } from '@web/styles/theme';
import App from './App';

// Ferramenta de uso interno: começa no tema escuro. Se a pessoa já escolheu
// (Claro/Escuro/Sistema pelo seletor), a escolha dela vale.
if (!localStorage.getItem('ludora_tema')) setThemePreference('dark');
applyTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
