import { app, clipboard, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SuperAdminUsuario } from '@ludora/shared-types';
import { CANAIS, type ConfigApp, type ResultadoLogin } from '../shared/bridge';
import { emailValido, metodoPermitido, caminhoApiPermitido, rendererUrlPermitida } from '../shared/rules';
import { chamarApi } from './api-client';
import { API_URL_PADRAO, lerApiUrl, salvarApiUrl } from './config';
import { iniciarLogs, obterHistorico, pararLogs } from './realtime';
import { armazenamentoSeguro, carregarDoDisco, limparSessao, salvarSessao, sessaoAtual } from './session';
import { formatarLogs, selecionarLogs } from '../shared/logs';

// Só o nosso próprio renderer pode falar com o processo principal.
function remetenteConfiavel(evento: IpcMainInvokeEvent, janela: BrowserWindow): boolean {
  if (evento.sender !== janela.webContents) return false;
  if (evento.senderFrame !== janela.webContents.mainFrame) return false;
  const url = evento.senderFrame?.url ?? '';
  const entrada = process.env.ELECTRON_RENDERER_URL
    || pathToFileURL(path.join(__dirname, '../renderer/index.html')).href;
  return rendererUrlPermitida(url, entrada);
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

  // Confirma no servidor o papel interno atual do funcionário.
  type Validacao = { usuario: SuperAdminUsuario } | { erro: string; rede: boolean };
  async function validarFuncionario(token: string): Promise<Validacao> {
    const me = await chamarApi<{ usuario?: SuperAdminUsuario; error?: string }>('GET', '/admin/equipe/me', undefined, { token });
    if (me.ok && me.data.usuario) return { usuario: me.data.usuario };
    if (me.status === 403) return { erro: 'Esta conta não tem acesso ao painel interno Ludora.', rede: false };
    return { erro: me.data.error ?? 'Não foi possível validar o acesso.', rede: me.status === 0 || me.status >= 500 };
  }

  ipcMain.handle(CANAIS.authRestaurar, async (evento): Promise<ResultadoLogin | null> => {
    janelaOuErro(evento);
    const sessao = sessaoAtual() ?? carregarDoDisco();
    if (!sessao) return null;
    const validacao = await validarFuncionario(sessao.token);
    if (!('usuario' in validacao)) {
      // API fora do ar não é motivo para descartar a sessão; token inválido é.
      if (!validacao.rede) limparSessao();
      return null;
    }
    if (validacao.usuario.papel_plataforma === 'SUPERADMIN') comecarLogs(sessao.token);
    else pararLogs();
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

    // Só guardamos o token depois que o servidor confirma o acesso interno.
    const validacao = await validarFuncionario(login.data.token);
    if (!('usuario' in validacao)) return { ok: false, erro: validacao.erro };

    const persistente = salvarSessao({ token: login.data.token, usuario: validacao.usuario });
    if (validacao.usuario.papel_plataforma === 'SUPERADMIN') comecarLogs(login.data.token);
    else pararLogs();
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

  for (const canal of [CANAIS.logsCopiar, CANAIS.logsExportar]) {
    ipcMain.handle(canal, async (evento, ids: unknown) => {
      const janela = janelaOuErro(evento);
      const sessao = sessaoAtual();
      if (sessao?.usuario.papel_plataforma !== 'SUPERADMIN') return { ok: false, total: 0, erro: 'Acesso restrito à administração Ludora.' };
      try {
        const entradas = selecionarLogs(obterHistorico().entradas, ids);
        if (!entradas.length) return { ok: false, total: 0, erro: 'Os registros não estão mais disponíveis. Atualize a seleção.' };
        const texto = formatarLogs(entradas);
        if (canal === CANAIS.logsCopiar) clipboard.writeText(texto);
        else {
          const escolha = await dialog.showSaveDialog(janela, {
            title: 'Exportar logs exibidos', defaultPath: `ludora-logs-${new Date().toISOString().slice(0, 10)}.txt`,
            filters: [{ name: 'Arquivo de texto', extensions: ['txt'] }],
          });
          if (escolha.canceled || !escolha.filePath) return { ok: false, cancelado: true, total: 0 };
          // A sessão pode ter expirado enquanto o seletor nativo estava aberto.
          if (sessaoAtual()?.token !== sessao.token) return { ok: false, total: 0, erro: 'A sessão mudou. Entre novamente.' };
          await writeFile(escolha.filePath, texto, 'utf8');
        }
        return { ok: true, total: entradas.length };
      } catch {
        return { ok: false, total: 0, erro: 'Não foi possível copiar ou exportar os logs selecionados.' };
      }
    });
  }
}
