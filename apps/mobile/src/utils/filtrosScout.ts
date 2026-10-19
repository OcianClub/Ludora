import type { Jogador } from '../services/mlService';

export type PerfilScout = 'Todos' | 'Artilheiro' | 'Armador' | 'Paredão' | 'Sem dados';
export type OrdenacaoScout = 'NOTA' | 'GOLS' | 'ASSISTENCIAS' | 'DEFESAS';

const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function filtrarJogadoresScout(jogadores: Jogador[], busca: string, perfil: PerfilScout, ordenacao: OrdenacaoScout) {
  const termo = normalizar(busca);
  const campo = { NOTA: 'nota_geral', GOLS: 'gols', ASSISTENCIAS: 'assistencias', DEFESAS: 'defesas' } as const;
  return jogadores.filter(jogador =>
    (perfil === 'Todos' || jogador.perfil_ml === perfil) &&
    (!termo || normalizar(`${jogador.nome} ${jogador.posicao}`).includes(termo)),
  ).sort((a, b) => (b[campo[ordenacao]] ?? 0) - (a[campo[ordenacao]] ?? 0) ||
    (b.nota_geral ?? 0) - (a.nota_geral ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
}
