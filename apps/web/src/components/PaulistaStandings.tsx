import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { chavePublicada, nomeOficial } from '../utils/paulistaView';
import { nomeGrupo } from '../utils/paulistaOverview';
import { chavesDasEquipes, faixasPublicadas } from '../utils/paulistaStandings';
import { OfficialMedal } from './PaulistaIcons';
import './PaulistaStandings.css';
import { ClubBadge } from './Brand';
import { FilterSelect } from './FilterSelect';
import { Btn } from './UI';

export function PaulistaStandings({ snapshot, minhas, fase, grupo, onFilter, filtersTarget }: {
  snapshot: SnapshotPaulista; minhas: Set<number>; fase: string; grupo: string;
  onFilter: (values: Record<string, string>) => void;
  filtersTarget?: HTMLElement | null;
}) {
  const minhaLinha = useRef<HTMLTableRowElement>(null);
  const [localizada, setLocalizada] = useState(false);
  const destaqueTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(destaqueTimer.current), []);
  function localizar() {
    minhaLinha.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    minhaLinha.current?.focus({ preventScroll: true });
    setLocalizada(true);
    clearTimeout(destaqueTimer.current);
    destaqueTimer.current = setTimeout(() => setLocalizada(false), 2200);
  }
  const chaves = new Set(snapshot.classificacao.filter(r => minhas.has(r.equipeId)).map(r => chavePublicada(`${r.fase} ${r.grupo}`)).filter(Boolean));
  const disponiveis = snapshot.classificacao.filter(r => /CLASSIFICA/i.test(r.fase) || chaves.has(chavePublicada(`${r.fase} ${r.grupo}`)));
  const fases = [...new Map(disponiveis.map(r => [r.faseId, r.fase]))];
  const iniciais = disponiveis.filter(r => /CLASSIFICA/i.test(r.fase));
  const faseDoClube = iniciais.find(r => minhas.has(r.equipeId))?.faseId || iniciais[0]?.faseId;
  const selecionada = fases.some(([id]) => id === fase) ? fase : faseDoClube || fases[0]?.[0];
  const tabela = disponiveis.filter(r => r.faseId === selecionada), grupos = [...new Set(tabela.map(r => r.grupo))];
  const grupoAtual = grupos.includes(grupo) ? grupo : tabela.find(r => minhas.has(r.equipeId))?.grupo || grupos[0];
  const inicial = tabela.some(r => /CLASSIFICA/i.test(r.fase));
  // A fonte pode dar um faseId distinto a cada grupo inicial. O seletor aproxima
  // a apresentação, mas cada tabela continua filtrada pelo seu ID e grupo reais.
  const opcoesGrupo = [...new Map((inicial ? iniciais : tabela).map(r => [`${r.faseId}|${r.grupo}`, r.grupo]))];
  const rows = tabela.filter(r => r.grupo === grupoAtual).sort((a, b) => a.posicao - b.posicao);
  const equipes = new Map(snapshot.equipes.map(t => [t.id, t]));
  const destaque = rows.find(r => minhas.has(r.equipeId));
  const chavesPublicadas = chavesDasEquipes(snapshot);
  const faixas = faixasPublicadas(rows, chavesPublicadas);
  const conjuntos = faixas.length ? faixas.map(faixa => ({ faixa, linhas: rows.filter(r => r.posicao >= faixa.inicio && r.posicao <= faixa.fim) })) : [{ faixa: null, linhas: rows }];
  const chaveDoClube = destaque && chavesPublicadas.get(destaque.equipeId);
  const faixaDoClube = destaque && faixas.find(f => destaque.posicao >= f.inicio && destaque.posicao <= f.fim);
  const tabelaCompleta = rows.length > 0 && rows.every((r, i) => r.posicao === i + 1);
  if (!snapshot.classificacao.length) return <p className="collection-empty">Classificação oficial ainda não publicada pela federação.</p>;
  const label = (id: string, nome: string) => {
    const repetida = fases.filter(([, n]) => n === nome).length > 1;
    const nomes = snapshot.classificacao.filter(r => r.faseId === id).slice(0, 2).map(r => nomeOficial(equipes.get(r.equipeId)?.nome || ''));
    return nomeOficial(nome) + (repetida ? ` · ${nomes.join(' × ')}` : '');
  };
  const etapasDisponiveis = [...(iniciais.length ? [{ value: 'inicial', label: 'Fase de classificação' }] : []), ...fases.filter(([, nome]) => !/CLASSIFICA/i.test(nome)).map(([id, nome]) => ({ value: id, label: label(id, nome) }))];
  return <section className="paulista-standings" aria-label="Classificação oficial">
    <div className="paulista-table-heading">
      <div className="paulista-table-identity"><span className="eyebrow">CLASSIFICAÇÃO OFICIAL</span><div className="paulista-table-title"><h2>{inicial ? nomeGrupo(grupoAtual || 'Classificação') : nomeOficial(rows[0]?.fase || 'Tabela publicada')}</h2>
        {tabelaCompleta && <p>{rows.length} equipes</p>}
      </div></div>
      {(() => { const controls = <div className="paulista-table-filters">
        {etapasDisponiveis.length > 1 && <FilterSelect label="Etapa da classificação" value={inicial ? 'inicial' : selecionada || ''} emptyLabel="Selecionar etapa" onChange={v => onFilter({ tabela: v === 'inicial' ? faseDoClube || '' : v, grupo: '' })} options={etapasDisponiveis}/>}
        {opcoesGrupo.length > 1 && <FilterSelect label="Grupo/chave" value={`${selecionada}|${grupoAtual}`} emptyLabel="Selecionar grupo" onChange={v => onFilter({ tabela: v.slice(0, v.indexOf('|')), grupo: v.slice(v.indexOf('|') + 1) })} options={opcoesGrupo.map(([value, g]) => ({ value, label: nomeGrupo(nomeOficial(g)) }))}/>}
      </div>; return filtersTarget ? createPortal(controls, filtersTarget) : controls; })()}
    </div>
    <div className={`paulista-ranking-layout${destaque ? ' has-club' : ''}`}>
      <div className="paulista-ranking-table">
        <div className="paulista-table-scroll" tabIndex={0} aria-label="Tabela oficial. Role para os lados para consultar todas as estatísticas.">
          <table>
            <colgroup><col className="paulista-rank-position"/><col className="paulista-rank-club"/><col span={8}/></colgroup>
            <caption className="sr-only">Classificação oficial: {nomeOficial(rows[0]?.fase || '')}, {grupoAtual}. PTS: pontos; J: jogos; V: vitórias; E: empates; D: derrotas; GP: gols marcados; GC: gols sofridos; SG: saldo.</caption>
            <thead><tr><th scope="col">Pos.</th><th scope="col">Equipe</th>{['PTS', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].map((v, i) => <th scope="col" key={v}><abbr tabIndex={0} title={['Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols marcados', 'Gols sofridos', 'Saldo de gols'][i]}>{v}</abbr></th>)}</tr></thead>
            {conjuntos.map(({ faixa, linhas }) => <tbody key={faixa?.chave || "published"}>
                {faixa && <tr className={`paulista-ranking-band band-${faixa.chave?.toLowerCase() || 'pending'}`}><th colSpan={10} scope="rowgroup"><span className="paulista-ranking-band-label"><span>{faixa.chave ? `Chave ${faixa.chave[0]}${faixa.chave.slice(1).toLowerCase()}` : 'Chave não publicada'}</span><small>{faixa.inicio}º {faixa.inicio !== faixa.fim && `ao ${faixa.fim}º`}</small></span></th></tr>}
                {linhas.map(r => <tr key={`${r.faseId}:${r.grupo}:${r.equipeId}`} ref={r === destaque ? minhaLinha : undefined} tabIndex={r === destaque ? -1 : undefined} data-team-id={r.equipeId} data-key={faixa?.chave?.toLowerCase()} className={`${minhas.has(r.equipeId) ? 'is-own' : ''}${r === destaque && localizada ? ' is-located' : ''}`}>
                  <td>{r.posicao}º</td>
                  <th scope="row"><span className="paulista-ranking-team"><ClubBadge src={equipes.get(r.equipeId)?.escudo} name={nomeOficial(equipes.get(r.equipeId)?.nome || 'Equipe')} size={26}/><span title={nomeOficial(equipes.get(r.equipeId)?.nome || '')}>{nomeOficial(equipes.get(r.equipeId)?.nome || 'Equipe a confirmar')}{minhas.has(r.equipeId) && <small>Seu clube</small>}</span></span></th>
                  {[r.pontosNota || r.pontos, r.jogos, r.vitorias, r.empates, r.derrotas, r.golsPro, r.golsContra, r.saldo].map((v, i) => <td key={i}>{v}</td>)}
                </tr>)}
            </tbody>)}
          </table>
        </div>
        {!rows.length && <p className="collection-empty">A fonte ainda não publicou a tabela desta etapa.</p>}
      </div>
      {destaque && <aside className="paulista-ranking-summary" aria-label="Seu clube na classificação">
        <div className="paulista-standing-identity"><ClubBadge src={equipes.get(destaque.equipeId)?.escudo} name={equipes.get(destaque.equipeId)?.nome} size={38}/><div><span className="eyebrow">SEU CLUBE</span><strong>{nomeOficial(equipes.get(destaque.equipeId)?.nome || '')}</strong></div></div>
        <div className="paulista-standing-position"><b aria-label={`${destaque.posicao}º lugar`}>{destaque.posicao}º</b><span>{tabelaCompleta ? `de ${rows.length} equipes` : 'posição publicada'}<small>{nomeGrupo(grupoAtual)}</small></span></div>
        {chaveDoClube && <div className="paulista-standing-key"><OfficialMedal chave={chaveDoClube}/>{faixaDoClube?.chave && <small>{faixaDoClube.inicio}º ao {faixaDoClube.fim}º</small>}</div>}
        <dl className="paulista-standing-stats"><div><dt>Pontos</dt><dd>{destaque.pontosNota || destaque.pontos}</dd></div><div><dt>Jogos</dt><dd>{destaque.jogos}</dd></div><div><dt>Saldo de gols</dt><dd>{destaque.saldo > 0 ? '+' : ''}{destaque.saldo}</dd></div></dl>
        <div className="paulista-standing-record">
          <div><span>V · E · D</span><strong aria-label={`${destaque.vitorias} vitórias, ${destaque.empates} empates e ${destaque.derrotas} derrotas`}><span>{destaque.vitorias}</span> · <span>{destaque.empates}</span> · <span>{destaque.derrotas}</span></strong></div>
          <div className="paulista-standing-record-bar" aria-hidden="true">{[destaque.vitorias, destaque.empates, destaque.derrotas].map((n, i) => <span key={i} style={{ flexGrow: n }}/>)}</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={localizar}>Localizar meu clube</Btn>
      </aside>}
    </div>
    <details className="paulista-standings-info"><summary>Sobre a classificação oficial</summary>
      <p>Posições e pontos conforme a federação, sem recálculo pelo Ludora. {faixas.length ? 'As faixas mostram as chaves identificadas nas fases publicadas; não são uma projeção de classificação.' : 'Grupos são independentes. Chaves só aparecem quando identificadas na publicação; não são deduzidas da posição.'}</p>
      {rows.some(r => r.pontosNota) && <p>* Pontuação com nota na fonte oficial. Consulte a federação para o motivo.</p>}
    </details>
  </section>;
}
