import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiResponseError } from '../services/api';
import { responderProposta, type PropostaPartida } from '../services/sharedMatches';
import { useMatchProposals } from '../hooks/useMatchProposals';
import { Btn, Input, Modal, LoadingSkeleton } from '../components/UI';
import { Icon } from '../components/Icon';
import { InfoNotice } from '../components/InfoNotice';
import { ClubBadge } from '../components/Brand';
import { CollectionFilterDialog, FilterRadioGroup } from '../components/CollectionToolbar';
import { MatchDateField, MatchTimeField } from '../components/MatchDateTime';
import { formatMatchDate } from '../components/MatchCard';
import { Toast } from '../components/Toast';
import './SharedMatches.css';

export default function SolicitacoesPartidas() {
  const { clube, token } = useAuth();
  const [params] = useSearchParams();
  const { items, loading, refreshing, error: refreshError, refresh } = useMatchProposals(clube?.id, token);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<PropostaPartida | null>(null);
  const [acao, setAcao] = useState('ACEITAR'), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ data: '', horario: '', local: '', motivo: '' });
  const [filtro, setFiltro] = useState('PENDENTE');
  const [direcao, setDirecao] = useState('TODAS');
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const [draftFilters, setDraftFilters] = useState({ situacao: 'PENDENTE', direcao: 'TODAS' });
  const highlighted = useRef<string | null>(null);
  useEffect(() => {
    const id = params.get('id');
    const item = items.find(proposal => proposal.id === id);
    if (!item || highlighted.current === id) return;
    highlighted.current = id;
    if (item.status !== 'PENDENTE') setFiltro('');
    setDirecao('TODAS');
    requestAnimationFrame(() => document.querySelector('[data-highlight]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [items, params]);
  function open(p: PropostaPartida, next: string) {
    setSelected(p); setAcao(next); setError('');
    setForm({ data: p.dados.data || '', horario: p.dados.horario || '', local: p.dados.local || '', motivo: '' });
  }
  async function respond() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await responderProposta(selected, acao, form);
      setSelected(null); setNotice(acao === 'ACEITAR'
        ? selected.tipo === 'SUMULA' ? 'Responsabilidade pela súmula atualizada.'
          : selected.tipo === 'CORRECAO' ? 'Correções autorizadas por 30 minutos.'
          : 'Confronto confirmado. A partida está disponível para os dois clubes.'
        : acao === 'SUGERIR' ? 'Alteração enviada. Aguarde a resposta do outro clube.' : 'Resposta registrada.');
      await refresh();
    } catch (e) {
      if (e instanceof ApiResponseError && e.status === 409) {
        setSelected(null);
        setNotice('A solicitação mudou ou já foi respondida. Confira os dados atualizados antes de continuar.');
        await refresh();
      } else setError((e as Error).message);
    } finally { setBusy(false); }
  }
  function closeResponse() {
    if (busy) return;
    setSelected(null);
    setError('');
  }
  const responseTitle = acao === 'SUGERIR' ? 'Sugerir alteração' : acao === 'ACEITAR' ? 'Aceitar proposta' : acao === 'RECUSAR' ? 'Recusar proposta' : 'Cancelar proposta';
  const responseLabel = acao === 'SUGERIR' ? 'Enviar sugestão' : responseTitle;
  const visibleItems = items.filter(p => (!filtro || p.status === filtro) && (direcao === 'TODAS' || (direcao === 'RESPONDER' ? p.status === 'PENDENTE' && p.respondente_id === clube?.id : p.origem_id === clube?.id)));
  const situationOptions = [['PENDENTE', 'Pendentes'], ['', 'Todas as situações']];
  const directionOptions = [['TODAS', 'Todas as solicitações'], ['RESPONDER', 'Para responder'], ['ENVIADAS', 'Enviadas']];
  const activeFilterCount = Number(!!filtro) + Number(direcao !== 'TODAS');
  function clearFilters() { setFiltro(''); setDirecao('TODAS'); }
  return <div className="shared-matches-page">
    <header className="page-header shared-desktop-header"><div><h1 className="page-title">Solicitações de partidas</h1><p className="page-sub">Combine os confrontos e acompanhe as respostas dos clubes.</p></div><Link className="btn btn-ghost btn-md" to="/partidas"><Icon name="arrow" size={18}/>Voltar às partidas</Link></header>
    <header className="shared-mobile-header">
      <Link to="/partidas" className="btn btn-ghost shared-mobile-back" aria-label="Voltar às partidas"><Icon name="arrow" size={20}/></Link>
      <h1>Solicitações</h1>
      <button type="button" className="shared-mobile-filter" aria-label="Filtrar solicitações" aria-haspopup="dialog" aria-expanded={!!filterAnchor} onClick={event => { if (filterAnchor) { setFilterAnchor(null); return; } setDraftFilters({ situacao: filtro, direcao }); setFilterAnchor(event.currentTarget); }}><Icon name="filters" size={20}/>{activeFilterCount > 0 && <span className="shared-filter-dot" aria-hidden="true"/>}</button>
    </header>
    <div className="shared-desktop-filters">
      <div className="shared-status-tabs" role="group" aria-label="Situação das solicitações">{situationOptions.map(([v, l]) => <button type="button" key={l} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{l}</button>)}</div>
      <div className="shared-status-tabs" role="group" aria-label="Direção das solicitações">{directionOptions.map(([v, l]) => <button type="button" key={l} aria-pressed={direcao === v} onClick={() => setDirecao(v)}>{l}</button>)}</div>
    </div>
    <div className="shared-request-toolbar">
      <div className="shared-request-results" aria-live="polite">{!loading && <><strong>{visibleItems.length} {visibleItems.length === 1 ? 'solicitação' : 'solicitações'}</strong><span>{filtro ? 'Pendentes' : 'Todas as situações'} · {directionOptions.find(([value]) => value === direcao)?.[1]}</span></>}</div>
      <button type="button" className="btn btn-ghost shared-request-refresh" aria-label="Atualizar solicitações" aria-busy={refreshing} disabled={refreshing || busy} onClick={() => { setError(''); void refresh(); }}><Icon name="refresh" size={17}/><span>{refreshing ? 'Atualizando…' : 'Atualizar'}</span></button>
    </div>
    <Toast message={notice} onClose={() => setNotice('')}/>
    {!selected && (error || refreshError) && <p role="alert" className="notice-error">{error || refreshError}</p>}
    {loading ? <LoadingSkeleton kind="rows" /> : <div className="shared-proposal-list">{visibleItems.map(p => {
      const recebida = p.respondente_id === clube?.id;
      const sugestao = p.dados.sugestao;
      const autorSugestao = sugestao?.clube_id === p.origem_id ? p.origem.nome : p.destino.nome;
      const tipoLabel = p.tipo === 'CORRECAO' ? 'Correção da súmula' : p.tipo === 'SUMULA' ? 'Responsável pela súmula' : p.tipo === 'CRIACAO' ? 'Proposta de partida' : 'Alteração da partida';
      const statusLabel = ({ PENDENTE: 'Pendente', ACEITA: 'Aceita', RECUSADA: 'Recusada', CANCELADA: 'Cancelada', EXPIRADA: 'Expirada' } as Record<string, string>)[p.status] || p.status;
      return <article className="shared-proposal" key={p.id} data-highlight={params.get('id') === p.id || undefined}>
        <header className="shared-proposal-header"><h2><Icon name={p.tipo === 'SUMULA' ? 'switchClub' : p.tipo === 'CORRECAO' ? 'edit' : 'email'} size={19}/>{tipoLabel}</h2><span className={`shared-proposal-status is-${p.status}`}><span aria-hidden="true"/>{statusLabel}</span></header>
        <div className="shared-proposal-teams" aria-label={`${p.origem?.nome} versus ${p.destino?.nome}`}>
          <div className="shared-proposal-club"><ClubBadge src={p.origem?.escudo} name={p.origem?.nome} size={42}/><strong>{p.origem?.nome || 'Clube de origem'}</strong></div>
          <span className="shared-proposal-versus" aria-hidden="true">×</span>
          <div className="shared-proposal-club"><ClubBadge src={p.destino?.escudo} name={p.destino?.nome} size={42}/><strong>{p.destino?.nome || 'Clube de destino'}</strong></div>
        </div>
        <div className="shared-proposal-meta">{p.categoria_nome && <span>{p.categoria_nome.toUpperCase()}</span>}{!['SUMULA', 'CORRECAO'].includes(p.tipo) && <><span><Icon name="calendar" size={17}/>{p.dados.data ? formatMatchDate(p.dados.data) : 'Data a definir'}</span><span><Icon name="clock" size={17}/>{p.dados.horario || 'Horário a definir'}</span></>}</div>
        {!['SUMULA', 'CORRECAO'].includes(p.tipo) && <div className="shared-proposal-location"><Icon name="location" size={16}/>{p.dados.local || 'Local a definir'}</div>}
        <p className="shared-proposal-description">{p.status === 'PENDENTE' ? sugestao ? recebida ? `${autorSugestao} sugeriu novos dados. Confira e responda.` : 'Sua sugestão foi enviada. Aguardando o outro clube.' : recebida ? 'Seu clube precisa responder a esta proposta.' : 'Aguardando a resposta do outro clube.' : p.motivo || 'Solicitação encerrada.'}</p>
        {sugestao?.motivo && <p className="shared-proposal-observation"><Icon name="info" size={17}/>{sugestao.motivo}</p>}
        {p.tipo === 'SUMULA' && <p className="editor-description">Após o aceite, o {p.dados.novo_responsavel_id === p.origem_id ? p.origem.nome : p.destino.nome} passa a operar a súmula. Cada clube mantém sua própria escalação.</p>}
        {p.tipo === 'CORRECAO' && <p className="editor-description">{p.dados.motivo}<br/>O aceite permite correções com justificativa por 30 minutos.</p>}<div className="shared-inline-actions">{p.status === 'PENDENTE' && recebida && <><Btn onClick={() => open(p, 'ACEITAR')}>Aceitar</Btn><Btn variant="ghost" onClick={() => open(p, 'RECUSAR')}>Recusar</Btn>{!['SUMULA', 'CORRECAO'].includes(p.tipo) && <Btn variant="ghost" onClick={() => open(p, 'SUGERIR')}>Sugerir alteração</Btn>}</>}
          {p.status === 'PENDENTE' && p.origem_id === clube?.id && <Btn variant="ghost" onClick={() => open(p, 'CANCELAR')}>Cancelar proposta</Btn>}
          {p.partida_id && <Link className="btn btn-ghost btn-sm" to={`/partidas/${p.partida_id}`}>Abrir partida<Icon name="chevronRight" size={16}/></Link>}
        </div>
      </article>;
    })}</div>}
    {!loading && !error && !refreshError && visibleItems.length === 0 && <div className="shared-requests-empty" role="status"><Icon name="email" size={36}/><h2>{items.length ? 'Nenhuma solicitação com esses filtros' : 'Nenhuma solicitação por aqui'}</h2><p>{items.length ? 'Tente outra situação ou veja todas as solicitações.' : 'Propostas de partida e pedidos entre clubes aparecerão aqui.'}</p>{items.length > 0 && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}</div>}
    <CollectionFilterDialog open={!!filterAnchor} anchor={filterAnchor} title="Filtrar solicitações" onClose={() => setFilterAnchor(null)} onClear={() => setDraftFilters({ situacao: '', direcao: 'TODAS' })} onApply={() => { setFiltro(draftFilters.situacao); setDirecao(draftFilters.direcao); setFilterAnchor(null); }} className="shared-request-filter-dialog">
      <FilterRadioGroup label="Situação" value={draftFilters.situacao} options={situationOptions.map(([value, label]) => ({ value, label }))}
        onChange={situacao => setDraftFilters(current => ({ ...current, situacao }))} />
      <FilterRadioGroup label="Solicitações" value={draftFilters.direcao} options={directionOptions.map(([value, label]) => ({ value, label }))}
        onChange={direcao => setDraftFilters(current => ({ ...current, direcao }))} />
    </CollectionFilterDialog>
    <Modal open={!!selected} title={responseTitle} className="proposal-response-dialog" onClose={closeResponse} footer={<div className="proposal-response-actions"><Btn disabled={busy} variant="ghost" onClick={closeResponse}>Voltar</Btn><Btn disabled={busy} variant={['RECUSAR', 'CANCELAR'].includes(acao) ? 'danger' : 'primary'} onClick={() => void respond()}>{busy ? 'Salvando…' : responseLabel}</Btn></div>}>
      {selected && <><div className="proposal-response-match"><strong>{selected.origem?.nome} <span>×</span> {selected.destino?.nome}</strong>{selected.categoria_nome && <small>{selected.categoria_nome.toUpperCase()}</small>}</div>
      {acao === 'ACEITAR' && !['SUMULA', 'CORRECAO'].includes(selected.tipo) && <dl className="proposal-response-details">
        <div><dt><Icon name="calendar" size={17}/>Data</dt><dd>{selected.dados.data ? formatMatchDate(selected.dados.data) : 'Data a definir'}</dd></div>
        <div><dt><Icon name="clock" size={17}/>Horário</dt><dd>{selected.dados.horario || 'Horário a definir'}</dd></div>
        <div className="proposal-response-location"><dt><Icon name="location" size={17}/>Local</dt><dd>{selected.dados.local || 'Local a definir'}</dd></div>
      </dl>}
      <InfoNotice title={acao === 'ACEITAR' ? 'Confira antes de confirmar' : 'Sobre sua resposta'}>{acao === 'ACEITAR' ? selected.tipo === 'CORRECAO' ? 'O aceite autoriza correções por 30 minutos, com justificativa, sem transferir a responsabilidade pela súmula.' : selected.tipo === 'SUMULA' ? `Após o aceite, o ${selected.dados.novo_responsavel_id === selected.origem_id ? selected.origem.nome : selected.destino.nome} será responsável pelo placar e pelos eventos. Cada clube mantém sua própria escalação.` : 'Ao aceitar, você confirma a data, o horário e o local desta versão da proposta.' : 'O outro clube será informado da sua resposta.'}</InfoNotice>
      {acao === 'SUGERIR' && <div className="form-grid"><MatchDateField value={form.data} onChange={data => setForm(f => ({ ...f, data }))}/><MatchTimeField value={form.horario} onChange={horario => setForm(f => ({ ...f, horario }))}/><div className="full"><Input label="Local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))}/></div></div>}
      {acao !== 'ACEITAR' && <Input label="Motivo ou observação (opcional)" maxLength={500} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}/>}
      {error && <p role="alert" className="notice-error">{error}</p>}</>}
    </Modal>
  </div>;
}
