import test from 'node:test';
import assert from 'node:assert/strict';
import type { EntradaLog } from '@ludora/shared-types';
import { ConsultasEmAndamento } from '../src/shared/inflight';
import { formatarLogs, LIMITE_LOGS, mesclarLogs, selecionarLogs } from '../src/shared/logs';
import { ordenarUsuarios, proximaOrdem } from '../src/shared/user-order';
import { dentroDoPeriodo, PERIODOS_LOG } from '../src/shared/log-period';
import type { UsuarioGlobal } from '@ludora/shared-types';

const log = (id: number): EntradaLog => ({ id, ts: '2026-11-09T12:00:00Z', nivel: 'info', tipo: 'http', mensagem: `GET /admin/clubes/${id} → 200`, ms: 10 });

test('períodos de logs respeitam os limites de tempo e o modo ao vivo mantém o histórico recebido', () => {
  const agora = Date.parse('2026-11-09T12:00:00Z');
  for (const periodo of PERIODOS_LOG.filter(p => p.value !== 'live')) {
    const limite = agora - Number(periodo.value) * 60000;
    assert.equal(dentroDoPeriodo(new Date(limite).toISOString(), periodo.value, agora), true);
    assert.equal(dentroDoPeriodo(new Date(limite - 1).toISOString(), periodo.value, agora), false);
    assert.equal(dentroDoPeriodo(new Date(agora + 1).toISOString(), periodo.value, agora), false);
    assert.equal(dentroDoPeriodo('inválido', periodo.value, agora), false);
  }
  assert.equal(dentroDoPeriodo('2025-01-01T00:00:00Z', 'live', agora), true);
  assert.equal(dentroDoPeriodo('2026-11-09T08:00:00-03:00', '60', agora), true);
});

test('consultas simultâneas compartilham o transporte, mas consultas concluídas não viram cache', async () => {
  const consultas = new ConsultasEmAndamento();
  let chamadas = 0;
  const consultar = async () => { chamadas++; return { valor: chamadas }; };
  const resultados = await Promise.all(Array.from({ length: 20 }, () => consultas.executar('/admin/overview', consultar)));
  assert.equal(chamadas, 1);
  assert.ok(resultados.every(r => r.valor === 1));
  assert.equal((await consultas.executar('/admin/overview', consultar)).valor, 2);
});

test('limpar na troca de sessão/escrita impede reaproveitar leitura anterior', async () => {
  const consultas = new ConsultasEmAndamento();
  let liberar!: (valor: string) => void;
  const antigo = consultas.executar('contas', () => new Promise<string>(resolve => { liberar = resolve; }));
  await Promise.resolve();
  consultas.limpar();
  let liberarNovo!: (valor: string) => void;
  const novo = consultas.executar('contas', () => new Promise<string>(resolve => { liberarNovo = resolve; }));
  await Promise.resolve();
  liberar('sessão anterior'); await antigo;
  assert.equal(consultas.executar('contas', async () => 'incorreto'), novo, 'A resposta antiga não apaga a nova consulta');
  liberarNovo('sessão atual');
  assert.equal(await novo, 'sessão atual');
});

test('falha de consulta permite tentar novamente e chaves diferentes não se misturam', async () => {
  const consultas = new ConsultasEmAndamento();
  await assert.rejects(consultas.executar('a', async () => { throw new Error('rede'); }), /rede/);
  assert.deepEqual(await Promise.all([
    consultas.executar('a', async () => 'a'), consultas.executar('b', async () => 'b'),
  ]), ['a', 'b']);
});

test('logs: une snapshot e stream por id, ordena e limita o histórico', () => {
  const atual = Array.from({ length: 800 }, (_, id) => log(id));
  const novos = Array.from({ length: 800 }, (_, id) => log(id + 500)).reverse();
  const resultado = mesclarLogs(atual, novos);
  assert.equal(resultado.length, LIMITE_LOGS);
  assert.equal(resultado[0].id, 300);
  assert.equal(resultado.at(-1)?.id, 1299);
  assert.equal(new Set(resultado.map(e => e.id)).size, LIMITE_LOGS);
  assert.equal(atual.length, 800, 'Não modifica o snapshot anterior');
});

test('exportação só seleciona ids presentes no histórico autorizado', () => {
  assert.deepEqual(selecionarLogs([log(1), log(2), log(3)], [3, 1, 999, 1]).map(e => e.id), [3, 1]);
  for (const ids of [null, '1', [-1], [1.5], ['1'], Array(1001).fill(1)]) {
    assert.throws(() => selecionarLogs([log(1)], ids), /inválida/);
  }
});

test('texto exportado mantém apenas campos dos registros e uma linha por evento', () => {
  const entrada = { ...log(1), mensagem: 'ação\nregistrada\tcom sucesso', tipo: 'audit' as const, usuarioId: 99 };
  assert.equal(formatarLogs([entrada]), '2026-11-09T12:00:00Z\tAUDIT\tação registrada com sucesso\t10 ms');
  assert.equal(formatarLogs([]), '');
});

test('ordenação de usuários percorre crescente, decrescente e padrão sem alterar os registros', () => {
  const contas = [
    { id: 1, nome: 'Zeca', email: 'z@example.test', papel_plataforma: 'USUARIO', suspenso: true, clubes: [{ nome: 'Santos', papel: 'TECNICO' }] },
    { id: 2, nome: 'Álvaro', email: 'a@example.test', papel_plataforma: 'SUPORTE', suspenso: false, clubes: [] },
    { id: 3, nome: 'Bia', email: 'b@example.test', papel_plataforma: 'USUARIO', suspenso: false, clubes: [{ nome: 'Ocian', papel: 'MESARIO' }] },
  ] as UsuarioGlobal[];
  const asc = proximaOrdem(null, 'conta');
  assert.deepEqual(ordenarUsuarios(contas, asc).map(u => u.id), [2, 3, 1]);
  const desc = proximaOrdem(asc, 'conta');
  assert.deepEqual(ordenarUsuarios(contas, desc).map(u => u.id), [1, 3, 2]);
  assert.equal(proximaOrdem(desc, 'conta'), null);
  assert.equal(ordenarUsuarios(contas, null), contas, 'Padrão mantém exatamente a ordem recebida');
  assert.deepEqual(proximaOrdem(desc, 'clube'), { coluna: 'clube', direcao: 'asc' });
  assert.deepEqual(ordenarUsuarios(contas, { coluna: 'clube', direcao: 'asc' }).map(u => u.id), [2, 3, 1]);
  assert.deepEqual(ordenarUsuarios(contas, { coluna: 'situacao', direcao: 'asc' }).map(u => u.id), [2, 3, 1]);
  assert.deepEqual(contas.map(u => u.id), [1, 2, 3]);
});
