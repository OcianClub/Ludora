import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CollectionFilterButton, CollectionFilterDialog, CollectionSearch } from '@web/components/CollectionToolbar';
import { Btn, Card, DesktopSection, DesktopState, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { Toast } from '@web/components/Toast';
import { ClubBadge } from '@web/components/Brand';
import { Icon } from '@web/components/Icon';
import type { PainelPaulista } from '@ludora/shared-types/src/paulista';
import { requestJson } from '../services/api';
import { PaulistaComparison, PaulistaAudit } from '../components/PaulistaReview';
import { FederationGlobe } from '@web/components/PaulistaIcons';
import { DesktopTabs } from '../components/DesktopTabs';
import { DesktopSelect } from '../components/DesktopSelect';
import { DesktopToggle } from '../components/DesktopToggle';
import { DesktopAccordion } from '../components/DesktopAccordion';
import { PaulistaStatus } from '../components/PaulistaStatus';
import { AdminIcon } from '../components/AdminIcon';
import { PaulistaEventCollection, PaulistaRecentChanges } from '../components/PaulistaEventCollection';
import { DesktopMenu, DesktopMenuItem } from '../components/DesktopMenu';
import './Paulista.css';

type Equipe = { id: number; nome: string; escudo: string | null; vinculo: { clubeId: number; motivo: string; clube?: { nome: string; escudo: string | null } } | null; sugestoes: { id: number; nome: string }[] };
type Pausa = { protocolo: string; motivo: string; inicio: string };
type Evento = { id: number; ano: number; categoria: string; divisao: string; acompanhado: boolean; estado: string; tentativaEm: string | null; sucessoEm: string | null; proximaEm: string | null; erro: string | null; jogos: number; versao: number; equipes: Equipe[]; manutencao?: Pausa };
type Alerta = { id: number; jogoId: string; tipo: string; estado: string; atualizadoEm: string | null; clubeIds: number[];
  jogo: { eventoId: number; mandante: string; visitante: string; data: string | null; horario: string | null } };
type Resumo = { rotina: { descobertaEm: string | null; proximaEm: string | null; erro: string | null } | null; catalogo: Evento[]; clubes: { id: number; nome: string; escudo: string | null }[]; fila: Alerta[]; recentes: { id: number; eventoId: number; criadoEm: string }[] };
type Painel = PainelPaulista & { chamados?: Record<string, { id: string; status: string }>; vinculoChamados?: Record<string, string> };
type Decisao = { path: string; titulo: string; body: object; impacto: string; label?: string; rotina?: boolean; motivos?: string[] };
const quando = (v?: string | null) => v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : 'Ainda sem registro';
const estados: Record<string, string> = { ACOMPANHADO: 'Acompanhado', REVISAR_IDENTIDADE: 'Identidade a confirmar', ERRO: 'Atualização com falha', DESCOBERTO: 'Disponível na Federação', PAUSADO: 'Pausado' };
const pendencias: Record<string, string> = { PLACAR: 'Placar divergente', IDENTIDADE: 'Identidade do confronto', ALTERACAO_OFICIAL: 'Alteração no calendário', OCORRENCIA_OFICIAL: 'Ocorrência oficial' };
const motivosConferencia = ['Publicação oficial conferida', 'Súmula oficial conferida', 'Federação confirmou a atualização'];
const motivosTecnicos = ['Conferir diferença entre o Ludora e a fonte', 'Suspeita de erro de importação', 'Publicação incompleta ou inconsistente'];
const nomeEvento = (e: Evento) => `Paulista ${e.ano} · ${e.divisao} · ${e.categoria}`;
const clubesDoEvento = (e: Evento) => [...new Set(e.equipes.flatMap(t => t.vinculo?.clube?.nome || []))];
const envolveClube = (e: Evento, id: number) => e.equipes.some(t => t.vinculo?.clubeId === id || !t.vinculo && t.sugestoes.some(c => c.id === id));
const base = '/admin/paulista';

export default function PaulistaAdmin() {
  const [params, setParams] = useSearchParams();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [historico, setHistorico] = useState<Parameters<typeof PaulistaAudit>[0]['item'][]>([]);
  const [historicoPendencia, setHistoricoPendencia] = useState<typeof historico | null>(null);
  const [erroHistorico, setErroHistorico] = useState('');
  const [erro, setErro] = useState('');
  const [erroAcao, setErroAcao] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [detalhando, setDetalhando] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [acao, setAcao] = useState<Decisao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoCustom, setMotivoCustom] = useState(false);
  const [todosAlertas, setTodosAlertas] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const evento = resumo?.catalogo.find(e => String(e.id) === params.get('evento'));
  const clubeSelecionado = resumo?.clubes?.find(c => String(c.id) === params.get('clube'));
  const path = evento ? `${base}/eventos/${evento.id}` : '';
  const jogoSelecionado = params.get('jogo') || '';
  const tipoSelecionado = params.get('tipo') || '';
  const pendenciaSelecionada = painel?.pendencias.find(p => p.jogoId === jogoSelecionado && p.tipo === tipoSelecionado);

  async function carregar() {
    setErro(''); setCarregando(true);
    try { setResumo(await requestJson<Resumo>(base)); }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);
  useEffect(() => {
    let atual = true;
    setPainel(null); setHistorico([]); setDetalhando(false);
    if (!evento?.versao) return;
    setDetalhando(true);
    void Promise.all([requestJson<Painel>(path), requestJson<typeof historico>(`${path}/historico`)]).then(([p, h]) => {
      if (atual) { setPainel(p); setHistorico(h); }
    }).catch(e => { if (atual) setErro(e.message); }).finally(() => { if (atual) setDetalhando(false); });
    return () => { atual = false; };
  }, [path, evento?.versao, resumo]);
  useEffect(() => {
    setHistoricoPendencia(null); setErroHistorico('');
    if (!pendenciaSelecionada || !path) return;
    let atual = true;
    const p = new URLSearchParams({ jogo: jogoSelecionado, pendencia: String(pendenciaSelecionada.id) });
    const frame = requestAnimationFrame(() => document.getElementById('paulista-pendencia-ativa')?.scrollIntoView({ block: 'nearest' }));
    void requestJson<typeof historico>(`${path}/historico?${p}`).then(itens => { if (atual) setHistoricoPendencia(itens); })
      .catch(e => { if (atual) setErroHistorico(e.message); });
    return () => { atual = false; cancelAnimationFrame(frame); };
  }, [path, pendenciaSelecionada, jogoSelecionado]);
  function abrir(id: number, alerta?: Alerta, clubeId?: number) {
    setAviso(''); setErro('');
    const p = new URLSearchParams({ evento: String(id) });
    if (clubeId) p.set('clube', String(clubeId));
    if (alerta) { p.set('jogo', alerta.jogoId); p.set('tipo', alerta.tipo); }
    setParams(p);
    document.getElementById('main-content')?.scrollTo({ top: 0 });
  }
  function voltar() { setErro(''); setParams(clubeSelecionado ? { clube: String(clubeSelecionado.id) } : {}); }
  function expandirPendencia(jogoId: string, tipo: string, expandida: boolean) {
    const p = new URLSearchParams(params);
    if (expandida) { p.delete('jogo'); p.delete('tipo'); }
    else { p.set('jogo', jogoId); p.set('tipo', tipo); }
    setParams(p);
  }
  function revisar(decisao: Decisao) { setAcao(decisao); setMotivo(decisao.motivos?.[0] || ''); setMotivoCustom(false); setConfirmado(false); setErroAcao(''); }
  async function executar() {
    if (!acao || busy) return;
    setBusy(true); setErroAcao('');
    try {
      const r = await requestJson<{ chamadoId?: string }>(acao.path, { method: 'POST', body: { ...acao.body, motivo, confirmacao: 'CONFIRMAR_IDENTIDADE' } });
      setAcao(null); setAviso(r.chamadoId ? acao.path.endsWith('/revisar-vinculo') ? 'Chamado de análise do vínculo registrado.' : 'Chamado técnico vinculado. A divergência segue em revisão.' : 'Operação registrada. Consulte a situação atual e o histórico.');
      await carregar();
    } catch (e) { setErroAcao((e as Error).message); }
    finally { setBusy(false); }
  }
  const catalogo = resumo?.catalogo || [];
  const opcoes = {
    ano: [...new Set(catalogo.map(e => e.ano))].sort((a, b) => b - a).map(a => ({ value: String(a), label: String(a) })),
    divisao: [...new Set(catalogo.map(e => e.divisao))].sort().map(v => ({ value: v, label: v })),
    categoria: [...new Set(catalogo.map(e => e.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(v => ({ value: v, label: v.toUpperCase() })),
    clube: (resumo?.clubes || []).map(c => ({ value: String(c.id), label: c.nome })),
    pendencia: Object.entries(pendencias).map(([value, label]) => ({ value, label })),
  };
  const campos = { ano: 'Ano', divisao: 'Divisão', categoria: 'SUB', clube: 'Clube vinculado', pendencia: 'Tipo de pendência' };
  const chaves = Object.keys(campos) as (keyof typeof campos)[];
  const eventos = catalogo.filter(e => (!status || status === e.estado)
    && (!filtros.ano || filtros.ano === String(e.ano)) && (!filtros.divisao || filtros.divisao === e.divisao)
    && (!filtros.categoria || filtros.categoria === e.categoria) && (!filtros.clube || envolveClube(e, Number(filtros.clube)))
    && (!filtros.pendencia || resumo?.fila.some(p => p.jogo.eventoId === e.id && p.tipo === filtros.pendencia))
    && [nomeEvento(e), ...clubesDoEvento(e), ...e.equipes.map(t => t.nome)].join(' ').toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()));
  const tarefas = (resumo?.fila || []).filter(p => eventos.some(e => e.id === p.jogo.eventoId) &&
    (!filtros.pendencia || filtros.pendencia === p.tipo) && (!filtros.clube || p.clubeIds.includes(Number(filtros.clube))));
  const clubes = (resumo?.clubes || []).map(clube => ({
    ...clube,
    eventos: eventos.filter(e => envolveClube(e, clube.id) || tarefas.some(t => t.jogo.eventoId === e.id && t.clubeIds.includes(clube.id))),
    alertas: tarefas.filter(t => t.clubeIds.includes(clube.id)),
  })).filter(c => (!filtros.clube || String(c.id) === filtros.clube) &&
    (c.eventos.length || !status && !filtros.ano && !filtros.divisao && !filtros.categoria && !filtros.pendencia && c.nome.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase())));
  const semClube = eventos.filter(e => !clubes.some(c => c.eventos.some(item => item.id === e.id)));
  const falhou = !!resumo?.rotina?.erro || catalogo.some(e => e.erro && e.estado !== 'PAUSADO');
  const tituloSaude = falhou ? 'Há atualizações com falha' : resumo?.fila.length || catalogo.some(e => e.estado === 'REVISAR_IDENTIDADE') ? 'Aguardando conferência' : catalogo.length ? 'Catálogo disponível' : 'Aguardando a primeira descoberta';
  const nomeTime = (id: number) => painel?.vinculos.find(v => v.equipeId === id)?.nome || painel?.snapshot.equipes.find(e => e.id === id)?.nome || 'Equipe a confirmar';
  const time = (id: number) => ({ nome: nomeTime(id), escudo: painel?.vinculos.find(v => v.equipeId === id)?.escudo ||
    painel?.snapshot.equipes.find(e => e.id === id)?.escudo });
  const estadoAlerta = (estado: string) => estado === 'AGUARDANDO_CLUBE' ? 'Aguardando clube' : estado === 'EM_REVISAO' ? 'Em revisão' : 'Aguardando decisão';
  const alertasEvento = painel?.pendencias.filter(p => {
    if (!clubeSelecionado || p === pendenciaSelecionada) return true;
    const jogo = painel.snapshot.jogos.find(j => j.id === p.jogoId);
    return painel.vinculos.some(v => v.clubeId === clubeSelecionado.id && (v.equipeId === jogo?.mandanteId || v.equipeId === jogo?.visitanteId)) ||
      tarefas.some(t => t.jogoId === p.jogoId && t.tipo === p.tipo && t.clubeIds.includes(clubeSelecionado.id));
  }) || [];
  function avisoDaFila(t: Alerta, clubeId?: number) {
    const e = catalogo.find(v => v.id === t.jogo.eventoId);
    if (!e) return null;
    const destino = clubeId || t.clubeIds[0];
    const clube = clubes.find(c => c.id === destino) || resumo?.clubes?.find(c => c.id === destino);
    return <button key={`${t.jogoId}:${t.tipo}`} type="button" className="ticket-card" onClick={() => abrir(e.id, t, destino)}>
      <span className="ticket-card-icon"><Icon name="alert" size={19}/></span>
      <span className="ticket-card-copy"><strong>{t.jogo.mandante} × {t.jogo.visitante}</strong><small>{pendencias[t.tipo] || 'Divergência'} · {clube?.nome || 'Sem clube confirmado'} · {nomeEvento(e)}</small></span>
      <span className="ticket-card-meta"><PaulistaStatus state={t.estado} label={estadoAlerta(t.estado)}/><time>{t.atualizadoEm ? quando(t.atualizadoEm) : [t.jogo.data?.split('-').reverse().join('/'), t.jogo.horario].filter(Boolean).join(' · ') || 'Horário a confirmar'}</time></span><Icon name="chevronRight" size={16}/>
    </button>;
  }
  function listaEventos(items: Evento[], clubeId?: number) {
    return <PaulistaEventCollection events={items} labels={estados} alerts={id=>tarefas.filter(t=>t.jogo.eventoId === id && (!clubeId || t.clubeIds.includes(clubeId))).length} onOpen={id=>abrir(id,undefined,clubeId)}/>;
  }

  return <div className="ticket-page match-schedule paulista-admin">
    {evento && <Btn variant="ghost" className="ticket-back" onClick={voltar}><Icon name="chevronLeft" size={17}/> {clubeSelecionado ? `Voltar a ${clubeSelecionado.nome}` : 'Voltar aos clubes'}</Btn>}
    <header className="page-header"><div><span className="ticket-kicker">Integração oficial</span><h1 className="page-title">{evento ? nomeEvento(evento) : 'Campeonato Paulista'}</h1><p className="page-sub">{evento ? 'Calendário, vínculos e conferência dos dados oficiais.' : 'Acompanhe a publicação da Federação e revise diferenças com o Ludora.'}</p></div>
      <div className="actions"><Btn variant="ghost" disabled={carregando || busy} onClick={() => void carregar()}><Icon name="refresh" size={17}/>{carregando ? 'Atualizando…' : 'Atualizar painel'}</Btn>
        {evento && <a className="paulista-source-icon" href={`https://eventos.admfutsal.com.br/evento/${evento.id}/jogos`} target="_blank" rel="noreferrer"
          aria-label="Abrir fonte oficial" data-tooltip="Abrir fonte oficial da Federação"><FederationGlobe/></a>}</div>
    </header>
    {erro && <DesktopState error title="Não foi possível carregar a integração" description={erro} onRetry={() => void carregar()}/>}
    <Toast message={aviso} onClose={() => setAviso('')}/>
    {!resumo && !erro && <LoadingSkeleton kind="rows" label="Carregando integração Paulista"/>}
    {resumo && !evento && <>
      <DesktopSection title="Sincronização com a Federação" className="paulista-health" actions={<PaulistaStatus state={falhou ? 'ERRO' : resumo.fila.length || catalogo.some(e=>e.estado === 'REVISAR_IDENTIDADE') ? 'EM_REVISAO' : 'DESCOBERTO'} label={tituloSaude}/>}>
        <div className="paulista-health-content"><dl><div><dt>Última descoberta</dt><dd>{quando(resumo.rotina?.descobertaEm)}</dd></div><div><dt>Próxima descoberta</dt><dd>{resumo.rotina?.proximaEm ? quando(resumo.rotina.proximaEm) : 'Sem agendamento informado'}</dd></div></dl>
        <Btn size="sm" variant="ghost" onClick={() => revisar({ path: `${base}/verificar`, titulo: 'Executar rotina pendente', body: {}, rotina: true, impacto: 'Processa as consultas que já estão agendadas. Uma falha preserva a última versão válida.' })}>Executar rotina pendente</Btn>
        </div>{resumo.rotina?.erro && <p role="status" className="paulista-error-text">{resumo.rotina.erro}</p>}
      </DesktopSection>
      <DesktopTabs label="Situação dos campeonatos" value={status} onChange={setStatus} options={[
        {value:'',label:'Todos',count:catalogo.length}, ...Object.entries(estados).map(([value,label])=>({value,label,count:catalogo.filter(e=>e.estado === value).length})),
      ]}>
      <div className="user-toolbar"><CollectionSearch label="Buscar campeonatos" placeholder="Clube, SUB, equipe oficial ou ano…" value={busca} onChange={setBusca}/><CollectionFilterButton label="Mais filtros" count={Object.values(filtros).filter(Boolean).length} onClick={() => setDraft({ ...filtros })}/></div>
      {Object.values(filtros).some(Boolean) && <div className="schedule-active-filters" aria-label="Filtros ativos">{chaves.filter(k => filtros[k]).map(k => <button key={k} onClick={() => setFiltros({ ...filtros, [k]: '' })}>{opcoes[k].find(o => o.value === filtros[k])?.label}<Icon name="minus" size={14}/></button>)}</div>}
      <section className="ticket-day paulista-alerts"><h2>Alertas <span className="paulista-count">{tarefas.length}</span></h2>
        {!tarefas.length && <p className="paulista-empty-inline"><AdminIcon name="check" size={17}/>Nenhuma divergência aberta para esta seleção.</p>}
        {(todosAlertas ? tarefas : tarefas.slice(0, 5)).map(t => avisoDaFila(t))}
        {tarefas.length > 5 && <div><Btn size="sm" variant="ghost" aria-expanded={todosAlertas} onClick={() => setTodosAlertas(v => !v)}>{todosAlertas ? 'Mostrar menos alertas' : `Ver os outros ${tarefas.length - 5} alertas`}</Btn></div>}
      </section>
      <section className="ticket-day"><h2>Clubes</h2>
        {!clubes.length && !semClube.length && <DesktopState plain icon="search" title="Nenhum clube encontrado" description="Revise os filtros ou a busca."/>}
        {clubes.map(c => {
          const subs = new Set(c.eventos.map(e => e.categoria)).size;
          return <DesktopAccordion className="paulista-club-card" key={`${c.id}:${clubeSelecionado?.id || ''}`} defaultOpen={c.id === clubeSelecionado?.id} title={<span className="paulista-club-heading">
              <ClubBadge src={c.escudo} name={c.nome} size={36}/>
              <span className="ticket-card-copy"><strong>{c.nome}</strong><small>{subs ? `${c.eventos.some(e => e.acompanhado) ? 'Em acompanhamento' : 'Sem acompanhamento'} · ${subs} ${subs === 1 ? 'SUB' : 'SUBs'}` : 'Sem participação publicada'}</small></span>
              <span className="paulista-club-alert-count" data-warning={c.alertas.length > 0}>{c.alertas.length === 1 ? '1 alerta' : `${c.alertas.length} alertas`}</span>
            </span>}>
            <div className="paulista-club-content">
              {listaEventos(c.eventos, c.id)}
              {!c.eventos.length && <p className="dica">Ainda não há SUBs vinculados ou sugeridos pela Federação.</p>}
            </div>
          </DesktopAccordion>;
        })}
        {!!semClube.length && <DesktopAccordion className="paulista-club-card" title={<span className="paulista-club-heading"><span className="ticket-card-icon"><Icon name="trophy" size={18}/></span><span className="ticket-card-copy"><strong>Eventos sem clube associado</strong><small>{semClube.length} publicados</small></span></span>}><div className="paulista-club-content">{listaEventos(semClube)}</div></DesktopAccordion>}
      </section>
      {!!resumo.recentes?.length && <section className="ticket-day paulista-recent-section"><h2><Icon name="clock" size={17}/>Alterações oficiais recentes <span className="paulista-count">{resumo.recentes.length}</span></h2><PaulistaRecentChanges changes={resumo.recentes} events={catalogo} onOpen={id=>abrir(id)}/></section>}
      </DesktopTabs>
    </>}
    {evento && <div className="ticket-detail-main">
      <section className="paulista-event-overview" aria-label="Resumo do evento">
        <div className="paulista-event-context">{clubeSelecionado ? <ClubBadge src={clubeSelecionado.escudo} name={clubeSelecionado.nome} size={40}/> : <span className="paulista-context-icon"><Icon name="trophy" size={23}/></span>}<div><strong>{clubeSelecionado?.nome || 'Evento da Federação'}</strong><PaulistaStatus state={evento.estado} label={estados[evento.estado] || evento.estado}/></div></div>
        <dl><div><dt>Jogos no evento</dt><dd>{evento.jogos}</dd></div><div data-attention={alertasEvento.some(p=>['ABERTA','EM_REVISAO','AGUARDANDO_CLUBE'].includes(p.estado))}><dt>Divergências abertas</dt><dd>{painel ? alertasEvento.filter(p=>['ABERTA','EM_REVISAO','AGUARDANDO_CLUBE'].includes(p.estado)).length : '—'}</dd></div><div><dt>Equipes vinculadas</dt><dd>{evento.equipes.filter(e=>e.vinculo).length}</dd></div></dl>
      </section>
      <div className="paulista-detail-workspace"><aside className="paulista-detail-sidebar" aria-label="Consultas da integração">
      <DesktopSection title="Sincronização" className="paulista-sync" actions={<Icon name="refresh" size={18}/>}>
        <dl className="paulista-sync-dates"><div><dt>Último sucesso</dt><dd>{quando(evento.sucessoEm)}</dd></div><div><dt>Próxima tentativa</dt><dd>{evento.proximaEm ? quando(evento.proximaEm) : 'Sem agendamento informado'}</dd></div><div><dt>Versão salva</dt><dd>{evento.versao > 0 ? evento.versao : 'Nenhuma'}</dd></div></dl>
        {evento.erro && <p className="paulista-error-text" role="status">{evento.erro}</p>}
        {evento.manutencao && <p className="notice-error" role="status">Em manutenção desde {quando(evento.manutencao.inicio)}. {evento.manutencao.motivo} Protocolo {evento.manutencao.protocolo}.</p>}
        <div className="actions">
          <Btn disabled={!!evento.manutencao} onClick={() => revisar({ path: `${path}/sincronizar`, titulo: 'Consultar Federação agora', body: {}, rotina: true, impacto: 'Busca a publicação atual deste evento e aplica atualizações oficiais. Uma falha preserva a última versão válida.' })}><Icon name="refresh" size={16}/>Consultar Federação agora</Btn>
          <Link className="btn btn-ghost btn-sm" to={`/manutencao?evento=${evento.id}`}>{evento.manutencao ? 'Revisar pausa' : 'Configurar pausa'}</Link>
        </div>
        {evento.versao > 0 && <div className="paulista-follow">
          <div><strong>Acompanhamento automático</strong><p>{evento.acompanhado ? 'Ligado' : 'Desligado'} · Consulta programada deste SUB</p></div>
          <DesktopToggle label="Acompanhamento automático" checked={evento.acompanhado} onChange={() => revisar({
              path: `${path}/acompanhamento`, titulo: evento.acompanhado ? 'Desligar acompanhamento automático' : 'Ligar acompanhamento automático',
              body: { acompanhado: !evento.acompanhado },
              impacto: evento.acompanhado ? 'Cancela as próximas consultas programadas deste SUB. O calendário salvo continua disponível.' : 'Agenda a primeira consulta deste SUB. As seguintes seguem o intervalo programado da integração.',
              motivos: evento.acompanhado ? ['Edição encerrada', 'Pausa no acompanhamento'] : ['Calendário em andamento', 'Retomada do acompanhamento'],
            })}/>
        </div>}
      </DesktopSection>
      </aside><div className="paulista-detail-work">
      {detalhando && <LoadingSkeleton kind="rows" label="Carregando detalhes do evento"/>}
      {painel && <section className="ticket-day paulista-detail-alerts"><h2><Icon name="calendar" size={18}/>Conferência do calendário</h2>
        {!!alertasEvento.length && <p className="paulista-detail-description">Compare as publicações oficiais com os registros do Ludora.</p>}
        {!alertasEvento.length && <div className="paulista-no-divergence"><AdminIcon name="check" size={20}/><div><strong>Nenhuma divergência registrada</strong><p>Nenhuma ação de conferência necessária nesta seleção.</p></div></div>}
        {alertasEvento.map(p => {
          const j = painel.snapshot.jogos.find(v => v.id === p.jogoId);
          const chamado = painel.chamados?.[String(p.id)];
          const aberta = ['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'].includes(p.estado);
          const chave = `${p.jogoId}:${p.tipo}`;
          const expandida = p === pendenciaSelecionada;
          return <article key={chave} className="paulista-divergencia" id={expandida ? 'paulista-pendencia-ativa' : undefined}>
            <button type="button" className="ticket-card" aria-expanded={expandida} onClick={() => expandirPendencia(p.jogoId, p.tipo, expandida)}>
              <span className="ticket-card-icon"><Icon name={p.tipo === 'PLACAR' ? 'ball' : p.tipo === 'IDENTIDADE' ? 'people' : p.tipo === 'ALTERACAO_OFICIAL' ? 'calendar' : 'info'} size={18}/></span><span className="ticket-card-copy"><strong>{pendencias[p.tipo] || p.tipo}</strong>
                <small>{j ? `${nomeTime(j.mandanteId)} × ${nomeTime(j.visitanteId)}` : 'Confronto em revisão'}</small></span>
              <span className="ticket-card-meta"><PaulistaStatus state={aberta ? p.estado : 'CONFERIDA'} label={aberta ? estadoAlerta(p.estado) : 'Conferida'}/></span><Icon name="chevronRight" size={16}/>
            </button>
            {expandida && <div className="paulista-divergencia-body">
            <PaulistaComparison pendencia={p} mandante={j ? time(j.mandanteId) : undefined} visitante={j ? time(j.visitanteId) : undefined}/>
            <p>Classificação usa o resultado oficial. Scout e acontecimentos do clube ficam preservados.</p>
            <div className="actions">
              {aberta && p.tipo !== 'IDENTIDADE' && <Btn size="sm" variant="ghost" onClick={() => revisar({ path: p.tipo === 'PLACAR' ? `${path}/avaliar-placar` : `${path}/pendencias/${p.id}`, titulo: 'Registrar conferência do dado oficial', body: { acao: 'MANTER_OFICIAL', jogoId: p.jogoId, esperado: p.dados }, motivos: motivosConferencia, impacto: 'Registra a conferência para a equipe. O placar, os acontecimentos e o scout do clube permanecem como estão.' })}>Manter dado oficial</Btn>}
              {aberta && p.tipo === 'PLACAR' && p.estado !== 'AGUARDANDO_CLUBE' && <Btn size="sm" variant="ghost" onClick={() => revisar({
                path: `${path}/avaliar-placar`, titulo: 'Solicitar correção ao clube', body: { acao: 'SOLICITAR_CORRECAO_CLUBE', jogoId: p.jogoId, esperado: p.dados },
                motivos: ['Conferir o placar na súmula', 'Conferir acontecimentos registrados', 'Revisar o encerramento da partida'],
                impacto: 'Exibe um pedido de conferência na aba Avisos do clube. A classificação continua usando a Federação.',
              })}>Solicitar correção ao clube</Btn>}
              {aberta && p.tipo === 'IDENTIDADE' && <Btn size="sm" variant="ghost" onClick={() => revisar({ path: `${path}/pendencias/${p.id}`, titulo: 'Encaminhar revisão de identidade', body: { acao: 'ENCAMINHAR_REVISAO', esperado: p.dados }, impacto: 'Registra a revisão dos participantes. O vínculo e o histórico ficam preservados.' })}>Encaminhar revisão de identidade</Btn>}
              {chamado && <Link className="btn btn-ghost btn-sm" to={`/chamados?id=${chamado.id}`}>Abrir chamado vinculado</Link>}
              {aberta && (!chamado || chamado.status === 'RESOLVIDO') && <Btn size="sm" onClick={() => revisar({ path: p.id > 0 ? `${path}/pendencias/${p.id}/chamado` : `${path}/chamado-placar`, titulo: 'Encaminhar aos desenvolvedores', body: { jogoId: p.jogoId }, motivos: motivosTecnicos, impacto: 'Envia a comparação e o motivo para a fila técnica. A pendência permanece em revisão.', label: 'Criar chamado técnico' })}>Encaminhar aos desenvolvedores</Btn>}
            </div>
            <h3>Histórico da divergência</h3>
            {erroHistorico ? <p role="alert">{erroHistorico}</p> : historicoPendencia ? historicoPendencia.length ? historicoPendencia.map(h => <PaulistaAudit key={h.id} item={h}/>) : <p className="dica">Nenhuma decisão registrada.</p> : <p role="status">Carregando histórico…</p>}
            </div>}
          </article>;
        })}
      </section>}
      <section className="ticket-day paulista-identities"><h2><Icon name="handshake" size={18}/>Vínculos dos clubes</h2>
        {!evento.equipes.some(e => e.vinculo || e.sugestoes.length) && <p className="dica">Nenhum vínculo confirmado ou sugestão para conferir.</p>}
        <div className="paulista-identity-grid">{evento.equipes.filter(e => e.vinculo || e.sugestoes.length).map(e => <Card key={e.id} className={`ticket-section paulista-identity${e.vinculo ? ' paulista-identity-confirmed' : ''}`}><div className="linha-clube"><ClubBadge src={e.vinculo ? e.vinculo.clube?.escudo : e.escudo} name={e.vinculo?.clube?.nome || e.nome} size={36}/><h3>{e.vinculo?.clube?.nome || e.nome}</h3>
          {e.vinculo && <DesktopMenu label={`Opções do vínculo de ${e.vinculo.clube?.nome || e.nome}`}><DesktopMenuItem icon={<Icon name="trash" size={16}/>} disabled={!!evento.manutencao} onSelect={() => revisar({ path: `${path}/desvincular`, titulo: 'Desfazer vínculo confirmado', body: { equipeId: e.id }, impacto: 'A API impede reversões que deixem a agenda órfã ou removam contribuições do clube.' })}>Desfazer vínculo</DesktopMenuItem></DesktopMenu>}
          </div><PaulistaStatus state={e.vinculo ? 'CONFERIDA' : 'REVISAR_IDENTIDADE'} label={e.vinculo ? 'Identidade confirmada' : 'Identidade a conferir'}/>
          {e.vinculo ? <><p><span className="paulista-field-label">Na Federação</span>{e.nome}</p><div className="actions">
            <Btn size="sm" variant="ghost" onClick={() => revisar({ path: `${path}/revisar-vinculo`, titulo: 'Solicitar análise de vínculo', body: { equipeId: e.id },
              motivos: ['Conferir a identidade do clube', 'Conferir partidas e participações', 'Conferir dados da Federação'],
              impacto: 'Abre uma tarefa de atendimento para conferir identidade e histórico. O vínculo atual fica disponível durante a análise.' })}>Solicitar análise de vínculo</Btn>
            {painel?.vinculoChamados?.[String(e.id)] && <Link className="btn btn-ghost btn-sm" to={`/chamados?id=${painel.vinculoChamados[String(e.id)]}`}>Acompanhar análise</Link>}
          </div></> : e.sugestoes.map(c => <div className="actions" key={c.id}><Btn size="sm" variant="ghost" disabled={!!evento.manutencao} onClick={() => revisar({ path: `${path}/confirmar`, titulo: `Confirmar ${e.nome} como ${c.nome}`, body: { equipeId: e.id, clubeId: c.id }, impacto: 'Confirme a identidade, o SUB e o histórico. A associação permite distribuir partidas oficiais para este clube.' })}>Confirmar {c.nome}</Btn><Btn size="sm" variant="ghost" onClick={() => revisar({ path: `${path}/rejeitar-sugestao`, titulo: 'Rejeitar sugestão', body: { equipeId: e.id, clubeId: c.id }, impacto: 'Retira a sugestão de identidade da fila.' })}>Não é este clube</Btn></div>)}
        </Card>)}</div>
      </section>
      </div></div>
      {!!historico.length && <DesktopAccordion title="Histórico da integração" count={historico.length}>{historico.map(h => <PaulistaAudit key={h.id} item={h}/>)}</DesktopAccordion>}
    </div>}
    {draft && <CollectionFilterDialog open title="Filtrar campeonatos" onClose={() => setDraft(null)} onClear={() => setDraft({})} onApply={() => { setFiltros(draft); setDraft(null); }}><div className="schedule-filter-fields">
      {chaves.map(k => <DesktopSelect showLabel fullWidth key={k} label={campos[k]} options={[{value:'',label:'Todos'}, ...opcoes[k]]} value={draft[k] || ''} onChange={v => setDraft({ ...draft, [k]: v })}/>)}
    </div></CollectionFilterDialog>}
    {acao && <Modal open title={acao.titulo} onClose={() => { if (!busy) setAcao(null); }} className="schedule-review-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={() => setAcao(null)}>Voltar</Btn><Btn disabled={busy || (!acao.rotina && (motivo.trim().length < 5 || !acao.motivos && !confirmado))} onClick={() => void executar()}>{busy ? 'Registrando…' : acao.label || (acao.rotina || acao.motivos ? 'Confirmar' : 'Registrar decisão')}</Btn></div>}>
      <p>{acao.impacto}</p>
      {acao.motivos ? <div className="paulista-reason-fields"><DesktopSelect label="Motivo" showLabel fullWidth expandInDialog value={motivoCustom ? '__outro' : motivo} options={[...acao.motivos.map(v=>({value:v,label:v})),{value:'__outro',label:'Outro'}]} onChange={v=>{setMotivoCustom(v === '__outro');setMotivo(v === '__outro' ? '' : v);}}/>{motivoCustom && <Input label="Descreva o motivo" value={motivo} maxLength={300} onChange={e=>setMotivo(e.target.value)}/>}</div> : !acao.rotina && <>
        <Input label={acao.label ? 'Passos para reproduzir' : 'Motivo da decisão'} value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)}/>
        <label className="check"><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)}/> Conferi os dados e autorizo a ação.</label>
      </>}
      {erroAcao && <p role="alert" className="notice-error">{erroAcao}</p>}
    </Modal>}
  </div>;
}
