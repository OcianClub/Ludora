import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarControleRequisicoes, fetchComTimeout } from '../src/utils/request';
import { dataPartidaISO, horarioPartidaValido, erroFormularioPartida } from '../src/utils/validarPartida';
import { resumirPartidas } from '../src/utils/resumoPartidas';

for (const data of ['31/02', '31/04', '00/10', '10/00', '10/13', '1/01', 'abc']) {
  test(`formulário recusa a data impossível ou incompleta ${data}`, () => assert.equal(dataPartidaISO(data, 2026), null));
}
test('calendário distingue fevereiro em anos bissextos', () => {
  assert.equal(dataPartidaISO('29/02', 2024), '2024-02-29');
  assert.equal(dataPartidaISO('29/02', 2026), null);
  assert.equal(dataPartidaISO('31/12', 2026), '2026-12-31');
});
test('horários respeitam os limites de hora e minuto', () => {
  for (const invalido of ['24:00', '23:60', '99:99', '9:30', '']) assert.equal(horarioPartidaValido(invalido), false);
  for (const valido of ['00:00', '09:30', '23:59']) assert.equal(horarioPartidaValido(valido), true);
});
test('partida exige categoria e times diferentes antes de enviar', () => {
  const dados = { mandanteId: 1, visitanteId: 2, categoriaId: 9, data: '18/10', horario: '14:30' };
  assert.equal(erroFormularioPartida(dados), null);
  assert.match(erroFormularioPartida({ ...dados, visitanteId: 1 })!, /diferentes/);
  assert.match(erroFormularioPartida({ ...dados, categoriaId: null })!, /categoria/);
  assert.match(erroFormularioPartida({ ...dados, visitanteId: undefined })!, /dois times/);
});

test('troca rápida de clube: resposta antiga não substitui a atual', async () => {
  const controle = criarControleRequisicoes();
  let finalizarAntiga!: (valor: string) => void;
  const antiga = new Promise<string>(resolve => { finalizarAntiga = resolve; });
  const pedidoAntigo = controle.iniciar();
  let tela = '';
  const pendente = antiga.then(dados => { if (controle.atual(pedidoAntigo)) tela = dados; });
  const pedidoNovo = controle.iniciar();
  if (controle.atual(pedidoNovo)) tela = 'clube B';
  finalizarAntiga('clube A');
  await pendente;
  assert.equal(tela, 'clube B');
});
test('sair da tela invalida uma busca que ainda estava carregando', () => {
  const controle = criarControleRequisicoes();
  const pedido = controle.iniciar();
  controle.invalidar();
  assert.equal(controle.atual(pedido), false);
});

test('rede disponível: preserva corpo, método e cabeçalhos sem repetir POST', async t => {
  let chamadas = 0;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    chamadas++;
    assert.equal(init.method, 'POST'); assert.equal(init.body, '{"teste":1}');
    assert.equal(new Headers(init.headers).get('x-clube-id'), '7');
    return new Response('{}', { status: 201 });
  });
  const res = await fetchComTimeout('https://api.invalid/partidas', { method: 'POST', body: '{"teste":1}', headers: { 'x-clube-id': '7' } });
  assert.equal(res.status, 201); assert.equal(chamadas, 1);
});
test('rede indisponível: devolve mensagem útil e não repete a operação', async t => {
  let chamadas = 0;
  t.mock.method(globalThis, 'fetch', async () => { chamadas++; throw new TypeError('Network request failed'); });
  await assert.rejects(fetchComTimeout('https://api.invalid'), /conectar ao servidor/);
  assert.equal(chamadas, 1);
});
test('timeout: interrompe uma conexão pendurada', async t => {
  let sinal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    sinal = options.signal!;
    sinal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  await assert.rejects(fetchComTimeout('https://api.invalid', {}, 15), /demorou demais/);
  assert.equal(sinal?.aborted, true);
});
test('cancelamento explícito não é apresentado como falta de internet', async t => {
  const controller = new AbortController();
  const erro = new Error('cancelado');
  t.mock.method(globalThis, 'fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(erro), { once: true });
  }));
  const resposta = fetchComTimeout('https://api.invalid', { signal: controller.signal });
  controller.abort();
  await assert.rejects(resposta, error => error === erro);
});
test('401 continua disponível para o fluxo de autenticação', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"Token inválido"}', { status: 401 }));
  assert.equal((await fetchComTimeout('https://api.invalid')).status, 401);
});

const agora = new Date(2026, 9, 18, 12);
function partida(id: number, extras = {}) {
  return { id, data: '2026-10-18', horario: '14:00', status: 'AGENDADA', emCasa: true, gols_mandante: 0, gols_visitante: 0, ...extras };
}
test('Home prioriza ao vivo e desconsidera canceladas e agendadas antigas', () => {
  const resumo = resumirPartidas([partida(1, { data: '2026-10-17' }), partida(2, { status: 'CANCELADA' }), partida(3), partida(4, { status: 'AO_VIVO' })], agora);
  assert.equal(resumo.proximoJogo?.id, 4);
});
test('próximo jogo respeita horário quando há duas partidas no mesmo dia', () => {
  assert.equal(resumirPartidas([partida(1, { horario: '18:00' }), partida(2, { horario: '13:00' })], agora).proximoJogo?.id, 2);
});
test('pontuação é calculada pela perspectiva do clube em casa ou fora', () => {
  const resumo = resumirPartidas([
    partida(1, { status: 'FINALIZADA', gols_mandante: 3, gols_visitante: 1 }),
    partida(2, { status: 'FINALIZADA', emCasa: false, gols_mandante: 0, gols_visitante: 2 }),
    partida(3, { status: 'FINALIZADA', gols_mandante: 1, gols_visitante: 1 }),
    partida(4, { status: 'FINALIZADA', gols_mandante: 0, gols_visitante: 1 }),
    partida(5, { status: 'AO_VIVO', gols_mandante: 5 }),
  ], agora);
  assert.deepEqual(resumo.estatisticas, { pontos: 7, vitorias: 2 });
  assert.equal(resumo.historico.length, 4);
});
test('histórico limita a cinco jogos sem modificar a lista original', () => {
  const lista = Array.from({ length: 9 }, (_, id) => partida(id, { status: 'FINALIZADA', data: `2026-10-${String(id + 1).padStart(2, '0')}` }));
  const antes = JSON.stringify(lista);
  const resumo = resumirPartidas(lista, agora);
  assert.deepEqual(resumo.historico.map(p => p.id), [8, 7, 6, 5, 4]);
  assert.equal(JSON.stringify(lista), antes);
});
test('clube sem partidas mantém um estado vazio coerente', () => {
  assert.deepEqual(resumirPartidas([], agora), { proximoJogo: null, historico: [], estatisticas: { pontos: 0, vitorias: 0 } });
});
