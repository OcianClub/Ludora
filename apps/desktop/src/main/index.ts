import { app, BrowserWindow, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import { darkColors, lightColors } from '@ludora/design-tokens';
import { registrarIpc } from './ipc';
import { pararLogs } from './realtime';

let janela: BrowserWindow | null = null;

// Uma única instância: duas janelas disputariam a mesma sessão cifrada.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function criarJanela() {
  const escuro = nativeTheme.shouldUseDarkColors;

  janela = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'Ludora Admin',
    autoHideMenuBar: true,
    // Mesma cor de fundo do tema, vinda dos design-tokens, para não piscar.
    backgroundColor: escuro ? darkColors.fundo : lightColors.fundo,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true, // o CORS é resolvido no processo principal, nunca desligando isto
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  janela.once('ready-to-show', () => janela?.show());
  janela.on('closed', () => {
    janela = null;
  });

  // Nenhuma navegação para fora do app; links externos abrem no navegador (só https).
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (evento, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL;
    const interno = dev ? url.startsWith(dev) : url.startsWith('file://');
    if (!interno) evento.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void janela.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void janela.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // O painel não precisa de câmera, microfone, localização etc.
  session.defaultSession.setPermissionRequestHandler((_wc, _permissao, resposta) => resposta(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  registrarIpc(() => janela);
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('second-instance', () => {
  if (janela) {
    if (janela.isMinimized()) janela.restore();
    janela.focus();
  }
});

// Bloqueia <webview> e qualquer janela criada fora do nosso controle.
app.on('web-contents-created', (_evento, conteudo) => {
  conteudo.on('will-attach-webview', evento => evento.preventDefault());
});

app.on('before-quit', () => pararLogs());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
