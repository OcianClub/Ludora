import type { PainelPaulista } from '@ludora/shared-types/src/paulista';
import { ClubBadge } from '@web/components/Brand';

const campos: Record<string, string> = { data: 'Data', horario: 'Horário', local: 'Local', golsMandante: 'Gols do mandante', golsVisitante: 'Gols do visitante', ocorrencia: 'Ocorrência', sumulaId: 'Súmula' };
const valor = (v: unknown): string => v == null ? 'Não publicado' : typeof v === 'string' || typeof v === 'number' ? String(v) : 'Identidade alterada — conferir participantes na fonte';
const valorDoCampo = (campo: string, v: unknown) => campo === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  ? v.split('-').reverse().join('/') : valor(v);
type Time = { nome: string; escudo?: string | null };
export function PaulistaComparison({ pendencia: p, mandante, visitante }: { pendencia: PainelPaulista['pendencias'][number]; mandante?: Time; visitante?: Time }) {
  if (p.tipo === 'PLACAR') return <div role="table" aria-label="Comparação da divergência" className="paulista-score-review">
    {([{ titulo: 'Federação · atual', placar: p.dados.oficial }, { titulo: 'Ludora · anotado', placar: p.dados.local }]).map(linha =>
      <div role="row" className="paulista-score-review-row" key={linha.titulo}>
        <strong role="rowheader">{linha.titulo}</strong>
        <span role="cell"><ClubBadge src={mandante?.escudo} name={mandante?.nome} size={28}/>{mandante?.nome || 'Mandante'}</span>
        <b role="cell">{linha.placar?.join(' × ') || '—'}</b>
        <span role="cell"><ClubBadge src={visitante?.escudo} name={visitante?.nome} size={28}/>{visitante?.nome || 'Visitante'}</span>
      </div>)}
  </div>;
  const ocorrencia = (v: unknown) => v === 'WO' ? 'W.O.' : v === 'ADIADA' ? 'Adiada' : 'Sem ocorrência';
  const linhas = p.tipo === 'ALTERACAO_OFICIAL' && Array.isArray(p.dados.changes)
      ? p.dados.changes.filter((c: { campo: string }) => ['data', 'horario', 'local'].includes(c.campo)).map((c: any) => ({ campo: campos[c.campo], fonte: valorDoCampo(c.campo, c.depois), clube: valorDoCampo(c.campo, c.antes) }))
    : p.tipo === 'OCORRENCIA_OFICIAL' ? [{ campo: 'Ocorrência', fonte: ocorrencia(p.dados.depois), clube: ocorrencia(p.dados.antes) }]
      : [{ campo: 'Identidade dos participantes', fonte: 'Conferência humana necessária', clube: 'Histórico preservado; transferência automática bloqueada' }];
  return <div className="paulista-comparison" role="table" aria-label="Comparação da divergência"><div role="row" className="comparison-head"><span role="columnheader">Informação</span><strong role="columnheader">Federação · atual</strong><strong role="columnheader">Versão anterior</strong></div>{linhas.map((l: any, i: number) => <div role="row" key={i}><span role="rowheader">{l.campo}</span><strong role="cell">{valor(l.fonte)}</strong><span role="cell">{valor(l.clube)}</span></div>)}</div>;
}
const acoes: Record<string, string> = { CHAMADO_TECNICO: 'Chamado técnico vinculado', SUGESTAO_REJEITADA: 'Sugestão rejeitada', SINCRONIZACAO: 'Calendário conferido', VINCULO_CONFIRMADO: 'Identidade confirmada', VINCULO_DESFEITO: 'Vínculo desfeito', DECISAO_PENDENCIA: 'Decisão de revisão', DADOS_OFICIAIS_ALTERADOS: 'Publicação oficial alterada', AGENDA_LOCAL_ATUALIZADA: 'Agenda atualizada', PROJECAO_LOCAL_PAULISTA: 'Partida atualizada pela Federação', FALHA_SINCRONIZACAO: 'Falha na atualização', RETROATIVO: 'Acontecimento histórico incluído', REVISAO_VINCULO_SOLICITADA: 'Revisão de identidade solicitada', ACOMPANHAMENTO: 'Acompanhamento alterado', PROGRAMACAO: 'Rotina alterada' };
export function PaulistaAudit({ item }: { item: { id: number; acao: string; criadoEm: string; dados: any; operador?: string } }) {
  const d = item.dados || {};
  const publicacao = d.tipoResultado === 'PUBLICACAO_RESULTADO' ? 'Primeira publicação do resultado' : d.tipoResultado === 'CORRECAO_RESULTADO' ? 'Correção do resultado oficial' : '';
  const titulo = publicacao || acoes[item.acao] || 'Operação registrada';
  const projecao = item.acao === 'PROJECAO_LOCAL_PAULISTA';
  return <details className="paulista-audit">
    <summary>{titulo} · {new Date(item.criadoEm).toLocaleString('pt-BR')}</summary>
    <dl>
      <div><dt>Responsável</dt><dd>{item.operador || 'Sistema'}</dd></div>
      {d.motivo && <div><dt>Motivo</dt><dd>{d.motivo}</dd></div>}
      {projecao && <div><dt>Partida #{d.depois?.partidaId} · Placar local</dt><dd>{d.antes?.status === 'FINALIZADA' ? d.antes.placar.join(' × ') : 'Sem resultado'} → {d.depois?.status === 'FINALIZADA' ? d.depois.placar.join(' × ') : 'Sem resultado'}</dd></div>}
      {Array.isArray(d.agenda) && d.agenda.map((c: { campo: string; antes: unknown; depois: unknown }) => <div key={c.campo}><dt>{campos[c.campo]}</dt><dd>{valorDoCampo(c.campo, c.antes)} → {valorDoCampo(c.campo, c.depois)}</dd></div>)}
      {d.antes?.oficial && d.antes?.local && <div><dt>Dados analisados</dt><dd>Federação {d.antes.oficial.join(' × ')} · Clube {d.antes.local.join(' × ')}</dd></div>}
      {typeof d.antes === 'string' && <div><dt>Antes → depois</dt><dd>{d.antes === 'SUGESTAO' ? 'Sugestão de identidade' : d.antes} → {d.depois === 'REJEITADA' ? 'Rejeitada' : d.depois}</dd></div>}
      {d.estado && <div><dt>Situação</dt><dd>{d.estado === 'CONFERIDA' ? 'Conferida' : d.estado === 'AGUARDANDO_CLUBE' ? 'Aguardando clube' : 'Em revisão'}</dd></div>}
      {typeof d.criadas === 'number' && <div><dt>Partidas novas / atualizadas</dt><dd>{d.criadas} / {d.atualizadas || 0}</dd></div>}
      {d.preservouEventosLocais && <div><dt>Registros do clube</dt><dd>Eventos e scout preservados</dd></div>}
    </dl>
  </details>;
}
