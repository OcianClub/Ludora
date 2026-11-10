import { Icon } from '@web/components/Icon';
import { PaulistaStatus } from './PaulistaStatus';
import { PlatformSummaryCard } from './PlatformClubCollection';

type EventItem = { id: number; ano: number; categoria: string; divisao: string; estado: string; jogos: number; sucessoEm: string | null };
const date = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const name = (e: EventItem) => `Paulista ${e.ano} · ${e.divisao} · ${e.categoria}`;

/** Ano e divisão aparecem uma vez por grupo; cada botão mantém seu evento oficial. */
export function PaulistaEventCollection({ events, labels, alerts, onOpen }: {
  events: readonly EventItem[]; labels: Record<string, string>; alerts: (id: number) => number; onOpen: (id: number) => void;
}) {
  const groups = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = `${event.ano} · Divisão ${event.divisao}`;
    const group = groups.get(key) || [];
    group.push(event); groups.set(key, group);
  }
  return <div className="paulista-event-groups">{[...groups].map(([label, items]) => <section key={label} className="paulista-event-group" aria-label={label}>
    <h4><Icon name="trophy" size={15}/>{label}</h4>
    <div className="paulista-event-grid">{[...items].sort((a,b)=>a.categoria.localeCompare(b.categoria,'pt-BR',{numeric:true})).map(e=>{
      const count = alerts(e.id);
      return <PlatformSummaryCard key={e.id} className={`paulista-event-tile paulista-event-${e.estado.toLowerCase()}`} onClick={()=>onOpen(e.id)}
        label={`${name(e)} · ${labels[e.estado] || e.estado}`}
        tooltip={e.sucessoEm ? `Último sucesso: ${date(e.sucessoEm)}` : 'Ainda sem sincronização bem-sucedida registrada'}
        icon={<span className="paulista-event-icon"><Icon name="trophy" size={20}/></span>}
        title={<span>{e.categoria.toUpperCase()}</span>}
        subtitle={e.sucessoEm ? `Atualizado em ${date(e.sucessoEm)}` : 'Sem atualização registrada'}
        status={<PaulistaStatus state={e.estado} label={labels[e.estado] || e.estado}/>}
        metrics={[{label:'Jogos',value:e.jogos.toLocaleString('pt-BR')},{label:'Pendências',value:<span className={count > 0 ? 'paulista-pending-count' : undefined}>{count}</span>}]}/>;
    })}</div>
  </section>)}</div>;
}

/** Agrupa o resumo recebido por evento, sem descartar os registros do histórico. */
export function PaulistaRecentChanges({ changes, events, onOpen }: {
  changes: readonly { id: number; eventoId: number; criadoEm: string }[]; events: readonly EventItem[]; onOpen: (id: number) => void;
}) {
  const groups = new Map<number, { event: EventItem; count: number; latest: string }>();
  for (const change of changes) {
    const event = events.find(e=>e.id === change.eventoId);
    if (!event) continue;
    const previous = groups.get(event.id);
    groups.set(event.id, { event, count: (previous?.count || 0) + 1,
      latest: previous && Date.parse(previous.latest) > Date.parse(change.criadoEm) ? previous.latest : change.criadoEm });
  }
  return <div className="paulista-recent-grid">{[...groups.values()].sort((a,b)=>Date.parse(b.latest)-Date.parse(a.latest)).map(({event,count,latest})=><button
    type="button" key={event.id} className="paulista-recent-tile" onClick={()=>onOpen(event.id)} aria-label={`Ver alterações de ${name(event)}`}>
    <span className="paulista-recent-icon"><Icon name="clock" size={19}/></span>
    <span><strong>{event.categoria.toUpperCase()} · {event.divisao} · {event.ano}</strong><small>{count} {count === 1 ? 'alteração' : 'alterações'} · <time dateTime={latest}>{date(latest)}</time></small></span>
    <Icon name="chevronRight" size={16}/>
  </button>)}</div>;
}
