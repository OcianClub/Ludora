import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EntradaLog, NivelLog } from '@ludora/shared-types';
import { Btn } from '../components/AdminUI';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon } from '@web/components/Icon';
import { AdminIcon } from '../components/AdminIcon';
import { DesktopMenu } from '../components/DesktopMenu';
import { LogPeriodPicker } from '../components/LogPeriodPicker';
import { dentroDoPeriodo, type PeriodoLog } from '../../../shared/log-period';
import { useEstadoTempoReal } from '../components/useTempoReal';
import { LIMITE_LOGS, mesclarLogs } from '../../../shared/logs';
import { Toast } from '@web/components/Toast';

const NIVEIS = [
  { value: '', label: 'Todos os logs' },
  { value: 'warn', label: 'Avisos e erros' },
  { value: 'error', label: 'Só erros' },
  { value: 'audit', label: 'Auditoria (ações do painel)' },
];
const ordem: Record<NivelLog, number> = { info: 0, audit: 0, warn: 1, error: 2 };

export default function LogsPage() {
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
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.desktop-menu-popover')) { setAmpliado(false); expandirRef.current?.focus(); } };
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

  const visiveis = useMemo(() => {
    const busca = texto.trim().toLowerCase();
    return entradas.filter(e => {
      if (nivel === 'audit') { if (e.tipo !== 'audit') return false; }
      else if (nivel && ordem[e.nivel] < ordem[nivel as NivelLog]) return false;
      if (!dentroDoPeriodo(e.ts, periodo, agora)) return false;
      return !busca || e.mensagem.toLowerCase().includes(busca);
    }).sort((a, b) => ((new Date(a.ts).getTime() - new Date(b.ts).getTime()) || a.id - b.id) * (descendente ? -1 : 1));
  }, [entradas, nivel, texto, periodo, agora, descendente]);

  useEffect(() => {
    const console = consoleRef.current;
    if (console && !pausado) console.scrollTop = descendente ? 0 : console.scrollHeight;
  }, [visiveis, pausado, descendente, ampliado]);

  const data = (ts: string) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const horario = (ts: string) => new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });

  async function compartilhar(exportar: boolean) {
    if (exportando || !visiveis.length) return;
    setExportando(true); setErro('');
    try {
      const ids = visiveis.map(e => e.id);
      const resultado = exportar ? await window.ludora.logs.exportar(ids) : await window.ludora.logs.copiar(ids);
      if (resultado.ok) setAviso(`${resultado.total} registros ${exportar ? 'exportados' : 'copiados'}.`);
      else if (!('cancelado' in resultado && resultado.cancelado)) setErro(resultado.erro || 'Não foi possível concluir.');
    } catch { setErro('Não foi possível concluir a operação. Tente novamente.'); }
    finally { setExportando(false); }
  }

  const conteudo = (
    <div className={`logs-pagina desktop-logs${ampliado ? ' desktop-logs-expanded' : ''}`}>
      <div className="page-header">
        <div><h1 className="page-title">Logs ao vivo</h1><p className="page-sub">Requisições da API e ações do painel · caminhos sem query e sem dados de corpo</p></div>
      </div>

      <section className="desktop-log-viewer" aria-label="Console de logs">
      <div className="desktop-log-toolbar">
        <DesktopMenu label={`Nível dos logs: ${NIVEIS.find(n => n.value === nivel)!.label}`} className="desktop-log-select desktop-log-level"
          trigger={<><span>{NIVEIS.find(n => n.value === nivel)!.label}</span><Icon name="chevronRight" size={14}/></>}>
          {NIVEIS.map(n => <button type="button" key={n.value} role="menuitemradio" aria-checked={nivel === n.value} onClick={() => setNivel(n.value)}>
            {n.label}{nivel === n.value && <span className="desktop-menu-selection-dot" aria-hidden="true"/>}
          </button>)}
        </DesktopMenu>
        <CollectionSearch label="Filtrar texto" placeholder="Buscar nos logs…" value={texto} onChange={setTexto}/>
        <LogPeriodPicker value={periodo} onChange={valor => {
          setPeriodo(valor); setAgora(Date.now());
          if (valor === 'live') { pausadoRef.current = false; setPausado(false); }
        }}/>
        <button type="button" ref={expandirRef} className="btn btn-md btn-ghost desktop-log-expand" aria-label={ampliado ? 'Restaurar console' : 'Ampliar console'} aria-pressed={ampliado} onClick={() => setAmpliado(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={ampliado ? 'M4 9h5V4m11 11h-5v5M9 9 3 3m12 12 6 6' : 'M14 3h7v7M10 21H3v-7M21 3l-7 7M3 21l7-7'}/></svg>
        </button>
        <DesktopMenu label="Opções dos logs">
          <button type="button" role="menuitem" disabled={!visiveis.length || exportando} onClick={() => void compartilhar(false)}><Icon name="copy" size={16}/>Copiar exibidos</button>
          <button type="button" role="menuitem" disabled={!visiveis.length || exportando} onClick={() => void compartilhar(true)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>Exportar .txt</button>
          <hr/><span className="desktop-menu-label">Ordenação</span>
          <button type="button" role="menuitemradio" aria-checked={!descendente} onClick={() => setDescendente(false)}><span aria-hidden="true">↑</span>Mais antigos primeiro{!descendente && <AdminIcon name="check" size={15}/>}</button>
          <button type="button" role="menuitemradio" aria-checked={descendente} onClick={() => setDescendente(true)}><span aria-hidden="true">↓</span>Mais recentes primeiro{descendente && <AdminIcon name="check" size={15}/>}</button>
          <hr/>
          <button type="button" role="menuitemcheckbox" aria-checked={quebrar} onClick={() => setQuebrar(v => !v)}>Quebrar linhas longas{quebrar && <AdminIcon name="check" size={15}/>}</button>
          <button type="button" role="menuitem" onClick={() => { setEntradas([]); fila.current = []; }}><Icon name="trash" size={16}/>Limpar tela</button>
        </DesktopMenu>
      </div>
      {erro && <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={() => setRevisao(n => n + 1)}>Tentar novamente</Btn></div>}
      <div ref={consoleRef} className={`log-console${quebrar ? ' log-wrap' : ''}`} role="log" aria-label="Registros da API" aria-live="off" tabIndex={0}>
        {visiveis.length === 0 && <p className="log-vazio">{texto || nivel || periodo !== 'live' ? 'Nenhum registro corresponde aos filtros.' : estado === 'conectado' ? 'Aguardando registros…' : 'Sem conexão em tempo real com a API.'}</p>}
        {visiveis.map((e, index) => <div key={e.id}>
          {(index === 0 || data(visiveis[index - 1].ts) !== data(e.ts)) && <div className="desktop-log-day">{data(e.ts)}</div>}
          <div className={`log-linha nivel-${e.nivel}`}>
            <time dateTime={e.ts} title={e.ts}>{horario(e.ts)}</time>
            <span className="log-nivel">{e.tipo === 'audit' ? 'AUDIT' : e.nivel.toUpperCase()}</span>
            <span className="log-msg">{e.mensagem}</span>
            {e.ms !== undefined && <span className="log-ms">{e.ms} ms</span>}
          </div></div>)}
      </div>
      <footer className="desktop-log-status"><span role="status"><i className={`rt-dot rt-${estado}`} aria-hidden="true"/>{pausado ? 'Pausado' : 'Acompanhando'} · {visiveis.length} de {entradas.length} registros</span>
        <div>{(texto || nivel || periodo !== 'live') && <Btn variant="ghost" size="sm" onClick={() => { setTexto(''); setNivel(''); setPeriodo('live'); }}>Limpar filtros</Btn>}
        <Btn variant="ghost" size="sm" aria-pressed={pausado} onClick={alternarPausa}>{pausado ? 'Retomar' : 'Pausar'}</Btn></div>
      </footer>
      </section>
      <p className="desktop-log-scope">Histórico recebido nesta sessão · até {LIMITE_LOGS} registros. Copiar e exportar seguem os filtros e a ordem exibida.</p>
      <Toast message={aviso} onClose={() => setAviso('')}/>
    </div>
  );
  return ampliado ? createPortal(conteudo, document.body) : conteudo;
}
