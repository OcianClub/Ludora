import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Modal, Spinner } from './UI';
import { fetchContextoScout, type PerfilJogador } from '../services/api';
import { formatMatchDate } from './MatchCard';
import {
  resumirContextoScout,
  formatarMediaScout,
  type ContextoScout,
  type FiltroContextoScout,
} from '../../../mobile/src/utils/contextoScout';
import { PositionIcon } from './PositionIcon';
import { Icon, type IconName } from './Icon';
import { ScoutIndexHelp } from './ScoutIndexHelp';
import { FilterSelect } from './FilterSelect';
import { ScoutRecordsRadar, ScoutRecentChart } from './ScoutCharts';
import './ScoutPlayerDetail.css';

const EVENTOS: Record<string, { nome: string; icon: IconName }> = {
  GOL: { nome: 'Gol', icon: 'ball' },
  ASSISTENCIA: { nome: 'Assistência', icon: 'handshake' },
  DEFESA: { nome: 'Defesa', icon: 'defense' },
  FALTA: { nome: 'Falta', icon: 'whistle' },
  CARTAO_AMARELO: { nome: 'Cartão amarelo', icon: 'alert' },
  CARTAO_VERMELHO: { nome: 'Cartão vermelho', icon: 'alert' },
  CARTAO_AZUL: { nome: 'Cartão azul', icon: 'alert' },
};

export function ScoutPlayerDetail({
  player,
  category,
  onClose,
  initialFilter = {},
}: {
  player: PerfilJogador;
  category: string;
  onClose: () => void;
  initialFilter?: FiltroContextoScout;
}) {
  const [context, setContext] = useState<ContextoScout | null>(null);
  const [options, setOptions] = useState<ContextoScout['opcoes']>();
  const [filtro, setFiltro] = useState<FiltroContextoScout>(initialFilter);
  const [tipo, setTipo] = useState(
    initialFilter.partida_id
      ? 'partida'
      : initialFilter.competicao_id
        ? 'competicao'
        : 'geral',
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const contentElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setContext(null);
    contentElement.current
      ?.closest('.modal-body')
      ?.scrollTo({ top: 0, behavior: 'instant' });
    fetchContextoScout(player.id, controller.signal, filtro)
      .then((data) => {
        if (!controller.signal.aborted) {
          setContext(data);
          setOptions(data.opcoes);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Não foi possível carregar os dados. Tente novamente.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [player.id, attempt, filtro]);

  const summary = context ? resumirContextoScout(context) : null;
  const single = context?.recorte?.tipo === 'partida';
  const match = single ? context?.partidas[0] : null;
  const totals = context?.totais;
  const seasons = [
    ...new Set(
      options?.temporadas ??
        (options?.partidas || [])
          .filter((p) => p.status === 'FINALIZADA')
          .map((p) => Number(p.data.slice(0, 4))),
    ),
  ].sort((a, b) => b - a);
  const title =
    tipo === 'competicao'
      ? options?.competicoes.find((c) => c.id === filtro.competicao_id)?.nome ||
        'Campeonato'
      : tipo === 'partida'
        ? 'Nesta partida'
        : filtro.ano
          ? 'Temporada ' + filtro.ano
          : 'Histórico completo';

  function changeType(next: string) {
    setTipo(next);
    setFiltro(
      next === 'competicao' && options?.competicoes.length
        ? { competicao_id: options.competicoes[0].id }
        : next === 'partida' && options?.partidas.length
          ? { partida_id: options.partidas[0].id }
          : {},
    );
  }

  function selectMatch(id: number) {
    setTipo('partida');
    setFiltro({ partida_id: id });
  }

  return (
    <Modal
      open
      title="Ficha do atleta"
      className="scout-detail-dialog athlete-sheet"
      onClose={onClose}
    >
      <header className="athlete-identity">
        <span className="athlete-shirt">
          {player.numCamisa != null ? (
            '#' + player.numCamisa
          ) : (
            <Icon name="shirt" size={25} />
          )}
        </span>
        <div>
          <h2>{player.nome}</h2>
          <p>
            <PositionIcon
              decorative
              tooltip={false}
              position={player.posicao}
            />
            {player.posicao || 'Posição não informada'}
            <span>·</span>
            {category.toUpperCase()}
            {player.idade != null && (
              <>
                <span>·</span>
                {player.idade} anos
              </>
            )}
          </p>
        </div>
      </header>
      <div className="athlete-filters">
        <div className="athlete-context-choice">
          <span className="athlete-label">Analisar</span>
          <div
            className="athlete-context-tabs"
            role="group"
            aria-label="Contexto do Scout"
          >
            {(['geral', 'competicao', 'partida'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={tipo === value}
                disabled={
                  (value === 'competicao' && !options?.competicoes.length) ||
                  (value === 'partida' && !options?.partidas.length)
                }
                onClick={() => changeType(value)}
              >
                {value === 'geral'
                  ? 'Geral'
                  : value === 'competicao'
                    ? 'Campeonato'
                    : 'Partida'}
              </button>
            ))}
          </div>
        </div>
        {tipo === 'geral' && (
          <FilterSelect
            label="Temporada"
            emptyLabel="Todas as temporadas"
            value={String(filtro.ano || '')}
            options={seasons.map((year) => ({
              value: year,
              label: String(year),
            }))}
            onChange={(value) => {
              if (!value || seasons.includes(Number(value)))
                setFiltro(value ? { ano: Number(value) } : {});
            }}
          />
        )}
        {tipo === 'competicao' && (
          <FilterSelect
            label="Campeonato"
            emptyLabel="Todos os campeonatos"
            value={String(filtro.competicao_id || '')}
            options={(options?.competicoes || []).map((c) => ({
              value: c.id,
              label: c.nome + ' · ' + c.ano,
            }))}
            onChange={(value) =>
              value
                ? setFiltro({ competicao_id: Number(value) })
                : changeType('geral')
            }
          />
        )}
        {tipo === 'partida' && (
          <FilterSelect
            label="Partida"
            emptyLabel="Todas as partidas"
            value={String(filtro.partida_id || '')}
            options={(options?.partidas || []).map((p) => ({
              value: p.id,
              label:
                formatMatchDate(p.data) +
                ' · ' +
                p.nome +
                (p.status === 'AO_VIVO' ? ' · Ao vivo' : ''),
            }))}
            onChange={(value) =>
              value ? selectMatch(Number(value)) : changeType('geral')
            }
          />
        )}
      </div>
      <div className="athlete-content" aria-busy={loading} ref={contentElement}>
        {loading ? (
          <div className="athlete-loading" role="status">
            <Spinner />
            <span>Carregando estatísticas…</span>
          </div>
        ) : error ? (
          <div role="alert" className="athlete-empty">
            <Icon name="alert" size={24} />
            <p>{error}</p>
            <Btn
              variant="ghost"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Tentar novamente
            </Btn>
            <Btn variant="ghost" onClick={() => changeType('geral')}>
              Voltar ao geral
            </Btn>
          </div>
        ) : (
          context &&
          summary && (
            <>
              <div className="athlete-section-heading">
                <h3>{title}</h3>
                <span>
                  {context.total_partidas}{' '}
                  {context.total_partidas === 1
                    ? 'partida com registro'
                    : 'partidas com registro'}
                </span>
              </div>
              {context.recorte?.provisorio && (
                <p className="athlete-notice" role="status">
                  <Icon name="broadcast" size={17} />
                  Dados provisórios: esta partida está ao vivo.
                </p>
              )}
              {!context.total_partidas ? (
                <div className="athlete-empty">
                  <Icon name="radar" size={30} />
                  <h3>
                    {filtro.ano
                      ? 'Ainda sem registros neste período'
                      : 'Este atleta ainda não tem registros'}
                  </h3>
                  <p>
                    {filtro.ano
                      ? 'Escolha outra temporada ou consulte o histórico completo.'
                      : 'Os dados aparecem após uma convocação ou evento em uma partida finalizada.'}
                  </p>
                  {filtro.ano && (
                    <Btn variant="ghost" onClick={() => changeType('geral')}>
                      Ver histórico completo
                    </Btn>
                  )}
                </div>
              ) : (
                <>
                  {match && (
                    <div className="athlete-match-summary">
                      <span>
                        {formatMatchDate(match.data)} ·{' '}
                        {match.competicao?.nome || 'Amistoso'}
                      </span>
                      <strong>
                        {match.mandante}
                        <b>
                          {match.gols_mandante} × {match.gols_visitante}
                        </b>
                        {match.visitante}
                      </strong>
                      <div>
                        <span>
                          {match.convocado
                            ? match.titular_inicial === true
                              ? 'Titular inicial'
                              : match.titular_inicial === false
                                ? 'Reserva inicial'
                                : 'Convocado'
                            : 'Com eventos registrados'}
                        </span>
                        <Link to={'/partidas/' + match.id} onClick={onClose}>
                          Abrir partida <Icon name="chevronRight" size={16} />
                        </Link>
                      </div>
                    </div>
                  )}
                  {totals && (
                    <>
                      <dl className="athlete-key-stats scout-recorded-totals">
                        {(
                          [
                            ['Convocações', totals.convocacoes, 'team'],
                            ['Gols', totals.gols, 'ball'],
                            ['Assist.', totals.assistencias, 'handshake'],
                            ['Defesas', totals.defesas, 'defense'],
                          ] as [string, number, IconName][]
                        ).map(([label, value, icon]) => (
                          <div key={label}>
                            <Icon name={icon} size={18} />
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="athlete-secondary-stats">
                        <span>
                          <b>{totals.titularidades}</b> como titular inicial
                        </span>
                        <span>
                          <b>{totals.faltas}</b>{' '}
                          {totals.faltas === 1 ? 'falta' : 'faltas'}
                        </span>
                        <span>
                          <b>
                            {totals.amarelos + totals.vermelhos + totals.azuis}
                          </b>{' '}
                          {totals.amarelos + totals.vermelhos + totals.azuis ===
                          1
                            ? 'cartão'
                            : 'cartões'}
                        </span>
                      </div>
                    </>
                  )}
                  <div
                    className={
                      'athlete-charts' +
                      (single ? ' athlete-charts-single' : '')
                    }
                  >
                    {totals && (
                      <section
                        className="athlete-panel"
                        aria-labelledby="athlete-radar-title"
                      >
                        <div className="athlete-panel-heading">
                          <h3 id="athlete-radar-title">Raio-X dos registros</h3>
                          <span>
                            {single
                              ? 'Nesta partida'
                              : 'No período selecionado'}
                          </span>
                        </div>
                        <ScoutRecordsRadar totals={totals} />
                      </section>
                    )}
                    {!single && !!context.partidas.length && (
                      <section
                        className="athlete-panel"
                        aria-labelledby="athlete-trend-title"
                      >
                        <div className="athlete-panel-heading">
                          <h3 id="athlete-trend-title">Últimos jogos</h3>
                          <span>Gols, assistências e defesas por partida</span>
                        </div>
                        <ScoutRecentChart
                          matches={context.partidas}
                          onSelect={selectMatch}
                        />
                        <div className="athlete-averages">
                          <h4>
                            {summary.tamanhoRecente === 1
                              ? 'Média na última partida'
                              : 'Média nas últimas ' +
                                summary.tamanhoRecente +
                                ' partidas'}
                          </h4>
                          <dl>
                            {summary.metricas.map((m) => (
                              <div key={m.campo}>
                                <dt>
                                  {m.titulo === 'Assistências'
                                    ? 'Assist.'
                                    : m.titulo}
                                  /jogo
                                </dt>
                                <dd>{formatarMediaScout(m.recente)}</dd>
                                {summary.podeComparar && (
                                  <small>
                                    Antes: {formatarMediaScout(m.anterior)}
                                  </small>
                                )}
                              </div>
                            ))}
                          </dl>
                          {summary.podeComparar && (
                            <p className="athlete-note">
                              Antes = média das 5 partidas anteriores.
                            </p>
                          )}
                        </div>
                      </section>
                    )}
                  </div>
                  {!single && summary.poucosRegistros && (
                    <p className="athlete-note athlete-sample-note">
                      <Icon name="info" size={16} />
                      Amostra inicial: {context.total_partidas} de 5 partidas.
                      Evite conclusões com poucos registros.
                    </p>
                  )}
                  {!single && !!context.partidas.length && (
                    <section className="athlete-history">
                      <div className="athlete-section-heading">
                        <h3>Jogos com registro</h3>
                        <span>
                          {context.partidas.length === 1
                            ? 'Última partida'
                            : 'Últimos ' +
                              context.partidas.length +
                              ' · mais recentes primeiro'}
                        </span>
                      </div>
                      <div className="scout-history-scroll">
                        <table className="scout-history-table">
                          <caption className="sr-only">
                            Estatísticas do atleta nos últimos jogos. Selecione
                            o adversário para detalhar.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Adversário / data</th>
                              <th scope="col">Gols</th>
                              <th scope="col" aria-label="Assistências">
                                Assist
                              </th>
                              <th scope="col">Defesas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {context.partidas.map((p) => (
                              <tr key={p.id}>
                                <th scope="row">
                                  <button
                                    className="scout-match-link"
                                    type="button"
                                    onClick={() => selectMatch(p.id)}
                                  >
                                    <span className="athlete-history-opponent">
                                      {p.adversario}
                                    </span>
                                    <small>
                                      <time dateTime={p.data}>
                                        {formatMatchDate(p.data)}
                                      </time>
                                      <span className="athlete-history-competition">
                                        {p.competicao?.nome || 'Amistoso'}
                                      </span>
                                    </small>
                                  </button>
                                </th>
                                <td>{p.gols}</td>
                                <td>{p.assistencias}</td>
                                <td>{p.defesas}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  {single && (
                    <section className="athlete-history">
                      <div className="athlete-section-heading">
                        <h3>Ações do atleta</h3>
                        <span>Nesta partida</span>
                      </div>
                      <div className="scout-athlete-events">
                        {match?.eventos?.length ? (
                          match.eventos.map((e) => (
                            <div key={e.id}>
                              <Icon
                                name={EVENTOS[e.tipo]?.icon || 'info'}
                                size={18}
                              />
                              <span>
                                {e.gol_contra
                                  ? 'Gol contra'
                                  : EVENTOS[e.tipo]?.nome || e.tipo}
                              </span>
                              <small>
                                {e.periodo}º tempo
                                {e.minuto != null
                                  ? ' · ' + e.minuto + ' min'
                                  : ''}
                              </small>
                            </div>
                          ))
                        ) : (
                          <p className="athlete-note">
                            Nenhum evento atribuído ao atleta nesta partida.
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                  {totals && (
                    <details className="athlete-disclosure">
                      <summary>
                        <Icon name="whistle" size={17} />
                        <span>Disciplina e escalação</span>
                        <Icon name="chevronRight" size={16} />
                      </summary>
                      <dl className="athlete-extra-stats">
                        {[
                          ['Faltas', totals.faltas],
                          ['Amarelos', totals.amarelos],
                          ['Vermelhos', totals.vermelhos],
                          ['Azuis', totals.azuis],
                          ['Gols contra', totals.gols_contra],
                          ['Titularidades iniciais', totals.titularidades],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      {!!totals.titularidades_desconhecidas && (
                        <p className="athlete-note">
                          {totals.titularidades_desconhecidas} convocações
                          antigas sem titularidade inicial informada.
                        </p>
                      )}
                    </details>
                  )}
                  {!single && !!context.por_tempo?.length && (
                    <details className="athlete-disclosure">
                      <summary>
                        <Icon name="clock" size={17} />
                        <span>Registros por tempo</span>
                        <Icon name="chevronRight" size={16} />
                      </summary>
                      <p className="athlete-note">
                        Contagem de eventos; não indica o tempo jogado.
                      </p>
                      <div className="scout-periods">
                        {context.por_tempo.map((p) => (
                          <div key={p.periodo}>
                            <strong>{p.periodo}º tempo</strong>
                            <span>
                              {p.gols} gols · {p.assistencias} assist ·{' '}
                              {p.defesas} defesas
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {!single &&
                    !filtro.competicao_id &&
                    !filtro.ano &&
                    !!context.semelhantes?.length && (
                      <details className="athlete-disclosure">
                        <summary>
                          <Icon name="team" size={17} />
                          <span>Atletas com registros semelhantes</span>
                          <Icon name="chevronRight" size={16} />
                        </summary>
                        <p className="athlete-note">
                          Mesma categoria e posição. Semelhança nos registros
                          não significa habilidade equivalente.
                        </p>
                        <div className="scout-similar">
                          {context.semelhantes.map((p) => (
                            <Link
                              key={p.id}
                              to={
                                '/elenco?categoria_id=' +
                                player.categoria_id +
                                '&atleta=' +
                                p.id
                              }
                              onClick={onClose}
                            >
                              <span>
                                {p.numCamisa != null ? '#' + p.numCamisa : '—'}
                              </span>
                              {p.nome}
                              <Icon name="chevronRight" size={16} />
                            </Link>
                          ))}
                        </div>
                        {context.modelo && (
                          <p className="athlete-note">
                            {context.modelo.grupo_tamanho} atletas na comparação
                            · atualizado em{' '}
                            {new Date(
                              context.modelo.calculado_em,
                            ).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </details>
                    )}
                </>
              )}
              <footer className="athlete-data-help">
                <p className="athlete-note">
                  {single
                    ? 'Registros da partida selecionada.'
                    : 'Somente partidas finalizadas.'}{' '}
                  Zero = nenhum evento registrado. Convocação não comprova
                  entrada em campo.
                </p>
                <ScoutIndexHelp />
              </footer>
            </>
          )
        )}
      </div>
    </Modal>
  );
}
