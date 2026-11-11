import type { PainelPaulista, SnapshotPaulista } from '../paulista';

export type EventoPublicoPaulista = Pick<SnapshotPaulista, 'id' | 'ano' | 'divisao' | 'categoria' | 'fonte' | 'equipes' | 'jogos' | 'classificacao'> & {
  equipesClube: number[];
  verificadoEm: string | null;
  fasesExcluidas?: string[];
};
export type ClubePaulistaPublico = { id: number; nome: string; escudo?: string | null };

// Adapta somente a publicação oficial para os componentes de consulta existentes.
// Não associa súmulas de gestão nem fornece pendências, auditoria ou operações.
export function painelPaulistaPublico(evento: EventoPublicoPaulista, clube: ClubePaulistaPublico): PainelPaulista {
  return {
    evento: { id: evento.id, versao: 0, consultadoEm: '', verificadoEm: evento.verificadoEm, diario: false },
    snapshot: { id: evento.id, ano: evento.ano, titulo: 'Paulista', divisao: evento.divisao, categoria: evento.categoria,
      fonte: evento.fonte, equipes: evento.equipes, jogos: evento.jogos, classificacao: evento.classificacao,
      avisos: [], fasesExcluidas: evento.fasesExcluidas || [] },
    vinculos: evento.equipesClube.filter(id => evento.equipes.some(e => e.id === id)).map(equipeId => ({
      equipeId, clubeId: clube.id, nome: clube.nome, escudo: clube.escudo,
    })),
    jogosLocais: [], pendencias: [], retroativos: [],
  };
}
