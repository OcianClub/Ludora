import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { JogoPaulista, SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { caminhoPublicado, etapaPublicada } from '../utils/paulistaBracket';
import { PaulistaBracketCard, type BracketCardProps } from './PaulistaBracketCard';
import { Btn } from './UI';
import { Icon } from './Icon';
import { nomeOficial } from '../utils/paulistaView';

const Canvas = lazy(() => import('./PaulistaBracketCanvas'));
export function PaulistaBracket({ snapshot, chave, minhas, onOpen }: {
  snapshot: SnapshotPaulista; chave: string; minhas: Set<number>; onOpen: (j: JogoPaulista) => void;
}) {
  const caminho = useMemo(() => caminhoPublicado(snapshot, chave), [snapshot, chave]);
  const root = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 760);
  const [modo, setModo] = useState<'fases' | 'mapa' | null>(null);
  const [etapa, setEtapa] = useState<number | null>(null);
  const mapa = (modo || (compact ? 'fases' : 'mapa')) === 'mapa';
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setCompact(window.innerWidth <= 760 || entry.contentRect.width < 700));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const cards = useMemo<BracketCardProps[]>(() => {
    const equipes = new Map(snapshot.equipes.map(e => [e.id, e]));
    return caminho.colunas.flatMap(c => c.jogos.map(jogo => {
      const avancou = caminho.conexoes.find(c => c.de === jogo.id);
      return { jogo, equipes, minhas, onOpen, avancou: avancou?.equipeId, empate: avancou?.empate, avisos: caminho.avisos.filter(a => a.jogos.includes(jogo.id)) };
    }));
  }, [caminho, snapshot.equipes, minhas, onOpen]);
  const ultimaEtapa = [...caminho.colunas].reverse().find(c => c.jogos.some(j => minhas.has(j.mandanteId) || minhas.has(j.visitanteId)));
  const escolhida = caminho.colunas.find(c => c.etapa === etapa) || ultimaEtapa || caminho.colunas[0];
  const quantidade = cards.length;
  return <section className="paulista-bracket" ref={root} data-view={mapa ? 'mapa' : 'fases'} aria-label={`Chaveamento ${chave.toLowerCase()}`}>
    <div className="paulista-bracket-toolbar">
      <div className="paulista-bracket-heading"><h2>Chave {nomeOficial(chave)}</h2><span>{quantidade} {quantidade === 1 ? 'jogo' : 'jogos'}</span></div>
      <button className="paulista-bracket-switch" type="button" onClick={() => setModo(mapa ? 'fases' : 'mapa')}>
        {mapa ? <Icon name="list" size={18}/> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="9" width="6" height="6" rx="1"/><path d="M9 6h3v12H9m0-6h6"/></svg>}
        {mapa ? 'Por fase' : 'Mapa'}
      </button>
    </div>
    {!quantidade ? <p className="collection-empty">A federação ainda não publicou confrontos desta chave.</p> : <>
      {mapa ? <Suspense fallback={<div className="paulista-flow-loading" role="status">Carregando mapa do chaveamento…</div>}>
        <Canvas caminho={caminho} cards={cards} identity={`${snapshot.id}:${chave}`} compact={compact}/>
      </Suspense> : <>
        <div className="paulista-round-tabs" role="group" aria-label="Fases do chaveamento">{caminho.colunas.map(c => <button key={c.etapa} type="button" aria-label={`${c.titulo} · ${c.jogos.length} jogos`} aria-pressed={escolhida?.etapa === c.etapa} onClick={() => setEtapa(c.etapa)}>
          {compact ? c.titulo.replace('Quartas de final', 'Quartas') : c.titulo}{c.jogos.length > 0 && <span>· {c.jogos.length}</span>}
        </button>)}</div>
        <div className="paulista-round-games">{cards.filter(c => etapaPublicada(c.jogo.fase) === escolhida?.etapa).map(c => <PaulistaBracketCard key={c.jogo.id} {...c}/>)}
          {escolhida?.futura && <div className="paulista-bracket-pending"><Icon name="clock" size={24}/><strong>{escolhida.titulo}</strong><span>Aguardando publicação dos confrontos.</span></div>}
        </div>
        {cards.some(c => c.minhas.has(c.jogo.mandanteId) || c.minhas.has(c.jogo.visitanteId)) && <Btn size="sm" variant="ghost" onClick={() => {
          setEtapa(ultimaEtapa!.etapa); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('.paulista-bracket-game.is-own')?.focus({ preventScroll: true }));
        }}>Localizar meu clube<Icon name="shield" size={14}/></Btn>}
      </>}
      <p className="paulista-bracket-help">{mapa ? 'As linhas e as setas indicam avanços comprovados pela publicação. ' : 'Jogos da fase selecionada. ' }As fases seguintes podem reordenar os classificados.</p>
      {caminho.avisos.length > 0 && <details className="paulista-bracket-warnings"><summary><Icon name="alert" size={16}/>{caminho.avisos.length} {caminho.avisos.length === 1 ? 'aviso na publicação' : 'avisos na publicação'}<Icon name="chevronRight" size={14}/></summary>
        <ul>{caminho.avisos.map(a => <li key={a.id}><strong>{a.tipo === 'conflito' ? 'Dados em conferência' : a.tipo === 'agenda' ? 'Agenda provisória' : a.tipo === 'ocorrencia' ? 'Ocorrência oficial' : 'Nome publicado'}</strong><p>{a.mensagem}</p></li>)}</ul>
      </details>}
    </>}
  </section>;
}
