import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { JogoPaulista, SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { caminhoPublicado, estadoJogo, nomeOficial, temResultado } from '../utils/paulistaView';
import { ClubBadge } from './Brand';
import { formatMatchDate } from './MatchCard';

export function PaulistaBracket({ snapshot, chave, minhas, onOpen }: {
  snapshot: SnapshotPaulista; chave: string; minhas: Set<number>; onOpen: (j: JogoPaulista) => void;
}) {
  const caminho = useMemo(() => caminhoPublicado(snapshot, chave), [snapshot, chave]);
  const canvas = useRef<HTMLDivElement>(null), nodes = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<{ id: string; d: string }[]>([]);
  const equipes = new Map(snapshot.equipes.map(t => [t.id, t]));
  const meus = caminho.colunas.flatMap(c => c.jogos).filter(j => minhas.has(j.mandanteId) || minhas.has(j.visitanteId));
  const ultimaEtapa = [...caminho.colunas].reverse().find(c => c.jogos.some(j => minhas.has(j.mandanteId) || minhas.has(j.visitanteId)));
  const positions = new Map<string, number>();
  let altura = 220;
  for (const column of caminho.colunas) {
    const desired = column.jogos.map((j, i) => {
      const anteriores = caminho.conexoes.filter(c => c.para === j.id).map(c => positions.get(c.de)).filter((v): v is number => v !== undefined);
      return { id: j.id, y: anteriores.length ? anteriores.reduce((a, b) => a + b, 0) / anteriores.length : i * 220 };
    }).sort((a, b) => a.y - b.y);
    let last = -220;
    for (const p of desired) { const y = Math.max(p.y, last + 220); positions.set(p.id, y); last = y; altura = Math.max(altura, y + 210); }
  }
  useLayoutEffect(() => {
    const parent = canvas.current;
    if (!parent) return;
    const measure = () => {
      const box = parent.getBoundingClientRect();
      setLines(caminho.conexoes.flatMap(c => {
        const de = nodes.current.get(c.de)?.getBoundingClientRect(), para = nodes.current.get(c.para)?.getBoundingClientRect();
        if (!de || !para) return [];
        const x = de.right - box.left, y = de.top - box.top + de.height / 2;
        const x2 = para.left - box.left, y2 = para.top - box.top + para.height / 2, middle = (x + x2) / 2;
        return [{ id: `${c.de}:${c.para}`, d: `M${x} ${y}H${middle}V${y2}H${x2}` }];
      }));
    };
    const observer = new ResizeObserver(measure); observer.observe(parent);
    for (const element of nodes.current.values()) observer.observe(element);
    measure(); return () => observer.disconnect();
  }, [caminho]);
  if (!caminho.colunas.length) return <p className="collection-empty">A federação ainda não publicou confrontos desta chave.</p>;
  return <section aria-label={`Caminho publicado da chave ${chave.toLowerCase()}`}>
    <div className="paulista-bracket-summary"><span><strong>{meus.length}</strong> confrontos do seu clube</span><span>Participação publicada até <strong>{ultimaEtapa?.titulo || 'etapa a confirmar'}</strong></span><span><strong>{caminho.colunas.reduce((n, c) => n + c.jogos.length, 0)}</strong> jogos nesta chave</span></div>
    <p className="page-sub">O histórico do clube permanece após cada etapa. As linhas indicam somente continuidade identificável em confrontos já publicados.</p>
    <div className="paulista-bracket-scroll" tabIndex={0} aria-label="Chaveamento: role para os lados para consultar as etapas">
      <div className="paulista-bracket-canvas" ref={canvas}>
        <svg className="paulista-connectors" aria-hidden="true">{lines.map(line => <path key={line.id} d={line.d}/>)}</svg>
        {caminho.colunas.map(column => <section className={`paulista-bracket-column${column.etapa === 3 ? ' is-final' : ''}`} key={column.etapa}>
          <h3>{column.titulo}</h3><div className="paulista-bracket-games" style={{ height: altura }}>
            {column.jogos.map(j => {
              const own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
              const advanced = caminho.conexoes.find(c => c.de === j.id)?.equipeId;
              const details = `${formatMatchDate(j.data || '')} · ${j.horario || 'Horário a confirmar'} · ${estadoJogo(j)}`;
              return <button type="button" key={j.id} ref={el => { if (el) nodes.current.set(j.id, el); else nodes.current.delete(j.id); }}
                style={{ top: positions.get(j.id) || 0 }} className={`paulista-bracket-game${own ? ' is-own' : ''}${temResultado(j) && !own ? ' is-complete' : ''}`}
                onClick={() => onOpen(j)} data-tooltip={details} aria-label={`${nomeOficial(equipes.get(j.mandanteId)?.nome || '')} contra ${nomeOficial(equipes.get(j.visitanteId)?.nome || '')}. ${details}. Abrir detalhes.`}>
                <small>{own ? 'Seu clube · ' : ''}{j.ocorrencia === 'WO' ? 'W.O.' : j.ocorrencia === 'ADIADA' ? 'Adiada' : j.data ? formatMatchDate(j.data) : 'Data a confirmar'}</small>
                {[j.mandanteId, j.visitanteId].map((id, side) => <span className={`paulista-bracket-team${minhas.has(id) ? ' is-own' : ''}`} key={id}>
                  <ClubBadge src={equipes.get(id)?.escudo || undefined} size={26}/><span>{nomeOficial(equipes.get(id)?.nome || 'Equipe a confirmar')}</span>
                  <b>{j.ocorrencia === 'WO' ? '—' : (side ? j.golsVisitante : j.golsMandante) ?? '—'}</b>
                  {advanced === id && <span className="paulista-advanced" aria-label="Presença confirmada na próxima etapa">›</span>}
                </span>)}
                <small>{advanced ? 'Avanço confirmado na etapa seguinte' : estadoJogo(j)}</small>
              </button>;
            })}
          </div>
        </section>)}
      </div>
    </div>
    {!lines.length && <p className="page-sub">Confrontos publicados sem ligação inequívoca entre etapas. Nenhuma conexão foi presumida.</p>}
  </section>;
}
