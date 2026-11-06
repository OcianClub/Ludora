const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const os = require('node:os');
const { setTimeout: esperar } = require('node:timers/promises');

function portaDisponivel(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (['EADDRINUSE', 'EACCES'].includes(error.code)) resolve(false);
      else reject(error);
    });
    server.listen({ port, exclusive: true }, () =>
      server.close(() => resolve(true))
    );
  });
}

async function escolherPorta(first = 8081, last = 8091) {
  for (let port = first; port <= last; port++) {
    if (await portaDisponivel(port)) return port;
  }
  throw new Error(
    `As portas ${first}–${last} estão ocupadas. Feche os servidores Expo antigos e tente novamente.`
  );
}

/** Prefere a interface da API local e evita escolher VPN/Hyper-V no celular. */
function escolherHostLan(interfaces, ambiente = {}) {
  if (ambiente.REACT_NATIVE_PACKAGER_HOSTNAME?.trim())
    return ambiente.REACT_NATIVE_PACKAGER_HOSTNAME.trim();
  const candidatos = Object.entries(interfaces).flatMap(([nome, itens]) =>
    (itens || []).filter(item =>
      !item.internal && (item.family === 'IPv4' || item.family === 4) &&
      !item.address.startsWith('169.254.')
    ).map(item => ({ nome, endereco: item.address }))
  );
  try {
    const apiHost = new URL(ambiente.EXPO_PUBLIC_API_URL).hostname;
    if (candidatos.some(item => item.endereco === apiHost)) return apiHost;
  } catch {}
  const prioridade = item =>
    (/vpn|radmin|hamachi|vethernet|virtual|wsl|docker|hyper-v|^tun|^tap/i.test(item.nome) ? 100 : 0) +
    (item.endereco.startsWith('192.168.') ? 0 : item.endereco.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(item.endereco) ? 2 : 3);
  candidatos.sort((a, b) => prioridade(a) - prioridade(b));
  return candidatos[0]?.endereco;
}

async function obterLinksExpo(port, { go = false, signal, consultar = fetch } = {}) {
  const consultarLocal = caminho => consultar(`http://127.0.0.1:${port}${caminho}`, {
    redirect: 'manual',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(2000)]) : AbortSignal.timeout(2000),
  });
  const estado = await consultarLocal('/status');
  if (!estado.ok || (await estado.text()).trim() !== 'packager-status:running') return null;
  // Pergunta ao próprio Expo: preserva o scheme real do APK e a porta/túnel ativos.
  const redirect = await consultarLocal(`/_expo/link?platform=android&choice=${go ? 'expo-go' : 'expo-dev-client'}`);
  const link = redirect.headers.get('location');
  if (![302, 307].includes(redirect.status) || !link) return null;
  try {
    const uri = new URL(link);
    if (go && uri.protocol === 'exp:') return { link, servidor: link.replace(/^exp:/, 'http:') };
    const servidor = uri.searchParams.get('url');
    if (!go && uri.hostname === 'expo-development-client' && servidor &&
      ['http:', 'https:'].includes(new URL(servidor).protocol)) return { link, servidor };
  } catch {}
  return null;
}

async function aguardarLinksExpo(port, { signal, go = false, timeoutMs = 90_000 } = {}) {
  const fim = Date.now() + timeoutMs;
  while (!signal?.aborted && Date.now() < fim) {
    try {
      const links = await obterLinksExpo(port, { go, signal });
      if (links) return links;
    } catch {
      if (signal?.aborted) return null;
    }
    await esperar(500, undefined, { signal }).catch(() => undefined);
  }
  return null;
}

function mostrarAcesso(links, { cwd, go, escrever = console.log }) {
  escrever(`\nLUDORA MOBILE — ${go ? 'Expo Go' : 'APK de desenvolvimento'}`);
  escrever(`Servidor para informar no aplicativo: ${links.servidor}`);
  escrever(`Link para abrir no celular: ${links.link}`);
  try {
    // Usa o mesmo gerador que já acompanha o Expo, sem nova dependência.
    const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [cwd] }));
    const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [expoRoot] }));
    const qr = require(require.resolve('qrcode-terminal', { paths: [cliRoot] }));
    qr.generate(links.link, { small: true }, codigo => escrever(codigo));
  } catch {
    escrever('QR code indisponível. Use o endereço acima no aplicativo.');
  }
  escrever('Celular e computador devem estar na mesma rede para conexão local.\n');
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--port');
  const explicit = index >= 0 ? Number(args[index + 1]) : undefined;
  if (
    explicit !== undefined &&
    (!Number.isInteger(explicit) || explicit < 1 || explicit > 65535)
  ) {
    throw new Error('Informe uma porta válida após --port.');
  }
  const port = await escolherPorta(explicit ?? 8081, explicit ?? 8091);
  if (port !== 8081 && explicit === undefined) {
    console.log(
      `A porta 8081 está ocupada. O Expo será aberto na ${port}. Conecte o APK pelo endereço/QR code deste terminal.`
    );
  }
  if (index >= 0) args.splice(index, 2);
  const cwd = path.resolve(__dirname, '../apps/mobile');
  const cli = require.resolve('expo/bin/cli', { paths: [cwd] });
  const env = { ...process.env };
  const hostIndex = args.indexOf('--host');
  const lan = !args.includes('--tunnel') && !args.includes('--localhost') &&
    (hostIndex < 0 || args[hostIndex + 1] === 'lan');
  if (lan && !env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    let projeto = {};
    try {
      const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [cwd] }));
      const { parseProjectEnv } = require(require.resolve('@expo/env', { paths: [expoRoot] }));
      projeto = parseProjectEnv(cwd, { mode: 'development', silent: true }).env;
    } catch {}
    const host = escolherHostLan(os.networkInterfaces(), { ...projeto, ...env });
    if (host) env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
  }
  const encerramento = new AbortController();
  const child = spawn(
    process.execPath,
    [cli, 'start', ...args, '--port', String(port)],
    {
      cwd,
      env,
      stdio: 'inherit',
    }
  );
  child.once('error', (error) => {
    encerramento.abort();
    console.error(`Não foi possível iniciar o Expo: ${error.code}.`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    encerramento.abort();
    process.exitCode = code ?? (signal ? 0 : 1);
  });
  // concurrently usa pipes; nesse modo o Expo omite sua interface/QR nativos.
  if (!process.stdout.isTTY || !process.stdin.isTTY || env.CI) {
    const go = args.includes('--go');
    void aguardarLinksExpo(port, { signal: encerramento.signal, go }).then(links => {
      if (encerramento.signal.aborted) return;
      if (links) mostrarAcesso(links, { cwd, go });
      else console.warn('O link do Expo ainda não está disponível. Confira os erros do servidor acima.');
    }).catch(() => undefined);
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      encerramento.abort();
      if (!child.killed) child.kill(signal);
    });
  }
}

module.exports = { portaDisponivel, escolherPorta, escolherHostLan, obterLinksExpo, aguardarLinksExpo, mostrarAcesso };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
