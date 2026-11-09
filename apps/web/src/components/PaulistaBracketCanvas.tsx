import { memo, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, useViewport, type Node, type NodeProps, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ALTURA_JOGO, LARGURA_JOGO, layoutChaveamento, type caminhoPublicado } from '../utils/paulistaBracket';
import { PaulistaBracketCard, type BracketCardProps } from './PaulistaBracketCard';
import { Icon } from './Icon';

type MatchNode = Node<BracketCardProps & Record<string, unknown>, 'match'>;
type LabelNode = Node<{ titulo: string; futura: boolean } & Record<string, unknown>, 'phase' | 'pending'>;
type BracketNode = MatchNode | LabelNode;
const Match = memo(function Match({ data }: NodeProps<MatchNode>) {
  return <><Handle type="target" position={Position.Left} isConnectable={false}/><PaulistaBracketCard {...data}/><Handle type="source" position={Position.Right} isConnectable={false}/></>;
});
const Phase = memo(function Phase({ data }: NodeProps<LabelNode>) { return <h3 className="paulista-flow-phase">{data.titulo}</h3>; });
const Pending = memo(function Pending({ data }: NodeProps<LabelNode>) {
  return <div className="paulista-bracket-pending"><Icon name="clock" size={23}/><strong>{data.titulo}</strong><span>Aguardando publicação</span><small>Os confrontos serão exibidos quando confirmados pela federação.</small></div>;
});
const nodeTypes = { match: Match, phase: Phase, pending: Pending };
const edgeOptions = { type: 'smoothstep', selectable: false, focusable: false, deletable: false, pathOptions: { borderRadius: 5, offset: 28 } };
function MapGlyph({ type }: { type: 'move' | 'fit' }) {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'move' ? <><path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3m-9-9-3 3 3 3m12-6 3 3-3 3"/></> : <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>}
  </svg>;
}
function ScaleButton({ onReset }: { onReset: () => void }) {
  const { zoom } = useViewport();
  return <button type="button" className="paulista-map-scale" onClick={onReset} aria-label="Voltar ao tamanho real" title="Exibir os cards em tamanho real">{Math.round(zoom * 100)}%</button>;
}

interface Props { caminho: ReturnType<typeof caminhoPublicado>; cards: BracketCardProps[]; identity: string; compact: boolean }
function Canvas({ caminho, cards, compact }: Props) {
  const flow = useReactFlow<BracketNode, Edge>();
  const surface = useRef<HTMLDivElement>(null);
  const [desktopMoving, setDesktopMoving] = useState(false);
  const moving = compact || desktopMoving;
  // Somente mudanças de estrutura refazem posições. Atualizações comuns preservam zoom/pan.
  const topology = JSON.stringify([caminho.colunas.map(c => [c.etapa, c.jogos.map(j => j.id).sort()]), caminho.conexoes.map(c => [c.de, c.para]).sort()]);
  const alturaJogo = compact ? ALTURA_JOGO : 136;
  const layout = useMemo(() => layoutChaveamento(caminho, alturaJogo), [topology, alturaJogo]);
  const nodes = useMemo<BracketNode[]>(() => {
    const items: BracketNode[] = layout.posicoes.map(p => ({ id: p.id, type: 'match', position: { x: p.x, y: p.y }, data: { ...cards.find(c => c.jogo.id === p.id)! },
      style: { width: LARGURA_JOGO, height: alturaJogo }, draggable: false, selectable: false, focusable: false, connectable: false }));
    for (const c of layout.colunas) {
      items.push({ id: `phase:${c.etapa}`, type: 'phase', position: { x: c.x, y: -46 }, data: c, style: { width: LARGURA_JOGO, height: 28 }, selectable: false, focusable: false });
      if (c.futura) items.push({ id: `pending:${c.etapa}`, type: 'pending', position: { x: c.x, y: c.y }, data: c, style: { width: LARGURA_JOGO, height: alturaJogo }, selectable: false, focusable: false });
    }
    return items;
  }, [layout, cards, alturaJogo]);
  const edges = useMemo<Edge[]>(() => caminho.conexoes.map(c => ({ id: `${c.de}->${c.para}`, source: c.de, target: c.para,
    ...edgeOptions, className: cards.some(p => p.minhas.has(c.equipeId)) ? 'paulista-connection is-own' : 'paulista-connection',
    style: { stroke: cards.some(p => p.minhas.has(c.equipeId)) ? 'var(--primaria)' : 'var(--texto-sec)', strokeWidth: cards.some(p => p.minhas.has(c.equipeId)) ? 2 : 1.4 } })), [caminho.conexoes, cards]);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const own = cards.filter(c => c.minhas.has(c.jogo.mandanteId) || c.minhas.has(c.jogo.visitanteId));
  const graphWidth = (layout.colunas[layout.colunas.length - 1]?.x || 0) + LARGURA_JOGO;
  const homeViewport = () => ({ x: Math.max(24, ((surface.current?.clientWidth || graphWidth) - graphWidth) / 2), y: 70, zoom: 1 });
  const duration = reduced ? 0 : 180;
  const locate = () => {
    if (own.length) void flow.fitView({ nodes: own.map(c => ({ id: c.jogo.id })), padding:0.22, maxZoom:1, duration });
  };
  return <div className={`paulista-flow${moving ? ' is-movable' : ''}`} data-compact={compact} role="region" aria-label="Mapa interativo do chaveamento">
    <div className="paulista-flow-surface" ref={surface} style={{ height: Math.max(360, layout.altura + 144) }}>
    <div className="paulista-map-controls" role="group" aria-label="Controles do mapa">
      {!compact && <button type="button" className="paulista-map-move" aria-pressed={moving} onClick={() => setDesktopMoving(v => !v)}><MapGlyph type="move"/>Mover mapa</button>}
      <div className="paulista-map-tools">
        <button type="button" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => void flow.zoomOut({ duration })}><Icon name="minus" size={17}/></button>
        <ScaleButton onReset={() => void flow.setViewport(homeViewport(), { duration })}/>
        <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => void flow.zoomIn({ duration })}><Icon name="plus" size={17}/></button>
        <button type="button" aria-label="Ajustar à tela" title="Enquadrar a chave completa" onClick={() => void flow.fitView({ padding: 0.1, maxZoom: 1, duration })}><MapGlyph type="fit"/>{!compact && <span>Ajustar à tela</span>}</button>
        <button type="button" aria-label="Focar meu clube" title="Centralizar os confrontos do seu clube" disabled={!own.length} onClick={locate}><Icon name="shield" size={17}/>{!compact && <span>Focar meu clube</span>}</button>
      </div>
    </div>
      <ReactFlow<BracketNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultEdgeOptions={edgeOptions}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} edgesFocusable={false} nodesFocusable={false}
      deleteKeyCode={null} panOnDrag={moving} zoomOnPinch={moving} zoomOnScroll={moving} zoomOnDoubleClick={false} preventScrolling={moving}
      panActivationKeyCode={null} zoomActivationKeyCode={null} autoPanOnNodeFocus={false} panOnScroll={false}
      minZoom={0.25} maxZoom={1.6} defaultViewport={{ x: 24, y: 70, zoom: 1 }} onInit={instance => { void instance.setViewport(homeViewport()); }}>
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--borda)"/>
      </ReactFlow>
    </div>
    <p className="paulista-map-instruction" role="status">{compact ? 'Arraste para navegar e use dois dedos para aproximar.' : moving ? 'Movimentação ativada · arraste para navegar e use o scroll para aproximar.' : 'Mapa fixo · ative “Mover mapa” para arrastar ou ampliar com gestos.'}</p>
  </div>;
}
export default function PaulistaBracketCanvas(props: Props) {
  return <ReactFlowProvider key={props.identity}><Canvas {...props}/></ReactFlowProvider>;
}
