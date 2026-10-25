import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { SuperAdminUsuario } from '@ludora/shared-types';
import { CANAIS, type ConfigApp, type ResultadoLogin } from '../shared/bridge';
import { emailValido, metodoPermitido, caminhoApiPermitido } from '../shared/rules';
import { chamarApi } from './api-client';
import { API_URL_PADRAO, lerApiUrl, salvarApiUrl } from './config';
import { iniciarLogs, obterHistorico, pararLogs } from './realtime';
import { armazenamentoSeguro, carregarDoDisco, limparSessao, salvarSessao, sessaoAtual } from './session';

// Só o nosso próprio renderer pode falar com o processo principal.
function remetenteConfiavel(evento: IpcMainInvokeEvent, janela: BrowserWindow): boolean {
  if (evento.sender !== janela.webContents) return false;
  const url = evento.senderFrame?.url ?? '';
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) return url.startsWith(dev);
  return url.startsWith('file://');
}

export function registrarIpc(obterJanela: () => BrowserWindow | null) {
  const janelaOuErro = (evento: IpcMainInvokeEvent) => {
    const janela = obterJanela();
    if (!janela || !remetenteConfiavel(evento, janela)) throw new Error('Remetente não autorizado');
    return janela;
  };

  const avisarExpirou = () => {
    pararLogs();
    obterJanela()?.webContents.send(CANAIS.sessaoExpirada);
  };

  const comecarLogs = (token: string) => {
    iniciarLogs(token, {
      aoEntrada: entrada => obterJanela()?.webContents.send(CANAIS.logsEntrada, entrada),
      aoMudarEstado: estado => obterJanela()?.webContents.send(CANAIS.logsEstado, estado),
    });
  };

  // Confirma no servidor que o token pertence a um Super Admin.
  type Validacao = { usuario: SuperAdminUsuario } | { erro: string; rede: boolean };
  async function validarSuperAdmin(token: string): Promise<Validacao> {
    const me = await chamarApi<{ usuario?: SuperAdminUsuario; error?: string }>('GET', '/admin/me', undefined, { token });
    if (me.ok && me.data.usuario) return { usuario: me.data.usuario };
    if (me.status === 403) return { erro: 'Esta conta não tem acesso ao painel Super Admin.', rede: false };
    return { erro: me.data.error ?? 'Não foi possível validar o acesso.', rede: me.status === 0 };
  }

  ipcMain.handle(CANAIS.authRestaurar, async (evento): Promise<ResultadoLogin | null> => {
    janelaOuErro(evento);
    const sessao = sessaoAtual() ?? carregarDoDisco();
    if (!sessao) return null;
    const validacao = await validarSuperAdmin(sessao.token);
    if (!('usuario' in validacao)) {
      // API fora do ar não é motivo para descartar a sessão; token inválido é.
      if (!validacao.rede) limparSessao();
      return null;
    }
    comecarLogs(sessao.token);
    return { ok: true, usuario: validacao.usuario, persistente: armazenamentoSeguro() };
  });

  ipcMain.handle(CANAIS.authEntrar, async (evento, email: unknown, senha: unknown): Promise<ResultadoLogin> => {
    janelaOuErro(evento);
    if (!emailValido(email) || typeof senha !== 'string' || !senha || senha.length > 128) {
      return { ok: false, erro: 'Informe e-mail e senha válidos.' };
    }

    const login = await chamarApi<{ token?: string; error?: string }>('POST', '/auth/login', { email, senha }, { semToken: true });
    if (!login.ok || !login.data.token) {
      return { ok: false, erro: login.data.error ?? 'Não foi possível entrar.' };
    }

    // Só guardamos o token depois que o servidor confirma o acesso de Super Admin.
    const validacao = await validarSuperAdmin(login.data.token);
    if (!('usuario' in validacao)) return { ok: false, erro: validacao.erro };

    const persistente = salvarSessao({ token: login.data.token, usuario: validacao.usuario });
    comecarLogs(login.data.token);
    return { ok: true, usuario: validacao.usuario, persistente };
  });

  ipcMain.handle(CANAIS.authSair, async evento => {
    janelaOuErro(evento);
    pararLogs();
    limparSessao();
  });

  ipcMain.handle(CANAIS.api, async (evento, metodo: unknown, caminho: unknown, corpo: unknown) => {
    janelaOuErro(evento);
    if (!metodoPermitido(metodo) || !caminhoApiPermitido(caminho)) {
      return { ok: false, status: 400, data: { error: 'Requisição não permitida' } };
    }
    return chamarApi(metodo, caminho, corpo, { aoExpirar: avisarExpirou });
  });

  ipcMain.handle(CANAIS.configObter, async (evento): Promise<ConfigApp> => {
    janelaOuErro(evento);
    return {
      apiUrl: lerApiUrl(),
      apiUrlPadrao: API_URL_PADRAO,
      versao: app.getVersion(),
      plataforma: process.platform,
      armazenamentoSeguro: armazenamentoSeguro(),
    };
  });

  ipcMain.handle(CANAIS.configDefinirApi, async (evento, url: unknown) => {
    janelaOuErro(evento);
    try {
      const nova = salvarApiUrl(String(url));
      // O token pertence ao servidor anterior: nunca o reaproveitamos em outro host.
      pararLogs();
      limparSessao();
      return { ok: true as const, apiUrl: nova };
    } catch (erro) {
      return { ok: false as const, erro: (erro as Error).message };
    }
  });

  ipcMain.handle(CANAIS.logsHistorico, async evento => {
    janelaOuErro(evento);
    return obterHistorico();
  });
}
