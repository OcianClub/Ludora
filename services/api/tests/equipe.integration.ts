import { simularProvedor, testarOperacoes } from './suporte-operacoes.integration';
import { testarAcessoDev } from './acesso-dev.integration';
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
      const email = {
        SUPORTE: 'suporte@ludora.com', DESENVOLVEDOR: 'dev@ludora.com',
        SUPERADMIN: 'admin@ludora.com', USUARIO: 'usuario@equipe.example.test',
      }[papel];
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
      if (papel === 'USUARIO') {
        const acesso = await prisma.usuarioClube.findFirstOrThrow({ where: { usuario_id: usuario.id }, orderBy: { clube_id: 'desc' } });
        const categoria = await prisma.categoria.create({ data: { nome: 'sub-7', clube_id: acesso.clube_id, tipo: 'INICIACAO' } });
        const mandante = await prisma.time.create({ data: { nome: 'Mandante', categoria_id: categoria.id, clube_representado_id: acesso.clube_id } });
        const visitante = await prisma.time.create({ data: { nome: 'Visitante', categoria_id: categoria.id } });
        await prisma.partida.createMany({ data: Array.from({ length: 13 }, (_, index) => ({
          data: new Date(Date.UTC(2099, 0, index + 1)), horario: '19:00', status: 'PREPARADA' as const,
          local: 'Ginásio', categoria_id: categoria.id, mandante_id: mandante.id, visitante_id: visitante.id,
        })) });
        const query = new URLSearchParams({ formato: 'web', por_situacao: 'true', todos_periodos: 'true',
          categoria_exibida: 'SUB-7', agora: '2098-01-01T12:00', busca: 'ginasio', preparacao: 'PREPARADA' });
        const agenda = `http://127.0.0.1:3018/publico/clubes/${acesso.clube_id}/partidas/agenda?${query}`;
        const primeira = await fetch(agenda);
        assert.equal(primeira.status, 200);
        const linhas = await primeira.json();
        assert.equal(linhas.length, 24);
        assert.ok(linhas.every((p: { total_grupo: number }) => p.total_grupo === 13));
        const mais = await fetch(agenda + '&grupo=preparacao&categoria_nome=SUB-7&apos=12');
        const pagina = await mais.json();
        assert.equal(mais.status, 200);
        assert.equal(pagina.length, 1);
        assert.equal(pagina[0].posicao, 13);
        const revisao = pagina[0].revisao_grupo;
        assert.equal(typeof revisao, 'string');
        assert.equal(revisao, linhas.find((p: { grupo_agenda: string }) => p.grupo_agenda === 'preparacao').revisao_grupo);
        await prisma.partida.update({ where: { id: pagina[0].id }, data: { local: 'Ginásio central', versao: { increment: 1 } } });
        const atualizadas = await (await fetch(agenda)).json();
        assert.notEqual(atualizadas.find((p: { grupo_agenda: string }) => p.grupo_agenda === 'preparacao').revisao_grupo, revisao);
        const partida = await prisma.partida.update({ where: { id: pagina[0].id }, data: {
          status: 'AO_VIVO', sumula_clube_id: acesso.clube_id,
          participantes: { create: { clube_id: acesso.clube_id, categoria_id: categoria.id, time_id: mandante.id, pronta: true } },
        } });
        const postarGol = () => fetch(`http://127.0.0.1:3018/partidas/${partida.id}/eventos`, {
          method: 'POST', headers: { ...headers, 'x-clube-id': String(acesso.clube_id) },
          body: JSON.stringify({ tipo: 'GOL', time_id: mandante.id, autor_pendente: true, versao: partida.versao,
            request_id: 'sala-teste-um-gol', retorno_incremental: true }),
        });
        const gol = await postarGol();
        assert.equal(gol.status, 201);
        const confirmado = await gol.json();
        assert.equal(confirmado.sincronizacao.versao, partida.versao + 1);
        assert.equal(confirmado.sincronizacao.gols_mandante, 1);
        assert.equal((await postarGol()).status, 200, 'Reenvio confirma o mesmo lance');
        assert.equal(await prisma.avisoPartidaPendente.count({ where: { partida_id: partida.id } }), 1);
        assert.equal(await prisma.notificacao.count({ where: { partida_id: partida.id } }), 0, 'Resposta antecede a distribuição');
        const { distribuirAvisosPartida } = await import('../src/services/avisos-partida.service.js');
        const worker = () => distribuirAvisosPartida(prisma, io, async () => {});
        await Promise.all([worker(), worker()]);
        assert.equal(await prisma.notificacao.count({ where: { partida_id: partida.id, tipo: 'GOL_PARTIDA' } }), 1);
        assert.equal(await prisma.avisoPartidaPendente.count({ where: { partida_id: partida.id } }), 0);
      }
      for (const endpoint of ['/admin/equipe/me', '/admin/equipe/diagnostico']) {
        const r = await fetch('http://127.0.0.1:3018' + endpoint, { headers });
        assert.equal(r.status, papel === 'USUARIO' ? 403 : 200, `${papel} ${endpoint}`);
      }
      for (const endpoint of ['/admin/usuarios', '/admin/logs', '/admin/db/status', '/admin/sistema', '/admin/overview']) {
        const r = await fetch('http://127.0.0.1:3018' + endpoint, { headers });
        assert.equal(r.status, papel === 'SUPERADMIN' || papel === 'DESENVOLVEDOR' ? 200 : 403, `${papel} ${endpoint}`);
      }
      for (const [endpoint, permitido] of [
        ['/admin/equipe/chamados', papel !== 'USUARIO'],
        ['/admin/equipe/manutencao', papel !== 'USUARIO'],
        ['/admin/clubes/cascas?agrupar=clube', papel === 'SUPERADMIN'],
      ] as const) {
        const r = await fetch('http://127.0.0.1:3018' + endpoint, { headers });
        assert.equal(r.status, permitido ? 200 : 403, `${papel} ${endpoint}`);
      }
      if (papel !== 'SUPERADMIN') {
        for (const endpoint of ['/admin/clubes', `/admin/usuarios/${usuario.id}/revogar-sessoes`, '/admin/paulista/verificar']) {
          const r = await fetch('http://127.0.0.1:3018' + endpoint, { method: 'POST', headers, body: '{}' });
          assert.equal(r.status, 403, `${papel} ${endpoint}`);
        }
        if (papel !== 'USUARIO') {
          await prisma.usuario.update({ where: { id: usuario.id }, data: { papel_plataforma: 'USUARIO' } });
          assert.equal((await fetch('http://127.0.0.1:3018/admin/equipe/me', { headers })).status, 403, 'Rebaixamento revoga acesso com o mesmo token');
          await prisma.usuario.update({ where: { id: usuario.id }, data: { papel_plataforma: papel } });
        }
      }
      if (papel !== 'USUARIO') {
        await prisma.usuario.update({ where: { id: usuario.id }, data: { suspenso: true } });
        try {
          assert.equal((await fetch('http://127.0.0.1:3018/admin/equipe/me', { headers })).status, 401, 'Suspensão bloqueia um token existente');
        } finally {
          await prisma.usuario.update({ where: { id: usuario.id }, data: { suspenso: false } });
        }
        await prisma.usuario.update({ where: { id: usuario.id }, data: { versao_sessao: { increment: 1 } } });
        assert.equal((await fetch('http://127.0.0.1:3018/admin/equipe/me', { headers })).status, 401, 'Revogação bloqueia um token existente');
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
      await testarAcessoDev(prisma, contas, pasta);
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
