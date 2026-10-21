import type { PartidaHome } from '../components/HomeCategoria';
import type { Jogador, ScoresMl } from '../services/mlService';

const inteiro = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isSafeInteger(valor);
const numero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);
const textoOuNull = (valor: unknown) =>
  typeof valor === 'string' ? valor : null;

function time(valor: any) {
  if (!valor || !inteiro(valor.id) || typeof valor.nome !== 'string')
    return null;
  return { id: valor.id, nome: valor.nome, escudo: textoOuNull(valor.escudo) };
}

export function selecionarPartidasLocais(valor: unknown): PartidaHome[] | null {
  if (!Array.isArray(valor) || valor.length > 5000) return null;
  const partidas: PartidaHome[] = [];
  for (const partida of valor) {
    if (
      !partida ||
      !inteiro(partida.id) ||
      !numero(partida.gols_mandante) ||
      !numero(partida.gols_visitante) ||
      typeof partida.data !== 'string' ||
      typeof partida.emCasa !== 'boolean' ||
      !['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(
        partida.status
      )
    )
      return null;
    const mandante = time(partida.mandante);
    const visitante = time(partida.visitante);
    if (!mandante || !visitante) return null;
    const categoria = partida.categoria;
    const competicao = partida.competicao;
    partidas.push({
      id: partida.id,
      ...(inteiro(partida.clube_origem_id) && partida.clube_origem_id > 0
        ? { clube_origem_id: partida.clube_origem_id }
        : {}),
      ...(typeof partida.somente_leitura === 'boolean'
        ? { somente_leitura: partida.somente_leitura }
        : {}),
      mandante,
      visitante,
      gols_mandante: partida.gols_mandante,
      gols_visitante: partida.gols_visitante,
      data: partida.data,
      horario: textoOuNull(partida.horario),
      local: textoOuNull(partida.local),
      status: partida.status,
      emCasa: partida.emCasa,
      categoria:
        categoria && inteiro(categoria.id) && typeof categoria.nome === 'string'
          ? { id: categoria.id, nome: categoria.nome }
          : null,
      competicao:
        competicao &&
        inteiro(competicao.id) &&
        typeof competicao.nome === 'string'
          ? {
              id: competicao.id,
              nome: competicao.nome,
              ano: inteiro(competicao.ano) ? competicao.ano : 0,
            }
          : null,
    });
  }
  return partidas;
}

export function selecionarJogadoresLocais(valor: unknown): Jogador[] | null {
  if (!Array.isArray(valor) || valor.length > 5000) return null;
  const jogadores: Jogador[] = [];
  for (const jogador of valor) {
    if (
      !jogador ||
      !inteiro(jogador.id_jogador) ||
      !inteiro(jogador.categoria_id) ||
      typeof jogador.nome !== 'string' ||
      typeof jogador.posicao !== 'string' ||
      typeof jogador.categoria !== 'string' ||
      !['BASE', 'INICIACAO'].includes(jogador.categoria_tipo)
    )
      return null;
    const estatistica = (campo: string) =>
      numero(jogador[campo]) ? jogador[campo] : 0;
    const scores: ScoresMl | null = jogador.scores_ml
      ? {
          finalizacao: numero(jogador.scores_ml.finalizacao)
            ? jogador.scores_ml.finalizacao
            : 0,
          visao_de_jogo: numero(jogador.scores_ml.visao_de_jogo)
            ? jogador.scores_ml.visao_de_jogo
            : 0,
          defesa: numero(jogador.scores_ml.defesa)
            ? jogador.scores_ml.defesa
            : 0,
          disciplina: numero(jogador.scores_ml.disciplina)
            ? jogador.scores_ml.disciplina
            : 0,
          intensidade: numero(jogador.scores_ml.intensidade)
            ? jogador.scores_ml.intensidade
            : 0,
          tecnica: numero(jogador.scores_ml.tecnica)
            ? jogador.scores_ml.tecnica
            : 0,
        }
      : null;
    jogadores.push({
      id_jogador: jogador.id_jogador,
      nome: jogador.nome,
      posicao: jogador.posicao,
      numCamisa: inteiro(jogador.numCamisa) ? jogador.numCamisa : null,
      idade: estatistica('idade'),
      perfil_ml:
        typeof jogador.perfil_ml === 'string' ? jogador.perfil_ml : 'Sem dados',
      scores_ml: scores,
      nota_geral: estatistica('nota_geral'),
      categoria: jogador.categoria,
      categoria_tipo: jogador.categoria_tipo,
      categoria_id: jogador.categoria_id,
      time: typeof jogador.time === 'string' ? jogador.time : 'Clube',
      jogos_disputados: estatistica('jogos_disputados'),
      gols: estatistica('gols'),
      assistencias: estatistica('assistencias'),
      defesas: estatistica('defesas'),
      cartoes_amarelos: estatistica('cartoes_amarelos'),
      cartoes_vermelhos: estatistica('cartoes_vermelhos'),
      faltas_cometidas: estatistica('faltas_cometidas'),
    });
  }
  return jogadores;
}
