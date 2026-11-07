// Backup do schema da aplicação. Credenciais passam pelo ambiente, nunca pelo log.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const u = new URL(process.env.DIRECT_URL);
const folder = process.env.PAULISTA_BACKUP_DIR ? path.resolve(process.env.PAULISTA_BACKUP_DIR) : path.resolve(__dirname, '../../../.local-demo/backups/2026-11-06');
fs.mkdirSync(folder, { recursive: true });
if (fs.existsSync(path.join(folder, 'ludora-public.dump'))) {
  console.error('Backup já existe. Preserve a cópia anterior e escolha outro destino antes de repetir.');
  process.exit(1);
}
console.log('Backup de public:', u.hostname, u.port, u.pathname);
const out = spawnSync('docker', ['run', '--rm', '-e', 'PGPASSWORD', '-v', `${folder}:/backup`, 'postgres:17-alpine',
  'pg_dump', '--host', u.hostname, '--port', u.port || '5432', '--username', decodeURIComponent(u.username), '--dbname', u.pathname.slice(1),
  '--schema=public', '--format=custom', '--no-owner', '--no-privileges', '--file=/backup/ludora-public.dump'],
  { env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: 'require' }, encoding: 'utf8' });
if (out.status !== 0) { console.error('Backup falhou; migration não deve prosseguir.'); process.exit(1); }
console.log('Backup gravado:', path.join(folder, 'ludora-public.dump'), fs.statSync(path.join(folder, 'ludora-public.dump')).size, 'bytes');
