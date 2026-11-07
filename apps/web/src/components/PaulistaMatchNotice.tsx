import type { Partida } from '../services/api';
import type { GestaoPartida } from '../services/sharedMatches';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
export function PaulistaMatchNotice({ oficial, partida }: { oficial: GestaoPartida['paulista']; partida: Partida }) {
  if (!oficial) return null;
  const j = oficial.jogo;
  const diverge = j.golsMandante !== null && j.golsVisitante !== null && (partida.gols_mandante !== j.golsMandante || partida.gols_visitante !== j.golsVisitante);
  return <aside className="official-match-notice" aria-label="Dados oficiais da Federação Paulista">
    <div><Icon name="shield" size={19}/><strong>Paulista · Federação</strong><span>Resultado oficial: {j.ocorrencia === 'WO' ? 'W.O.' : j.ocorrencia === 'ADIADA' ? 'Adiada' : `${j.golsMandante ?? '—'} × ${j.golsVisitante ?? '—'}`}</span></div>
    <p>Adversários, mando, data e resultado publicado são definidos pela federação. Os controles abaixo registram as anotações do seu clube, com justificativa para correções.</p>
    {diverge && <p role="status">O placar anotado pelo clube diverge do oficial. Os eventos dos atletas permanecem preservados para revisão.</p>}
    {oficial.retroativo && <small>Há acontecimentos históricos registrados pelo clube após o encerramento.</small>}
    <Link to={`/competicoes/paulista?evento=${oficial.eventoId}`}>Ver campeonato<Icon name="chevronRight" size={14}/></Link>
  </aside>;
}
