const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

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
  const child = spawn(
    process.execPath,
    [cli, 'start', ...args, '--port', String(port)],
    {
      cwd,
      env: process.env,
      stdio: 'inherit',
    }
  );
  child.once('error', (error) => {
    console.error(`Não foi possível iniciar o Expo: ${error.code}.`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 0 : 1);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      if (!child.killed) child.kill(signal);
    });
  }
}

module.exports = { portaDisponivel, escolherPorta };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
