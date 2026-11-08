import { lazy, Suspense, useState } from 'react';
import type { GestaoPartida } from '../services/sharedMatches';
import { matchWinner } from '../utils/matchResult';
import { ClubBadge } from './Brand';
import { EventIcon } from './EventIcon';
import { Icon } from './Icon';
import { formatMatchDate } from './MatchCard';
import { Btn } from './UI';
import './ThemeToggle.css';
import './MatchResultSummary.css';

const MatchShareDialog = lazy(() => import('./MatchShareDialog'));

type Props = {
  data: GestaoPartida;
  period?: number | null;
  onFeedback: (message: string) => void;
  onCorrectEvent?: () => void;
  onRequestCorrection?: () => void;
};

export function MatchResultSummary({ data, period = null, onFeedback, onCorrectEvent, onRequestCorrection }: Props) {
  const match = data.partida;
  const winner = matchWinner(data);
  const [shareOpen, setShareOpen] = useState(false);
  const sides = [
    { id: match.mandante_id, name: match.mandante?.nome || 'Mandante', crest: match.mandante?.escudo, score: match.gols_mandante },
    { id: match.visitante_id, name: match.visitante?.nome || 'Visitante', crest: match.visitante?.escudo, score: match.gols_visitante },
  ];
  const events = period === null ? data.eventos : data.eventos.filter(event => event.periodo === period);
  const count = (team: number, types: string[]) => events.filter(event => event.time_id === team && types.includes(event.tipo)).length;
  const stats = [
    { label: 'Faltas', type: 'FALTA', types: ['FALTA'] },
    { label: 'Cartões', type: 'CARTAO_AMARELO', types: ['CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL'] },
    { label: 'Assistências', type: 'ASSISTENCIA', types: ['ASSISTENCIA'] },
    { label: 'Defesas', type: 'DEFESA', types: ['DEFESA'] },
  ];

  return (
    <>
      <section className="match-result" aria-labelledby="match-result-title">
        <header className="match-result-heading">
          <h2 id="match-result-title" tabIndex={-1}>{data.paulista ? 'Placar anotado pelo clube' : 'Resultado da partida'}</h2>
          <span><Icon name="checkAll" size={15} />Encerrada</span>
        </header>
        <p className="match-result-outcome">
          <Icon name={winner ? 'trophy' : 'ball'} size={19} />
          {winner ? `Vitória do ${winner.name}!` : 'Empate entre as equipes'}
        </p>
        <div className="match-result-score" aria-label={`${sides[0].name} ${sides[0].score} a ${sides[1].score} ${sides[1].name}`}>
          <div className={`match-result-team${winner?.id === sides[0].id ? ' is-winner' : ''}`}>
            <ClubBadge src={sides[0].crest} name={sides[0].name} size={64} />
            <strong>{sides[0].name}</strong>
            <small>{winner?.id === sides[0].id ? 'Vencedor' : 'Mandante'}</small>
          </div>
          <div className="match-result-numbers" aria-hidden="true">
            <strong className={winner?.id === sides[0].id ? 'is-winner' : ''}>{sides[0].score}</strong>
            <span>·</span>
            <strong className={winner?.id === sides[1].id ? 'is-winner' : ''}>{sides[1].score}</strong>
          </div>
          <div className={`match-result-team${winner?.id === sides[1].id ? ' is-winner' : ''}`}>
            <ClubBadge src={sides[1].crest} name={sides[1].name} size={64} />
            <strong>{sides[1].name}</strong>
            <small>{winner?.id === sides[1].id ? 'Vencedor' : 'Visitante'}</small>
          </div>
        </div>
        <div className="match-result-facts">
          <span><Icon name="calendar" size={15} />{formatMatchDate(match.data)}{match.horario && ` · ${match.horario}`}</span>
          <span>{match.categoria?.nome?.toUpperCase()}{match.competicao?.nome && ` · ${match.competicao.nome}`}</span>
          {match.local && <span><Icon name="location" size={15} />{match.local}</span>}
        </div>
        <div className="match-result-stats" aria-label="Estatísticas registradas na partida">
          {stats.map(stat => (
            <div key={stat.label}>
              <span><EventIcon type={stat.type} />{stat.label}</span>
              <strong aria-label={`${stat.label}: ${count(sides[0].id, stat.types)} do ${sides[0].name}, ${count(sides[1].id, stat.types)} do ${sides[1].name}`}>
                {count(sides[0].id, stat.types)}<i>·</i>{count(sides[1].id, stat.types)}
              </strong>
            </div>
          ))}
        </div>
        <p className="match-result-note">{period === null ? 'Registros da partida' : `Registros do ${period}º tempo`} · {sides[0].name} à esquerda e {sides[1].name} à direita.</p>
        <div className="match-result-actions">
          <Btn onClick={() => setShareOpen(true)}>
            <Icon name="share" size={17} />Compartilhar resultado
          </Btn>
        </div>
        {onCorrectEvent && <button className="match-result-correction" type="button" onClick={onCorrectEvent}><Icon name="edit" size={14} />Adicionar evento com justificativa</button>}
        {onRequestCorrection && <button className="match-result-correction" type="button" onClick={onRequestCorrection}><Icon name="email" size={14} />Solicitar edição da súmula</button>}
      </section>
      {shareOpen && <Suspense fallback={<p role="status">Abrindo compartilhamento…</p>}>
        <MatchShareDialog data={data} onFeedback={onFeedback} onClose={() => setShareOpen(false)} />
      </Suspense>}
    </>
  );
}
