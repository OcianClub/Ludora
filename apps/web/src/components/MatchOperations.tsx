import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { requestJson } from '../services/api';
import { comandoPartida, type GestaoPartida } from '../services/sharedMatches';
import { Btn, Input, Modal, Select } from './UI';
import { Icon } from './Icon';
import { EVENT_TYPES, EventIcon } from './EventIcon';
import { PositionIcon } from './PositionIcon';

export function MatchPreparationStatus({ data }: { data: GestaoPartida }) {
  const ready = data.equipes.filter(team => team.pronta).length;
  const operator = data.equipes.find(team => team.clube_id === data.partida.sumula_clube_id)?.clube.nome || data.organizador.nome;
  const preparing = ['AGENDADA', 'PREPARADA'].includes(data.partida.status);
  return <section className={`match-coordination${preparing ? '' : ' is-active'}`} aria-label="Organização e preparação das equipes">
    <div className="match-ownership"><span className="match-ownership-icon"><Icon name="handshake" size={21}/></span>
      <div><strong>Organizada por {data.organizador.nome}</strong><p>{data.podeSumula ? 'Seu clube controla o placar e os eventos da partida.' : `Placar e eventos sob responsabilidade do ${operator}.`}</p></div>
    </div>
    {preparing && <div className="match-readiness" role="status">
      <div className="match-readiness-heading"><span>Preparação das equipes</span><small>{ready} de {data.equipes.length} {data.equipes.length === 1 ? 'pronta' : 'prontas'}</small></div>
      <div className="match-readiness-teams">{data.equipes.map(team => <div key={team.id} className={`match-team-readiness${team.pronta ? ' is-ready' : ''}`}>
        <Icon name={team.pronta ? 'checkAll' : 'clock'} size={18}/><span><strong>{team.clube.nome}</strong><small>{team.pronta ? 'Equipe pronta' : 'Aguardando confirmação'}</small></span>
      </div>)}</div>
    </div>}
  </section>;
}

export function PublishedLineups({ data }: { data: GestaoPartida }) {
  const [selected, setSelected] = useState<number | null>(null);
  const equipe = data.equipes.find(team => team.id === selected) || data.equipes.find(team => team.id === data.minhaEquipeId) || data.equipes[0];
  if (!equipe) return <p className="lineup-empty">Escalação ainda não divulgada.</p>;
  return <section className="lineup-groups published-lineups" aria-label="Escalações das equipes">
    <div className="shared-lineup-tabs" role="group" aria-label="Escolher equipe">{data.equipes.map(team => <button type="button" key={team.id} aria-pressed={team.id === equipe.id} onClick={() => setSelected(team.id)}><Icon name="team" size={17}/>{team.clube.nome}</button>)}</div>
    {!equipe.publicada_em ? <p className="lineup-empty">O {equipe.clube.nome} ainda não publicou a escalação.</p> : <div className="lineup-columns">{[true, false].map(titular => {
      const players = equipe.escalacao.filter(player => player.titular === titular);
      const offset = titular ? 0 : equipe.escalacao.filter(player => player.titular).length;
      return <section key={String(titular)}><h2>{titular ? 'Em campo' : 'Reservas'}<span>{players.length}</span></h2>
        {players.map((player, index) => <div className="lineup-row" key={player.jogador_id}>
          <span className="lineup-order">{offset + index + 1}</span><span className="lineup-shirt">{String(player.numCamisa).padStart(2, '0')}</span>
          <div className="lineup-player"><strong>{player.jogador?.nome}</strong><span className="lineup-position"><PositionIcon position={player.jogador?.posicao || ''}/>{player.jogador?.posicao}</span></div>
          {titular && <span className="lineup-starter-tag">Titular</span>}
        </div>)}{!players.length && <p className="lineup-empty">Nenhum reserva convocado.</p>}
      </section>;
    })}</div>}
  </section>;
}
export function MatchOperations({ data, refresh }: { data: GestaoPartida; refresh: () => Promise<void> }) {
  const { clube } = useAuth();
  const p = data.partida;
  const [event, setEvent] = useState<string | null>(null), [team, setTeam] = useState(String(p.mandante_id));
  const [player, setPlayer] = useState(''), [contra, setContra] = useState(false), [minute, setMinute] = useState(''), [motivo, setMotivo] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [sub, setSub] = useState(false);
  const [out, setOut] = useState(''), [into, setInto] = useState('');
  const [score, setScore] = useState(false), [homeScore, setHomeScore] = useState(''), [awayScore, setAwayScore] = useState('');
  const mine = data.equipes.find(e => e.clube_id === clube?.id);
  const actorTeam = contra ? Number(team) === p.mandante_id ? p.visitante_id : p.mandante_id : Number(team);
  const actor = data.equipes.find(e => e.time_id === actorTeam);
  function open(tipo: string, timeId?: number) {
    if (tipo === 'GOL' && timeId && p.status === 'AO_VIVO' && !data.equipes.some(e => e.time_id === timeId)) {
      setBusy(true); setError('');
      void comandoPartida(p.id, 'eventos', { tipo, time_id: timeId, versao: p.versao }).then(refresh).catch(e => setError(e.message)).finally(() => setBusy(false));
      return;
    } setEvent(tipo); setTeam(String(timeId || mine?.time_id || p.mandante_id)); setPlayer(''); setContra(false); setMinute(''); setMotivo(''); setError(''); }
  async function save() {
    if (busy || !event) return;
    setBusy(true); setError('');
    try {
      await comandoPartida(p.id, 'eventos', { tipo: event, time_id: Number(team), jogador_id: player ? Number(player) : undefined, gol_contra: contra, periodo: p.periodo_atual, minuto: minute || undefined, motivo, versao: p.versao });
      setEvent(null); await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: number) {
    const reason = window.prompt('Qual o motivo da remoção deste evento?');
    if (!reason?.trim() || busy) return;
    setBusy(true); setError('');
    try { await requestJson(`/eventos/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: reason, versao: p.versao }) }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function share() {
    const text = `${p.mandante?.nome} ${p.gols_mandante} × ${p.gols_visitante} ${p.visitante?.nome} · ${p.categoria?.nome || ''}`;
    try { if (navigator.share) await navigator.share({ title: 'Resultado da partida', text, url: window.location.href }); else { await navigator.clipboard.writeText(`${text} ${window.location.href}`); setError('Resultado e link copiados.'); } }
    catch (e) { if ((e as Error).name !== 'AbortError') setError('Não foi possível compartilhar. Copie o endereço da partida.'); }
  }
  return <div className="shared-match-operations">
    {error && !event && !sub && <p className="match-notice" role="status">{error}</p>}
    {data.podeSumula && ['AO_VIVO', 'FINALIZADA'].includes(p.status) && <section className="event-actions-panel"><h2 className="section-title">{p.status === 'FINALIZADA' ? 'Corrigir súmula' : 'Registrar evento'}</h2>
      <div className="shared-inline-actions">{[p.mandante, p.visitante].map((t, i) => <Btn key={i} disabled={busy} onClick={() => open('GOL', i === 0 ? p.mandante_id : p.visitante_id)}><Icon name="plus" size={17}/>Gol · {t?.nome}</Btn>)}</div>
      <Btn variant="ghost" size="sm" onClick={() => { setHomeScore(String(p.gols_mandante)); setAwayScore(String(p.gols_visitante)); setMotivo(''); setError(''); setScore(true); }}>Corrigir placar com justificativa</Btn>
      <div className="event-action-grid">{EVENT_TYPES.filter(t => t.value !== 'GOL' && !t.unavailable).map(t => <button key={t.value} className="event-action" disabled={busy} onClick={() => open(t.value)}><span className="event-icon-box"><EventIcon type={t.value}/></span>{t.label}</button>)}</div>
      {p.status === 'AO_VIVO' && <div className="shared-inline-actions"><span>Período {p.periodo_atual}</span><Btn variant="ghost" disabled={busy || p.periodo_atual >= 10} onClick={async () => { setBusy(true); try { await comandoPartida(p.id, 'periodo', { periodo: p.periodo_atual + 1, versao: p.versao }, 'PATCH'); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Próximo período<Icon name="chevronRight" size={16}/></Btn></div>}
    </section>}
    {p.status === 'AO_VIVO' && data.podePreparar && mine && <Btn variant="ghost" onClick={() => { setSub(true); setOut(''); setInto(''); setError(''); }}><Icon name="switchClub" size={17}/>Substituição · {mine.clube.nome}</Btn>}
    {p.status === 'FINALIZADA' && <section className="shared-result"><h2>Resumo da partida</h2><p>{p.mandante?.nome} <strong>{p.gols_mandante} × {p.gols_visitante}</strong> {p.visitante?.nome}</p><Btn onClick={() => void share()}>Compartilhar resultado</Btn></section>}
    <section className="shared-events"><h2 className="section-title">Eventos da partida</h2>{!data.eventos.length && <p className="lineup-empty">Nenhum evento registrado.</p>}{data.eventos.map(e => <div key={e.id} className="evento-item"><span className="event-icon-box"><EventIcon type={e.tipo}/></span><span className="evento-description"><strong>{EVENT_TYPES.find(t => t.value === e.tipo)?.label || e.tipo}{e.gol_contra ? ' contra' : ''}</strong><small>{e.jogador?.nome || (e.time_id === p.mandante_id ? p.mandante?.nome : p.visitante?.nome) || 'Sem autor identificado'}</small></span><span className="evento-meta">{e.periodo}º período{e.minuto != null ? ` · ${e.minuto}′` : ''}</span>{data.podeSumula && <button disabled={busy} className="lineup-remove" aria-label="Remover evento" onClick={() => void remove(e.id)}><Icon name="trash" size={17}/></button>}</div>)}</section>
    <PublishedLineups data={data}/>
    {data.podePreparar && data.auditoria.length > 0 && <details className="shared-audit"><summary>Histórico de alterações</summary><ul>{data.auditoria.map(a => <li key={a.id}><strong>{a.acao.toLowerCase().replace(/_/g, ' ')}</strong><small>{new Date(a.criado_em).toLocaleString('pt-BR')} · Usuário #{a.usuario_id}</small></li>)}</ul></details>}
    <Modal open={score} title="Corrigir placar" onClose={() => { if (!busy) setScore(false); }} footer={<div className="editor-actions"><Btn variant="ghost" disabled={busy} onClick={() => setScore(false)}>Voltar</Btn><Btn disabled={busy || !motivo.trim()} onClick={async () => { setBusy(true); setError(''); try { await comandoPartida(p.id,'placar',{gols_mandante:Number(homeScore),gols_visitante:Number(awayScore),motivo,versao:p.versao},'PATCH'); setScore(false); await refresh(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>Confirmar correção</Btn></div>}>
      <p className="editor-description">O ajuste ficará no histórico. Para atribuir gols a atletas, corrija também os eventos da súmula.</p>
      <Input label={p.mandante?.nome || 'Mandante'} type="number" min="0" max="99" value={homeScore} onChange={e => setHomeScore(e.target.value)}/>
      <Input label={p.visitante?.nome || 'Visitante'} type="number" min="0" max="99" value={awayScore} onChange={e => setAwayScore(e.target.value)}/>
      <Input label="Motivo da correção" value={motivo} onChange={e => setMotivo(e.target.value)} required/>
      {error && <p className="notice-error" role="alert">{error}</p>}
    </Modal>
    <Modal open={!!event} title={event ? EVENT_TYPES.find(t => t.value === event)?.label || 'Registrar evento' : 'Registrar evento'} onClose={() => { if (!busy) setEvent(null); }} footer={<div className="editor-actions"><Btn variant="ghost" disabled={busy} onClick={() => setEvent(null)}>Voltar</Btn><Btn disabled={busy} onClick={() => void save()}>{busy ? 'Salvando…' : p.status === 'FINALIZADA' ? 'Confirmar correção' : 'Registrar'}</Btn></div>}>
      <Select label="Equipe beneficiada / equipe do evento" value={team} options={[{ value: p.mandante_id, label: p.mandante?.nome || 'Mandante' }, { value: p.visitante_id, label: p.visitante?.nome || 'Visitante' }]} onChange={e => { setTeam(e.target.value); setPlayer(''); }}/>
      {event === 'GOL' && <label className="shared-own-goal"><input type="checkbox" checked={contra} onChange={e => { setContra(e.target.checked); setPlayer(''); }}/>Gol contra do adversário</label>}
      {actor && <Select label={contra ? 'Autor do gol contra (opcional)' : 'Jogador em campo'} value={player} emptyLabel="Selecionar jogador" options={actor.escalacao.filter(j => j.titular || p.status === 'FINALIZADA').map(j => ({ value: j.jogador_id, label: `#${j.numCamisa} · ${j.jogador?.nome}` }))} onChange={e => setPlayer(e.target.value)}/>}
      {!actor && <p className="editor-description">O adversário é externo ao Ludora. O evento será registrado para a equipe, sem atleta vinculado.</p>}
      <Input label="Minuto (opcional)" inputMode="numeric" value={minute} onChange={e => setMinute(e.target.value)}/>
      {p.status === 'FINALIZADA' && <Input label="Motivo da correção" value={motivo} onChange={e => setMotivo(e.target.value)} required/>}
      {error && <p role="alert" className="notice-error">{error}</p>}
    </Modal>
    <Modal open={sub} title="Substituição" onClose={() => { if (!busy) setSub(false); }} footer={<div className="editor-actions"><Btn disabled={busy} variant="ghost" onClick={() => setSub(false)}>Voltar</Btn><Btn disabled={busy || !out || !into} onClick={async () => { setBusy(true); try { await comandoPartida(p.id, 'substituicoes', { sai: Number(out), entra: Number(into), versao: p.versao }); setSub(false); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Confirmar troca</Btn></div>}>
      <Select label="Sai de campo" value={out} emptyLabel="Selecionar titular" options={(mine?.escalacao || []).filter(j => j.titular).map(j => ({ value: j.jogador_id, label: `#${j.numCamisa} · ${j.jogador?.nome}` }))} onChange={e => setOut(e.target.value)}/>
      <Select label="Entra em campo" value={into} emptyLabel="Selecionar reserva" options={(mine?.escalacao || []).filter(j => !j.titular).map(j => ({ value: j.jogador_id, label: `#${j.numCamisa} · ${j.jogador?.nome}` }))} onChange={e => setInto(e.target.value)}/>
      {error && <p role="alert" className="notice-error">{error}</p>}
    </Modal>
  </div>;
}
