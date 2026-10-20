import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  montarResumoPosPartida,
  textoCompartilhamentoPartida,
  type EventoResumo,
  type PartidaResumo,
} from '../src/utils/resumoPosPartida';

const partida: PartidaResumo = {
  id: 10,
  status: 'FINALIZADA',
  emCasa: true,
  mandante: { nome: 'Ludora' },
  visitante: { nome: 'Visitante' },
  gols_mandante: 2,
  gols_visitante: 1,
  data: '2026-10-20T00:00:00Z',
  categoria: { nome: 'sub-10' },
  competicao: { nome: 'Copa Teste' },
};
const eventos: EventoResumo[] = [
  { id: 1, tipo: 'GOL', jogador_id: 4, jogador: { id: 4, nome: 'Atleta A' } },
  { id: 2, tipo: 'GOL', jogador_id: 5, jogador: { id: 5, nome: 'Atleta B' } },
  {
    id: 3,
    tipo: 'DEFESA',
    jogador_id: 6,
    jogador: { id: 6, nome: 'Atleta C' },
  },
  {
    id: 4,
    tipo: 'ASSISTENCIA',
    jogador_id: 4,
    jogador: { id: 4, nome: 'Atleta A' },
  },
];

test('resultado respeita o clube em casa ou fora e o dia não muda com fuso horário', () => {
  assert.equal(montarResumoPosPartida(partida, eventos)?.resultado, 'Vitória');
  const fora = montarResumoPosPartida({ ...partida, emCasa: false }, []);
  assert.equal(fora?.resultado, 'Derrota');
  assert.equal(fora?.clube, 'Visitante');
  assert.equal(fora?.golsClube, 1);
  assert.equal(fora?.data, '20/10/2026');
  assert.equal(
    montarResumoPosPartida({ ...partida, gols_visitante: 2 }, [])?.resultado,
    'Empate'
  );
});

test('somente partidas encerradas geram resumo ou compartilhamento', () => {
  for (const status of ['AO_VIVO', 'AGENDADA', 'PREPARADA', 'CANCELADA']) {
    assert.equal(montarResumoPosPartida({ ...partida, status }, eventos), null);
    assert.equal(
      textoCompartilhamentoPartida({ ...partida, status }, eventos),
      null
    );
  }
});

test('destaques preservam todos os empates e não alteram eventos de origem', () => {
  const copia = structuredClone(eventos);
  const resumo = montarResumoPosPartida(partida, eventos)!;
  assert.deepEqual(
    resumo.metricas[0].lideres.map((atleta) => atleta.id),
    [4, 5]
  );
  assert.equal(resumo.metricas[0].maior, 1);
  assert.equal(resumo.metricas[2].total, 1);
  assert.equal(resumo.golsConferem, true);
  assert.deepEqual(eventos, copia);
});

test('eventos duplicados e explicitamente adversários não inflam o resumo', () => {
  const resumo = montarResumoPosPartida(partida, [
    ...eventos,
    eventos[0],
    { id: 15, tipo: 'GOL', doOcian: false },
  ])!;
  assert.equal(resumo.metricas[0].total, 2);
});

test('placar sem eventos não inventa autores; gols sem jogador contam sem atribuição', () => {
  const vazio = montarResumoPosPartida(partida, [])!;
  assert.equal(vazio.temEventos, false);
  assert.equal(vazio.golsConferem, false);
  assert.deepEqual(vazio.metricas[0].lideres, []);
  const semAutoria = montarResumoPosPartida(partida, [
    { id: 1, tipo: 'GOL' },
    eventos[1],
  ])!;
  assert.equal(semAutoria.golsConferem, true);
  assert.deepEqual(
    semAutoria.metricas[0].lideres.map((atleta) => atleta.id),
    [5]
  );
});

test('texto padrão não divulga nomes ou identificadores de atletas', () => {
  const texto = textoCompartilhamentoPartida(partida, eventos)!;
  assert.match(texto, /Ludora 2 × 1 Visitante/);
  assert.match(texto, /sub-10/);
  assert.doesNotMatch(texto, /Atleta A|Atleta B|Atleta C|jogador_id/);
  const completo = textoCompartilhamentoPartida(partida, eventos, true)!;
  assert.match(completo, /Atleta A \(1\), Atleta B \(1\)/);
  assert.match(completo, /Defesas em destaque: Atleta C \(1\)/);
});

test('divergência entre eventos e placar não é compartilhada como autoria confirmada', () => {
  const texto = textoCompartilhamentoPartida(
    { ...partida, gols_mandante: 4 },
    eventos,
    true
  )!;
  assert.match(texto, /Ludora 4 × 1 Visitante/);
  assert.doesNotMatch(texto, /Gols em destaque/);
  assert.match(texto, /Assistências em destaque/);
});
