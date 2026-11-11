import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EntradaLog, NivelLog } from '@ludora/shared-types';
import { Btn, Modal, Input } from '../components/AdminUI';
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

export default function LogsPage() {
  const dev = useAdminAuth().usuario?.papel_plataforma === 'DESENVOLVEDOR';
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
    window.ludora.logs.historico().then(h => { if (ativo) setEntradas(a => mesclarLogs(a, h.entradas)); })
      .catch(() => { if (ativo) setErro('Não foi possível recuperar o histórico dos logs.'); });
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

  const http = useMemo(() => new Map(entradas.map(e => [e.id, interpretarHttp(e)])), [entradas]);
  const temFiltros = !!(texto || nivel || periodo !== 'live' || metodo || statusHttp || lentas);
  const visiveis = useMemo(() => {
    const busca = texto.trim().toLowerCase();
    return entradas.filter(e => {
      if (nivel === 'audit') { if (e.tipo !== 'audit') return false; }
      else if (nivel && ordem[e.nivel] < ordem[nivel as NivelLog]) return false;
      if (!dentroDoPeriodo(e.ts, periodo, agora)) return false;
      const campos = http.get(e.id);
      if (metodo && campos?.metodo !== metodo) return false;
      if (statusHttp && (!campos || Math.floor(campos.status / 100).toString() !== statusHttp)) return false;
      if (lentas && classeDuracao(e.ms, limites.lenta, limites.critica) === 'normal') return false;
      return !busca || e.mensagem.toLowerCase().includes(busca);
    }).sort((a, b) => ((new Date(a.ts).getTime() - new Date(b.ts).getTime()) || a.id - b.id) * (descendente ? -1 : 1));
  }, [entradas, nivel, texto, periodo, agora, descendente, http, metodo, statusHttp, lentas, limites]);

  useEffect(() => { seguir.current = true; setNovos(0); }, [nivel, texto, periodo, descendente, metodo, statusHttp, lentas]);

  useEffect(() => {
    const console = consoleRef.current;
    if (!seguir.current) {
      const quantidade = visiveis.filter(e => !idsAnteriores.current.has(e.id)).length;
      if (quantidade) setNovos(n => Math.min(LIMITE_LOGS, n + quantidade));
    }
    idsAnteriores.current = new Set(visiveis.map(e => e.id));
    if (console && !pausado && seguir.current) console.scrollTop = descendente ? 0 : console.scrollHeight;
  }, [visiveis, pausado, descendente, ampliado]);

  const data = (ts: string) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const horario = (ts: string) => new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });

  async function compartilhar(exportar: boolean, registro?: EntradaLog) {
    if (exportando || !visiveis.length) return;
    setExportando(true); setErro('');
    try {
      const ids = registro ? [registro.id] : visiveis.map(e => e.id);
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
      {erro && <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Btn></div>}
      <div ref={consoleRef} className={`log-console${quebrar ? ' log-wrap' : ''}`} role="log" aria-label="Registros da API" aria-live="off" tabIndex={0} onScroll={e => {
        const el = e.currentTarget;
        seguir.current = descendente ? el.scrollTop < 24 : el.scrollHeight - el.clientHeight - el.scrollTop < 24;
        if (seguir.current) setNovos(0);
      }}>
        <div className="desktop-log-columns" aria-hidden="true"><span>Horário</span><span>Nível</span><span>Método</span><span>Rota / mensagem</span><span>Status</span><span>Duração</span></div>
        {visiveis.length === 0 && <p className="log-vazio">{temFiltros ? 'Nenhum registro corresponde aos filtros.' : estado === 'conectado' ? 'Aguardando registros…' : 'Sem conexão em tempo real com a API.'}</p>}
        {visiveis.map((e, index) => <div key={e.id}>
          {(index === 0 || data(visiveis[index - 1].ts) !== data(e.ts)) && <div className="desktop-log-day">{data(e.ts)}</div>}
          <button type="button" className={`log-linha nivel-${e.nivel}`} onClick={() => setSelecionado(e)} aria-label={`Detalhes: ${e.mensagem}`}>
            <time dateTime={e.ts} title={e.ts}>{horario(e.ts)}</time>
            <span className="log-nivel">{e.tipo === 'audit' ? 'AUDIT' : e.nivel.toUpperCase()}</span>
            <span className={`log-method method-${http.get(e.id)?.metodo.toLowerCase()}`}>{http.get(e.id)?.metodo || '—'}</span>
            <span className="log-msg">{http.get(e.id)?.rota || e.mensagem}</span>
            <span className={`log-http http-${Math.floor((http.get(e.id)?.status || 0) / 100)}`}>{http.get(e.id)?.status || '—'}</span>
            <span className={`log-ms duration-${classeDuracao(e.ms, limites.lenta, limites.critica)}`}>{e.ms !== undefined ? `${e.ms} ms` : '—'}</span>
          </button></div>)}
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
