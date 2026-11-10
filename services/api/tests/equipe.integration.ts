import { simularProvedor, testarOperacoes } from './suporte-operacoes.integration';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

async function main() {
  const pasta = path.resolve('../../.local-demo/equipe');
  const config = JSON.parse(await fs.readFile(path.join(pasta, 'config.json'), 'utf8'));
  const target = new URL(config.databaseUrl);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55448');
  assert.equal(target.pathname, '/ludora_equipe');
  Object.assign(process.env, {
    DATABASE_URL: target.href, DIRECT_URL: target.href, JWT_SECRET: config.jwtSecret,
    NODE_ENV: 'test', SUPERADMIN_EMAILS: '', RESEND_API_KEY: '', PYTHON_AI_URL: '',
    PAULISTA_ENABLED: process.argv.includes('--paulista-isolado') ? 'true' : 'false', PAULISTA_SYNC_DIARIA: 'false', ATUALIZACAO_TEMPORADA: 'false',
    SUPABASE_SERVICE_ROLE_KEY: '', GOOGLE_PLACES_API_KEY: '',
    CORS_ORIGINS: 'http://localhost:5198',
  });
  const mensagens = process.argv.includes('--email-isolado') ? simularProvedor() : null;
  if (mensagens) Object.assign(process.env, { RESEND_API_KEY: 'test-only', EMAIL_FROM: 'noreply@equipe.example.test', INVITE_BASE_URL: 'http://localhost:5198/convite/token' });
  const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env, encoding: 'utf8' });
  assert.equal(migration.status, 0, migration.stderr);
  const { prisma } = await import('../src/lib/prisma.js');
  const bcrypt = (await import('bcrypt')).default;
  const { criarApp } = await import('../src/app.js');
  const { criarSocketServer } = await import('../src/realtime/socket.js');
  const io = criarSocketServer();
  const server = criarApp(io).listen(3018, '127.0.0.1');
  io.attach(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const contas = [];
  let manterServidor = false;
  try {
    for (const papel of ['SUPORTE', 'DESENVOLVEDOR', 'SUPERADMIN', 'USUARIO'] as const) {
      const senha = randomBytes(32).toString('base64url');
      const email = `${papel.toLowerCase()}@equipe.example.test`;
      const usuario = await prisma.usuario.upsert({ where: { email },
        create: { email, nome: `Test ${papel}`, senha: await bcrypt.hash(senha, 10), papel_plataforma: papel },
        update: { senha: await bcrypt.hash(senha, 10), papel_plataforma: papel },
      });
      if (papel === 'USUARIO') {
        const clube = await prisma.clube.create({ data: { nome: 'Harbor Test Club' } });
        await prisma.usuarioClube.create({ data: { usuario_id: usuario.id, clube_id: clube.id, papel: 'ADMIN' } });
      }
      const login = await fetch('http://127.0.0.1:3018/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }),
      });
      assert.equal(login.status, 200);
      const { token } = await login.json() as { token: string };
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      for (const endpoint of ['/admin/equipe/me', '/admin/equipe/diagnostico']) {
        const r = await fetch('http://127.0.0.1:3018' + endpoint, { headers });
        assert.equal(r.status, papel === 'USUARIO' ? 403 : 200, `${papel} ${endpoint}`);
      }
      for (const endpoint of ['/admin/usuarios', '/admin/logs', '/admin/db/status']) {
        const r = await fetch('http://127.0.0.1:3018' + endpoint, { headers });
        assert.equal(r.status, papel === 'SUPERADMIN' ? 200 : 403, `${papel} ${endpoint}`);
      }
      if (papel !== 'SUPERADMIN') {
        for (const endpoint of ['/admin/clubes', `/admin/usuarios/${usuario.id}/revogar-sessoes`, '/admin/paulista/eventos/900/sincronizar']) {
          const r = await fetch('http://127.0.0.1:3018' + endpoint, { method: 'POST', headers, body: '{}' });
          assert.equal(r.status, 403, `${papel} ${endpoint}`);
        }
        if (papel !== 'USUARIO') {
          await prisma.usuario.update({ where: { id: usuario.id }, data: { papel_plataforma: 'USUARIO' } });
          assert.equal((await fetch('http://127.0.0.1:3018/admin/equipe/me', { headers })).status, 403, 'Rebaixamento revoga acesso com o mesmo token');
          await prisma.usuario.update({ where: { id: usuario.id }, data: { papel_plataforma: papel } });
        }
      }
      contas.push({ papel, email, senha });
    }
    assert.equal((await fetch('http://127.0.0.1:3018/admin/equipe/me')).status, 401);
    await fs.writeFile(path.join(pasta, 'contas.json'), JSON.stringify(contas));
    console.log('PASS quatro papéis, autenticação real, diagnóstico, bloqueio de consultas/escritas e rebaixamento imediato.');
    const anterior = await fs.readFile(path.join(pasta, 'chamados.json'), 'utf8').catch(() => '');
    if (anterior) {
      const ids = JSON.parse(anterior);
      const automatico = await prisma.suporteChamado.findUniqueOrThrow({ where: { id: ids.automatico } });
      assert.equal(automatico.ocorrencias, 3);
      assert.ok(await prisma.suporteChamado.findUnique({ where: { id: ids.manual } }));
      console.log('PASS chamados manual e automático preservados após reiniciar a API.');
    }
    if (mensagens) {
      await testarOperacoes(prisma, contas, mensagens, senha => bcrypt.hash(senha, 10));

    }
    if (process.argv.includes('--completo')) {
      // A API precisa continuar atendendo enquanto os testes filhos usam HTTP.
      for (const arquivo of ['suporte.integration.ts', 'manutencao.integration.ts', 'paulista-operacional.integration.ts']) {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, [require.resolve('tsx/cli'), path.join(__dirname, arquivo)], {
            env: process.env, stdio: 'inherit', windowsHide: true,
          });
          child.once('error', reject);
          child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${arquivo} terminou com código ${code}`)));
        });
      }
      console.log('PASS integração completa no PostgreSQL local isolado.');
    }
    if (process.argv.includes('--serve')) {
      manterServidor = true;
      console.log('API isolada pronta na porta 3018 para validar Electron.');
      return;
    }
  } finally {
    if (!manterServidor) {
      await new Promise<void>(resolve => io.close(() => resolve()));
      await prisma.$disconnect();
    }
  }
}
main().catch(e => { console.error('Falha na validação isolada da equipe.', e.message); process.exitCode = 1; });
