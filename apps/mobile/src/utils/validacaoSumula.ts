import type { EquipePartida, EventoPartida, GestaoPartida } from '../services/partidasCompartilhadas';
import { timeAutor } from './sumulaPartida';
export function ultimoPeriodoIniciado(data: GestaoPartida) {
  return Math.max(1, data.partida.periodo_atual,
    ...data.eventos.map(e => e.periodo),
    ...(data.auditoria || []).filter(a => a.acao === 'PERIODO_ALTERADO').map(a => Number(a.dados?.periodo) || 1));
}
export function validarLance(data: GestaoPartida, form: { tipo: string; timeId: number; jogadorId?: number; contra: boolean; assistenteId?: number; minuto?: string; existente?: EventoPartida }, depois = false) {
  const ator = timeAutor(data, { time_id: form.timeId, gol_contra: form.contra });
  const equipe = data.equipes.find(e => e.time_id === ator);
  const aoVivo = data.partida.status === 'AO_VIVO';
  if (form.minuto && (!/^\d{1,3}$/.test(form.minuto) || Number(form.minuto) > 200)) return 'Informe um minuto de 0 a 200.';
  if (form.contra && form.tipo !== 'GOL') return 'Gol contra só é válido para gols.';
  const jogador = equipe?.escalacao.find(j => j.jogador_id === form.jogadorId);
  if (!depois && form.jogadorId && (!jogador || !equipe?.publicada_em || (aoVivo && !form.existente && (!jogador.titular || jogador.expulso)))) return 'O jogador não está mais elegível. Confira a escalação atual.';
  if (!depois && equipe && !form.jogadorId) return 'Selecione o jogador ou escolha identificar depois.';
  if (!depois && form.assistenteId) {
    const assistente = equipe?.escalacao.find(j => j.jogador_id === form.assistenteId);
    if (form.tipo !== 'GOL' || form.contra || !form.jogadorId || form.assistenteId === form.jogadorId || !assistente || (aoVivo && (!assistente.titular || assistente.expulso))) return 'A assistência deve ser de outro jogador em campo da equipe que marcou.';
  }
  return '';
}
export function ultimoLance(data: GestaoPartida) {
  const ultimo = [...data.eventos].sort((a, b) => b.id - a.id)[0];
  const gol = ultimo?.tipo === 'ASSISTENCIA' ? data.auditoria?.find(a => a.acao === 'EVENTO_REGISTRADO' && a.dados?.assistencia_evento_id === ultimo.id)?.dados?.evento_id : undefined;
  return data.eventos.find(e => e.id === gol) || ultimo;
}
export function placarDoPeriodo(data: GestaoPartida, periodo: number) {
  return [data.partida.mandante_id, data.partida.visitante_id].map(id => data.eventos.filter(e => e.tipo === 'GOL' && e.periodo === periodo && e.time_id === id).length);
}
export function trocaValida(equipe: EquipePartida | undefined, sai?: number, entra?: number) {
  if (!equipe?.publicada_em || !sai || !entra || sai === entra) return false;
  const fora = equipe.escalacao.find(j => j.jogador_id === sai && (j.titular || j.reposicao_pendente)), dentro = equipe.escalacao.find(j => j.jogador_id === entra && !j.titular && !j.expulso);
  if (!fora || !dentro || !fora.numCamisa || !dentro.numCamisa) return false;
  if (fora.expulso) return !!fora.reposicao_pendente;
  // Preserve the existing goalkeeper slots, including a keeper playing outfield
  // after a red-card replacement. The API uses the same position check.
  return (fora.jogador?.posicao === 'Goleiro') === (dentro.jogador?.posicao === 'Goleiro');
}
