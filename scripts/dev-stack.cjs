const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { concurrently } = require('concurrently');
const { parse } = require('../services/api/node_modules/dotenv');

const arquivoApi = path.resolve(__dirname, '../services/api/.env');
const envApi = existsSync(arquivoApi) ? parse(readFileSync(arquivoApi)) : {};
const porta = Number(process.env.PORT || envApi.PORT || 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  console.error('Confira a variável PORT da API.');
  process.exit(1);
}

const api = `http://localhost:${porta}`;
const origens = (process.env.CORS_ORIGINS || envApi.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const CORS_ORIGINS = [...new Set([...origens, 'http://localhost:8081', 'http://localhost:5173', 'http://127.0.0.1:5173'])].join(',');

const incluirMobile = !process.argv.includes('--sem-mobile');

console.log(`Web: http://localhost:5173 · API do Ludora: ${api}`);
const { result } = concurrently([
  { name: 'API', command: 'pnpm dev:api', prefixColor: 'blue', env: { CORS_ORIGINS, PORT: String(porta), PYTHON_AI_URL: 'http://127.0.0.1:8000', LUDORA_WEB_URL: 'http://localhost:5173' } },
  { name: 'ML', command: 'pnpm dev:ml', prefixColor: 'magenta' },
  ...(incluirMobile ? [
    { name: 'MOBILE', command: 'pnpm dev:mobile', prefixColor: 'green', env: { LUDORA_API_PORT_LOCAL: String(porta) } },
  ] : []),
  { name: 'WEB', command: 'pnpm dev:web --port 5173 --strictPort', prefixColor: 'cyan', env: { VITE_API_URL: api } },
  { name: 'DESKTOP', command: 'pnpm dev:desktop', prefixColor: 'yellow', env: { LUDORA_DESKTOP_DEV_API: api } },
], { prefix: 'name', killOthersOn: 'failure', handleInput: incluirMobile, defaultInputTarget: incluirMobile ? 'MOBILE' : undefined });
result.catch(() => { process.exitCode = 1; });
