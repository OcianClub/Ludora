import type { SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { chavePublicada, nomeOficial } from '../utils/paulistaView';
import { ClubBadge } from './Brand';
import { FilterSelect } from './FilterSelect';

export function PaulistaStandings({ snapshot, minhas, fase, grupo, onFilter }: {
  snapshot: SnapshotPaulista; minhas: Set<number>; fase: string; grupo: string;
  onFilter: (values: Record<string, string>) => void;
}) {
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
  if (!snapshot.classificacao.length) return <p className="collection-empty">Classificação oficial ainda não publicada pela federação.</p>;
  const label = (id: string, nome: string) => {
    const repetida = fases.filter(([, n]) => n === nome).length > 1;
    const nomes = snapshot.classificacao.filter(r => r.faseId === id).slice(0, 2).map(r => nomeOficial(equipes.get(r.equipeId)?.nome || ''));
    return nomeOficial(nome) + (repetida ? ` · ${nomes.join(' × ')}` : '');
  };
  return <section className="paulista-standings" aria-label="Classificação oficial">
    <div className="paulista-table-heading"><div><span className="eyebrow">CLASSIFICAÇÃO OFICIAL</span><h2>{inicial ? 'Classificação' : nomeOficial(rows[0]?.fase || 'Tabela publicada')}</h2><p>{grupoAtual || 'Grupo ainda não publicado'}</p></div>
      <div className="paulista-table-filters"><FilterSelect label="Etapa da classificação" value={inicial ? 'inicial' : selecionada || ''} emptyLabel="Selecionar etapa" onChange={v => onFilter({ tabela: v === 'inicial' ? faseDoClube || '' : v, grupo: '' })} options={[...(iniciais.length ? [{ value: 'inicial', label: 'Classificação' }] : []), ...fases.filter(([, nome]) => !/CLASSIFICA/i.test(nome)).map(([id, nome]) => ({ value: id, label: label(id, nome) }))]}/>
        {opcoesGrupo.length > 1 && <FilterSelect label="Grupo/chave" value={`${selecionada}|${grupoAtual}`} emptyLabel="Selecionar grupo" onChange={v => onFilter({ tabela: v.slice(0, v.indexOf('|')), grupo: v.slice(v.indexOf('|') + 1) })} options={opcoesGrupo.map(([value, g]) => ({ value, label: nomeOficial(g) }))}/>}
      </div>
    </div>
    {destaque && <div className="paulista-ranking-summary"><ClubBadge src={equipes.get(destaque.equipeId)?.escudo || undefined} size={44}/><div><span className="eyebrow">SEU CLUBE · {grupoAtual}</span><strong>{nomeOficial(equipes.get(destaque.equipeId)?.nome || '')}</strong></div><b>{destaque.posicao}º</b><dl><div><dt>Pontos</dt><dd>{destaque.pontosNota || destaque.pontos}</dd></div><div><dt>Vitórias</dt><dd>{destaque.vitorias}</dd></div><div><dt>Saldo</dt><dd>{destaque.saldo}</dd></div></dl></div>}
    <p className="page-sub">Cortes Ouro/Prata/Bronze não verificados no regulamento específico. Sem projeção. {opcoesGrupo.length === 1 && /UNICA|ÚNICA/i.test(grupos[0]) ? 'Chave única publicada: esta é a classificação geral desta fase.' : opcoesGrupo.length > 1 ? 'Tabelas independentes por grupo. A fonte não publica uma classificação geral separada nesta fase.' : 'Tabela publicada desta chave e etapa, sem comparação com posições de outras chaves.'} Posições e números conforme a federação.</p>
    <div className="paulista-table-scroll" tabIndex={0} aria-label="Tabela oficial. Role para os lados para consultar todas as estatísticas.">
      <table><thead><tr><th scope="col">Pos.</th><th scope="col">Equipe</th>{['PTS', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].map(v => <th scope="col" key={v}>{v}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={`${r.faseId}:${r.grupo}:${r.equipeId}`} className={minhas.has(r.equipeId) ? 'is-own' : ''}>
          <td>{r.posicao}º</td><th scope="row"><span className="paulista-ranking-team"><ClubBadge src={equipes.get(r.equipeId)?.escudo || undefined} size={28}/><span>{nomeOficial(equipes.get(r.equipeId)?.nome || 'Equipe a confirmar')}{minhas.has(r.equipeId) && <small>Seu clube</small>}</span></span></th>
          {[r.pontosNota || r.pontos, r.jogos, r.vitorias, r.empates, r.derrotas, r.golsPro, r.golsContra, r.saldo].map((v, i) => <td key={i}>{v}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {rows.some(r => r.pontosNota) && <p className="page-sub">* Pontuação marcada com nota na publicação oficial. Consulte a fonte para o motivo; os pontos não foram recalculados pelo Ludora.</p>}
    {!rows.length && <p className="collection-empty">A fonte ainda não publicou a tabela desta etapa.</p>}
  </section>;
}
