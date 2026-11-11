import type { ClubeListado } from '../services/api';

export type PartidaDescoberta = {
  id: number;
  data: string;
  horario: string | null;
  categoria: string;
  clube_ids: number[];
  gols_mandante: number;
  gols_visitante: number;
  mandante: { nome: string; escudo?: string | null };
  visitante: { nome: string; escudo?: string | null };
};

export function limitesCarrossel(largura: number, conteudo: number, offset: number) {
  const excede = largura > 0 && conteudo > largura + 2;
  return {
    anterior: excede && offset > 2,
    proximo: excede && offset + largura < conteudo - 2,
  };
}

export function clubeParaPartida(jogo: PartidaDescoberta, clubes: ClubeListado[], atualId?: number) {
  const participantes = clubes.filter(c => c.ativo !== false && jogo.clube_ids.includes(c.id));
  const gestor = (c: ClubeListado) => ['ADMIN', 'TECNICO', 'MESARIO'].includes(c.papel || '');
  return participantes.find(c => c.id === atualId && gestor(c))
    || participantes.find(gestor)
    || participantes.find(c => c.id === atualId)
    || participantes[0];
}

export function partidasDisponiveis(jogos: PartidaDescoberta[], clubes?: ClubeListado[]) {
  if (!clubes) return jogos;
  const ativos = new Set(clubes.filter(c => c.ativo !== false).map(c => c.id));
  const favoritos = new Set(clubes.filter(c => c.papel || c.isSeguindo).map(c => c.id));
  return jogos.filter(j => j.clube_ids.some(id => ativos.has(id)))
    .sort((a, b) => Number(b.clube_ids.some(id => favoritos.has(id))) - Number(a.clube_ids.some(id => favoritos.has(id))));
}

export function nomeEquipeDescoberta(nome: string) {
  return nome.normalize('NFKC').replace(/(?:\s+[-–—·]?\s*|\s*\()sub[\s-]*\d{1,2}\)?\s*$/i, '').trim().replace(/\s+/g, ' ');
}

export function dataPartidaDescoberta(data: string, horario: string | null) {
  // Data de calendário: converter meia-noite UTC mudaria o dia no Brasil.
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!partes) return horario || 'Data a confirmar';
  const mes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(partes[2]) - 1];
  if (!mes) return horario || 'Data a confirmar';
  return `${Number(partes[3])} de ${mes}${horario ? ` · ${horario}` : ''}`;
}
