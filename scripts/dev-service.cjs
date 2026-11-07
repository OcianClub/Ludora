const { spawn } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const service = process.argv[2];
const env = { ...process.env, NODE_ENV: 'development' };
let command;
let args;
let cwd;

if (service === 'api') {
  command = process.execPath;
  args = ['--import', 'tsx', '--watch', 'src/server.ts'];
  cwd = path.join(root, 'services/api');
} else if (service === 'ml') {
  cwd = path.join(root, 'services/ml');
  command = path.join(cwd, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  args = ['-m', 'uvicorn', 'main:app', '--reload'];
  const apiEnv = path.join(root, 'services/api/.env');
  if (!env.ML_API_KEY && existsSync(apiEnv)) {
    const { parse } = require('../services/api/node_modules/dotenv');
    const key = parse(readFileSync(apiEnv)).ML_API_KEY;
    if (key) env.ML_API_KEY = key;
  }
} else {
  console.error('Informe api ou ml para iniciar o serviço local.');
  process.exit(1);
}

const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
child.once('error', error => {
  console.error(`Não foi possível iniciar ${service}: ${error.code}. Confira as dependências do serviço.`);
  process.exitCode = 1;
});
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (!child.killed) child.kill(signal); });
}
