import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useId, useState } from 'react';
import { CollectionFilterButton, CollectionFilterDialog, CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon } from '@web/components/Icon';
import { ClubBadge } from '@web/components/Brand';
import { Btn, Card, DesktopState, LoadingSkeleton, Modal } from '../components/AdminUI';
import { DesktopSelect } from '../components/DesktopSelect';
import { DesktopTabs } from '../components/DesktopTabs';
import { DesktopAccordion } from '../components/DesktopAccordion';
import { PlatformClubOption } from '../components/PlatformClubCollection';
import { MaintenanceReasonIcon, motivosPausa, motivosReativacao } from '../components/MaintenanceReasonIcon';
import { requestJson } from '../services/api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import './Manutencao.css';

const base = '/admin/equipe/manutencao';
const formatar = (v: string) => new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const horas = [{ value: '1', label: 'Em 1 hora' }, { value: '4', label: 'Em 4 horas' }, { value: '24', label: 'Em 24 horas' }];
const escopos = { GLOBAL: 'Toda a plataforma', CLUBE: 'Um clube', EVENTO: 'Um evento Paulista' };
type Escopo = keyof typeof escopos;
type Pausa = { id: string; operacao: string; escopo: Escopo; alvoId: number; chamadoId: string | null; ativa: boolean; motivo: string; inicio: string; revisarEm: string; revisao: number; historico: { id: number; operadorId: number; motivo: string; criadoEm: string; depois: { ativa: boolean } }[] };
type Data = { pausas: Pausa[]; clubes: { id: number; nome: string; escudo?: string | null }[]; eventos: { id: number; titulo: string; categoria: string }[]; operacoes: { value: string; label: string; escopos: Escopo[] }[]; chamado: { id: string; assunto: string; clubeId: number; status: string } | null };

export default function ManutencaoPage() {
  const [params] = useSearchParams();
  const chamadoId = params.get('chamado');
  const eventoId = params.get('evento');
  return <ManutencaoContexto key={`${chamadoId || ''}:${eventoId || ''}`} chamadoId={chamadoId} eventoInicial={eventoId}/>;
}

function ManutencaoContexto({ chamadoId, eventoInicial }: { chamadoId: string | null; eventoInicial: string | null }) {
  const dev = useAdminAuth().usuario?.papel_plataforma === 'DESENVOLVEDOR';
  const grupoClube = useId();
  const url = chamadoId ? `${base}?chamado=${encodeURIComponent(chamadoId)}` : base;
  const [dados, setDados] = useState<Data>();
  const [erro, setErro] = useState('');
  const [formErro, setFormErro] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaClube, setBuscaClube] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState({operacao:'',escopo:'',revisao:''});
  const [rascunho, setRascunho] = useState<typeof filtros | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);
  const [modal, setModal] = useState<'pausar' | Pausa | null>(null);
  const [operacao, setOperacao] = useState('');
  const [escopo, setEscopo] = useState('');
  const [alvo, setAlvo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [motivoCustom, setMotivoCustom] = useState(false);
  const [prazo, setPrazo] = useState('4');
  const [salvando, setSalvando] = useState(false);
  const [revisar, setRevisar] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  async function carregar() {
    setErro(''); setCarregando(true);
    try { setDados(await requestJson<Data>(url)); } catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);
  useEffect(() => {
    if (dados?.chamado && dados.pausas.length && dados.pausas.every(p => !p.ativa)) setVerHistorico(true);
  }, [!!dados]);
  useEffect(() => {
    const evento = dados?.eventos.find(e => String(e.id) === eventoInicial);
    if (!evento || !dados) return;
    setBusca(evento.titulo);
    if (!dev && !dados.pausas.some(p => p.ativa && (p.escopo === 'GLOBAL' || p.escopo === 'EVENTO' && p.alvoId === evento.id) && ['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'].includes(p.operacao))) {
      setModal('pausar'); setOperacao('AGENDA_OFICIAL'); setEscopo('EVENTO'); setAlvo(String(evento.id));
    }
  }, [eventoInicial, !!dados, dev]);
  const chamado = dados?.chamado;
  const clubeChamado = dados?.clubes.find(c => c.id === chamado?.clubeId);
  const pausas = dados?.pausas || [];
  const tipos = dados?.operacoes || [];
  const selecao = tipos.find(t => t.value === operacao);
  function nomeAlvo(esc: string, id: number) {
    if (esc === 'GLOBAL') return 'Toda a plataforma';
    if (esc === 'CLUBE') return dados?.clubes.find(c => c.id === id)?.nome || 'Clube';
    const e = dados?.eventos.find(c => c.id === id);
    return e ? `${e.titulo} · ${e.categoria}` : 'Evento Paulista';
  }
  function abrir(valor: 'pausar' | Pausa) {
    setConfirmacao(''); setFormErro(''); setMotivo(''); setMotivoCustom(false); setOperacao('');
    setEscopo(chamado ? 'CLUBE' : ''); setAlvo(chamado ? String(chamado.clubeId) : '');
    setPrazo('4'); setBuscaClube(''); setRevisar(false); setModal(valor);
  }
  async function salvar() {
    if (!modal || salvando || !valido) return;
    setSalvando(true); setFormErro('');
    try {
      if (modal === 'pausar') await requestJson(base, { method: 'POST', body: { operacao, escopo, alvoId: escopo === 'GLOBAL' ? 0 : Number(alvo), motivo, revisarEm: new Date(Date.now() + Number(prazo) * 3600000).toISOString(), chamadoId: chamado?.id } });
      else await requestJson(`${base}/${modal.id}/reativar`, { method: 'POST', body: { motivo, revisao: modal.revisao } });
      setConfirmacao(modal === 'pausar' ? 'Pausa registrada.' : 'Função reativada. Histórico atualizado.');
      setVerHistorico(modal !== 'pausar');
      setModal(null); await carregar();
    } catch (e) { setFormErro((e as Error).message); }
    finally { setSalvando(false); }
  }
  const visiveis = pausas.filter(p => p.ativa !== verHistorico && (eventoInicial && p.escopo === 'GLOBAL' && ['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'].includes(p.operacao) || `${tipos.find(t => t.value === p.operacao)?.label || p.operacao} ${nomeAlvo(p.escopo, p.alvoId)}`.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()))
    && (!filtros.operacao || p.operacao === filtros.operacao) && (!filtros.escopo || p.escopo === filtros.escopo)
    && (!filtros.revisao || p.ativa && (filtros.revisao === 'atrasada' ? Date.parse(p.revisarEm) <= Date.now() : Date.parse(p.revisarEm) > Date.now())));
  const alvoValido = escopo === 'GLOBAL' || escopo === 'CLUBE' && !!dados?.clubes.some(c => String(c.id) === alvo) || escopo === 'EVENTO' && !!dados?.eventos.some(e => String(e.id) === alvo);
  const valido = motivo.trim().length >= 10 && motivo.length <= 300 && (modal !== 'pausar' || !!selecao?.escopos.includes(escopo as Escopo) && horas.some(h => h.value === prazo) && alvoValido);
  const opcoesMotivo = modal === 'pausar' ? motivosPausa : motivosReativacao;
  const clubesVisiveis = (dados?.clubes || []).filter(c => String(c.id) === alvo || c.nome.toLocaleLowerCase().includes(buscaClube.trim().toLocaleLowerCase()));
  const filtrosAtivos = Object.values(filtros).filter(Boolean).length;
  return <div className="ticket-page desktop-maintenance-page">
    <header className="page-header"><div><span className="ticket-kicker">Operação da plataforma</span><h1 className="page-title">Manutenção</h1><p className="page-sub">{dev ? 'Consulte as pausas temporárias e o histórico de intervenções.' : 'Gerencie pausas temporárias e acompanhe as revisões.'}</p></div>
      <div className="actions"><Btn variant="ghost" loading={carregando} disabled={salvando} onClick={() => void carregar()}>{!carregando && <Icon name="refresh" size={17}/>}Atualizar</Btn>{!dev && <Btn disabled={!dados || carregando || chamado?.status === 'RESOLVIDO'} onClick={() => abrir('pausar')}><Icon name="plus" size={17}/>Nova pausa</Btn>}</div>
    </header>
    {chamado && <Card className="maintenance-linked"><div><span>Chamado vinculado · {nomeAlvo('CLUBE', chamado.clubeId)}</span><strong>{chamado.assunto}</strong></div><Link to={`/chamados?id=${chamado.id}`}>Voltar ao chamado<Icon name="chevronRight" size={15}/></Link></Card>}
    <DesktopTabs label="Situação das pausas" value={verHistorico ? 'encerradas' : 'ativas'} options={[
      {value:'ativas',label:'Ativas',count:pausas.filter(p=>p.ativa).length},
      {value:'encerradas',label:'Encerradas',count:pausas.filter(p=>!p.ativa).length},
    ]} onChange={v=>{setVerHistorico(v === 'encerradas'); if(v === 'encerradas') setFiltros(f=>({...f,revisao:''}));}}>
      <div className="maintenance-toolbar"><CollectionSearch label="Buscar pausas" placeholder="Buscar por função ou alcance…" value={busca} onChange={setBusca}/><CollectionFilterButton label="Filtrar pausas" count={filtrosAtivos} onClick={()=>setRascunho({...filtros})}/></div>
      {!!filtrosAtivos && <div className="maintenance-active-filters"><span>{filtrosAtivos} {filtrosAtivos === 1 ? 'filtro aplicado' : 'filtros aplicados'}</span><button type="button" onClick={()=>setFiltros({operacao:'',escopo:'',revisao:''})}>Limpar filtros</button></div>}
      {erro && <DesktopState error title="Falha ao consultar pausas" description={erro} onRetry={() => void carregar()}/>}
      {confirmacao && <p role="status" className="maintenance-feedback"><Icon name="checkAll" size={16}/>{confirmacao}</p>}
      {!dados && !erro && <LoadingSkeleton kind="rows" label="Carregando manutenções"/>}
      {dados && <section className="maintenance-list" aria-label="Pausas registradas" aria-busy={carregando}>
        <div className="maintenance-list-heading"><p>{visiveis.length} {visiveis.length === 1 ? `pausa ${verHistorico ? 'encerrada' : 'ativa'}` : `pausas ${verHistorico ? 'encerradas' : 'ativas'}`}</p><DesktopAccordion title="Como funcionam as pausas"><p>Consultas e históricos continuam disponíveis. O prazo é um lembrete de revisão: a função só volta quando a equipe reativá-la.</p></DesktopAccordion></div>
        {!visiveis.length && <DesktopState plain icon="wrench" title={`Nenhuma pausa ${verHistorico ? 'encerrada' : 'ativa'}`} description={busca || filtrosAtivos ? 'Ajuste a busca ou limpe os filtros.' : 'As intervenções serão exibidas aqui.'}/>}
        {visiveis.map(p => {
          const atrasada = p.ativa && Date.parse(p.revisarEm) <= Date.now();
          const clube = p.escopo === 'CLUBE' ? dados.clubes.find(c=>c.id === p.alvoId) : null;
          return <Card className="maintenance-card" key={p.id}>
            <header className="maintenance-card-header"><div className="maintenance-identity"><span className="maintenance-icon"><MaintenanceReasonIcon reason={p.motivo} size={20}/></span><div><h2>{tipos.find(t => t.value === p.operacao)?.label || p.operacao}</h2><span className="maintenance-target">{clube && <ClubBadge src={clube.escudo} name={clube.nome} size={32}/>}<span>{nomeAlvo(p.escopo, p.alvoId)}</span></span></div></div>
              <span className="maintenance-state" data-state={!p.ativa ? 'ended' : atrasada ? 'overdue' : 'active'}>{!p.ativa ? 'Reativada' : atrasada ? 'Revisão atrasada' : 'Em manutenção'}</span>
            </header>
            <p className="maintenance-reason">{p.motivo}</p>
            <div className="maintenance-card-bottom"><dl><div><dt>Início da pausa</dt><dd>{formatar(p.inicio)}</dd></div><div><dt>{p.ativa ? 'Revisar até' : 'Revisão prevista'}</dt><dd className={atrasada ? 'maintenance-overdue' : ''}>{formatar(p.revisarEm)}</dd></div></dl>
              {p.ativa && tipos.some(t => t.value === p.operacao && t.escopos.includes(p.escopo)) && <Btn variant="ghost" disabled={salvando || carregando} onClick={() => abrir(p)}>Reativar função</Btn>}
            </div>
            {atrasada && <p className="maintenance-review-note"><Icon name="clock" size={14}/>O prazo de revisão venceu. A função continua pausada.</p>}
            {p.chamadoId && !chamado && <Link className="maintenance-ticket-link" to={`/chamados?id=${p.chamadoId}`}>Abrir chamado vinculado<Icon name="chevronRight" size={15}/></Link>}
            <DesktopAccordion title="Histórico da intervenção" count={p.historico.length}>
              <p className="maintenance-protocol">Protocolo {p.id}</p>
              {!p.historico.length && <p>Ainda não há movimentações registradas.</p>}
              <ol className="maintenance-history">{p.historico.map(h => <li key={h.id}><time dateTime={h.criadoEm}>{formatar(h.criadoEm)}</time><strong><MaintenanceReasonIcon reason={h.motivo} size={15}/>{h.depois.ativa ? 'Função pausada' : 'Função reativada'}</strong><p>{h.motivo}</p></li>)}</ol>
            </DesktopAccordion>
          </Card>;
        })}
      </section>}
    </DesktopTabs>
    {rascunho && <CollectionFilterDialog open title="Filtrar pausas" onClose={()=>setRascunho(null)} onClear={()=>setRascunho({operacao:'',escopo:'',revisao:''})} onApply={()=>{setFiltros(rascunho);setRascunho(null);}}>
      <div className="maintenance-filter-fields">
        <DesktopSelect label="Função" showLabel fullWidth expandInDialog value={rascunho.operacao} options={[{value:'',label:'Todas as funções'},...tipos]} onChange={v=>setRascunho({...rascunho,operacao:v})}/>
        <DesktopSelect label="Alcance" showLabel fullWidth expandInDialog value={rascunho.escopo} options={[{value:'',label:'Todos os alcances'},...Object.entries(escopos).map(([value,label])=>({value,label}))]} onChange={v=>setRascunho({...rascunho,escopo:v})}/>
        {!verHistorico && <DesktopSelect label="Revisão" showLabel fullWidth expandInDialog value={rascunho.revisao} options={[{value:'',label:'Todos os prazos'},{value:'atrasada',label:'Revisão atrasada'},{value:'no-prazo',label:'Dentro do prazo'}]} onChange={v=>setRascunho({...rascunho,revisao:v})}/>}
      </div>
    </CollectionFilterDialog>}
    {modal && <Modal open title={modal === 'pausar' ? 'Pausar uma função' : 'Reativar função'} onClose={() => { if (!salvando) setModal(null); }} className="maintenance-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={salvando} onClick={() => revisar ? setRevisar(false) : setModal(null)}>{revisar ? 'Voltar' : 'Cancelar'}</Btn><Btn disabled={!valido || salvando} onClick={() => revisar ? void salvar() : setRevisar(true)}>{salvando ? 'Registrando…' : revisar ? modal === 'pausar' ? 'Confirmar pausa' : 'Confirmar reativação' : 'Revisar impacto'}</Btn></div>}>
      {revisar ? <div className="maintenance-review">
        <div className="maintenance-review-heading"><span className="maintenance-icon"><MaintenanceReasonIcon reason={motivo} size={21}/></span><div><h3>{modal === 'pausar' ? selecao?.label : tipos.find(t => t.value === modal.operacao)?.label}</h3><p>{modal === 'pausar' ? nomeAlvo(escopo, Number(alvo)) : nomeAlvo(modal.escopo, modal.alvoId)}</p></div></div>
        <div className="maintenance-impact"><Icon name="alert" size={19}/><p>{modal === 'pausar' ? 'Novas operações desta função serão bloqueadas neste alcance. Consultas, histórico e scout continuam disponíveis.' : 'Este bloqueio será encerrado. Outras pausas que atinjam o mesmo alcance continuam valendo.'}</p></div>
        <dl><div><dt>{modal === 'pausar' ? 'Motivo público' : 'Motivo da reativação'}</dt><dd>{motivo}</dd></div>{modal === 'pausar' && <div><dt>Próxima revisão</dt><dd>{horas.find(h=>h.value === prazo)?.label}</dd></div>}</dl>
        {modal === 'pausar' && <p className="maintenance-hint">A revisão é um lembrete e não encerra a pausa automaticamente.</p>}
      </div> : <div className="maintenance-form" aria-busy={salvando}>
        <p className="maintenance-hint">{modal === 'pausar' ? 'Escolha o que será pausado, o alcance e o motivo.' : 'Confira o que foi corrigido antes de liberar a função.'}</p>
        {modal === 'pausar' ? <>
          <DesktopSelect label="Função" showLabel fullWidth expandInDialog value={operacao} placeholder="Selecione a função a pausar" options={tipos.filter(t => chamado ? t.escopos.includes('CLUBE') : t.escopos.length > 0)} onChange={v => { setOperacao(v); if (!chamado) { setEscopo(''); setAlvo(''); } }}/>
          {chamado && <div className="maintenance-linked-club"><ClubBadge src={clubeChamado?.escudo} name={clubeChamado?.nome} size={32}/><div><small>Alcance do chamado</small><strong>{nomeAlvo('CLUBE', chamado.clubeId)}</strong></div></div>}
          {selecao && !chamado && <DesktopSelect label="Alcance" showLabel fullWidth expandInDialog value={escopo} placeholder="Selecione o alcance" options={selecao.escopos.map(v => ({value:v,label:escopos[v]}))} onChange={v=>{setEscopo(v);setAlvo('');}}/>}
          {escopo === 'CLUBE' && !chamado && <fieldset className="maintenance-clubs"><legend>Clube</legend>
            {dados!.clubes.length > 6 && <CollectionSearch label="Buscar clube" placeholder="Buscar clube pelo nome…" value={buscaClube} onChange={setBuscaClube}/>}
            <div className="maintenance-club-options">{clubesVisiveis.map(c=><PlatformClubOption key={c.id} clube={{...c,escudo:c.escudo || null,cidade:null,estado:null}} name={grupoClube} checked={String(c.id) === alvo} onSelect={()=>setAlvo(String(c.id))} detail="Pausar somente neste clube"/>)}</div>
            {!clubesVisiveis.length && <p className="maintenance-hint">Nenhum clube encontrado.</p>}
          </fieldset>}
          {escopo === 'EVENTO' && <DesktopSelect label="Evento" showLabel fullWidth expandInDialog value={alvo} placeholder="Selecione o evento" options={(dados?.eventos || []).map(e=>({value:String(e.id),label:`${e.titulo} · ${e.categoria}`}))} onChange={setAlvo}/>}
          <DesktopSelect label="Revisar em" showLabel fullWidth expandInDialog options={horas} value={prazo} onChange={setPrazo}/>
          <p className="maintenance-hint">O prazo é para a equipe revisar. A pausa continua até ser reativada.</p>
        </> : <div className="maintenance-review-heading"><span className="maintenance-icon"><MaintenanceReasonIcon reason={modal.motivo} size={21}/></span><div><h3>{tipos.find(t=>t.value === modal.operacao)?.label || modal.operacao}</h3><p>{nomeAlvo(modal.escopo,modal.alvoId)}</p></div></div>}
        <DesktopSelect label={modal === 'pausar' ? 'Motivo público da pausa' : 'Motivo da reativação'} showLabel fullWidth expandInDialog value={motivoCustom ? '__outro' : motivo} placeholder="Selecione o motivo" options={[...opcoesMotivo.map(v=>({value:v,label:v,icon:<MaintenanceReasonIcon reason={v}/>})),{value:'__outro',label:'Outro',icon:<MaintenanceReasonIcon reason="Outro"/>}]} onChange={v=>{setMotivoCustom(v === '__outro');setMotivo(v === '__outro' ? '' : v);}}/>
        {motivoCustom && <label className="field"><span className="field-label">Descreva o motivo</span><textarea className="field-input" aria-label="Descreva o motivo" rows={3} minLength={10} maxLength={300} value={motivo} onChange={e=>setMotivo(e.target.value)}/><small className="maintenance-hint">Mínimo de 10 caracteres · {motivo.length}/300</small></label>}
        <p className="maintenance-hint">{modal === 'pausar' ? 'Este motivo aparece para quem tentar usar a função.' : 'O motivo ficará registrado no histórico da equipe.'}</p>
      </div>}
      {formErro && <p role="alert" className="notice-error">{formErro}</p>}
    </Modal>}
  </div>;
}
