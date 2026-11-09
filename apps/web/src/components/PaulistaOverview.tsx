import { useMemo } from 'react';
import type { JogoPaulista, SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { OfficialMedal } from './PaulistaIcons';
import { StatusBadge } from './UI';
import { formatMatchDate } from './MatchCard';
import { etapaPublicada, estadoJogo, nomeOficial, resumoClube, situacaoPublicacao, temResultado } from '../utils/paulistaView';
import { campanhaPublicada, classificacaoProxima, nomeGrupo, type EstadoEtapa } from '../utils/paulistaOverview';
import './PaulistaOverview.css';

type Props = {
  snapshot: SnapshotPaulista;
  summary: ReturnType<typeof resumoClube>;
  minhas: Set<number>;
  clubeNome?: string;
  chave?: string;
  pendentes: number;
  situacoes: ReadonlyMap<string, string | undefined>;
  onTab: (tab: 'classificacao' | 'jogos' | 'chaveamento') => void;
  onOpen: (jogo: JogoPaulista) => void;
};
const etapaNome = (j: JogoPaulista) => ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'][etapaPublicada(j.fase)] || nomeGrupo(nomeOficial(j.fase));
const estadoNome: Record<EstadoEtapa, string> = { advanced:'Avanço confirmado', ended:'Eliminação confirmada', published:'Confronto publicado', pending:'Aguardando publicação', unreached:'Não alcançada' };
function Marcador({ estado }: { estado: EstadoEtapa }) {
  return <span className={`paulista-journey-marker is-${estado}`} aria-hidden="true">{estado === 'advanced' ? '✓' : estado === 'ended' ? '×' : estado === 'published' ? <Icon name="ball" size={14}/> : null}</span>;
}
export function PaulistaOverview({ snapshot, summary, minhas, clubeNome, chave, pendentes, situacoes, onTab, onOpen }: Props) {
  const equipes = useMemo(() => new Map(snapshot.equipes.map(e => [e.id, e])), [snapshot.equipes]);
  const campanha = useMemo(() => campanhaPublicada(snapshot, minhas, chave), [snapshot, minhas, chave]);
  const classificacao = summary.classificacao;
  const vizinhas = useMemo(() => classificacaoProxima(snapshot, classificacao), [snapshot, classificacao]);
  const equipe = snapshot.equipes.find(e => minhas.has(e.id));
  const nomeTime = (id: number) => nomeOficial(equipes.get(id)?.nome || 'Equipe a confirmar');
  const jogos = campanha.jogos.length ? campanha.jogos : [summary.ultimo, summary.proxima].filter((j, i, all): j is JogoPaulista => !!j && all.findIndex(k => k?.id === j.id) === i);
  const etapas = [{ etapa:-1, titulo:'Classificação', estado:(campanha.jogos.length ? 'advanced' : classificacao ? 'published' : 'pending') as EstadoEtapa }, ...campanha.etapas];
  const totalResultados = classificacao ? classificacao.vitorias + classificacao.empates + classificacao.derrotas : 0;
  const ultima = summary.ultimo?.id;
  const resultado = (j: JogoPaulista) => {
    if (!temResultado(j)) return j.ocorrencia ? <span className="paulista-overview-result">{estadoJogo(j)}</span> : <StatusBadge status={situacaoPublicacao(j, situacoes.get(j.id))}/>;
    const saldo = (j.golsMandante! - j.golsVisitante!) * (minhas.has(j.mandanteId) ? 1 : -1);
    return <span className={`match-result result-${saldo > 0 ? 'V' : saldo < 0 ? 'D' : 'E'}`}>{saldo > 0 ? 'Vitória' : saldo < 0 ? 'Derrota' : 'Empate'}</span>;
  };
  const confronto = (j: JogoPaulista) => <span className="paulista-overview-contest">
    <span className={minhas.has(j.mandanteId) ? 'is-own' : ''}><ClubBadge src={equipes.get(j.mandanteId)?.escudo} name={nomeTime(j.mandanteId)} size={28}/><b title={nomeTime(j.mandanteId)}>{nomeTime(j.mandanteId)}</b></span>
    <strong className="paulista-overview-score" aria-label={temResultado(j) ? `${j.golsMandante} a ${j.golsVisitante}` : j.ocorrencia === 'WO' ? 'W.O.' : 'Contra'}>{temResultado(j) ? <><span>{j.golsMandante}</span><i aria-hidden="true">–</i><span>{j.golsVisitante}</span></> : <small>{j.ocorrencia === 'WO' ? 'W.O.' : 'VS'}</small>}</strong>
    <span className={minhas.has(j.visitanteId) ? 'is-own' : ''}><ClubBadge src={equipes.get(j.visitanteId)?.escudo} name={nomeTime(j.visitanteId)} size={28}/><b title={nomeTime(j.visitanteId)}>{nomeTime(j.visitanteId)}</b></span>
  </span>;
  return <div className={`paulista-overview-screen${chave ? ` key-${chave.toLowerCase()}` : ''}`}>
    <section className="paulista-participation" aria-label="Situação do clube no campeonato">
      <div className="paulista-participation-header">
        <div className="paulista-participation-identity"><ClubBadge src={equipe?.escudo} name={equipe?.nome || clubeNome} size={30}/><span>{clubeNome || equipe?.nome || 'Seu clube'} · {snapshot.categoria.toUpperCase()} · Divisão {snapshot.divisao}</span></div>
        <div className="paulista-participation-key">{chave ? <OfficialMedal chave={chave} filled/> : <span className="paulista-key-pending">Chave a confirmar</span>}</div>
      </div>
      <div className="paulista-participation-main">
        <div className="paulista-participation-title"><h2 className="paulista-campaign-state">{campanha.titulo}</h2></div>
        <ol className="paulista-stage-progress" aria-label="Percurso nas fases publicadas">{etapas.map(etapa => <li key={etapa.etapa} className={`is-${etapa.estado}`}><Marcador estado={etapa.estado}/><strong>{etapa.titulo === 'Semifinais' ? 'Semifinal' : etapa.titulo}</strong><span>{etapa.etapa === -1 ? classificacao ? `${classificacao.posicao}º lugar` : 'A confirmar' : estadoNome[etapa.estado]}</span></li>)}</ol>
      </div>
      <div className="paulista-participation-position">
        <strong>{classificacao ? `${classificacao.posicao}º` : '—'}</strong>
        <span>Posição na fase de classificação</span>
        <span>{vizinhas.total ? `de ${vizinhas.total} equipes · ` : ''}{classificacao ? nomeGrupo(nomeOficial(classificacao.grupo)) : 'Tabela a confirmar'}</span>
        <button type="button" onClick={() => onTab('classificacao')}>Ver classificação<Icon name="chevronRight" size={14}/></button>
      </div>
    </section>

    <section className="paulista-campaign-strip" aria-label="Números da fase de classificação"><dl className="paulista-campaign-metrics">
      <div><dt>Pontos</dt><dd>{classificacao?.pontosNota || classificacao?.pontos || (classificacao ? 0 : '—')}</dd></div>
      <div><dt>Jogos</dt><dd>{classificacao?.jogos ?? '—'}</dd></div>
      <div className="paulista-record"><dt>Vitórias · empates · derrotas</dt><dd>{classificacao ? <><span>{classificacao.vitorias}<small>V</small></span><span>{classificacao.empates}<small>E</small></span><span>{classificacao.derrotas}<small>D</small></span></> : '—'}</dd><div className="paulista-record-bar" role="img" aria-label={classificacao ? `${classificacao.vitorias} vitórias, ${classificacao.empates} empates e ${classificacao.derrotas} derrotas na fase de classificação` : 'Campanha ainda não publicada'}>{classificacao && totalResultados > 0 && [classificacao.vitorias,classificacao.empates,classificacao.derrotas].map((n,i) => <span key={i} className={`record-${i}`} style={{width:`${n / totalResultados * 100}%`}}/>)}</div></div>
      <div><dt>Saldo de gols</dt><dd>{classificacao ? `${classificacao.saldo > 0 ? '+' : ''}${classificacao.saldo}` : '—'}</dd></div>
    </dl></section>

    <div className="paulista-overview-columns">
      <section className="paulista-journey" aria-label="Trajetória do clube">
        <div className="paulista-overview-heading"><h2>Trajetória</h2><button type="button" onClick={() => onTab('jogos')}>Ver jogos<Icon name="chevronRight" size={14}/></button></div>
        <ol>
          {classificacao && <li className="paulista-journey-classification"><Marcador estado={campanha.jogos.length ? 'advanced' : 'published'}/><div className="paulista-journey-step"><h3>Fase de classificação · {nomeGrupo(nomeOficial(classificacao.grupo))}</h3><p>{classificacao.posicao}º lugar · {classificacao.pontosNota || classificacao.pontos} pontos · {classificacao.jogos} jogos</p></div></li>}
          {jogos.map(j => { const estado = campanha.estados.get(j.id) || 'published'; return <li key={j.id} data-game-id={j.id} className={`is-${estado}${j.id === ultima ? ' is-latest' : ''}`}>
            <Marcador estado={estado}/><div className="paulista-journey-step"><div className="paulista-journey-stage"><h3>{etapaNome(j)}{chave && etapaPublicada(j.fase) >= 0 ? ` · ${nomeOficial(chave)}` : ''}</h3>{j.id === ultima && <span>Último jogo</span>}</div>
              <button type="button" className="paulista-journey-match" onClick={() => onOpen(j)} aria-label={`Ver ${etapaNome(j)}: ${nomeTime(j.mandanteId)} contra ${nomeTime(j.visitanteId)}`}>{confronto(j)}<Icon name="chevronRight" size={14}/></button>
              <div className="paulista-journey-meta"><div className="paulista-journey-details"><time dateTime={j.data || undefined}>{formatMatchDate(j.data || '')} · {j.horario || 'Horário a confirmar'}</time>{resultado(j)}</div>
              {j.local && <p className="paulista-journey-location" title={j.local}><Icon name="location" size={13}/><span>{j.local}</span></p>}</div>
              {(estado === 'advanced' || estado === 'ended') && <span className="sr-only">{estadoNome[estado]}</span>}
            </div>
          </li>; })}
          {campanha.etapas.filter(e => e.estado === 'pending' || e.estado === 'unreached').map(e => <li key={`pending-${e.etapa}`} className={`is-${e.estado}`}><Marcador estado={e.estado}/><div className="paulista-journey-step"><h3>{e.titulo}</h3><p>{estadoNome[e.estado]}</p></div></li>)}
        </ol>
        {!jogos.length && <div className="paulista-overview-empty"><Icon name="calendar" size={22}/><p>{chave ? 'Os confrontos desta chave ainda não foram publicados.' : 'O calendário aparecerá quando a federação publicar os jogos.'}</p></div>}
        <div className="paulista-journey-footer">{!campanha.eliminado && !summary.proxima && !!jogos.length && <p><Icon name="info" size={16}/><span>Nenhuma próxima partida publicada para {snapshot.categoria.toUpperCase()}.</span></p>}{chave && <button type="button" onClick={() => onTab('chaveamento')}>Ver chaveamento<Icon name="chevronRight" size={14}/></button>}</div>
        {pendentes > 0 && <button type="button" className="paulista-overview-pending" onClick={() => onTab('jogos')}><Icon name="info" size={16}/><span>{pendentes} {pendentes === 1 ? 'jogo aguarda' : 'jogos aguardam'} data ou resultado. Consultar calendário</span><Icon name="chevronRight" size={14}/></button>}
      </section>

      <section className="paulista-nearby" aria-label="Classificação próxima do clube"><div className="paulista-overview-heading"><h2>Classificação</h2></div><p className="paulista-nearby-context">Na fase de classificação{classificacao ? ` · ${nomeGrupo(nomeOficial(classificacao.grupo))}` : ''}</p>
        {vizinhas.linhas.length ? <table><caption className="sr-only">Posições oficiais próximas ao seu clube na mesma fase e grupo. PTS: pontos; SG: saldo de gols.</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Equipe</th><th scope="col"><abbr title="Pontos">PTS</abbr></th><th scope="col"><abbr title="Saldo de gols">SG</abbr></th></tr></thead><tbody>{vizinhas.linhas.map(r => <tr key={r.equipeId} className={minhas.has(r.equipeId) ? 'is-own' : ''}><td>{r.posicao}º</td><th scope="row"><span><ClubBadge src={equipes.get(r.equipeId)?.escudo} name={nomeTime(r.equipeId)} size={24}/><span title={nomeTime(r.equipeId)}>{nomeTime(r.equipeId)}{minhas.has(r.equipeId) && <small>Seu clube</small>}</span></span></th><td>{r.pontosNota || r.pontos}</td><td>{r.saldo > 0 ? '+' : ''}{r.saldo}</td></tr>)}</tbody></table> : <div className="paulista-overview-empty"><Icon name="table" size={22}/><p>Classificação oficial ainda não publicada para este grupo.</p></div>}
        <button type="button" className="paulista-nearby-link" onClick={() => onTab('classificacao')}>Ver classificação completa<Icon name="chevronRight" size={14}/></button>
      </section>
    </div>
  </div>;
}
