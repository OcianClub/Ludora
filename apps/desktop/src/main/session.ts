import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { SuperAdminUsuario } from '@ludora/shared-types';

// O token (JWT) só existe no processo principal. O renderer nunca o recebe:
// ele só sabe se há sessão e quem é o usuário.
export interface Sessao {
  token: string;
  usuario: SuperAdminUsuario;
}

let emMemoria: Sessao | null = null;
const arquivo = () => path.join(app.getPath('userData'), 'sessao.bin');

export const armazenamentoSeguro = () => safeStorage.isEncryptionAvailable();

export function sessaoAtual(): Sessao | null {
  return emMemoria;
}

/** Retorna true se a sessão foi gravada em disco (cifrada pelo sistema operacional). */
export function salvarSessao(sessao: Sessao): boolean {
  emMemoria = sessao;
  if (!armazenamentoSeguro()) return false; // sem cofre do SO: nunca grava em texto puro
  try {
    fs.writeFileSync(arquivo(), safeStorage.encryptString(JSON.stringify(sessao)));
    return true;
  } catch {
    return false;
  }
}

export function carregarDoDisco(): Sessao | null {
  if (!armazenamentoSeguro()) return null;
  try {
    const dados = JSON.parse(safeStorage.decryptString(fs.readFileSync(arquivo())));
    if (typeof dados?.token === 'string' && dados?.usuario?.id) {
      emMemoria = dados as Sessao;
      return emMemoria;
    }
  } catch {
    /* arquivo ausente ou ilegível: sessão inexistente */
  }
  return null;
}

export function limparSessao() {
  emMemoria = null;
  try {
    fs.rmSync(arquivo(), { force: true });
  } catch {
    /* ignora */
  }
}
