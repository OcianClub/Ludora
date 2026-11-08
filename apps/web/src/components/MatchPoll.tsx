import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMatchPoll } from '../hooks/useMatchPoll';
import type { GestaoPartida } from '../services/sharedMatches';
import { POLL_CHOICES } from '../services/matchPoll';
import { rememberAccess } from '../services/publicAccess';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import './MatchPoll.css';

export function MatchPoll({ data }: { data: GestaoPartida }) {
  const { token } = useAuth();
  return <MatchPollSession key={`${data.partida.id}:${token || 'guest'}`} data={data} token={token} />;
}
function MatchPollSession({ data, token }: { data: GestaoPartida; token: string | null }) {
  const ended = ['FINALIZADA', 'CANCELADA'].includes(data.partida.status);
  const { poll, loading, busy, error, notice, vote, reload } = useMatchPoll(data.partida.id, token, ended);
  const closed = ended || Boolean(poll && !poll.aberta);
  const options = [data.partida.mandante, undefined, data.partida.visitante];
  return <section className="match-poll" aria-labelledby="match-poll-title" aria-busy={busy}>
    <header><div><h2 id="match-poll-title">{closed ? 'Palpite da torcida' : 'Quem você acha que vence?'}</h2><p>{poll ? `${poll.total} ${poll.total === 1 ? 'palpite' : 'palpites'}${closed ? ' · votação encerrada' : ''}` : loading ? 'Carregando votação…' : 'Palpites do público'}</p></div><Icon name="trophy" size={20} /></header>
    {poll && <div className="match-poll-options" role="group" aria-label="Palpite para o resultado">
      {POLL_CHOICES.map((choice, i) => {
        const name = options[i]?.nome || (i === 1 ? 'Empate' : i === 0 ? 'Mandante' : 'Visitante');
        const percent = poll.percentuais[choice];
        const selected = token && poll.meuVoto === choice;
        return <button type="button" key={choice} title={name} aria-label={`${name}, ${poll.total ? `${percent}%` : 'nenhum palpite'}${selected ? ', seu palpite' : ''}`} aria-pressed={Boolean(selected)} disabled={!token || busy || closed} onClick={() => void vote(choice)}>
          <span className="match-poll-fill" aria-hidden="true" style={{ transform: `scaleY(${percent / 100})` }} />
          <span className="match-poll-choice-team">
            {i === 1 ? <span className="match-poll-draw">X</span> : <ClubBadge src={options[i]?.escudo} name={name} size={24} />}
            <span className="match-poll-option-name">{name}</span>
          </span>
          <strong>{poll.total ? `${percent}%` : '—'}</strong>
        </button>;
      })}
    </div>}
    {error && <div className="match-poll-error" role="status"><span>{error}</span><button type="button" disabled={loading || busy} onClick={reload}>Atualizar votação</button></div>}
    {busy && <p className="match-poll-feedback" role="status">Confirmando seu palpite…</p>}
    {!busy && notice && <p className="match-poll-feedback" role="status">{notice}</p>}
    {!token && !closed && poll && <Link className="match-poll-login" to="/login" onClick={() => rememberAccess()}>Entrar para dar um palpite <Icon name="arrow" size={14} /></Link>}
    {token && !closed && poll && !notice && <p className="match-poll-hint">Um palpite por conta. Pode trocar até o fim do jogo.</p>}
    <small>Opinião do público, não uma previsão do Scout.</small>
  </section>;
}
