import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const dataCurta = (valor: string) => new Date(valor).toLocaleDateString('pt-BR', { ...zona, day: '2-digit', month: 'short' });
const dataCompleta = (valor: string) => new Date(valor).toLocaleDateString('pt-BR', zona);
const filtrosExtras = ['status', 'origem', 'prioridade', 'tipo', 'clube', 'responsavel'] as const;
const endpoint = '/admin/equipe/chamados';
const decisoes = {
  ATRIBUIR: { titulo: 'Assumir chamado', campo: 'Motivo da atribuição', texto: 'Você ficará responsável pelo acompanhamento deste chamado.' },
  FINALIZAR: { titulo: 'Finalizar chamado', campo: 'Como o problema foi resolvido?', texto: 'O chamado será finalizado. Uma pausa vinculada continua sob controle da aba Manutenção.' },
  ENCAMINHAR: { titulo: 'Encaminhar aos desenvolvedores', campo: 'Passos para reproduzir o problema', texto: 'O relato e o diagnóstico técnico vão para a fila de desenvolvimento.' },
  DEVOLVER: { titulo: 'Devolver ao suporte', campo: 'O que foi corrigido ou precisa ser conferido?', texto: 'O suporte recebe o chamado para verificar o resultado com o cliente.' },
};
type Decisao = keyof typeof decisoes;
const historicoRotulos: Record<string, string> = {
  CRIADO: 'Chamado recebido', CRIADO_MANUAL: 'Chamado aberto pela equipe', OCORRENCIA: 'Ocorrência registrada',
  ATRIBUIR: 'Responsável atualizado', STATUS: 'Situação alterada', CLASSIFICAR: 'Tipo alterado',
  ENCAMINHAR: 'Encaminhado aos desenvolvedores', DEVOLVER: 'Devolvido ao suporte',
  FINALIZAR: 'Chamado finalizado', RESPOSTA_CLIENTE: 'Resposta do cliente',
  MANUTENCAO_PAUSADA: 'Função pausada', MANUTENCAO_REATIVADA: 'Função reativada',
};
const regrasTriagem: Record<string, string> = {
  TRIAGEM_HUMANA: 'Enviado para triagem', SEGURANCA_OU_RECUPERACAO: 'Encaminhado para atendimento restrito',
  FALHA_ABRANGENTE: 'Falha detectada em vários clubes ou várias vezes',
  HTTP_500_RECORRENTE: 'Falha recorrente no servidor', OPERACAO_CONHECIDA: 'Encaminhado para suporte',
  REVISAO_HUMANA: 'Reclassificado pela equipe',
};
const rotulosImpacto: Record<string, string> = {
  DUVIDA: 'Dúvida ou observação', DIFICULDADE: 'Dificulta o uso', OPERACAO_BLOQUEADA: 'Impede concluir a ação',
};
const plataformas: Record<string, string> = { web: 'Web', mobile: 'Mobile', desktop: 'Desktop', api: 'API' };
const modosComentario = [{ value: 'nota', label: 'Nota interna' }, { value: 'resposta', label: 'Responder ao cliente' }] as const;
const modelosComentario = {
  nota: [
    { label: 'Triagem inicial', texto: 'Triagem iniciada. Conferir o contexto do relato e definir o próximo passo do atendimento.' },
    { label: 'Tentativa de reproduzir', texto: 'Em análise. A equipe está tentando reproduzir o comportamento descrito no chamado.' },
    { label: 'Aguardando informações', texto: 'A análise depende de informações adicionais do cliente. Retomar assim que houver retorno.' },
    { label: 'Análise técnica em andamento', texto: 'A equipe técnica está investigando a causa. Registrar no histórico o resultado da análise e o próximo passo.' },
    { label: 'Validar a solução', texto: 'Validar a solução repetindo o fluxo que originou o chamado e registrar o resultado antes de concluir o atendimento.' },
  ],
  resposta: [
    { label: 'Confirmar recebimento', texto: 'Recebemos seu chamado. Vamos conferir o que você relatou e avisar por aqui assim que tivermos uma atualização.' },
    { label: 'Análise em andamento', texto: 'Estamos analisando o que aconteceu e tentando reproduzir o problema. Avisaremos por aqui assim que tivermos novidades.' },
    { label: 'Solicitar mais detalhes', texto: 'Para avançarmos na análise, você pode nos dizer em qual tela isso aconteceu, quais passos seguiu e se apareceu alguma mensagem? Pode responder por aqui.' },
    { label: 'A equipe técnica está analisando', texto: 'Nossa equipe técnica está investigando o problema. Acompanharemos o caso e traremos a próxima atualização neste chamado.' },
    { label: 'Testar após a correção', texto: 'Aplicamos uma correção. Pode tentar novamente e nos contar por aqui se funcionou? Se o problema continuar, seguiremos com a análise.' },
  ],
};
type ModoComentario = typeof modosComentario[number]['value'];
const historicoInicial = 6;

type Chamado = {
  id: string; assunto: string; descricao: string; origem: string; tipo: string; status: string; prioridade: string;
  regra: string; impacto: string; fila: string; restrito: boolean; clubeId: number | null; usuarioId?: number | null; clube?: { nome: string };
  responsavelId?: number | null; responsavelNome?: string | null; clubesAfetadosNomes?: string[]; ocorrencias: number; criadoEm: string; revisarEm: string; revisao: number; finalizadoEm?: string | null;
  rota: string; versao: string; servico: string;
  detalhesTecnicos?: { reproducao?: string; correlacao?: string; statusHttp?: number; comparacao?: { oficial?: number[]; local?: number[] }; pistas?: { arquivo: string; linha: number; coluna: number }[] };
  manutencoes?: { id: string; ativa: boolean }[];
  historico?: { id: number; acao: string; motivo: string; criadoEm: string; operadorId: number | null; autorNome?: string | null; publico?: boolean; dados?: { correlacao?: string; status?: number; protocolo?: string; funcao?: string } }[];
};
type Opcoes = { clubes: { value: number; label: string }[]; responsaveis: { value: number; label: string }[]; contagens: Record<string, number> };

export default function ChamadosPage() {
  const { usuario } = useAdminAuth();
  const dev = usuario?.papel_plataforma === 'DESENVOLVEDOR';
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const [fila, setFila] = useState<{ consulta: string; itens: Chamado[] }>();
  const scrollFila = useRef(0);
  const origemDetalhe = useRef<HTMLButtonElement | null>(null);
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
  const [modoComentario, setModoComentario] = useState<ModoComentario>('nota');
  const [comentarios, setComentarios] = useState({ nota: '', resposta: '' });
  const [historicoCompleto, setHistoricoCompleto] = useState(false);
  const [carregarFerramentas, setCarregarFerramentas] = useState(false);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [notaDecisao, setNotaDecisao] = useState('');
  const [compartilharResumo, setCompartilharResumo] = useState(true);
  const [erroDecisao, setErroDecisao] = useState('');
  const [rascunho, setRascunho] = useState<Record<string, string> | null>(null);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const filtrosFila = new URLSearchParams(params);
  filtrosFila.delete('id');
  const query = filtrosFila.toString();
  const lista = fila?.consulta === query ? fila.itens : [];
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
          if (ativo) setFila({ consulta: query, itens });
        }
      } catch (e) { if (ativo) setErro((e as Error).message); }
      finally { if (ativo) setCarregando(false); }
    }, id ? 0 : 180);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [id, query, atualizacao]);

  useLayoutEffect(() => {
    const scroll = document.getElementById('main-content')?.closest('.admin-workspace');
    scroll?.scrollTo({ top: id ? 0 : scrollFila.current, behavior: 'instant' });
    if (!id) origemDetalhe.current?.focus({ preventScroll: true });
  }, [id]);

  useEffect(() => {
    setMotivo(''); setModoComentario('nota'); setComentarios({ nota: '', resposta: '' });
    setHistoricoCompleto(false); setCarregarFerramentas(false); setResultado(''); setDecisao(null);
  }, [id]);

  function abrirChamado(idChamado: string, origem?: HTMLButtonElement) {
    scrollFila.current = document.getElementById('main-content')?.closest('.admin-workspace')?.scrollTop ?? 0;
    origemDetalhe.current = origem ?? null;
    alterar({ id: idChamado });
  }

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
    if (!detalhe || detalhe.id !== id || busy) return;
    setBusy(true); setErro(''); setResultado('');
    try {
      await requestJson(`${endpoint}/${detalhe.id}`, {
        method: 'PATCH', body: { acao, motivo, status, tipo, publico: false, ...entrada, revisao: detalhe.revisao },
      });
      if (acao === 'COMENTAR') setComentarios(anterior => ({ ...anterior, [entrada?.publico ? 'resposta' : 'nota']: '' }));
      else if (entrada) setDecisao(null);
      else setMotivo('');
      if (acao === 'DEVOLVER' && dev) alterar({ id: '' });
      else { setResultado('Alteração registrada no histórico.'); setAtualizacao(n => n + 1); }
    } catch (e) { if (entrada && acao !== 'COMENTAR') setErroDecisao((e as Error).message); else setErro((e as Error).message); }
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
  const ordenados = lista.filter(c => c.status !== 'RESOLVIDO').sort((a, b) =>
    Number(b.prioridade === 'ALTA') - Number(a.prioridade === 'ALTA') || Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
  const agora = Date.now();
  const hoje = dia(new Date(agora).toISOString());
  const atual = detalhe?.id === id ? detalhe : null;
  const finalizados = agruparFinalizados(lista.filter(c => c.status === 'RESOLVIDO'));
  const atalhosPapel = [...atalhos, dev ? { value: 'ENCAMINHADOS', label: 'Encaminhados' } : { value: 'MEUS', label: 'Meus chamados' }, {value:'FINALIZADOS',label:'Finalizados'}];

  const nomeClube = (c: Chamado) => c.clube?.nome || c.clubesAfetadosNomes?.join(', ') || 'Plataforma';
  const nomeResponsavel = (c: Chamado) => {
    if (!c.responsavelId) return 'Sem responsável';
    if (c.responsavelId === usuario?.id) return 'Você';
    return c.responsavelNome || opcoes?.responsaveis.find(pessoa => pessoa.value === c.responsavelId)?.label || 'Equipe Ludora';
  };
  const revisarAte = (c: Chamado) => {
    const prazo = Date.parse(c.revisarEm);
    if (!Number.isFinite(prazo)) return 'Sem prazo';
    if (dia(c.revisarEm) === hoje) return `Hoje, ${hora(c.revisarEm)}`;
    return `${dataCurta(c.revisarEm)} · ${hora(c.revisarEm)}`;
  };
  const renderChamado = (c: Chamado) => {
    const encerrado = c.status === 'RESOLVIDO';
    const atrasado = !encerrado && Date.parse(c.revisarEm) < agora;
    const contexto = [
      plataformas[c.servico] || c.servico,
      c.origem === 'AUTOMATICO' ? 'Detectado pelo sistema' : rotulo(tipos, c.tipo),
      c.ocorrencias > 1 ? `${c.ocorrencias} ocorrências` : '',
    ].filter(Boolean).join(' · ');
    return <li key={c.id}>
      <button className="ticket-card" type="button" onClick={event => abrirChamado(c.id, event.currentTarget)}>
        <span className="ticket-row-subject">
          <span className="ticket-card-icon"><Icon name={c.origem === 'AUTOMATICO' ? 'alert' : 'headset'} size={17}/></span>
          <span className="ticket-card-copy"><strong>{c.assunto}</strong>
            {c.prioridade === 'ALTA' && <small className="ticket-priority">Prioridade alta</small>}
          </span>
        </span>
        <span className="ticket-row-context"><span title={nomeClube(c)}>{nomeClube(c)}</span><small title={contexto}>{contexto}</small></span>
        <span className="ticket-row-owner" title={nomeResponsavel(c)}>{nomeResponsavel(c)}</span>
        <span className="ticket-status" data-state={c.status}>{rotulo(estados, c.status)}</span>
        <span className="ticket-row-date">{encerrado
          ? <time dateTime={c.finalizadoEm || c.criadoEm}>{c.finalizadoEm ? hora(c.finalizadoEm) : 'Data não registrada'}</time>
          : <><span className={atrasado ? 'ticket-overdue' : undefined}>{atrasado ? 'Revisão atrasada' : revisarAte(c)}</span>
            {atrasado && <small>{revisarAte(c)}</small>}</>}
        </span>
      </button>
    </li>;
  };

  const podeResponder = !dev && !!atual?.usuarioId;
  const respostaPublica = podeResponder && modoComentario === 'resposta';
  const modoAtivo = respostaPublica ? 'resposta' : 'nota';
  const comentario = comentarios[modoAtivo];
  const modelos = modelosComentario[modoAtivo];
  const editorComentario = <div className="ticket-comment-editor">
    <DesktopSelect label={respostaPublica ? 'Modelos de resposta' : 'Modelos de nota'} placeholder="Escolher um modelo"
      fullWidth disabled={busy} value={modelos.find(modelo => modelo.texto === comentario)?.texto || ''}
      options={modelos.map(modelo => ({ value: modelo.texto, label: modelo.label }))}
      onChange={texto => setComentarios(atual => ({ ...atual, [modoAtivo]: texto }))}/>
    <label className="field">{respostaPublica ? 'Resposta ao cliente' : 'Nota interna'}
      <textarea className="field-input" rows={3} maxLength={4000} disabled={busy} value={comentario}
        onChange={e => setComentarios(atual => ({ ...atual, [modoAtivo]: e.target.value }))}/>
    </label>
  </div>;
  const podeAssumir = !!atual && atual.status !== 'RESOLVIDO' && atual.responsavelId !== usuario?.id;
  const podeDevolver = !!atual && dev && atual.fila === 'DESENVOLVIMENTO' && atual.status !== 'RESOLVIDO';
  const historico = atual?.historico ? [...atual.historico].reverse() : [];
  const copiarProtocolo = async (protocolo: string) => {
    try { await navigator.clipboard.writeText(protocolo); setResultado('Protocolo copiado.'); }
    catch { setResultado('Não foi possível copiar o protocolo.'); }
  };

  return <div className="ticket-page match-schedule desktop-tickets-page">
    {id && <Btn className="ticket-back" variant="ghost" disabled={busy} onClick={() => alterar({ id: '' }, true)}><Icon name="chevronLeft" size={17}/> Voltar à fila</Btn>}
    <header className="page-header">
      <div><span className="ticket-kicker">Central de atendimento</span><h1 className="page-title">{id ? atual?.assunto || 'Detalhe do chamado' : dev ? 'Caixa de desenvolvimento' : 'Chamados'}</h1>
        {id ? atual && <p className="page-sub ticket-protocol">Protocolo {id}<button type="button" className="ticket-copy" aria-label="Copiar protocolo" onClick={() => void copiarProtocolo(id)}><Icon name="copy" size={15}/></button></p>
          : <p className="page-sub">Acompanhe o atendimento e as ocorrências do Ludora.</p>}</div>
      <div className="actions"><Btn variant="ghost" className="ticket-refresh" disabled={carregando || busy} onClick={() => setAtualizacao(n => n + 1)}><Icon name="refresh" size={17}/> {id ? 'Atualizar chamado' : 'Atualizar fila'}</Btn>
        {!id && !dev && <Btn onClick={() => setCriando(true)}><Icon name="plus" size={17}/> Novo chamado</Btn>}
        {podeAssumir && !atual?.responsavelId && <Btn disabled={busy || carregando} onClick={() => abrirDecisao('ATRIBUIR')}>Assumir chamado</Btn>}
        {podeDevolver && <Btn variant="ghost" disabled={busy || carregando} onClick={() => abrirDecisao('DEVOLVER')}>Devolver ao suporte</Btn>}
      </div>
    </header>
    <div hidden={!!id}>
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
      {fila?.consulta !== query && carregando ? <LoadingSkeleton kind="rows" label="Carregando chamados"/> : (id || !erro) && <>
        <p className="ticket-count">{lista.length === 200 ? '200 chamados · refine a busca para encontrar outros' : `${lista.length} ${lista.length === 1 ? 'chamado' : 'chamados'}`}</p>
        {!lista.length && <div className="ticket-empty" role="status">
          <Icon name="headset" size={28}/>
          <h2>Nenhum chamado encontrado</h2>
          <p>{query ? 'Ajuste a busca ou limpe os filtros.' : 'Novos relatos e ocorrências aparecerão aqui.'}</p>
        </div>}
        {!!ordenados.length && <section className="ticket-queue" aria-label="Fila ativa" aria-busy={!id && carregando}>
          <div className="ticket-queue-head" aria-hidden="true"><span>Chamado</span><span>Contexto</span><span>Responsável</span><span>Situação</span><span>Revisão</span></div>
          <ul className="ticket-list">{ordenados.map(renderChamado)}</ul>
        </section>}
        {!!finalizados.length && <section className="ticket-closed-section" aria-label="Chamados finalizados">
          <h2 className="ticket-closed-title">Finalizados <small>{lista.filter(c => c.status === 'RESOLVIDO').length}</small></h2>
          {finalizados.map(group => <DesktopAccordion key={group.key} title={group.label} count={group.items.length}>
            <ul className="ticket-list ticket-closed-list">{group.items.map(renderChamado)}</ul>
          </DesktopAccordion>)}
        </section>}

      </>}
      </DesktopTabs>
    </div>
    {erro && <DesktopState error title="Não foi possível concluir" description={erro} onRetry={() => setAtualizacao(n => n + 1)}/>}
    {id && carregando && !atual && <Spinner/>}
    {id && atual && <>
      <section className="ticket-detail-summary" aria-label="Resumo do chamado">
        <span className="ticket-status" data-state={atual.status}>{rotulo(estados, atual.status)}</span>
        <span><Icon name="shield" size={15}/>{nomeClube(atual)}</span>
        <span><Icon name="user" size={15}/>{nomeResponsavel(atual)}</span>
        {atual.prioridade === 'ALTA' && <span className="ticket-priority"><Icon name="alert" size={15}/>Prioridade alta</span>}
        {atual.status !== 'RESOLVIDO' && Number.isFinite(Date.parse(atual.revisarEm)) && <span className={Date.parse(atual.revisarEm) < agora ? 'ticket-overdue' : undefined}>
          <Icon name="clock" size={15}/>{Date.parse(atual.revisarEm) < agora ? 'Revisão atrasada' : 'Revisar até'} · {revisarAte(atual)}
        </span>}
      </section>
      <div className="ticket-detail">
        <div className="ticket-detail-main">
          <Card className="ticket-section ticket-report">
            <header><h2>Relato do problema</h2><time dateTime={atual.criadoEm}>{dataCompleta(atual.criadoEm)} · {hora(atual.criadoEm)}</time></header>
            <p className="ticket-description">{atual.descricao || 'Nenhuma descrição informada.'}</p>
            <dl className="ticket-context">
              <div><dt>Tipo</dt><dd>{rotulo(tipos, atual.tipo)}</dd></div>
              <div><dt>Impacto</dt><dd>{rotulosImpacto[atual.impacto] || 'Não informado'}</dd></div>
              <div><dt>Origem</dt><dd>{rotulo(origens, atual.origem)}</dd></div>
              {atual.ocorrencias > 1 && <div><dt>Ocorrências</dt><dd>{atual.ocorrencias}</dd></div>}
            </dl>
            <DesktopAccordion title="Contexto e diagnóstico">
              <dl className="ticket-context">
                <div><dt>Página</dt><dd>{atual.rota || 'Não informada'}</dd></div>
                <div><dt>Plataforma</dt><dd>{plataformas[atual.servico] || atual.servico || 'Não informada'}</dd></div>
                <div><dt>Versão</dt><dd>{atual.versao || 'Não informada'}</dd></div>
                <div><dt>Triagem</dt><dd>{regrasTriagem[atual.regra] || humanizar(atual.regra)}</dd></div>
              </dl>
              {atual.detalhesTecnicos && <section className="ticket-technical">
                <h3>Relatório técnico vinculado</h3>
                {atual.detalhesTecnicos.reproducao && <p>{atual.detalhesTecnicos.reproducao}</p>}
                {atual.detalhesTecnicos.correlacao && <p>Ocorrência {atual.detalhesTecnicos.correlacao}{atual.detalhesTecnicos.statusHttp ? ` · HTTP ${atual.detalhesTecnicos.statusHttp}` : ''}</p>}
                {atual.detalhesTecnicos.comparacao?.oficial && atual.detalhesTecnicos.comparacao.local && <p>Federação {atual.detalhesTecnicos.comparacao.oficial.join(' × ')} · Ludora {atual.detalhesTecnicos.comparacao.local.join(' × ')}</p>}
                {atual.detalhesTecnicos.pistas?.map((p, i) => <p key={i}>Pista a verificar · {p.arquivo}, linha {p.linha}, coluna {p.coluna}</p>)}
              </section>}
            </DesktopAccordion>
          </Card>

          <Card className="ticket-section">
            <h2>Atendimento</h2>
            {podeResponder && <DesktopTabs className="ticket-comment-tabs" label="Visibilidade da mensagem" value={modoComentario}
              options={modosComentario} onChange={setModoComentario}>
              <p>{respostaPublica ? 'O cliente recebe um aviso no Web ao enviar.' : 'Visível apenas para a equipe.'}</p>
              {editorComentario}
            </DesktopTabs>}
            {!podeResponder && editorComentario}
            <div className="actions"><Btn disabled={busy || carregando || comentario.trim().length < 5}
              onClick={() => void agir('COMENTAR', { motivo: comentario.trim(), publico: respostaPublica })}>{respostaPublica ? 'Enviar resposta ao cliente' : 'Registrar nota interna'}</Btn></div>
          </Card>

          {!dev && !!atual.usuarioId && <Card className="ticket-section ticket-guided">
            <details onToggle={event => { if (event.currentTarget.open) setCarregarFerramentas(true); }}>
              <summary>Atendimento guiado</summary>
              {carregarFerramentas && <SupportOperations key={atual.id} id={atual.id} tipo={atual.tipo}
                temClube={!!atual.clubeId} admin={usuario?.papel_plataforma === 'SUPERADMIN'}/>}
            </details>
          </Card>}

          {(!dev || podeAssumir && !!atual.responsavelId) && <Card className="ticket-section">
            <DesktopAccordion title="Mais ações" headingLevel={2}>
              <div className="ticket-more-actions">
                <div className="actions">
                  {podeAssumir && !!atual.responsavelId && <Btn variant="ghost" disabled={busy || carregando} onClick={() => abrirDecisao('ATRIBUIR')}>Assumir chamado</Btn>}
                  {!dev && atual.status !== 'RESOLVIDO' && <>
                    <Btn variant="ghost" disabled={busy || carregando} onClick={() => abrirDecisao('FINALIZAR')}>Finalizar chamado</Btn>
                    {!atual.restrito && atual.status !== 'ENCAMINHADO_DEVS' && <Btn variant="ghost" disabled={busy || carregando} onClick={() => abrirDecisao('ENCAMINHAR')}>Encaminhar aos desenvolvedores</Btn>}
                    {atual.clubeId && !atual.manutencoes?.some(p => p.ativa) && <Link className="btn btn-ghost" to={`/manutencao?chamado=${atual.id}`}>Pausar função do clube</Link>}
                  </>}
                </div>
                {!dev && <>
                  {!!atual.manutencoes?.length && <p><Link to={`/manutencao?chamado=${atual.id}`}>{atual.manutencoes.some(p => p.ativa) ? 'Ver pausa e reativação' : 'Ver manutenção vinculada'}</Link></p>}
                  <DesktopAccordion title={atual.status === 'ENCAMINHADO_DEVS' ? 'Alterar tipo' : 'Alterar status ou tipo'} headingLevel={3}>
                    <label className="field">Motivo da alteração
                      <textarea className="field-input" rows={2} maxLength={4000} value={motivo} disabled={busy} onChange={e => setMotivo(e.target.value)}/>
                    </label>
                    <div className="ticket-action-fields">
                      {atual.status !== 'ENCAMINHADO_DEVS' && <>
                        <DesktopSelect label="Novo status" showLabel fullWidth value={status} options={estados.filter(s => !['ENCAMINHADO_DEVS', 'RESOLVIDO'].includes(s.value))} onChange={setStatus}/>
                        <Btn variant="ghost" disabled={!valido || !status} onClick={() => void agir('STATUS')}>Registrar status</Btn>
                      </>}
                      <DesktopSelect label="Reclassificar tipo" showLabel fullWidth value={tipo} options={tipos} onChange={setTipo}/>
                      <Btn variant="ghost" disabled={!valido || !tipo} onClick={() => void agir('CLASSIFICAR')}>Aplicar classificação</Btn>
                    </div>
                  </DesktopAccordion>
                </>}
              </div>
            </DesktopAccordion>
          </Card>}
        </div>
        <Card className="ticket-section ticket-history">
          <header><h2>Histórico do atendimento</h2><small>{historico.length} {historico.length === 1 ? 'registro' : 'registros'}</small></header>
          {!historico.length && <p>Ainda não há movimentações neste chamado.</p>}
          {(historicoCompleto ? historico : historico.slice(0, historicoInicial)).map(h => <article key={h.id}>
            <time dateTime={h.criadoEm}>{dia(h.criadoEm) === hoje ? 'Hoje' : dataCurta(h.criadoEm)} · {hora(h.criadoEm)}{h.autorNome ? ` · ${h.autorNome}` : ''}</time>
            <h3>{h.acao === 'COMENTAR' ? h.publico ? 'Resposta ao cliente' : 'Nota interna' : historicoRotulos[h.acao] || humanizar(h.acao)}</h3>
            <p>{regrasTriagem[h.motivo] || h.motivo}</p>
            {h.dados?.funcao && <small>{h.dados.funcao}</small>}
            {h.dados?.correlacao && <small>Ocorrência {h.dados.correlacao}{h.dados.status ? ` · HTTP ${h.dados.status}` : ''}</small>}
          </article>)}
          {historico.length > historicoInicial && <Btn variant="ghost" size="sm" aria-expanded={historicoCompleto}
            onClick={() => setHistoricoCompleto(!historicoCompleto)}>{historicoCompleto ? 'Mostrar menos' : 'Ver histórico completo'}</Btn>}
        </Card>
      </div>
    </>}
    {decisao && <Modal open title={decisoes[decisao].titulo} className="schedule-review-dialog" onClose={() => { if (!busy) setDecisao(null); }}
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={busy} onClick={() => setDecisao(null)}>Voltar</Btn><Btn disabled={busy || notaDecisao.trim().length < 5} onClick={() => void agir(decisao, { motivo: notaDecisao, publico: decisao === 'FINALIZAR' && compartilharResumo })}>{busy ? 'Registrando…' : 'Confirmar decisão'}</Btn></div>}>
      <p>{decisoes[decisao].texto}</p>
      <label className="field">{decisoes[decisao].campo}<textarea className="field-input" rows={4} maxLength={4000} value={notaDecisao} onChange={e => setNotaDecisao(e.target.value)}/></label>
      {decisao === 'FINALIZAR' && !!atual?.usuarioId && <div className="ticket-toggle-row"><span>Mostrar resumo ao cliente</span><DesktopToggle label="Mostrar resumo ao cliente" checked={compartilharResumo} onChange={setCompartilharResumo}/></div>}
      {erroDecisao && <p className="notice-error" role="alert">{erroDecisao}</p>}
    </Modal>}
    {criando && <ChamadoManual onClose={() => setCriando(false)} onCreated={id => { setCriando(false); abrirChamado(id); }}/>}
    <Toast message={resultado} onClose={() => setResultado('')}/>
  </div>;
}
