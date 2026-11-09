import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon } from '@web/components/Icon';
import { ClubBadge } from '@web/components/Brand';
import { Btn, Card, LoadingSkeleton, Modal } from '@web/components/UI';
import { OptionTiles } from '../components/OptionTiles';
import { MotivoTiles } from '../components/MotivoTiles';
import { requestJson } from '../services/api';

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
  const url = chamadoId ? `${base}?chamado=${encodeURIComponent(chamadoId)}` : base;
  const [dados, setDados] = useState<Data>();
  const [erro, setErro] = useState('');
  const [formErro, setFormErro] = useState('');
  const [busca, setBusca] = useState('');
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
    setErro('');
    try { setDados(await requestJson<Data>(url)); } catch (e) { setErro((e as Error).message); }
  }
  useEffect(() => { void carregar(); }, []);
  useEffect(() => {
    if (dados?.chamado && dados.pausas.length && dados.pausas.every(p => !p.ativa)) setVerHistorico(true);
  }, [!!dados]);
  useEffect(() => {
    const evento = dados?.eventos.find(e => String(e.id) === eventoInicial);
    if (!evento || !dados) return;
    setBusca(evento.titulo);
    if (!dados.pausas.some(p => p.ativa && (p.escopo === 'GLOBAL' || p.escopo === 'EVENTO' && p.alvoId === evento.id) && ['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'].includes(p.operacao))) {
      setModal('pausar'); setOperacao('AGENDA_OFICIAL'); setEscopo('EVENTO'); setAlvo(String(evento.id));
    }
  }, [eventoInicial, !!dados]);
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
    setPrazo('4'); setRevisar(false); setModal(valor);
  }
  async function salvar() {
    if (!modal || salvando) return;
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
  const visiveis = pausas.filter(p => p.ativa !== verHistorico && (eventoInicial && p.escopo === 'GLOBAL' && ['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'].includes(p.operacao) || `${tipos.find(t => t.value === p.operacao)?.label || p.operacao} ${nomeAlvo(p.escopo, p.alvoId)}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase())));
  const valido = motivo.trim().length >= 10 && (modal !== 'pausar' || !!operacao && !!prazo && (escopo === 'GLOBAL' || !!escopo && !!alvo));
  return <div className="ticket-page match-schedule">
    <header className="page-header"><div><span className="ticket-kicker">Operação da plataforma</span><h1 className="page-title">Manutenção</h1><p className="page-sub">Bloqueie temporariamente uma função enquanto a equipe investiga ou corrige um problema.</p></div><Btn disabled={!dados || chamado?.status === 'RESOLVIDO'} onClick={() => abrir('pausar')}><Icon name="plus" size={18}/> Nova pausa</Btn></header>
    {chamado && <Card className="ticket-section"><h2>Chamado vinculado</h2><p>{chamado.assunto} · {nomeAlvo('CLUBE', chamado.clubeId)}</p><Link to={`/chamados?id=${chamado.id}`}>Voltar ao chamado</Link></Card>}
    <p className="page-sub">Exemplo de uso. Pause a criação de partidas de um clube enquanto a equipe corrige um erro. As partidas já cadastradas continuam disponíveis para consulta.</p>
    <div className="schedule-status-summary" role="group" aria-label="Situação das pausas"><button aria-pressed={!verHistorico} onClick={() => setVerHistorico(false)}>Ativas <span>{pausas.filter(p => p.ativa).length}</span></button><button aria-pressed={verHistorico} onClick={() => setVerHistorico(true)}>Encerradas <span>{pausas.filter(p => !p.ativa).length}</span></button></div>
    <CollectionSearch label="Buscar pausas" placeholder="Buscar por função ou alcance…" value={busca} onChange={setBusca}/>
    {erro && <div role="alert" className="schedule-load-error"><div><strong>Falha ao consultar pausas</strong><p>{erro}</p></div><Btn onClick={() => void carregar()}>Tentar novamente</Btn></div>}
    {confirmacao && <p role="status" className="page-sub">{confirmacao}</p>}
    {!dados && !erro && <LoadingSkeleton kind="cards"/>}
    {dados && <section className="ticket-day" aria-label="Pausas registradas">
      {!visiveis.length && <div className="schedule-empty"><span><Icon name="settings" size={24}/></span><div><h2>Nenhuma pausa {verHistorico ? 'encerrada' : 'ativa'}</h2><p>{busca ? 'Experimente outra busca.' : 'As intervenções serão exibidas aqui.'}</p></div></div>}
      {visiveis.map(p => <Card className="ticket-section" key={p.id}>
        <div className="page-header"><div><h2>{tipos.find(t => t.value === p.operacao)?.label || p.operacao}</h2><p>{nomeAlvo(p.escopo, p.alvoId)} · {p.ativa ? 'Em manutenção' : 'Reativada'}</p></div>
          {p.ativa && tipos.some(t => t.value === p.operacao && t.escopos.includes(p.escopo)) && <Btn variant="ghost" onClick={() => abrir(p)}>Reativar função</Btn>}</div>
        <p>{p.motivo}</p><small>Início {formatar(p.inicio)} · Revisar em {formatar(p.revisarEm)} · Protocolo {p.id}</small>
        {p.ativa && Date.parse(p.revisarEm) <= Date.now() && <p><strong>Revisão vencida</strong> · A função continua pausada.</p>}
        {p.chamadoId && !chamado && <Link to={`/chamados?id=${p.chamadoId}`}>Abrir chamado vinculado</Link>}
        <details><summary>Histórico da intervenção</summary>{p.historico.map(h => <p key={h.id}>{formatar(h.criadoEm)} · {h.depois.ativa ? 'Pausada' : 'Reativada'} · {h.motivo}</p>)}</details>
      </Card>)}
    </section>}
    {modal && <Modal open title={modal === 'pausar' ? 'Pausar uma função' : 'Reativar função'} onClose={() => { if (!salvando) setModal(null); }} className="chamado-manual-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={salvando} onClick={() => revisar ? setRevisar(false) : setModal(null)}>{revisar ? 'Voltar' : 'Cancelar'}</Btn><Btn disabled={!valido || salvando} onClick={() => revisar ? void salvar() : setRevisar(true)}>{salvando ? 'Registrando…' : revisar ? modal === 'pausar' ? 'Confirmar pausa' : 'Confirmar reativação' : 'Revisar impacto'}</Btn></div>}>
      {revisar ? <div className="schedule-review"><h3>{modal === 'pausar' ? selecao?.label : tipos.find(t => t.value === modal.operacao)?.label}</h3>
        <p>{modal === 'pausar' ? nomeAlvo(escopo, Number(alvo)) : nomeAlvo(modal.escopo, modal.alvoId)}</p>
        <p>{modal === 'pausar' ? 'Novas operações desta função serão bloqueadas neste alcance. Consultas, histórico e scout continuam disponíveis. A revisão é um lembrete e não encerra a pausa automaticamente.' : 'Este bloqueio será encerrado. Outras pausas que atinjam o mesmo alcance continuam valendo.'}</p><p>{motivo}</p></div>
        : <div className="schedule-review">
          {modal === 'pausar' && <>
            <OptionTiles label="Função" value={operacao} options={tipos.filter(t => chamado ? t.escopos.includes('CLUBE') : t.escopos.length > 0)} onChange={v => { setOperacao(v); if (!chamado) { setEscopo(''); setAlvo(''); } }}/>
            {chamado && <div className="linha-clube"><ClubBadge src={clubeChamado?.escudo} name={clubeChamado?.nome} size={34}/><p>Alcance: {nomeAlvo('CLUBE', chamado.clubeId)} · Clube deste chamado</p></div>}
            {selecao && !chamado && <OptionTiles label="Alcance" value={escopo} options={selecao.escopos.map(v => ({ value: v, label: escopos[v] }))} onChange={v => { setEscopo(v); setAlvo(''); }}/>}
            {escopo === 'CLUBE' && !chamado && <OptionTiles label="Clube" value={alvo} options={(dados?.clubes || []).map(c => ({ value: c.id, label: c.nome, icon: <ClubBadge src={c.escudo} name={c.nome} size={32}/> }))} onChange={setAlvo} scroll/>}
            {escopo === 'EVENTO' && <OptionTiles label="Evento" value={alvo} options={(dados?.eventos || []).map(e => ({ value: e.id, label: `${e.titulo} · ${e.categoria}` }))} onChange={setAlvo} scroll/>}
            <OptionTiles label="Revisar em" options={horas} value={prazo} onChange={setPrazo}/>
            <p>Prazo para a equipe voltar e verificar. A pausa continua até alguém reativar a função.</p>
          </>}
          <MotivoTiles label={modal === 'pausar' ? 'Motivo público da pausa' : 'Motivo da reativação'}
            options={modal === 'pausar' ? ['Dados em conferência', 'Correção em andamento', 'Instabilidade na operação'] : ['Correção validada pela equipe', 'Dados conferidos', 'Serviço disponível novamente']}
            value={motivo} onChange={setMotivo} custom={motivoCustom} setCustom={setMotivoCustom}/>
          <p>{modal === 'pausar' ? 'O motivo da pausa aparece para quem tentar usar a função.' : 'Descreva o que foi conferido antes de liberar a função. O registro fica no histórico da equipe.'}</p>
        </div>}
      {formErro && <p role="alert" className="notice-error">{formErro}</p>}
    </Modal>}
  </div>;
}
