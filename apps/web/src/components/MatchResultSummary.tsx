import { useState } from 'react';
import type { GestaoPartida } from '../services/sharedMatches';
import { matchResultText, matchWinner } from '../utils/matchResult';
import { ClubBadge } from './Brand';
import { EventIcon } from './EventIcon';
import { Icon } from './Icon';
import { formatMatchDate } from './MatchCard';
import { Btn, Modal } from './UI';
import './ThemeToggle.css';
import './MatchResultSummary.css';

type Props = {
  data: GestaoPartida;
  onFeedback: (message: string) => void;
  onCorrectEvent?: () => void;
};

export function MatchResultSummary({ data, onFeedback, onCorrectEvent }: Props) {
  const match = data.partida;
  const winner = matchWinner(data);
  const [shareOpen, setShareOpen] = useState(false);
  const [includeNames, setIncludeNames] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);
  const sides = [
    { id: match.mandante_id, name: match.mandante?.nome || 'Mandante', crest: match.mandante?.escudo, score: match.gols_mandante },
    { id: match.visitante_id, name: match.visitante?.nome || 'Visitante', crest: match.visitante?.escudo, score: match.gols_visitante },
  ];
  const text = (data.paulista ? 'Anotações do clube (resultado oficial consultável na federação).\n' : '') + matchResultText(data, includeNames);
  const count = (team: number, types: string[]) => data.eventos.filter(event => event.time_id === team && types.includes(event.tipo)).length;
  const stats = [
    { label: 'Faltas', type: 'FALTA', types: ['FALTA'] },
    { label: 'Cartões', type: 'CARTAO_AMARELO', types: ['CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL'] },
    { label: 'Assistências', type: 'ASSISTENCIA', types: ['ASSISTENCIA'] },
    { label: 'Defesas', type: 'DEFESA', types: ['DEFESA'] },
  ];

  async function shareResult() {
    if (sharing) return;
    setSharing(true);
    setShareError('');
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${sides[0].name} × ${sides[1].name} · Ludora`, text, url: location.href });
        onFeedback('Resultado compartilhado.');
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${location.href}`);
        onFeedback('Resultado e link copiados para compartilhar.');
      }
      setShareOpen(false);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setShareError('Não foi possível compartilhar. Você pode selecionar e copiar o texto da prévia.');
        setMessageOpen(true);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <section className="match-result" aria-labelledby="match-result-title">
        <header className="match-result-heading">
          <h2 id="match-result-title" tabIndex={-1}>{data.paulista ? 'Placar anotado pelo clube' : 'Resultado da partida'}</h2>
          <span><Icon name="checkAll" size={15} />Encerrada</span>
        </header>
        <p className="match-result-outcome">
          <Icon name={winner ? 'trophy' : 'ball'} size={19} />
          {winner ? `Vitória do ${winner.name}` : 'Empate entre as equipes'}
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
        <p className="match-result-note">Números dos eventos registrados · {sides[0].name} à esquerda e {sides[1].name} à direita.</p>
        <div className="match-result-actions">
          <Btn onClick={() => { setShareError(''); setIncludeNames(false); setMessageOpen(false); setShareOpen(true); }}>
            <Icon name="share" size={17} />Compartilhar resultado
          </Btn>
        </div>
        {onCorrectEvent && <button className="match-result-correction" type="button" onClick={onCorrectEvent}><Icon name="edit" size={14} />Adicionar evento com justificativa</button>}
      </section>
      <Modal
        open={shareOpen}
        title="Compartilhar resultado"
        className="live-small-dialog match-result-share"
        onClose={() => { if (!sharing) setShareOpen(false); }}
        footer={<div className="live-modal-buttons">
          <Btn variant="ghost" disabled={sharing} onClick={() => setShareOpen(false)}>Voltar</Btn>
          <Btn disabled={sharing} onClick={() => void shareResult()}>
            <Icon name="share" size={17} />{sharing ? 'Preparando…' : typeof navigator.share === 'function' ? 'Compartilhar' : 'Copiar resultado'}
          </Btn>
        </div>}
      >
        <div className="match-share-preview" aria-label="Prévia do resultado">
          <div className="match-share-preview-heading">
            <span>LUDORA</span>
            <span>{match.categoria?.nome?.toUpperCase()} · {formatMatchDate(match.data)}</span>
          </div>
          <div className="match-result-score">
            <div className="match-result-team">
              <ClubBadge src={sides[0].crest} name={sides[0].name} size={52} />
              <strong>{sides[0].name}</strong>
            </div>
            <div className="match-result-numbers" aria-label={`Placar final: ${sides[0].score} a ${sides[1].score}`}>
              <strong>{sides[0].score}</strong><span>·</span><strong>{sides[1].score}</strong>
            </div>
            <div className="match-result-team">
              <ClubBadge src={sides[1].crest} name={sides[1].name} size={52} />
              <strong>{sides[1].name}</strong>
            </div>
          </div>
          <p><Icon name={winner ? 'trophy' : 'ball'} size={16} />{winner ? `Vitória do ${winner.name}` : 'Empate entre as equipes'}</p>
        </div>
        <div className="match-result-name-setting">
          <div><strong id="share-player-names">Incluir nomes dos jogadores</strong><p id="share-player-description">Adiciona os autores dos lances ao texto compartilhado.</p></div>
          <button className="settings-switch" type="button" role="switch" aria-checked={includeNames} aria-labelledby="share-player-names" aria-describedby="share-player-description" disabled={sharing} onClick={() => setIncludeNames(current => !current)}>
            <span className="settings-switch-thumb" aria-hidden="true"><Icon name="user" size={13} /></span>
          </button>
        </div>
        <details className="match-share-message" open={messageOpen} onToggle={event => setMessageOpen(event.currentTarget.open)}>
          <summary><Icon name="list" size={16} />Ver mensagem<Icon name="chevronRight" size={16} /></summary>
          <label className="sr-only" htmlFor="match-result-preview">Prévia do compartilhamento</label>
          <textarea id="match-result-preview" className="match-result-preview" readOnly value={text} />
        </details>
        <p className="match-result-note">Será compartilhado o texto do resultado com o link da partida.</p>
        {shareError && <p className="notice-error" role="alert">{shareError}</p>}
      </Modal>
    </>
  );
}
