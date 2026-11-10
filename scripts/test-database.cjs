/* PostgreSQL local exclusivo dos testes de integração. Nunca lê o .env. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const folder = path.join(root, '.local-demo', 'equipe');
const runtime = path.join(folder, 'runtime');
const data = path.join(folder, 'postgres-data');
const configFile = path.join(folder, 'config.json');
const bin = path.join(runtime, 'package', 'native', 'bin');
const version = '16.15.0-beta.19';
const port = 55448;
const action = process.argv[2] || 'status';

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, windowsHide: true, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Falha em ${path.basename(executable)}`);
  return result.stdout;
}

function readConfig() {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const target = new URL(config.databaseUrl);
  if (target.protocol !== 'postgresql:' || target.hostname !== '127.0.0.1' || target.port !== String(port)
    || target.pathname !== '/ludora_equipe' || target.username !== 'ludora_test') {
    throw new Error('Configuração recusada: este comando só opera no banco local ludora_equipe, porta 55448.');
  }
  return config;
}

async function download() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Este instalador portátil é para Windows x64.');
  }
  if (fs.existsSync(path.join(bin, 'initdb.exe'))) return;
  fs.mkdirSync(runtime, { recursive: true });
  console.log('Baixando PostgreSQL portátil (somente na primeira execução)...');
  const response = await fetch(`https://registry.npmjs.org/@embedded-postgres%2fwindows-x64/${version}`);
  if (!response.ok) throw new Error(`Registro indisponível: ${response.status}`);
  const metadata = await response.json();
  const archiveResponse = await fetch(metadata.dist.tarball);
  if (!archiveResponse.ok) throw new Error(`Download indisponível: ${archiveResponse.status}`);
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
  if (integrity !== metadata.dist.integrity) throw new Error('Download com integridade inválida.');
  const archive = path.join(runtime, 'windows-postgres.tgz');
  fs.writeFileSync(archive, bytes);
  fs.writeFileSync(path.join(runtime, 'package-source.json'), JSON.stringify({ name: metadata.name, version, dist: metadata.dist }, null, 2));
  run('tar.exe', ['-xzf', archive, '-C', runtime]);
}

function portAvailable() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function running() {
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) return false;
  return spawnSync(path.join(bin, 'pg_ctl.exe'), ['-D', data, 'status'], { windowsHide: true, stdio: 'ignore' }).status === 0;
}

async function start() {
  await download();
  if (!fs.existsSync(configFile)) {
    if (fs.existsSync(path.join(data, 'PG_VERSION'))) throw new Error('Banco existente sem configuração. Restaure config.json; nenhuma senha será substituída.');
    const password = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(configFile, JSON.stringify({ databaseUrl: `postgresql://ludora_test:${password}@127.0.0.1:${port}/ludora_equipe`, jwtSecret: crypto.randomBytes(48).toString('hex') }, null, 2), { mode: 0o600 });
  }
  const config = readConfig();
  if (!running()) {
    await portAvailable();
    if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
      const passwordFile = path.join(folder, 'init-password.tmp');
      try {
        fs.writeFileSync(passwordFile, decodeURIComponent(new URL(config.databaseUrl).password), { mode: 0o600 });
        run(path.join(bin, 'initdb.exe'), ['-D', data, '-U', 'ludora_test', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', `--pwfile=${passwordFile}`]);
      } finally { if (fs.existsSync(passwordFile)) fs.unlinkSync(passwordFile); }
    }
    // PostgreSQL continua em segundo plano; não herdar pipes do terminal no Windows.
    run(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-l', path.join(folder, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', '-t', '30', 'start'], { stdio: 'ignore' });
  }
  const { PrismaClient } = require(path.join(root, 'services', 'api', 'node_modules', '@prisma', 'client'));
  const adminUrl = new URL(config.databaseUrl);
  adminUrl.pathname = '/postgres';
  const prisma = new PrismaClient({ datasourceUrl: adminUrl.href });
  try {
    const databases = await prisma.$queryRawUnsafe("SELECT 1 FROM pg_database WHERE datname = 'ludora_equipe'");
    if (!databases.length) await prisma.$executeRawUnsafe('CREATE DATABASE ludora_equipe');
  } finally { await prisma.$disconnect(); }
  console.log(`Banco de testes pronto em 127.0.0.1:${port}/ludora_equipe. Supabase e .env permanecem intactos.`);
}

async function main() {
  if (action === 'start') return start();
  if (!['stop', 'status'].includes(action)) throw new Error('Use start, stop ou status.');
  if (!fs.existsSync(configFile)) { console.log('Banco de testes ainda não criado. Use pnpm db:test:start.'); return; }
  readConfig();
  if (action === 'status') { console.log(running() ? `Banco de testes em execução na porta ${port}.` : 'Banco de testes parado.'); return; }
  if (running()) run(path.join(bin, 'pg_ctl.exe'), ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop']);
  console.log('Banco de testes parado. Os dados fictícios foram preservados.');
}

main().catch(error => {
  // Não expõe URLs autenticadas em mensagens de falha de conexão.
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[conexão local omitida]'));
  process.exitCode = 1;
});
