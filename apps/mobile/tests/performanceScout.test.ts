import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  criarCatalogoScout,
  chaveCategoriaScout,
} from '../src/utils/catalogoScout';
import { calcularResumo } from '../src/utils/resumoScout';
import { filtrarJogadoresScout } from '../src/utils/filtrosScout';
import { gerarJogadoresScout } from './scout.fixture';

test('resumo linear mantém resultados e desempates do cálculo anterior sem ordenar a origem', () => {
  const jogadores = gerarJogadoresScout(1600);
  const original = jogadores.map((j) => j.id_jogador);
  const artilheiro = [...jogadores].sort((a, b) => b.gols - a.gols)[0];
  const assistente = [...jogadores].sort(
    (a, b) => b.assistencias - a.assistencias
  )[0];
  const lider = [...jogadores].sort((a, b) => b.nota_geral - a.nota_geral)[0];
  assert.deepEqual(calcularResumo(jogadores), {
    artilheiro: { nome: artilheiro.nome, gols: artilheiro.gols },
    assistente: {
      nome: assistente.nome,
      assistencias: assistente.assistencias,
      colocacao: 1,
    },
    lider: { nome: lider.nome, pontos: Math.round(lider.nota_geral) },
  });
  assert.deepEqual(
    jogadores.map((j) => j.id_jogador),
    original
  );
  assert.deepEqual(calcularResumo([]), {
    artilheiro: null,
    assistente: null,
    lider: null,
  });
});

test('catálogo agrupa uma vez e mantém perfis, resumos e filtros equivalentes por categoria', () => {
  const jogadores = gerarJogadoresScout(1600);
  const catalogo = criarCatalogoScout(jogadores);
  assert.equal(catalogo.size, 8);
  let total = 0;
  for (const categoria of catalogo.values()) {
    const primeiro = categoria.jogadores[0];
    const antigos = jogadores.filter(
      (j) =>
        j.categoria_tipo === primeiro.categoria_tipo &&
        j.categoria === primeiro.categoria
    );
    assert.deepEqual(categoria.jogadores, antigos);
    assert.deepEqual(categoria.resumo, calcularResumo(antigos));
    for (const perfil of [
      'Artilheiro',
      'Armador',
      'Paredão',
      'Sem dados',
    ] as const) {
      assert.equal(
        categoria.contagens[perfil],
        antigos.filter((j) => j.perfil_ml === perfil).length
      );
    }
    assert.equal(categoria.contagens.Todos, antigos.length);
    for (const busca of ['', 'João', 'goleiro', 'inexistente']) {
      assert.deepEqual(
        filtrarJogadoresScout(categoria.jogadores, busca, 'Todos', 'GOLS'),
        filtrarJogadoresScout(antigos, busca, 'Todos', 'GOLS')
      );
    }
    total += categoria.jogadores.length;
  }
  assert.equal(total, jogadores.length);
});

test('catálogo não mistura tipos, não reaproveita jogadores de outro clube e não muda os objetos de origem', () => {
  const jogador = gerarJogadoresScout(1)[0];
  const outroTipo = {
    ...jogador,
    id_jogador: 2,
    categoria_tipo: 'BASE' as const,
  };
  const catalogo = criarCatalogoScout([Object.freeze(jogador), outroTipo]);
  assert.equal(catalogo.size, 2);
  assert.equal(
    catalogo.get(chaveCategoriaScout('INICIACAO', ' sub 7 '))?.jogadores[0],
    jogador
  );
  assert.equal(
    catalogo.get(chaveCategoriaScout('BASE', 'SUB-7'))?.jogadores[0],
    outroTipo
  );
  assert.equal(criarCatalogoScout([]).size, 0);
});
