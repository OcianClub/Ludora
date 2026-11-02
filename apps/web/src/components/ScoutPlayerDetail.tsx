import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Modal, Spinner } from './UI';
import { fetchContextoScout, type PerfilJogador } from '../services/api';
import { formatMatchDate } from './MatchCard';
import { profileClass } from '../utils/scoutPlayers';
import {
  resumirContextoScout,
  formatarMediaScout,
  observacoesContextoScout,
  type ContextoScout,
  type FiltroContextoScout,
} from '../../../mobile/src/utils/contextoScout';
import { PositionIcon } from './PositionIcon';
import { Icon, type IconName } from './Icon';
import { ScoutIndexHelp } from './ScoutIndexHelp';
import { FilterSelect } from './FilterSelect';

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
        : 'geral'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setContext(null);
    fetchContextoScout(player.id, controller.signal, filtro)
      .then((data) => {
        if (!controller.signal.aborted) {
          setContext(data);
          setOptions(data.opcoes);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            'Não foi possível carregar este recorte. Tente novamente ou selecione outro contexto.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [player.id, attempt, filtro]);
  const summary = context ? resumirContextoScout(context) : null;
  const single = context?.recorte?.tipo === 'partida';
  const match = single ? context?.partidas[0] : null;
  const insights = context ? observacoesContextoScout(context) : [];
  const title =
    tipo === 'competicao'
      ? options?.competicoes.find((c) => c.id === filtro.competicao_id)?.nome ||
        'Campeonato'
      : tipo === 'partida'
        ? 'Partida selecionada'
        : filtro.ano
          ? `Temporada ${filtro.ano}`
          : 'Geral · partidas finalizadas';
  function changeType(next: string) {
    setTipo(next);
    setFiltro(
      next === 'competicao' && options?.competicoes.length
        ? { competicao_id: options.competicoes[0].id }
        : next === 'partida' && options?.partidas.length
          ? { partida_id: options.partidas[0].id }
          : {}
    );
  }
  return (
    <Modal
      open
      title="Ficha do atleta"
      className="scout-detail-dialog"
      onClose={onClose}
    >
      <header
        className={`scout-detail-identity scout-tone-${profileClass(player)}`}
      >
        <span className="scout-shirt">
          {player.numCamisa != null ? `#${player.numCamisa}` : '—'}
        </span>
        <div className="scout-detail-person">
          <h2>{player.nome}</h2>
          <p className="position-inline">
            <PositionIcon
              decorative
              tooltip={false}
              position={player.posicao}
            />
            {player.posicao || 'Posição não informada'} · {category}
            {player.idade != null ? ` · ${player.idade} anos` : ''}
          </p>
        </div>
        <p className="scout-profile-description">
          Consulte a contribuição registrada no contexto de cada campeonato ou
          partida.
        </p>
      </header>
      <div className="scout-context-controls">
        <div
          className="scout-context-tabs"
          role="group"
          aria-label="Contexto do Scout"
        >
          {['geral', 'competicao', 'partida'].map((value) => (
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
        {tipo === 'competicao' && (
          <FilterSelect
            label="Campeonato"
            emptyLabel="Selecione um campeonato"
            value={String(filtro.competicao_id || '')}
            options={(options?.competicoes || []).map((c) => ({
              value: c.id,
              label: `${c.nome} · ${c.ano}`,
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
            emptyLabel="Selecione uma partida"
            value={String(filtro.partida_id || '')}
            options={(options?.partidas || []).map((p) => ({
              value: p.id,
              label: `${formatMatchDate(p.data)} · ${p.nome}${p.status === 'AO_VIVO' ? ' · Ao vivo' : ''}`,
            }))}
            onChange={(value) =>
              value
                ? setFiltro({ partida_id: Number(value) })
                : changeType('geral')
            }
          />
        )}
        {tipo === 'geral' && (
          <label className="scout-season">
            Temporada{' '}
            <input
              aria-label="Ano da temporada"
              type="number"
              min="1900"
              max="2200"
              placeholder="Todas"
              defaultValue={filtro.ano || ''}
              onBlur={(event) => {
                const year = Number(event.target.value);
                if (!event.target.value) setFiltro({});
                else if (Number.isInteger(year) && year >= 1900 && year <= 2200)
                  setFiltro({ ano: year });
                else event.currentTarget.reportValidity();
              }}
            />
          </label>
        )}
      </div>
      <div className="scout-detail-content">
        <ScoutIndexHelp />
        {loading ? (
          <div className="scout-context-loading" role="status">
            <Spinner />
            <span>Consultando os registros deste contexto…</span>
          </div>
        ) : error ? (
          <div role="alert" className="scout-inline-error">
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
              <section
                className="scout-detail-section"
                aria-labelledby="scout-context-title"
              >
                <div className="scout-detail-section-heading">
                  <h3 id="scout-context-title">{title}</h3>
                  <span>
                    {context.total_partidas}{' '}
                    {context.total_partidas === 1
                      ? 'partida com registro'
                      : 'partidas com registro'}
                  </span>
                </div>
                {context.recorte?.provisorio && (
                  <p className="scout-sample" role="status">
                    <Icon name="info" size={18} />
                    Dados provisórios: esta partida está ao vivo e não entra nas
                    análises históricas.
                  </p>
                )}
                <p className="scout-help">
                  Só eventos atribuídos ao atleta. Convocação não comprova
                  entrada em campo; não estimamos minutos jogados.
                </p>
                {match && (
                  <div className="scout-context-match">
                    <span>
                      {formatMatchDate(match.data)} ·{' '}
                      {match.competicao?.nome || 'Amistoso'}
                    </span>
                    <strong>
                      {match.mandante}{' '}
                      <b>
                        {match.gols_mandante} × {match.gols_visitante}
                      </b>{' '}
                      {match.visitante}
                    </strong>
                    <span>
                      {match.convocado
                        ? match.titular_inicial === true
                          ? 'Titular na escalação inicial'
                          : match.titular_inicial === false
                            ? 'Reserva na escalação inicial'
                            : 'Convocado · titularidade inicial não informada'
                        : 'Eventos registrados sem convocação cadastrada'}
                    </span>
                    <Link to={`/partidas/${match.id}`} onClick={onClose}>
                      Abrir partida <Icon name="chevronRight" size={15} />
                    </Link>
                  </div>
                )}
                {context.totais && (
                  <dl className="scout-detail-totals scout-recorded-totals">
                    {(
                      [
                        ['Convocações', context.totais.convocacoes, 'team'],
                        [
                          'Titularidades iniciais',
                          context.totais.titularidades,
                          'user',
                        ],
                        ['Gols', context.totais.gols, 'ball'],
                        [
                          'Assistências',
                          context.totais.assistencias,
                          'handshake',
                        ],
                        ['Defesas', context.totais.defesas, 'defense'],
                        ['Faltas', context.totais.faltas, 'whistle'],
                        ['Amarelos', context.totais.amarelos, 'alert'],
                        ['Vermelhos', context.totais.vermelhos, 'alert'],
                        ['Azuis', context.totais.azuis, 'alert'],
                      ] as [string, number, IconName][]
                    ).map(([label, value, icon]) => (
                      <div key={label}>
                        <Icon name={icon} size={18} />
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {!!context.totais?.titularidades_desconhecidas && (
                  <p className="scout-help">
                    Em {context.totais.titularidades_desconhecidas} convocações
                    antigas, a titularidade inicial não foi registrada.
                  </p>
                )}
                {!!context.totais?.gols_contra && (
                  <p className="scout-help">
                    {context.totais.gols_contra} gol(s) contra registrado(s),
                    separados dos gols a favor.
                  </p>
                )}
              </section>
              <section
                className="scout-detail-section"
                aria-labelledby="scout-recent-title"
              >
                <div className="scout-detail-section-heading">
                  <h3 id="scout-recent-title">
                    {single
                      ? 'Contribuição nesta partida'
                      : 'Momento do atleta'}
                  </h3>
                  <span>
                    {single
                      ? 'Eventos registrados'
                      : 'Dentro do recorte selecionado'}
                  </span>
                </div>
                <div className="scout-insights">
                  {insights.map((insight) => (
                    <article key={insight.titulo}>
                      <Icon name="info" size={18} />
                      <div>
                        <h4>{insight.titulo}</h4>
                        <p>{insight.texto}</p>
                      </div>
                    </article>
                  ))}
                </div>
                {!single && !!summary.tamanhoRecente && (
                  <>
                    <h4>
                      Médias nas últimas {summary.tamanhoRecente} partidas com
                      registro
                    </h4>
                    <dl className="scout-detail-totals scout-recent-averages">
                      {summary.metricas.map((m) => (
                        <div key={m.campo}>
                          <dt>
                            {m.titulo}
                            <span>por partida com registro</span>
                          </dt>
                          <dd>{formatarMediaScout(m.recente)}</dd>
                          {summary.podeComparar && (
                            <small>
                              5 anteriores: {formatarMediaScout(m.anterior)}
                            </small>
                          )}
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                {!single && context.partidas.length > 0 && (
                  <div className="scout-history-scroll">
                    <table className="scout-history-table">
                      <caption>
                        Últimos jogos com registro{' '}
                        <span>
                          Até 10 · mais recentes primeiro · selecione para
                          detalhar
                        </span>
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
                                onClick={() => {
                                  setTipo('partida');
                                  setFiltro({ partida_id: p.id });
                                }}
                              >
                                {p.adversario}
                                <small>
                                  {formatMatchDate(p.data)} ·{' '}
                                  {p.competicao?.nome || 'Amistoso'}
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
                )}
                {single && (
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
                            {e.minuto != null ? ` · ${e.minuto} min` : ''}
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="scout-help">
                        Nenhum evento atribuído ao atleta nesta partida. Isso
                        não avalia seu desempenho em campo.
                      </p>
                    )}
                  </div>
                )}
              </section>
              {!!context.por_tempo?.length && !single && (
                <section className="scout-detail-section">
                  <h3>Distribuição por tempo</h3>
                  <p className="scout-help">
                    Eventos no recorte inteiro. Não indica em quais tempos o
                    atleta jogou mais.
                  </p>
                  <div className="scout-periods">
                    {context.por_tempo.map((p) => (
                      <div key={p.periodo}>
                        <strong>{p.periodo}º tempo</strong>
                        <span>
                          {p.gols} gols · {p.assistencias} assist · {p.defesas}{' '}
                          defesas
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {context.semelhantes && (
                <section className="scout-detail-section">
                  <h3>Padrões de registros semelhantes</h3>
                  <p className="scout-help">
                    Mesmo clube, categoria e posição · médias por convocação em
                    partidas finalizadas. Semelhança não significa qualidade ou
                    habilidade equivalente.
                  </p>
                  {context.semelhantes.length ? (
                    <>
                      <div className="scout-similar">
                        {context.semelhantes.map((p) => (
                          <Link
                            key={p.id}
                            to={`/elenco?categoria_id=${player.categoria_id}&atleta=${p.id}`}
                            onClick={onClose}
                          >
                            <span>
                              {p.numCamisa != null ? `#${p.numCamisa}` : '—'}
                            </span>
                            {p.nome}
                            <Icon name="chevronRight" size={16} />
                          </Link>
                        ))}
                      </div>
                      <p className="scout-help">
                        Modelo v{context.modelo?.versao} ·{' '}
                        {context.modelo?.grupo_tamanho} atletas no grupo ·
                        atualizado em{' '}
                        {context.modelo?.calculado_em
                          ? new Date(
                              context.modelo.calculado_em
                            ).toLocaleDateString('pt-BR')
                          : 'data não informada'}
                        .
                      </p>
                    </>
                  ) : (
                    <p className="scout-help">
                      {single || filtro.competicao_id || filtro.ano
                        ? 'Consulte o contexto Geral, sem filtro de temporada, para ver padrões do histórico completo.'
                        : 'A comparação fica disponível após o processamento do Scout IA, com pelo menos 5 atletas da mesma categoria e posição, cada um com 5 convocações e eventos registrados.'}
                    </p>
                  )}
                </section>
              )}
              <p className="scout-help scout-detail-footnote">
                <Icon name="info" size={15} />
                Zero significa nenhum evento registrado. A coleta pode ser
                parcial; não há avaliação automática de técnica, intensidade
                física ou previsão de desempenho.
              </p>
            </>
          )
        )}
      </div>
    </Modal>
  );
}
