import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EntradaLog, NivelLog } from '@ludora/shared-types';
import { useLocation } from 'react-router-dom';
import { SavedFilters } from '../components/SavedFilters';
import { Btn, Modal, Input, LoadingSkeleton } from '../components/AdminUI';
import { FilterSelect } from '@web/components/FilterSelect';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon } from '@web/components/Icon';
import { DesktopMenu, DesktopMenuItem, DesktopMenuRadioItem, DesktopMenuToggleItem, DesktopMenuSeparator, DesktopMenuLabel } from '../components/DesktopMenu';
import { DesktopSelect } from '../components/DesktopSelect';
import { LogPeriodPicker } from '../components/LogPeriodPicker';
import { dentroDoPeriodo, type PeriodoLog } from '../../../shared/log-period';
import { useEstadoTempoReal } from '../components/useTempoReal';
import { LIMITE_LOGS, mesclarLogs, interpretarHttp, classeDuracao } from '../../../shared/logs';
import { Toast } from '@web/components/Toast';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const NIVEIS = [
  { value: '', label: 'Todos os logs' },
  { value: 'warn', label: 'Avisos e erros' },
  { value: 'error', label: 'Só erros' },
  { value: 'audit', label: 'Auditoria (ações do painel)' },
];
const ordem: Record<NivelLog, number> = { info: 0, audit: 0, warn: 1, error: 2 };
const alturaLinha = 33;
const alturaData = 33;
const margemJanela = 10 * alturaLinha;
const formatarData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const formatarHorario = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export default function LogsPage() {
  const { usuario } = useAdminAuth();
  const dev = usuario?.papel_plataforma === 'DESENVOLVEDOR';
  const location = useLocation();
  const [useContextFilter, setUseContextFilter] = useState(true);
  const context = useContextFilter ? location.state?.logFilters as { correlacao?: string; rota?: string; horario?: string } | undefined : undefined;
  const [loading, setLoading] = useState(true);
  const estado = useEstadoTempoReal();
  const [entradas, setEntradas] = useState<EntradaLog[]>([]);
  const [pausado, setPausado] = useState(false);
  const [nivel, setNivel] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [exportando, setExportando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [periodo, setPeriodo] = useState<PeriodoLog>('live');
  const [agora, setAgora] = useState(Date.now);
  const [descendente, setDescendente] = useState(false);
  const [quebrar, setQuebrar] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [filtros, setFiltros] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [selecionado, setSelecionado] = useState<EntradaLog | null>(null);
  const [metodo, setMetodo] = useState('');
  const [statusHttp, setStatusHttp] = useState('');
  const [lentas, setLentas] = useState(false);
  const [limites, setLimites] = useState({ lenta: 1000, critica: 3000 });
  const [rascunho, setRascunho] = useState({ metodo: '', status: '', lentas: false, lenta: '1000', critica: '3000' });
  const [novos, setNovos] = useState(0);
  const seguir = useRef(true);
  const idsAnteriores = useRef(new Set<number>());
  const expandirRef = useRef<HTMLButtonElement>(null);
  const pausadoRef = useRef(false);
  const fila = useRef<EntradaLog[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const colunasRef = useRef<HTMLDivElement>(null);
  const [janela, setJanela] = useState({ topo: 0, altura: 600 });

  useEffect(() => {
    const container = consoleRef.current;
    if (!container) return;
    const medir = () => setJanela({ topo: container.scrollTop, altura: container.clientHeight });
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(container);
    return () => observer.disconnect();
  }, [ampliado]);

  function alternarPausa() {
    pausadoRef.current = !pausadoRef.current;
    setPausado(pausadoRef.current);
  }

  useEffect(() => {
    if (periodo === 'live') return;
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 10000);
    return () => clearInterval(timer);
  }, [periodo]);
  useEffect(() => {
    if (!ampliado) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.desktop-menu-popover, dialog[open]')) { setAmpliado(false); expandirRef.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [ampliado]);

  useEffect(() => {
    let ativo = true;
    setErro('');
    setLoading(true);
    window.ludora.logs.historico().then(h => { if (ativo) setEntradas(a => mesclarLogs(a, h.entradas)); })
      .catch(() => { if (ativo) setErro('Não foi possível recuperar o histórico dos logs.'); })
      .finally(() => { if (ativo) setLoading(false); });
    const parar = window.ludora.logs.aoReceber(e => {
      fila.current.push(e);
      if (fila.current.length > LIMITE_LOGS) fila.current.splice(0, fila.current.length - LIMITE_LOGS);
    });
    // Um snapshot pode emitir centenas de entradas no mesmo instante. Agrupa
    // o lote antes de ordenar/renderizar, mantendo o console limitado.
    const timer = window.setInterval(() => {
      if (pausadoRef.current || !fila.current.length) return;
      const lote = fila.current; fila.current = [];
      setEntradas(a => mesclarLogs(a, lote));
    }, 100);
    return () => { ativo = false; parar(); clearInterval(timer); fila.current = []; };
  }, [revisao]);

  const metadados = useMemo(() => new WeakMap<EntradaLog, { http: ReturnType<typeof interpretarHttp>; instante: number; dia: string }>(), []);
  const registros = useMemo(() => entradas.map(entrada => {
    let meta = metadados.get(entrada);
    if (!meta) {
      const data = new Date(entrada.ts);
      meta = {
        http: interpretarHttp(entrada),
        instante: data.getTime(),
        dia: Number.isFinite(data.getTime()) ? formatarData.format(data) : 'Data indisponível',
      };
      metadados.set(entrada, meta);
    }
    return { entrada, ...meta };
  }), [entradas, metadados]);
  const temFiltros = !!(texto || nivel || periodo !== 'live' || metodo || statusHttp || lentas);
  const visiveis = useMemo(() => {
    const busca = texto.trim().toLowerCase();
    return registros.filter(({ entrada: e, instante, http: campos }) => {
      if (context?.correlacao && e.correlacao !== context.correlacao) return false;
      if (context?.rota && (e.caminho !== context.rota || !(Math.abs(instante - Date.parse(context.horario ?? '')) <= 5 * 60_000))) return false;
      if (nivel === 'audit') { if (e.tipo !== 'audit') return false; }
      else if (nivel && ordem[e.nivel] < ordem[nivel as NivelLog]) return false;
      if (!dentroDoPeriodo(e.ts, periodo, agora)) return false;
      if (metodo && campos?.metodo !== metodo) return false;
      if (statusHttp && (!campos || Math.floor(campos.status / 100).toString() !== statusHttp)) return false;
      if (lentas && classeDuracao(e.ms, limites.lenta, limites.critica) === 'normal') return false;
      return !busca || e.mensagem.toLowerCase().includes(busca);
    }).sort((a, b) => ((a.instante - b.instante) || a.entrada.id - b.entrada.id) * (descendente ? -1 : 1));
  }, [registros, nivel, texto, periodo, agora, descendente, metodo, statusHttp, lentas, limites, context]);

  const layout = useMemo(() => {
    let offset = 0;
    const linhas = visiveis.map((item, index) => {
      const iniciaDia = index === 0 || item.dia !== visiveis[index - 1].dia;
      const topo = offset;
      offset += alturaLinha + (iniciaDia ? alturaData : 0);
      return { ...item, iniciaDia, topo, fim: offset };
    });
    return { linhas, altura: offset };
  }, [visiveis]);
  const topo = Math.max(0, janela.topo - (colunasRef.current?.offsetHeight ?? 0));
  const inicio = quebrar ? 0 : Math.max(0, layout.linhas.findIndex(linha => linha.fim > topo - margemJanela));
  let fim = inicio;
  while (fim < layout.linhas.length && (quebrar || layout.linhas[fim].topo < topo + janela.altura + margemJanela)) fim++;
  const acima = quebrar ? 0 : layout.linhas[inicio]?.topo ?? 0;
  const abaixo = quebrar ? 0 : layout.altura - (layout.linhas[fim - 1]?.fim ?? 0);
  const layoutAnterior = useRef(layout);

  useLayoutEffect(() => { seguir.current = true; setNovos(0); }, [nivel, texto, periodo, descendente, metodo, statusHttp, lentas]);

  useLayoutEffect(() => {
    const console = consoleRef.current;
    const anterior = layoutAnterior.current;
    layoutAnterior.current = layout;
    if (!seguir.current) {
      const quantidade = visiveis.filter(({ entrada }) => !idsAnteriores.current.has(entrada.id)).length;
      if (quantidade) setNovos(n => Math.min(LIMITE_LOGS, n + quantidade));
      if (console && !quebrar && anterior !== layout) {
        const linha = anterior.linhas.find(item => item.fim > topo);
        const destino = linha && layout.linhas.find(item => item.entrada.id === linha.entrada.id);
        if (linha && destino) console.scrollTop = janela.topo + destino.topo - linha.topo;
      }
    }
    idsAnteriores.current = new Set(visiveis.map(({ entrada }) => entrada.id));
    if (console && !pausado && seguir.current) console.scrollTop = descendente ? 0 : console.scrollHeight;
    if (console) setJanela({ topo: console.scrollTop, altura: console.clientHeight });
  }, [layout, visiveis, pausado, descendente, ampliado, quebrar]);

  async function compartilhar(exportar: boolean, registro?: EntradaLog) {
    if (exportando || !visiveis.length) return;
    setExportando(true); setErro('');
    try {
      const ids = registro ? [registro.id] : visiveis.map(({ entrada }) => entrada.id);
      const resultado = exportar ? await window.ludora.logs.exportar(ids) : await window.ludora.logs.copiar(ids);
      if (resultado.ok) setAviso(`${resultado.total} registros ${exportar ? 'exportados' : 'copiados'}.`);
      else if (!('cancelado' in resultado && resultado.cancelado)) setErro(resultado.erro || 'Não foi possível concluir.');
    } catch { setErro('Não foi possível concluir a operação. Tente novamente.'); }
    finally { setExportando(false); }
  }

  const conteudo = (
    <div className={`logs-pagina desktop-logs${ampliado ? ' desktop-logs-expanded' : ''}`}>
      <div className="page-header">
        <div><h1 className="page-title">Logs ao vivo</h1><p className="page-sub">{dev ? 'Requisições da API com rota, status e duração.' : 'Requisições da API e ações do painel · caminhos sem query e sem dados de corpo'}</p></div>
      </div>

      <section className="desktop-log-viewer" aria-label="Console de logs">
      <div className="desktop-log-toolbar">
        <DesktopSelect label="Nível dos logs" height={40} value={nivel} options={dev ? NIVEIS.filter(opcao => opcao.value !== 'audit') : NIVEIS} onChange={setNivel} className="desktop-log-level"/>
        <CollectionSearch label="Filtrar texto" placeholder="Buscar nos logs…" value={texto} onChange={setTexto}/>
        <LogPeriodPicker value={periodo} onChange={valor => {
          setPeriodo(valor); setAgora(Date.now());
          if (valor === 'live') {
            pausadoRef.current = false; setPausado(false); seguir.current = true; setNovos(0);
            if (consoleRef.current) consoleRef.current.scrollTop = descendente ? 0 : consoleRef.current.scrollHeight;
          }
        }}/>
        <button type="button" ref={expandirRef} className="btn btn-md btn-ghost desktop-log-expand" aria-label={ampliado ? 'Restaurar console' : 'Ampliar console'} aria-pressed={ampliado} onClick={() => setAmpliado(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={ampliado ? 'M4 9h5V4m11 11h-5v5M9 9 3 3m12 12 6 6' : 'M14 3h7v7M10 21H3v-7M21 3l-7 7M3 21l7-7'}/></svg>
        </button>
        <DesktopMenu label="Opções dos logs">
          <DesktopMenuItem icon={<Icon name="filters" size={16}/>} onSelect={() => { setRascunho({ metodo, status: statusHttp, lentas, lenta: String(limites.lenta), critica: String(limites.critica) }); setFiltros(true); }}>Mais filtros{(metodo || statusHttp || lentas) && <span className="desktop-menu-selection-dot"/>}</DesktopMenuItem>
          <DesktopMenuItem icon={<Icon name="info" size={16}/>} onSelect={() => setAjuda(true)}>Como interpretar</DesktopMenuItem>
          <DesktopMenuSeparator/>
          <DesktopMenuItem icon={<Icon name="copy" size={16}/>} disabled={!visiveis.length || exportando} onSelect={() => void compartilhar(false)}>Copiar exibidos</DesktopMenuItem>
          <DesktopMenuItem icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>} disabled={!visiveis.length || exportando} onSelect={() => void compartilhar(true)}>Exportar .txt</DesktopMenuItem>
          <DesktopMenuSeparator/><DesktopMenuLabel>Ordenação</DesktopMenuLabel>
          <DesktopMenuRadioItem checked={!descendente} onSelect={() => setDescendente(false)} icon={<span aria-hidden="true">↑</span>}>Mais antigos primeiro</DesktopMenuRadioItem>
          <DesktopMenuRadioItem checked={descendente} onSelect={() => setDescendente(true)} icon={<span aria-hidden="true">↓</span>}>Mais recentes primeiro</DesktopMenuRadioItem>
          <DesktopMenuSeparator/>
          <DesktopMenuToggleItem checked={quebrar} onChange={setQuebrar}>Quebrar linhas longas</DesktopMenuToggleItem>
          <DesktopMenuItem icon={<Icon name="trash" size={16}/>} onSelect={() => { setEntradas([]); fila.current = []; setNovos(0); }}>Limpar tela</DesktopMenuItem>
        </DesktopMenu>
      </div>
      {context && <div className="desktop-log-context"><span>{context.correlacao ? `Ocorrência ${context.correlacao}` : `Registros de ${context.rota} próximos ao horário do chamado`}</span><Btn size="sm" variant="ghost" onClick={() => setUseContextFilter(false)}>Ver todos os logs</Btn></div>}
      {erro && <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" loading={loading} onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Btn></div>}
      <div ref={consoleRef} className={`log-console${quebrar ? ' log-wrap' : ''}`} role="log" aria-label="Registros da API" aria-live="off" tabIndex={0} onScroll={e => {
        const el = e.currentTarget;
        setJanela({ topo: el.scrollTop, altura: el.clientHeight });
        seguir.current = descendente ? el.scrollTop < 24 : el.scrollHeight - el.clientHeight - el.scrollTop < 24;
        if (seguir.current) setNovos(0);
      }}>
        <div ref={colunasRef} className="desktop-log-columns" aria-hidden="true"><span>Horário</span><span>Nível</span><span>Método</span><span>Rota / mensagem</span><span>Status</span><span>Duração</span></div>
        {!entradas.length && loading && <LoadingSkeleton kind="table" label="Carregando histórico de logs" count={6} />}
        {!loading && visiveis.length === 0 && <p className="log-vazio">{context ? 'Nenhum registro correspondente no histórico disponível. Logs antigos podem já ter saído do histórico.' : temFiltros ? 'Nenhum registro corresponde aos filtros.' : estado === 'conectado' ? 'Aguardando registros…' : 'Sem conexão em tempo real com a API.'}</p>}
        {acima > 0 && <div style={{ height: acima }} aria-hidden="true"/>}
        {layout.linhas.slice(inicio, fim).map(({ entrada: e, dia, instante, iniciaDia, http }) => <div key={e.id}>
          {iniciaDia && <div className="desktop-log-day" style={quebrar ? undefined : { height: alturaData, boxSizing: 'border-box' }}>{dia}</div>}
          <button type="button" className={`log-linha nivel-${e.nivel}`} style={quebrar ? undefined : { height: alturaLinha, boxSizing: 'border-box' }} onClick={() => setSelecionado(e)} aria-label={`Detalhes: ${e.mensagem}`}>
            <time dateTime={e.ts} title={e.ts}>{Number.isFinite(instante) ? formatarHorario.format(instante) : '—'}</time>
            <span className="log-nivel">{e.tipo === 'audit' ? 'AUDIT' : e.nivel.toUpperCase()}</span>
            <span className={`log-method method-${http?.metodo.toLowerCase()}`}>{http?.metodo || '—'}</span>
            <span className="log-msg">{http?.rota || e.mensagem}</span>
            <span className={`log-http http-${Math.floor((http?.status || 0) / 100)}`}>{http?.status || '—'}</span>
            <span className={`log-ms duration-${classeDuracao(e.ms, limites.lenta, limites.critica)}`}>{e.ms !== undefined ? `${e.ms} ms` : '—'}</span>
          </button></div>)}
        {abaixo > 0 && <div style={{ height: abaixo }} aria-hidden="true"/>}
      </div>
      <footer className="desktop-log-status"><span role="status"><i className={`rt-dot rt-${estado}`} aria-hidden="true"/>{pausado ? 'Pausado' : 'Acompanhando'} · {visiveis.length} de {entradas.length} registros</span>
        <div>{novos > 0 && <Btn variant="ghost" size="sm" onClick={() => { seguir.current = true; setNovos(0); if (consoleRef.current) consoleRef.current.scrollTop = descendente ? 0 : consoleRef.current.scrollHeight; }}>Novos registros {descendente ? '↑' : '↓'} · {novos}</Btn>}
        {temFiltros && <Btn variant="ghost" size="sm" onClick={() => { setTexto(''); setNivel(''); setPeriodo('live'); setMetodo(''); setStatusHttp(''); setLentas(false); }}>Limpar filtros</Btn>}
        <Btn variant="ghost" size="sm" aria-pressed={pausado} onClick={alternarPausa}>{pausado ? 'Retomar' : 'Pausar'}</Btn></div>
      </footer>
      </section>
      <p className="desktop-log-scope">Histórico recebido nesta sessão · até {LIMITE_LOGS} registros. Copiar e exportar seguem os filtros e a ordem exibida.</p>
      <Toast message={aviso} onClose={() => setAviso('')}/>
      <Modal open={filtros} title="Filtrar logs" onClose={() => setFiltros(false)} footer={<Btn onClick={() => {
        const lenta = Number(rascunho.lenta), critica = Number(rascunho.critica);
        if (!Number.isFinite(lenta) || !Number.isFinite(critica) || lenta <= 0 || critica <= lenta) return;
        setMetodo(rascunho.metodo); setStatusHttp(rascunho.status); setLentas(rascunho.lentas); setLimites({ lenta, critica }); setFiltros(false);
      }} disabled={!Number(rascunho.lenta) || !Number(rascunho.critica) || Number(rascunho.lenta) <= 0 || Number(rascunho.critica) <= Number(rascunho.lenta)}>Aplicar filtros</Btn>}>
        <SavedFilters storageKey={`ludora:logs:filtros:${usuario?.id}`}
          value={{ ...rascunho, nivel, periodo, descendente }}
          onApply={preset => {
            const lenta = Number(preset.lenta);
            const critica = Number(preset.critica);
            if (!Number.isFinite(lenta) || !Number.isFinite(critica) || lenta <= 0 || critica <= lenta) return;
            setNivel(preset.nivel);
            setPeriodo(preset.periodo);
            setDescendente(preset.descendente);
            setMetodo(preset.metodo);
            setStatusHttp(preset.status);
            setLentas(preset.lentas);
            setLimites({ lenta, critica });
            setFiltros(false);
          }} />
        <div className="desktop-log-filter-form">
          <FilterSelect label="Método HTTP" value={rascunho.metodo} emptyLabel="Todos os métodos" options={['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(value => ({ value, label: value }))} onChange={metodo => setRascunho(r => ({ ...r, metodo }))} overlayInDialog/>
          <FilterSelect label="Status HTTP" value={rascunho.status} emptyLabel="Todos os status" options={[{value:'2', label:'2xx · Sucesso'}, {value:'3', label:'3xx · Redirecionamento / cache'}, {value:'4', label:'4xx · Erro na requisição'}, {value:'5', label:'5xx · Erro no servidor'}]} onChange={status => setRascunho(r => ({ ...r, status }))} overlayInDialog/>
          <label className="check"><input type="checkbox" checked={rascunho.lentas} onChange={e => setRascunho(r => ({ ...r, lentas: e.target.checked }))}/>Somente lentas</label>
          <div className="desktop-log-limits"><Input label="Lenta a partir de (ms)" type="number" min="1" step="1" value={rascunho.lenta} onChange={e => setRascunho(r => ({ ...r, lenta: e.target.value }))}/><Input label="Muito lenta a partir de (ms)" type="number" min={Number(rascunho.lenta) + 1} step="1" value={rascunho.critica} onChange={e => setRascunho(r => ({ ...r, critica: e.target.value }))}/></div>
          <p>O limite de muito lenta deve ser maior que o de lenta. Estes limites são desta tela, nesta sessão.</p>
        </div>
      </Modal>
      <Modal open={ajuda} title="Como interpretar os logs" onClose={() => setAjuda(false)}>
        <div className="desktop-log-help"><p><strong>Método:</strong> GET azul, POST verde, PUT/PATCH âmbar e DELETE vermelho. A cor identifica a operação, não seu sucesso.</p><p><strong>Status:</strong> 2xx verde; 3xx neutro (304 é cache); 4xx âmbar; 5xx vermelho.</p><p><strong>Duração:</strong> âmbar a partir de {limites.lenta} ms e vermelha a partir de {limites.critica} ms. São referências configuráveis em Mais filtros; operações diferentes podem exigir tempos diferentes.</p><p>A duração é medida no servidor até o término da resposta; não é o tempo total de rede e renderização no aplicativo. Ao consultar registros antigos, a rolagem automática para, mas os novos logs continuam chegando.</p><p>O histórico é limitado a {LIMITE_LOGS} registros recebidos. Detalhes e exportação usam apenas os campos já disponíveis, sem consultar corpos ou tokens.</p></div>
      </Modal>
      <Modal open={!!selecionado} title="Detalhes do registro" onClose={() => setSelecionado(null)} footer={<Btn disabled={exportando} onClick={() => selecionado && void compartilhar(false, selecionado)}><Icon name="copy" size={16}/>Copiar registro</Btn>}>
        {selecionado && <dl className="desktop-log-details"><dt>Horário completo</dt><dd>{new Date(selecionado.ts).toLocaleString('pt-BR')} · {selecionado.ts}</dd><dt>Tipo / nível</dt><dd>{selecionado.tipo} · {selecionado.nivel}</dd><dt>Mensagem</dt><dd>{selecionado.mensagem}</dd><dt>Duração informada pela API</dt><dd>{selecionado.ms === undefined ? 'Não informada' : `${selecionado.ms} ms`}</dd>{selecionado.clubeId !== undefined && <><dt>Clube (ID)</dt><dd>{selecionado.clubeId}</dd></>}</dl>}
      </Modal>
    </div>
  );
  return ampliado ? createPortal(conteudo, document.body) : conteudo;
}
