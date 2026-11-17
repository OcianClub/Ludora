import type { Categoria, Competicao, Partida, Time } from '../services/api';
import type { ContextoOrganizacao } from '../../../../packages/shared-types/src/matchOrganization';
import { teamKey } from './teamIdentity';

export function timeDisponivel(source: { id?: number; nome?: string; clube_representado_id?: number | null }, times: Time[], categoriaId: number, clubeId: number) {
  const opcoes = times.filter(t => t.categoria_id === categoriaId && !t.arquivado && t.clube_representado_id !== clubeId);
  return opcoes.find(t => t.id === source.id && (t.clube_representado_id || null) === (source.clube_representado_id || null)) || (source.clube_representado_id
    ? opcoes.find(t => t.clube_representado_id === source.clube_representado_id)
    : opcoes.filter(t => !t.clube_representado_id && teamKey(t.nome) === teamKey(source.nome || '')).filter((_, __, items) => items.length === 1)[0]);
}
export function adversariosRecentes(contexto: ContextoOrganizacao | undefined, times: Time[], categoriaId: number, clubeId: number) {
  return [...new Set((contexto?.recentes || []).flatMap(t => {
    const atual = timeDisponivel({ id: t.timeId, nome: t.nome, clube_representado_id: t.clubeId }, times, categoriaId, clubeId);
    return atual ? [atual.id] : [];
  }))].slice(0, 8);
}
export function repetirConfronto(p: Partida, times: Time[], categorias: Categoria[], competicoes: Competicao[], clubeId: number) {
  const categoria = categorias.find(c => c.id === p.categoria_id || c.id === p.categoria?.id)
    || categorias.find(c => c.clube_id === clubeId && c.tipo === p.categoria?.tipo && c.nome.toLowerCase() === p.categoria?.nome.toLowerCase());
  if (!categoria) return null;
  const proprios = times.filter(t => t.categoria_id === categoria.id && t.clube_representado_id === clubeId && !t.arquivado);
  if (proprios.length !== 1) return null;
  const own = proprios[0];
  const casa = p.mandante?.clube_representado_id === clubeId || p.mandante_id === own.id;
  const fora = p.visitante?.clube_representado_id === clubeId || p.visitante_id === own.id;
  const emCasa = casa !== fora ? casa : p.emCasa;
  const outro = emCasa ? p.visitante : p.mandante;
  const opponent = timeDisponivel(outro || { id: emCasa ? p.visitante_id : p.mandante_id }, times, categoria.id, clubeId);
  if (!opponent) return null;
  const comp = competicoes.find(c => c.id === p.competicao_id && !c.arquivada && !c.paulista_evento_id && c.tipo === categoria.tipo);
  return { categoria_id: String(categoria.id), mandante_id: String(emCasa ? own.id : opponent.id), visitante_id: String(emCasa ? opponent.id : own.id), emCasa: String(emCasa),
    data: '', horario: /^([01]\d|2[0-3]):[0-5]\d$/.test(p.horario || '') ? p.horario! : '', local: p.local || '', competicao_id: comp ? String(comp.id) : 'amistoso', rodada: '' };
}
export function atalhosDataPartida(dia: string) {
  const base = new Date(`${dia}T12:00:00Z`);
  if (!Number.isFinite(base.getTime())) return [];
  return [{ label: 'Hoje', dias: 0 }, { label: 'Amanhã', dias: 1 }, { label: 'Próximo sábado', dias: (6 - base.getUTCDay() + 7) % 7 || 7 }].map(item => {
    const date = new Date(base); date.setUTCDate(date.getUTCDate() + item.dias);
    const value = date.toISOString().slice(0, 10);
    return { label: item.label, value, dateLabel: `${value.slice(8)}/${value.slice(5, 7)}` };
  });
}
