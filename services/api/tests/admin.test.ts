import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BufferLogs,
  ehSuperAdmin,
  limparCaminho,
  nivelPorStatus,
  parseSuperAdmins,
  tipoCategoriaPorIdade,
  validarClube,
  validarLimite,
} from '../src/modules/admin/admin.rules';

test('allowlist de super admin ignora lixo, espaços e caixa; vazia não libera ninguém', () => {
  const lista = parseSuperAdmins(' Dev@Ludora.com ,, invalido, outro@ludora.com ');
  assert.deepEqual([...lista].sort(), ['dev@ludora.com', 'outro@ludora.com']);
  assert.equal(ehSuperAdmin('DEV@ludora.com', lista), true);
  assert.equal(ehSuperAdmin('intruso@ludora.com', lista), false);
  assert.equal(ehSuperAdmin(null, lista), false);
  assert.equal(ehSuperAdmin('dev@ludora.com', parseSuperAdmins(undefined)), false);
  assert.equal(ehSuperAdmin('dev@ludora.com', parseSuperAdmins('')), false);
});

test('validarClube: criação exige nome; estado vira UF maiúscula; plano e escudo são restritos', () => {
  assert.throws(() => validarClube({}, { criando: true }), /Nome/);
  assert.throws(() => validarClube({ nome: 'A' }, { criando: true }), /Nome/);
  assert.deepEqual(
    validarClube({ nome: ' Ocian ', estado: 'sp', plano: 'TRIAL' }, { criando: true }),
    { nome: 'Ocian', estado: 'SP', plano: 'TRIAL' }
  );
  assert.throws(() => validarClube({ nome: 'Ocian', plano: 'GRATIS' }, { criando: true }), /Plano/);
  assert.throws(() => validarClube({ nome: 'Ocian', estado: 'São Paulo' }, { criando: true }), /Estado/);
  assert.throws(() => validarClube({ nome: 'Ocian', escudo: 'http://x.test/a.png' }, { criando: true }), /https/);
  assert.throws(() => validarClube({ nome: 'Ocian', escudo: 'javascript:alert(1)' }, { criando: true }), /https/);
  assert.equal(validarClube({ escudo: 'https://x.test/a.png' }, { criando: false }).escudo, 'https://x.test/a.png');
});

test('validarClube: PATCH parcial só devolve o que foi enviado e permite limpar campos', () => {
  assert.deepEqual(validarClube({ plano: 'PRO' }, { criando: false }), { plano: 'PRO' });
  assert.deepEqual(validarClube({ cidade: '' }, { criando: false }), { cidade: null });
  assert.deepEqual(validarClube({}, { criando: false }), {});
});

test('categoria padrão: até sub-10 é iniciação, acima é base (igual ao seed)', () => {
  assert.equal(tipoCategoriaPorIdade(7), 'INICIACAO');
  assert.equal(tipoCategoriaPorIdade(10), 'INICIACAO');
  assert.equal(tipoCategoriaPorIdade(12), 'BASE');
  assert.equal(tipoCategoriaPorIdade(18), 'BASE');
});

test('validarLimite respeita padrão e teto', () => {
  assert.equal(validarLimite(undefined, 50, 200), 50);
  assert.equal(validarLimite('abc', 50, 200), 50);
  assert.equal(validarLimite(-3, 50, 200), 50);
  assert.equal(validarLimite(9999, 50, 200), 200);
  assert.equal(validarLimite('25', 50, 200), 25);
});

test('logs HTTP removem query string e mascaram segmentos que parecem credenciais', () => {
  assert.equal(limparCaminho('/admin/usuarios?busca=ana@x.com&limite=5'), '/admin/usuarios');
  assert.equal(limparCaminho('/partidas/42?x=1#frag'), '/partidas/42');
  assert.equal(limparCaminho('/convites/aB3dE5gH7jK9mN2pQ4rS'), '/convites/:token');
  assert.equal(limparCaminho('/clubes/12/membros'), '/clubes/12/membros');
  assert.ok(limparCaminho('/' + 'a'.repeat(500)).length <= 200);
});

test('nivelPorStatus', () => {
  assert.equal(nivelPorStatus(200), 'info');
  assert.equal(nivelPorStatus(404), 'warn');
  assert.equal(nivelPorStatus(500), 'error');
});

test('buffer circular descarta os mais antigos, filtra por nível e notifica assinantes', () => {
  const buffer = new BufferLogs(3);
  const recebidos: number[] = [];
  const parar = buffer.assinar(e => recebidos.push(e.id));

  buffer.registrar({ nivel: 'info', tipo: 'http', mensagem: 'a' });
  buffer.registrar({ nivel: 'warn', tipo: 'http', mensagem: 'b' });
  buffer.registrar({ nivel: 'error', tipo: 'http', mensagem: 'c' });
  buffer.registrar({ nivel: 'info', tipo: 'http', mensagem: 'd' });

  assert.equal(buffer.tamanho, 3);
  assert.deepEqual(buffer.snapshot().map(e => e.mensagem), ['b', 'c', 'd']);
  assert.deepEqual(buffer.snapshot(10, 'warn').map(e => e.mensagem), ['b', 'c']);
  assert.deepEqual(buffer.snapshot(10, 'error').map(e => e.mensagem), ['c']);
  assert.deepEqual(buffer.snapshot(1).map(e => e.mensagem), ['d']);
  assert.deepEqual(recebidos, [1, 2, 3, 4]);

  parar();
  buffer.registrar({ nivel: 'info', tipo: 'http', mensagem: 'e' });
  assert.deepEqual(recebidos, [1, 2, 3, 4]);
});
