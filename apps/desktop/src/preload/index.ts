import { contextBridge, ipcRenderer } from 'electron';
import type { EntradaLog } from '@ludora/shared-types';
import { CANAIS, type EstadoTempoReal, type LudoraBridge } from '../shared/bridge';

// Cada função expõe um caso de uso específico. Não existe "invoke" genérico:
// o renderer não consegue chamar canais arbitrários nem importar o Electron.
function escutar<T>(canal: string, ouvinte: (valor: T) => void) {
  const handler = (_evento: unknown, valor: T) => ouvinte(valor);
  ipcRenderer.on(canal, handler);
  return () => ipcRenderer.removeListener(canal, handler);
}

const ponte: LudoraBridge = {
  auth: {
    restaurar: () => ipcRenderer.invoke(CANAIS.authRestaurar),
    entrar: (email, senha) => ipcRenderer.invoke(CANAIS.authEntrar, email, senha),
    sair: () => ipcRenderer.invoke(CANAIS.authSair),
    aoExpirar: ouvinte => escutar<void>(CANAIS.sessaoExpirada, () => ouvinte()),
  },
  api: {
    requisicao: (metodo, caminho, corpo) => ipcRenderer.invoke(CANAIS.api, metodo, caminho, corpo),
  },
  config: {
    obter: () => ipcRenderer.invoke(CANAIS.configObter),
    definirApiUrl: url => ipcRenderer.invoke(CANAIS.configDefinirApi, url),
  },
  logs: {
    historico: () => ipcRenderer.invoke(CANAIS.logsHistorico),
    aoReceber: ouvinte => escutar<EntradaLog>(CANAIS.logsEntrada, ouvinte),
    aoMudarEstado: ouvinte => escutar<EstadoTempoReal>(CANAIS.logsEstado, ouvinte),
  },
};

contextBridge.exposeInMainWorld('ludora', ponte);
