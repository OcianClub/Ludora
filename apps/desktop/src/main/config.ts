import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { validarApiUrl } from '../shared/rules';

// MAIN_VITE_* é injetado em tempo de build pelo electron-vite (ver .env.example).
const PADRAO_DO_BUILD = (import.meta.env.MAIN_VITE_API_URL as string | undefined) || 'http://localhost:3000';

export const API_URL_PADRAO = (() => {
  try {
    return validarApiUrl(PADRAO_DO_BUILD);
  } catch {
    return 'http://localhost:3000';
  }
})();

const arquivo = () => path.join(app.getPath('userData'), 'config.json');

export function lerApiUrl(): string {
  try {
    const bruto = JSON.parse(fs.readFileSync(arquivo(), 'utf8'));
    return validarApiUrl(bruto.apiUrl);
  } catch {
    return API_URL_PADRAO;
  }
}

export function salvarApiUrl(url: string): string {
  const valida = validarApiUrl(url);
  fs.writeFileSync(arquivo(), JSON.stringify({ apiUrl: valida }, null, 2), 'utf8');
  return valida;
}
