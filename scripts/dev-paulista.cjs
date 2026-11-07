// Visualização local do piloto. Nunca usa as credenciais de services/api/.env.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

const root = path.resolve(__dirname, '..');
const name = 'ludora-paulista-20261105';
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' && command === pnpm, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(' ')} falhou: ${result.error?.message || result.stderr?.trim() || result.stdout?.trim()}`);
  return result.stdout?.trim() || '';
}

async function portFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function main() {
  if (!await portFree(3009) || !await portFree(5193)) throw new Error('Porta 3009 ou 5193 ocupada. Encerre a visualização anterior.');
  const inspect = JSON.parse(run(docker, ['inspect', name]))[0];
  const binding = inspect?.HostConfig?.PortBindings?.['5432/tcp']?.[0];
  if (binding?.HostIp !== '127.0.0.1' || binding?.HostPort !== '55441') throw new Error('Banco de teste não está restrito a 127.0.0.1:55441.');
  const variables = Object.fromEntries((inspect.Config.Env || []).map(entry => { const i = entry.indexOf('='); return [entry.slice(0, i), entry.slice(i + 1)]; }));
  if (variables.POSTGRES_DB !== 'ludora_paulista' || !variables.POSTGRES_PASSWORD) throw new Error('Container não é o banco de teste esperado.');
  if (inspect.State.Status !== 'running') run(docker, ['start', name]);
  const url = new URL('postgresql://127.0.0.1:55441/ludora_paulista');
  url.username = variables.POSTGRES_USER || 'postgres';
  url.password = variables.POSTGRES_PASSWORD;
  const apiEnv = {
    ...process.env, NODE_ENV: 'development', PORT: '3009',
    DATABASE_URL: url.href, DIRECT_URL: url.href,
    JWT_SECRET: 'paulista-local-test-only-secret',
    PAULISTA_ENABLED: 'true', PAULISTA_SYNC_DIARIA: 'false',
    ATUALIZACAO_TEMPORADA: 'false', CORS_ORIGINS: 'http://localhost:5193,http://127.0.0.1:5193',
    PYTHON_AI_URL: '', RESEND_API_KEY: '', SUPERADMIN_EMAILS: '',
  };
  const webEnv = { ...process.env, VITE_API_URL: 'http://localhost:3009' };
  // Esta visualização isolada compila a API atual; pnpm dev usa src em watch.
  run(pnpm, ['--filter', '@ludora/api', 'run', 'build'], { stdio: 'inherit' });
  const api = spawn(process.execPath, ['dist/src/server.js'], { cwd: path.join(root, 'services/api'), env: apiEnv, stdio: 'inherit' });
  const web = spawn(pnpm, ['--filter', '@ludora/web', 'run', 'dev', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { cwd: root, env: webEnv, stdio: 'inherit', shell: process.platform === 'win32' });
  const stop = () => { api.kill(); web.kill(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  api.once('exit', stop); web.once('exit', stop);
  console.log('Piloto local: http://localhost:5193/competicoes/paulista (API 3009; banco Docker isolado).');
  console.log('Dados e contas neste banco são de teste. O Supabase compartilhado não é usado.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
