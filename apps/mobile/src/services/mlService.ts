import { BASE_URL } from './api';

export interface ScoresMl {
  finalizacao:   number;
  visao_de_jogo: number;
  defesa:        number;
  disciplina:    number;
  intensidade:   number;
  tecnica:       number;
}

export interface Jogador {
  id_jogador:        number;
  nome:              string;
  posicao:           string;
  numCamisa:         number | null;
  dtNasc:            string;
  perfil_ml:         string;
  scores_ml:         ScoresMl | null;
  nota_geral:        number;
  categoria:         string;
  categoria_tipo:    'INICIACAO' | 'BASE';
  categoria_id:      number;
  time:              string;
  jogos_disputados:  number;
  gols:              number;
  assistencias:      number;
  defesas:           number;
  cartoes_amarelos:  number;
  cartoes_vermelhos: number;
  faltas_cometidas:  number;
}

export interface ResumoCategoria {
  artilheiro: { nome: string; gols: number } | null;
  assistente: { nome: string; assistencias: number; colocacao: number } | null;
  lider:      { nome: string; pontos: number } | null;
}

export const obterPerfisJogadores = async (categoria_id?: number): Promise<Jogador[]> => {
  const query = categoria_id ? `?categoria_id=${categoria_id}` : '';
  const resposta = await fetch(`${BASE_URL}/jogadores/perfis${query}`);
  if (!resposta.ok) throw new Error(`Erro no servidor: ${resposta.status}`);
  const dados: Jogador[] = await resposta.json();

  return dados.map(j => ({
    ...j,
    scores_ml: j.scores_ml ? {
      finalizacao:   j.scores_ml.finalizacao   ?? 0,
      visao_de_jogo: j.scores_ml.visao_de_jogo ?? 0,
      defesa:        j.scores_ml.defesa        ?? 0,
      disciplina:    j.scores_ml.disciplina    ?? 0,
      intensidade:   j.scores_ml.intensidade   ?? 0,
      tecnica:       j.scores_ml.tecnica       ?? 0,
    } : null,
  }));
};

export const reprocessarScout = async (): Promise<void> => {
  const resposta = await fetch(`${BASE_URL}/admin/reprocessar-scout`, { method: 'POST' });
  if (!resposta.ok) throw new Error('Erro ao reprocessar Scout IA');
};

export function calcularResumo(jogadores: Jogador[]): ResumoCategoria {
  if (!jogadores.length) return { artilheiro: null, assistente: null, lider: null };

  const porGols   = [...jogadores].sort((a, b) => b.gols - a.gols);
  const porAssist = [...jogadores].sort((a, b) => b.assistencias - a.assistencias);
  const porNota   = [...jogadores].sort((a, b) => b.nota_geral - a.nota_geral);

  const assistente  = porAssist[0];
  const colocacao   = porAssist.findIndex(j => j.id_jogador === assistente.id_jogador) + 1;

  return {
    artilheiro: { nome: porGols[0].nome,    gols:        porGols[0].gols },
    assistente: { nome: assistente.nome,    assistencias: assistente.assistencias, colocacao },
    lider:      { nome: porNota[0].nome,    pontos:       Math.round(porNota[0].nota_geral) },
  };
}