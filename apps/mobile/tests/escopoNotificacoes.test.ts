import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  criarEscopoNotificacoes,
  headersClubeNotificacoes,
} from '../src/utils/escopoNotificacoes';

test('requisição de avisos leva um clube explícito e recusa contexto inválido', () => {
  assert.deepEqual(headersClubeNotificacoes(7), { 'x-clube-id': '7' });
  for (const id of [0, -1, NaN, Infinity, 1.5])
    assert.throws(() => headersClubeNotificacoes(id));
});

test('toques repetidos não iniciam duas mutações concorrentes', () => {
  const escopo = criarEscopoNotificacoes();
  assert.equal(escopo.iniciar(), null);
  escopo.definirClube(2);
  const primeira = escopo.iniciar()!;
  assert.equal(primeira.clubeId, 2);
  assert.equal(escopo.iniciar(), null);
  assert.equal(primeira.concluir(), true);
  assert.ok(escopo.iniciar());
});

test('concluir duas vezes não desbloqueia outra operação do mesmo clube', () => {
  const escopo = criarEscopoNotificacoes();
  escopo.definirClube(2);
  const antiga = escopo.iniciar()!;
  assert.equal(antiga.concluir(), true);
  const nova = escopo.iniciar()!;
  assert.equal(antiga.concluir(), false);
  assert.equal(escopo.iniciar(), null);
  assert.equal(nova.concluir(), true);
});

test('resposta antiga não atualiza clube novo nem libera sua operação pendente', () => {
  const escopo = criarEscopoNotificacoes();
  escopo.definirClube(2);
  const antiga = escopo.iniciar()!;
  escopo.definirClube(3);
  const nova = escopo.iniciar()!;
  assert.equal(antiga.atual(), false);
  assert.equal(antiga.concluir(), false);
  assert.equal(escopo.iniciar(), null);
  assert.equal(nova.atual(), true);
  assert.equal(nova.concluir(), true);
});

test('confirmação antiga continua inválida mesmo ao voltar para o mesmo clube', () => {
  const escopo = criarEscopoNotificacoes();
  escopo.definirClube(2);
  const confirmacao = escopo.capturar();
  escopo.definirClube(3);
  escopo.definirClube(2);
  assert.equal(confirmacao.atual(), false);
  assert.equal(escopo.capturar().atual(), true);
});

test('sair da conta ou da tela invalida qualquer conclusão pendente', () => {
  const escopo = criarEscopoNotificacoes();
  escopo.definirClube(2);
  const operacao = escopo.iniciar()!;
  escopo.definirClube(null);
  assert.equal(operacao.atual(), false);
  assert.equal(operacao.concluir(), false);
  assert.equal(escopo.iniciar(), null);
});
