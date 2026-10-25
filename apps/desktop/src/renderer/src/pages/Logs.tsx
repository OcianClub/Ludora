import { useEffect, useMemo, useRef, useState } from 'react';
import type { EntradaLog, NivelLog } from '@ludora/shared-types';
import { Btn, Input, Select } from '@web/components/UI';
import { useEstadoTempoReal } from '../components/useTempoReal';

const LIMITE = 1000;
const NIVEIS = [
  { value: 'warn', label: 'Avisos e erros' },
  { value: 'error', label: 'Só erros' },
  { value: 'audit', label: 'Auditoria (ações do painel)' },
];
const ordem: Record<NivelLog, number> = { info: 0, audit: 0, warn: 1, error: 2 };

// Une por id: o histórico e o stream podem trazer o mesmo registro.
const mesclar = (atual: EntradaLog[], novas: EntradaLog[]) => {
  const mapa = new Map(atual.map(e => [e.id, e]));
  novas.forEach(e => mapa.set(e.id, e));
  return [...mapa.values()].sort((a, b) => a.id - b.id).slice(-LIMITE);
};

export default function LogsPage() {
  const estado = useEstadoTempoReal();
  const [entradas, setEntradas] = useState<EntradaLog[]>([]);
  const [pausado, setPausado] = useState(false);
  const [nivel, setNivel] = useState('');
  const [texto, setTexto] = useState('');
  const pausadoRef = useRef(false);
  const fila = useRef<EntradaLog[]>([]);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { pausadoRef.current = pausado; if (!pausado && fila.current.length) { setEntradas(a => mesclar(a, fila.current)); fila.current = []; } }, [pausado]);

  useEffect(() => {
    let ativo = true;
    window.ludora.logs.historico().then(h => ativo && setEntradas(a => mesclar(a, h.entradas)));
    const parar = window.ludora.logs.aoReceber(e => {
      if (pausadoRef.current) fila.current.push(e); // congela a tela sem perder registros
      else setEntradas(a => mesclar(a, [e]));
    });
    return () => { ativo = false; parar(); };
  }, []);

  const visiveis = useMemo(() => {
    const busca = texto.trim().toLowerCase();
    return entradas.filter(e => {
      if (nivel === 'audit') { if (e.tipo !== 'audit') return false; }
      else if (nivel && ordem[e.nivel] < ordem[nivel as NivelLog]) return false;
      return !busca || e.mensagem.toLowerCase().includes(busca);
    });
  }, [entradas, nivel, texto]);

  useEffect(() => { if (!pausado) fim.current?.scrollIntoView({ block: 'end' }); }, [visiveis, pausado]);

  return (
    <div className="logs-pagina">
      <div className="page-header">
        <div><h1 className="page-title">Logs ao vivo</h1><p className="page-sub">Requisições da API e ações do painel · caminhos sem query e sem dados de corpo</p></div>
      </div>

      <div className="filter-bar">
        <Select label="Nível" emptyLabel="Tudo" options={NIVEIS} value={nivel} onChange={e => setNivel(e.target.value)} />
        <Input label="Filtrar texto" placeholder="/partidas, 500, Clube criado…" value={texto} onChange={e => setTexto(e.target.value)} />
        <Btn variant="ghost" onClick={() => setPausado(p => !p)}>{pausado ? `Retomar${fila.current.length ? ` (${fila.current.length})` : ''}` : 'Pausar'}</Btn>
        <Btn variant="ghost" onClick={() => { setEntradas([]); fila.current = []; }}>Limpar tela</Btn>
      </div>

      <div className="log-console" role="log" aria-live="off">
        {visiveis.length === 0 && <p className="log-vazio">{estado === 'conectado' ? 'Aguardando registros…' : 'Sem conexão em tempo real com a API.'}</p>}
        {visiveis.map(e => (
          <div key={e.id} className={`log-linha nivel-${e.nivel}`}>
            <time>{new Date(e.ts).toLocaleTimeString('pt-BR')}</time>
            <span className="log-nivel">{e.tipo === 'audit' ? 'AUDIT' : e.nivel.toUpperCase()}</span>
            <span className="log-msg">{e.mensagem}</span>
            {e.ms !== undefined && <span className="log-ms">{e.ms} ms</span>}
          </div>
        ))}
        <div ref={fim} />
      </div>
    </div>
  );
}
