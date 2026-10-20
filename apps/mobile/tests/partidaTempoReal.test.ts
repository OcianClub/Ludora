import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarSincronizador } from '../src/utils/sincronizador';
import { alterarGol } from '../src/utils/placarPartida';

function adiar<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

test('calcula gols em casa e fora sem alterar o placar anterior e rejeita limites', () => {
  const placar = { gols_mandante: 2, gols_visitante: 1 };
  assert.deepEqual(alterarGol(placar, 'mandante', 1), {
    anterior: placar,
    novo: { gols_mandante: 3, gols_visitante: 1 },
  });
  assert.deepEqual(alterarGol(placar, 'visitante', -1).novo, {
    gols_mandante: 2,
    gols_visitante: 0,
  });
  assert.deepEqual(placar, { gols_mandante: 2, gols_visitante: 1 });
  assert.throws(() =>
    alterarGol({ gols_mandante: 99, gols_visitante: 0 }, 'mandante', 1)
  );
  assert.throws(() =>
    alterarGol({ gols_mandante: 0, gols_visitante: 0 }, 'visitante', -1)
  );
});

test('rajadas de eventos agrupam a leitura e descartam uma resposta que ficou antiga', async () => {
  const primeira = adiar<number>();
  const segunda = adiar<number>();
  let leituras = 0;
  const aplicados: number[] = [];
  const estados: string[] = [];
  const controle = criarSincronizador(
    () => (++leituras === 1 ? primeira.promessa : segunda.promessa),
    (dados) => aplicados.push(dados),
    (estado) => estados.push(estado)
  );
  const atualizacao = controle.atualizar();
  assert.equal(controle.atualizar(), atualizacao);
  assert.equal(controle.atualizar(), atualizacao);
  assert.equal(leituras, 1);
  primeira.resolver(1);
  await Promise.resolve();
  assert.equal(leituras, 2);
  assert.deepEqual(aplicados, []);
  segunda.resolver(2);
  assert.equal(await atualizacao, true);
  assert.deepEqual(aplicados, [2]);
  assert.equal(estados.at(-1), 'atualizado');
});

test('erro preserva dados anteriores e permite atualizar novamente sem repetir escrita', async () => {
  let falhar = true;
  let dados = 3;
  const estados: string[] = [];
  const controle = criarSincronizador(
    async () => {
      if (falhar) throw new Error('Sem rede');
      return 4;
    },
    (valor) => {
      dados = valor;
    },
    (estado) => estados.push(estado)
  );
  assert.equal(await controle.atualizar(), false);
  assert.equal(dados, 3);
  assert.equal(estados.at(-1), 'erro');
  falhar = false;
  assert.equal(await controle.atualizar(), true);
  assert.equal(dados, 4);
});

test('sair da tela invalida a resposta e não atualiza o próximo clube', async () => {
  const pedido = adiar<number>();
  const aplicados: number[] = [];
  const estados: string[] = [];
  const controle = criarSincronizador(
    () => pedido.promessa,
    (dados) => aplicados.push(dados),
    (estado) => estados.push(estado)
  );
  const resultado = controle.atualizar();
  controle.encerrar();
  pedido.resolver(9);
  assert.equal(await resultado, false);
  assert.deepEqual(aplicados, []);
  assert.deepEqual(estados, ['carregando']);
  assert.equal(await controle.atualizar(), false);
});
