import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { criarCatalogoScout } from '../src/utils/catalogoScout';
import { filtrarJogadoresScout } from '../src/utils/filtrosScout';
import { gerarJogadoresScout } from './scout.fixture';

const jogadores = gerarJogadoresScout(1600);
const categorias = [...new Set(jogadores.map((j) => j.categoria))];
const consultas = [
  '',
  'j',
  'jo',
  'joa',
  'joao',
  'goleiro',
  'maria',
  'inexistente',
];
const catalogo = criarCatalogoScout(jogadores);

function anterior() {
  return consultas.map((busca) =>
    categorias.map((nome) => {
      const lista = jogadores.filter((j) => j.categoria === nome);
      const gols = [...lista].sort((a, b) => b.gols - a.gols)[0];
      const assistencias = [...lista].sort(
        (a, b) => b.assistencias - a.assistencias
      )[0];
      const nota = [...lista].sort((a, b) => b.nota_geral - a.nota_geral)[0];
      const contagens = ['Artilheiro', 'Armador', 'Paredão', 'Sem dados'].map(
        (perfil) => lista.filter((j) => j.perfil_ml === perfil).length
      );
      return {
        gols: gols.gols,
        assistencias: assistencias.assistencias,
        nota: Math.round(nota.nota_geral),
        contagens,
        ids: filtrarJogadoresScout(lista, busca, 'Todos', 'NOTA').map(
          (j) => j.id_jogador
        ),
      };
    })
  );
}

function otimizado() {
  return consultas.map((busca) =>
    [...catalogo.values()].map((categoria) => ({
      gols: categoria.resumo.artilheiro!.gols,
      assistencias: categoria.resumo.assistente!.assistencias,
      nota: categoria.resumo.lider!.pontos,
      contagens: [
        categoria.contagens.Artilheiro,
        categoria.contagens.Armador,
        categoria.contagens['Paredão'],
        categoria.contagens['Sem dados'],
      ],
      ids: filtrarJogadoresScout(
        categoria.jogadores,
        busca,
        'Todos',
        'NOTA'
      ).map((j) => j.id_jogador),
    }))
  );
}

assert.deepEqual(otimizado(), anterior());
anterior();
otimizado();
const tempos = { anterior: [] as number[], otimizado: [] as number[] };
for (let indice = 0; indice < 12; indice++) {
  const ordem =
    indice % 2
      ? (['anterior', 'otimizado'] as const)
      : (['otimizado', 'anterior'] as const);
  for (const nome of ordem) {
    const inicio = performance.now();
    (nome === 'anterior' ? anterior : otimizado)();
    tempos[nome].push(performance.now() - inicio);
  }
}
console.log(
  'Scout: benchmark sintético em Node, não mede FPS nem rede do Android.'
);
console.log(
  '1600 atletas, 8 categorias, 8 buscas por rodada, 12 rodadas alternadas.'
);
console.log(
  'Catálogo otimizado já preparado, como nas buscas após carregar os dados.'
);
for (const nome of ['anterior', 'otimizado'] as const) {
  const ordenados = tempos[nome].sort((a, b) => a - b);
  const mediana = (ordenados[5] + ordenados[6]) / 2;
  console.log(
    `${nome}: mediana ${mediana.toFixed(2)} ms; máximo ${ordenados.at(-1)!.toFixed(2)} ms por rodada.`
  );
}
