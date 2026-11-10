import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CollectionFilterButton, CollectionFilterDialog, CollectionSearch } from '@web/components/CollectionToolbar';
import { DesktopSelect } from '../components/DesktopSelect';
import { DesktopTabs } from '../components/DesktopTabs';
import { DesktopToggle } from '../components/DesktopToggle';
import { DesktopAccordion } from '../components/DesktopAccordion';
import { agruparFinalizados } from '../../../shared/ticket-periods';
import { SchedulePeriodDialog } from '@web/components/SchedulePeriodDialog';
import { Icon } from '@web/components/Icon';
import { Btn, Card, DesktopState, LoadingSkeleton, Modal, Spinner } from '../components/AdminUI';
import { Toast } from '@web/components/Toast';
import '@web/pages/Partidas.css';
import SupportOperations from '../components/SupportOperations';
import ChamadoManual from '../components/ChamadoManual';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { requestJson } from '../services/api';
import './Chamados.css';

const estados = [
  { value: 'NOVO', label: 'Novo' }, { value: 'EM_TRIAGEM', label: 'Em triagem' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente' }, { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'ENCAMINHADO_DEVS', label: 'Encaminhado aos devs' }, { value: 'RESOLVIDO', label: 'Finalizado' },
  { value: 'REABERTO', label: 'Reaberto' },
];
const tipos = [
  { value: 'CONVITE', label: 'Convite' }, { value: 'RECUPERACAO', label: 'Recuperação' },
  { value: 'SEGURANCA', label: 'Segurança' }, { value: 'CONFIGURACAO', label: 'Configuração' },
  { value: 'DUVIDA', label: 'Dúvida' }, { value: 'ERRO', label: 'Erro' }, { value: 'OUTRO', label: 'Outro' },
];
const origens = [{ value: 'CLIENTE', label: 'Enviado pelo cliente' }, { value: 'AUTOMATICO', label: 'Detectado pelo sistema' }, { value: 'OPERACAO', label: 'Encaminhado pela operação' }];
const prioridades = [{ value: 'ALTA', label: 'Alta' }, { value: 'NORMAL', label: 'Normal' }];
const atalhos = [{ value: '', label: 'Todos' }, { value: 'NOVO', label: 'Novos' }, { value: 'ATRASADO', label: 'Revisão atrasada' }, { value: 'RECORRENTE', label: 'Recorrentes' }];
const periodos = [{ value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Últimos 7 dias' }, { value: 'mes', label: 'Últimos 30 dias' }];
const rotulo = (opcoes: { value: string; label: string }[], valor: string) => opcoes.find(o => o.value === valor)?.label || valor;
const humanizar = (valor: string) => valor.replace(/_/g, ' ').toLowerCase();
const zona = { timeZone: 'America/Sao_Paulo' };
const dia = (valor: string) => new Date(valor).toLocaleDateString('sv-SE', zona);
const hora = (valor: string) => new Date(valor).toLocaleTimeString('pt-BR', { ...zona, hour: '2-digit', minute: '2-digit' });
const dataLonga = (valor: string) => new Date(`${valor}T12:00:00-03:00`).toLocaleDateString('pt-BR', { ...zona, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const filtrosExtras = ['status', 'origem', 'prioridade', 'tipo', 'clube', 'responsavel'] as const;
const endpoint = '/admin/equipe/chamados';
const decisoes = {
  FINALIZAR: { titulo: 'Finalizar chamado', campo: 'Como o problema foi resolvido?', texto: 'O chamado será finalizado. Uma pausa vinculada continua sob controle da aba Manutenção.' },
  ENCAMINHAR: { titulo: 'Encaminhar aos desenvolvedores', campo: 'Passos para reproduzir o problema', texto: 'O relato e o diagnóstico técnico vão para a fila de desenvolvimento.' },
  DEVOLVER: { titulo: 'Devolver ao suporte', campo: 'O que foi corrigido ou precisa ser conferido?', texto: 'O suporte recebe o chamado para verificar o resultado com o cliente.' },
};
type Decisao = keyof typeof decisoes;
const historicoRotulos: Record<string, string> = { MANUTENCAO_PAUSADA: 'Função pausada', MANUTENCAO_REATIVADA: 'Função reativada', FINALIZAR: 'Chamado finalizado' };

type Chamado = {
  id: string; assunto: string; descricao: string; origem: string; tipo: string; status: string; prioridade: string;
  regra: string; fila: string; restrito: boolean; clubeId: number | null; usuarioId?: number | null; clube?: { nome: string };
  clubesAfetadosNomes?: string[]; ocorrencias: number; criadoEm: string; revisarEm: string; revisao: number; finalizadoEm?: string | null;
  rota: string; versao: string; servico: string;
  detalhesTecnicos?: { reproducao?: string; correlacao?: string; statusHttp?: number; comparacao?: { oficial?: number[]; local?: number[] }; pistas?: { arquivo: string; linha: number; coluna: number }[] };
  manutencoes?: { id: string; ativa: boolean }[];
  historico?: { id: number; acao: string; motivo: string; criadoEm: string; operadorId: number | null; dados?: { correlacao?: string; status?: number; protocolo?: string; funcao?: string } }[];
};
type Opcoes = { clubes: { value: number; label: string }[]; responsaveis: { value: number; label: string }[]; contagens: Record<string, number> };

export default function ChamadosPage() {
  const { usuario } = useAdminAuth();
  const dev = usuario?.papel_plataforma === 'DESENVOLVEDOR';
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const [lista, setLista] = useState<Chamado[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [erroOpcoes, setErroOpcoes] = useState('');
  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState('');
  const [criando, setCriando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [status, setStatus] = useState('EM_TRIAGEM');
  const [tipo, setTipo] = useState('OUTRO');
  const [publico, setPublico] = useState(false);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [notaDecisao, setNotaDecisao] = useState('');
  const [compartilharResumo, setCompartilharResumo] = useState(true);
  const [erroDecisao, setErroDecisao] = useState('');
  const [rascunho, setRascunho] = useState<Record<string, string> | null>(null);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const query = params.toString();
  const ler = (chave: string) => params.get(chave) || '';

  function alterar(filtros: Record<string, string>, replace = false) {
    setParams(anterior => {
      const next = new URLSearchParams(anterior);
      for (const [chave, valor] of Object.entries(filtros)) {
        if (valor) next.set(chave, valor); else next.delete(chave);
      }
      return next;
    }, { replace });
  }

  useEffect(() => {
    let ativo = true;
    setErroOpcoes('');
    void requestJson<Opcoes>(`${endpoint}/filtros`).then(v => { if (ativo) setOpcoes(v); })
      .catch(() => { if (ativo) setErroOpcoes('Não foi possível atualizar os filtros e contadores.'); });
    return () => { ativo = false; };
  }, [atualizacao]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    const timer = window.setTimeout(async () => {
      try {
        if (id) {
          const chamado = await requestJson<Chamado>(`${endpoint}/${id}`);
          if (ativo) setDetalhe(chamado);
        } else {
          const filtros = new URLSearchParams(query);
          filtros.set('ordem', 'prioridade');
          filtros.set('incluirEncerramento', '1');
          const itens = await requestJson<Chamado[]>(`${endpoint}?${filtros}`);
          if (ativo) setLista(itens);
        }
      } catch (e) { if (ativo) setErro((e as Error).message); }
      finally { if (ativo) setCarregando(false); }
    }, id ? 0 : 180);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [id, query, atualizacao]);

  useEffect(() => {
    setMotivo(''); setPublico(false); setResultado(''); setDecisao(null);
    document.getElementById('main-content')?.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => {
    if (detalhe?.id === id) {
      setStatus(detalhe.status === 'RESOLVIDO' ? 'REABERTO' : detalhe.status);
      setTipo(detalhe.tipo);
    }
  }, [id, detalhe?.id, detalhe?.revisao]);

  function abrirDecisao(acao: Decisao) {
    setDecisao(acao); setNotaDecisao(''); setCompartilharResumo(true); setErroDecisao('');
  }

  async function agir(acao: string, entrada?: { motivo: string; publico: boolean }) {
    if (!detalhe || busy) return;
    setBusy(true); setErro(''); setResultado('');
    try {
      await requestJson(`${endpoint}/${detalhe.id}`, { method: 'PATCH', body: { acao, motivo, status, tipo, publico, ...entrada, revisao: detalhe.revisao } });
      if (entrada) setDecisao(null); else setMotivo('');
      if (acao === 'DEVOLVER' && dev) alterar({ id: '' });
      else { setResultado('Alteração registrada no histórico.'); setAtualizacao(n => n + 1); }
    } catch (e) { if (entrada) setErroDecisao((e as Error).message); else setErro((e as Error).message); }
    finally { setBusy(false); }
  }

  const valido = !busy && !carregando && motivo.trim().length >= 5;
  const periodo = ler('periodo');
  const periodoLabel = periodo === 'intervalo' && ler('desde') && ler('ate')
    ? `${ler('desde').split('-').reverse().join('/')} a ${ler('ate').split('-').reverse().join('/')}`
    : rotulo(periodos, periodo);
  const chips = [
    ...filtrosExtras.map(key => ({ key, label: ({
      status: rotulo(estados, ler(key)), origem: rotulo(origens, ler(key)), tipo: rotulo(tipos, ler(key)),
      prioridade: rotulo(prioridades, ler(key)), clube: opcoes?.clubes.find(c => String(c.value) === ler(key))?.label || 'Clube selecionado',
      responsavel: opcoes?.responsaveis.find(c => String(c.value) === ler(key))?.label || 'Responsável selecionado',
    })[key] })).filter(item => ler(item.key)),
    ...(periodo ? [{ key: 'periodo', label: periodoLabel }] : []),
  ];
  const grupos = new Map<string, Chamado[]>();
  const ordenados = lista.filter(c => c.status !== 'RESOLVIDO').sort((a, b) => Number(b.prioridade === 'ALTA') - Number(a.prioridade === 'ALTA') || Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
  for (const chamado of ordenados) {
    const chave = `${chamado.prioridade === 'ALTA' ? 'ALTA' : 'NORMAL'}:${dia(chamado.criadoEm)}`;
    const grupo = grupos.get(chave) || [];
    grupo.push(chamado);
    grupos.set(chave, grupo);
  }
  const hoje = dia(new Date().toISOString());
  const atual = detalhe?.id === id ? detalhe : null;
  const finalizados = agruparFinalizados(lista.filter(c => c.status === 'RESOLVIDO'));
  const atalhosPapel = [...atalhos, dev ? { value: 'ENCAMINHADOS', label: 'Encaminhados' } : { value: 'MEUS', label: 'Meus chamados' }, {value:'FINALIZADOS',label:'Finalizados'}];
  const renderChamado = (c: Chamado) => <button className="ticket-card" key={c.id} type="button" onClick={() => alterar({ id: c.id })}>
    <span className="ticket-card-icon"><Icon name={c.origem === 'AUTOMATICO' ? 'alert' : 'headset'} size={20}/></span>
    <span className="ticket-card-copy"><strong>{c.assunto}</strong><small>{c.clube?.nome || c.clubesAfetadosNomes?.join(', ') || 'Plataforma'} · {rotulo(tipos, c.tipo)}{c.ocorrencias > 1 ? ` · ${c.ocorrencias} ocorrências` : ''}</small>
      {(c.prioridade === 'ALTA' || c.status !== 'RESOLVIDO' && Date.parse(c.revisarEm) < Date.now()) && <span className="ticket-card-notes">
        {c.prioridade === 'ALTA' && <span className="ticket-priority">Prioridade alta</span>}
        {c.status !== 'RESOLVIDO' && Date.parse(c.revisarEm) < Date.now() && <span className="ticket-overdue"><Icon name="clock" size={12}/>Revisão atrasada</span>}
      </span>}
    </span>
    <time className="ticket-created-time" dateTime={c.finalizadoEm || c.criadoEm}>{hora(c.finalizadoEm || c.criadoEm)}</time>
    <span className="ticket-status" data-state={c.status}>{rotulo(estados, c.status)}</span>
  </button>;

  return <div className="ticket-page match-schedule desktop-tickets-page">
    {id && <Btn className="ticket-back" variant="ghost" onClick={() => alterar({ id: '' })}><Icon name="chevronLeft" size={17}/> Voltar à fila</Btn>}
    <header className="page-header">
      <div><span className="ticket-kicker">Central de atendimento</span><h1 className="page-title">{id ? atual?.assunto || 'Detalhe do chamado' : dev ? 'Caixa de desenvolvimento' : 'Chamados'}</h1>
        <p className="page-sub">{id ? `Protocolo ${id}` : 'Acompanhe o atendimento e as ocorrências do Ludora.'}</p></div>
      <div className="actions"><Btn variant="ghost" className="ticket-refresh" disabled={carregando || busy} onClick={() => setAtualizacao(n => n + 1)}><Icon name="refresh" size={17}/> {id ? 'Atualizar chamado' : 'Atualizar fila'}</Btn>
        {!id && !dev && <Btn onClick={() => setCriando(true)}><Icon name="plus" size={17}/> Novo chamado</Btn>}</div>
    </header>
    {!id && <>
      {erroOpcoes && <p role="alert" className="notice-error">{erroOpcoes} <Btn variant="ghost" size="sm" onClick={() => setAtualizacao(n => n + 1)}>Tentar novamente</Btn></p>}
      <DesktopTabs label="Atalhos da fila" value={ler('visao')} options={atalhosPapel.map(a => ({...a,count:opcoes?.contagens[a.value]}))}
        onChange={visao => alterar({ visao, status: '' })}>
      <div className="schedule-filter-primary ticket-toolbar">
        <CollectionSearch label="Buscar chamados" placeholder="Buscar por assunto, clube ou protocolo…" value={ler('busca')} onChange={busca => alterar({ busca: busca.slice(0, 60) }, true)}/>
        <DesktopSelect label="Período" fullWidth value={periodo} options={[{value:'',label:'Todos os períodos'}, ...periodos, { value: 'intervalo', label: periodo === 'intervalo' ? periodoLabel : 'Personalizado…' }]}
          onChange={value => value === 'intervalo' ? setPeriodoAberto(true) : alterar({ periodo: value, desde: '', ate: '' })}/>
        <CollectionFilterButton label="Mais filtros" count={filtrosExtras.filter(key => ler(key)).length} onClick={() => setRascunho(Object.fromEntries(filtrosExtras.map(key => [key, ler(key)])))}/>
      </div>
      {!!chips.length && <div className="schedule-active-filters" aria-label="Filtros ativos">
        {chips.map(chip => <button key={chip.key} type="button" aria-label={`Remover filtro ${chip.label}`} onClick={() => alterar(chip.key === 'periodo' ? { periodo: '', desde: '', ate: '' } : { [chip.key]: '' })}>{chip.label}<Icon name="minus" size={14}/></button>)}
        <button type="button" className="schedule-clear" onClick={() => setParams(new URLSearchParams())}>Limpar tudo</button>
      </div>}
      {periodoAberto && <SchedulePeriodDialog inicio={ler('desde')} fim={ler('ate')} onClose={() => setPeriodoAberto(false)} onApply={(desde, ate) => { alterar({ periodo: 'intervalo', desde, ate }); setPeriodoAberto(false); }}/>}
      {rascunho && <CollectionFilterDialog open title="Filtrar chamados" onClose={() => setRascunho(null)} onClear={() => setRascunho({})}
        onApply={() => { alterar({ ...Object.fromEntries(filtrosExtras.map(key => [key, rascunho[key] || ''])), ...(rascunho.status ? { visao: '' } : {}) }); setRascunho(null); }}>
        <div className="schedule-filter-fields">
          <DesktopSelect label="Origem" showLabel fullWidth expandInDialog value={rascunho.origem || ''} options={[{ value: '', label: 'Todas as origens' }, ...origens]} onChange={origem => setRascunho({ ...rascunho, origem })}/>
          <DesktopSelect label="Prioridade" showLabel fullWidth expandInDialog value={rascunho.prioridade || ''} options={[{ value: '', label: 'Todas as prioridades' }, ...prioridades]} onChange={prioridade => setRascunho({ ...rascunho, prioridade })}/>
          <DesktopSelect label="Situação" showLabel fullWidth expandInDialog options={[{value:'',label:'Todas as situações'},...estados]} value={rascunho.status || ''} onChange={status => setRascunho({ ...rascunho, status })}/>
          <DesktopSelect label="Tipo" showLabel fullWidth expandInDialog options={[{value:'',label:'Todos os tipos'},...tipos]} value={rascunho.tipo || ''} onChange={tipo => setRascunho({ ...rascunho, tipo })}/>
          <DesktopSelect label="Clube" showLabel fullWidth expandInDialog options={[{value:'',label:'Todos os clubes'},...opcoes?.clubes.map(c => ({...c,value:String(c.value)})) || []]} value={rascunho.clube || ''} onChange={clube => setRascunho({ ...rascunho, clube })}/>
          <DesktopSelect label="Responsável" showLabel fullWidth expandInDialog options={[{value:'',label:'Qualquer responsável'},...opcoes?.responsaveis.map(c => ({...c,value:String(c.value)})) || []]} value={rascunho.responsavel || ''} onChange={responsavel => setRascunho({ ...rascunho, responsavel })}/>
        </div>
      </CollectionFilterDialog>}
      {carregando ? <LoadingSkeleton kind="rows" label="Carregando chamados"/> : !erro && <>
        <p className="ticket-count">{lista.length === 200 ? '200 chamados · refine a busca para encontrar outros' : `${lista.length} ${lista.length === 1 ? 'chamado' : 'chamados'}`}</p>
        {!lista.length && <div className="ticket-empty" role="status">
          <Icon name="headset" size={28}/>
          <h2>Nenhum chamado encontrado</h2>
          <p>{query ? 'Ajuste a busca ou limpe os filtros.' : 'Novos relatos e ocorrências aparecerão aqui.'}</p>
        </div>}
        {[...grupos].map(([chave, itens]) => <section className="ticket-day" key={chave}>
          <h2>{itens[0].prioridade === 'ALTA' && <strong>Prioridade alta · </strong>}{dia(itens[0].criadoEm) === hoje ? 'Hoje' : dataLonga(dia(itens[0].criadoEm))}</h2>
          {itens.map(renderChamado)}
        </section>)}
        {!!finalizados.length && <section className="ticket-closed-section" aria-label="Chamados finalizados">
          <h2 className="ticket-closed-title">Finalizados <small>{lista.filter(c => c.status === 'RESOLVIDO').length}</small></h2>
          {finalizados.map(group => <DesktopAccordion key={group.key} title={group.label} count={group.items.length}>
            <div className="ticket-closed-list">{group.items.map(renderChamado)}</div>
          </DesktopAccordion>)}
        </section>}

      </>}
      </DesktopTabs>
    </>}
    {erro && <DesktopState error title="Não foi possível concluir" description={erro} onRetry={() => setAtualizacao(n => n + 1)}/>}
    {id && carregando && !atual && <Spinner/>}
    {id && atual && <>
      <section className="ticket-detail-summary" aria-label="Resumo do chamado">
        <span className="ticket-status" data-state={atual.status}>{rotulo(estados, atual.status)}</span>
        <span className={`ticket-detail-priority${atual.prioridade === 'ALTA' ? ' is-high' : ''}`}><Icon name="alert" size={15}/>Prioridade {rotulo(prioridades, atual.prioridade).toLowerCase()}</span>
        <span><Icon name="shield" size={15}/>{atual.clube?.nome || atual.clubesAfetadosNomes?.join(', ') || 'Plataforma'}</span>
        {atual.status !== 'RESOLVIDO' && Number.isFinite(Date.parse(atual.revisarEm)) && <span className={Date.parse(atual.revisarEm) < Date.now() ? 'ticket-overdue' : ''}><Icon name="clock" size={15}/>{Date.parse(atual.revisarEm) < Date.now() ? 'Revisão atrasada' : `Revisar até ${new Date(atual.revisarEm).toLocaleDateString('pt-BR', zona)} · ${hora(atual.revisarEm)}`}</span>}
      </section>
      <div className="ticket-detail">
      <div className="ticket-detail-main">
        <Card className="ticket-section ticket-report"><header><h2>Relato do problema</h2><time dateTime={atual.criadoEm}>{new Date(atual.criadoEm).toLocaleDateString('pt-BR', zona)} · {hora(atual.criadoEm)}</time></header>
          <p className="ticket-description">{atual.descricao || 'Nenhuma descrição informada.'}</p>
          <dl className="ticket-context"><div><dt>Tipo</dt><dd>{rotulo(tipos, atual.tipo)}</dd></div><div><dt>Origem</dt><dd>{rotulo(origens, atual.origem)}</dd></div><div><dt>Fila</dt><dd>{humanizar(atual.fila)}</dd></div><div><dt>Ocorrências</dt><dd>{atual.ocorrencias}</dd></div></dl>
          <DesktopAccordion title="Contexto e diagnóstico" headingLevel={3}>
            <dl className="ticket-context"><div><dt>Página</dt><dd>{atual.rota || 'Não informada'}</dd></div><div><dt>Plataforma</dt><dd>{atual.servico || 'Não informada'}</dd></div><div><dt>Versão</dt><dd>{atual.versao || 'Não informada'}</dd></div><div><dt>Triagem</dt><dd>{humanizar(atual.regra)}</dd></div></dl>
          {atual.detalhesTecnicos && <section className="ticket-technical"><h3>Relatório técnico vinculado</h3><p>{atual.detalhesTecnicos.reproducao || 'Ainda sem passos registrados para reproduzir.'}</p>{atual.detalhesTecnicos.correlacao && <p>Ocorrência {atual.detalhesTecnicos.correlacao}{atual.detalhesTecnicos.statusHttp ? ` · HTTP ${atual.detalhesTecnicos.statusHttp}` : ''}</p>}
            {atual.detalhesTecnicos.comparacao?.oficial && atual.detalhesTecnicos.comparacao.local && <p>Federação {atual.detalhesTecnicos.comparacao.oficial.join(' × ')} · Ludora {atual.detalhesTecnicos.comparacao.local.join(' × ')}</p>}{atual.detalhesTecnicos.pistas?.map((p, i) => <p key={i}>Pista a verificar · {p.arquivo}, linha {p.linha}, coluna {p.coluna}</p>)}</section>}
          </DesktopAccordion>
        </Card>
        {!dev && !!atual.usuarioId && <Card className="ticket-section"><SupportOperations key={atual.id} id={atual.id} admin={usuario?.papel_plataforma === 'SUPERADMIN'}/></Card>}
        <Card className="ticket-section"><h2>Ações do chamado</h2>
          <div className="actions">
            {dev ? atual.fila === 'DESENVOLVIMENTO' && atual.status !== 'RESOLVIDO' && <Btn disabled={busy || carregando} onClick={() => abrirDecisao('DEVOLVER')}>Devolver ao suporte</Btn> : <>
              {atual.status !== 'RESOLVIDO' && <Btn disabled={busy || carregando} onClick={() => abrirDecisao('FINALIZAR')}>Finalizar chamado</Btn>}
              {!atual.restrito && !['RESOLVIDO', 'ENCAMINHADO_DEVS'].includes(atual.status) && <Btn variant="ghost" disabled={busy || carregando} onClick={() => abrirDecisao('ENCAMINHAR')}>Encaminhar aos desenvolvedores</Btn>}
              {atual.clubeId && atual.status !== 'RESOLVIDO' && !atual.manutencoes?.some(p => p.ativa) && <Link className="btn btn-ghost" to={`/manutencao?chamado=${atual.id}`}>Pausar função do clube</Link>}
            </>}
          </div>
          {!dev && atual.manutencoes?.some(p => p.ativa) && <p>Há uma função pausada neste chamado. <Link to={`/manutencao?chamado=${atual.id}`}>Ver pausa e reativação</Link></p>}
          {!dev && atual.status === 'RESOLVIDO' && !!atual.manutencoes?.length && !atual.manutencoes.some(p => p.ativa) && <Link to={`/manutencao?chamado=${atual.id}`}>Ver manutenção vinculada</Link>}
          <div className="ticket-comment-heading"><h3>Adicionar comentário</h3><p>Registre uma observação no histórico do atendimento.</p></div>
          <label className="field">Comentário<textarea className="field-input" rows={3} maxLength={4000} value={motivo} onChange={e => setMotivo(e.target.value)}/></label>
          {!dev && !!atual.usuarioId && <div className="ticket-toggle-row"><span>Mostrar comentário ao cliente</span><DesktopToggle label="Mostrar comentário ao cliente" checked={publico} onChange={setPublico}/></div>}
          <div className="actions"><Btn disabled={!valido} onClick={() => void agir('COMENTAR')}>Registrar comentário</Btn><Btn variant="ghost" disabled={!valido} onClick={() => void agir('ATRIBUIR')}>Assumir chamado</Btn></div>
          {!dev && <>
            <DesktopAccordion title="Alterar status ou tipo"><div className="ticket-action-fields">
              <DesktopSelect label="Novo status" showLabel fullWidth value={status} options={estados.filter(s => !['ENCAMINHADO_DEVS', 'RESOLVIDO'].includes(s.value))} onChange={setStatus}/>
              <Btn disabled={!valido || !status} onClick={() => void agir('STATUS')}>Registrar status</Btn>
              <DesktopSelect label="Reclassificar tipo" showLabel fullWidth value={tipo} options={tipos} onChange={setTipo}/>
              <Btn variant="ghost" disabled={!valido || !tipo} onClick={() => void agir('CLASSIFICAR')}>Aplicar classificação</Btn>
            </div></DesktopAccordion>
          </>}
        </Card>
      </div>
      <Card className="ticket-section ticket-history"><header><h2>Histórico do atendimento</h2><small>{atual.historico?.length || 0} {atual.historico?.length === 1 ? 'registro' : 'registros'}</small></header>
        {!atual.historico?.length && <p>Ainda não há movimentações neste chamado.</p>}
        {atual.historico?.map(h => <article key={h.id}><time dateTime={h.criadoEm}>{dia(h.criadoEm) === hoje ? 'Hoje' : new Date(h.criadoEm).toLocaleDateString('pt-BR', zona)} · {hora(h.criadoEm)}</time><h3>{historicoRotulos[h.acao] || humanizar(h.acao)}</h3><p>{h.motivo}</p>{h.dados?.funcao && <small>{h.dados.funcao}</small>}{h.dados?.correlacao && <small>Ocorrência {h.dados.correlacao}{h.dados.status ? ` · HTTP ${h.dados.status}` : ''}</small>}</article>)}
      </Card>
    </div></>}
    {decisao && <Modal open title={decisoes[decisao].titulo} className="schedule-review-dialog" onClose={() => { if (!busy) setDecisao(null); }}
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={() => setDecisao(null)}>Voltar</Btn><Btn disabled={busy || notaDecisao.trim().length < 5} onClick={() => void agir(decisao, { motivo: notaDecisao, publico: decisao === 'FINALIZAR' && compartilharResumo })}>{busy ? 'Registrando…' : 'Confirmar decisão'}</Btn></div>}>
      <p>{decisoes[decisao].texto}</p>
      <label className="field">{decisoes[decisao].campo}<textarea className="field-input" rows={4} maxLength={4000} value={notaDecisao} onChange={e => setNotaDecisao(e.target.value)}/></label>
      {decisao === 'FINALIZAR' && !!atual?.usuarioId && <div className="ticket-toggle-row"><span>Mostrar resumo ao cliente</span><DesktopToggle label="Mostrar resumo ao cliente" checked={compartilharResumo} onChange={setCompartilharResumo}/></div>}
      {erroDecisao && <p className="notice-error" role="alert">{erroDecisao}</p>}
    </Modal>}
    {criando && <ChamadoManual onClose={() => setCriando(false)} onCreated={id => { setCriando(false); alterar({ id }); }}/>}
    <Toast message={resultado} onClose={() => setResultado('')}/>
  </div>;
}
