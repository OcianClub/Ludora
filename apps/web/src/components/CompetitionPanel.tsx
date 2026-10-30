import { useEffect, useState } from 'react';
import { fetchJogadoresPerfis, requestJson, type Competicao, type PerfilJogador } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Btn, Spinner } from './UI';
import { CollectionSearch } from './CollectionToolbar';

type Ranking = { grupo: string; times: { key: string; nome: string; pontos: number; jogos: number; vitorias: number; empates: number; derrotas: number; saldo: number }[] };
export function CompetitionPanel({ competition, onClose }: { competition: Competicao; onClose: () => void }) {
  const { podeGerenciar } = useAuth();
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [players, setPlayers] = useState<PerfilJogador[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState('classificacao'), [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([requestJson<Ranking[]>(`/competicoes/${competition.id}/classificacao`), podeGerenciar ? fetchJogadoresPerfis() : Promise.resolve([]), podeGerenciar ? requestJson<{ id_jogador: number }[]>(`/competicoes/${competition.id}/jogadores`) : Promise.resolve([])])
      .then(([table, list, registered]) => { if (active) { setRanking(table); setPlayers(list.filter(j => j.categoria_tipo === competition.tipo)); setSelected(registered.map(j => j.id_jogador)); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [competition.id, podeGerenciar]);
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try { await requestJson(`/competicoes/${competition.id}/jogadores`, { method: 'PUT', body: JSON.stringify({ jogador_ids: selected }) }); setNotice('Inscrições do seu clube salvas.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal open title={competition.nome} onClose={() => { if (!busy) onClose(); }} className="competition-panel">
    <p className="editor-description">Organização: {competition.organizador?.nome || 'Seu clube'} · {competition.titulares_necessarios || 5} titulares · {competition.exigir_inscricao ? 'Inscrição obrigatória' : 'Sem inscrição obrigatória'}</p>
    <div className="shared-status-tabs" role="group" aria-label="Informações da competição"><button aria-pressed={tab === 'classificacao'} onClick={() => setTab('classificacao')}>Classificação</button>{podeGerenciar && <button aria-pressed={tab === 'inscricoes'} onClick={() => setTab('inscricoes')}>Inscrições do meu clube</button>}</div>
    {loading ? <Spinner/> : tab === 'classificacao' ? <><p className="editor-description">Vitória: 3 pontos · Empate: 1 ponto. Desempate por vitórias, saldo e gols marcados.</p>{ranking.length ? ranking.map(group => <section key={group.grupo}><h3>{group.grupo.toUpperCase()}</h3><div className="competition-table-scroll"><table className="competition-ranking"><thead><tr><th scope="col">Equipe</th>{['PTS','J','V','E','D','SG'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{group.times.map(t => <tr key={t.key}><th scope="row">{t.nome}</th>{[t.pontos,t.jogos,t.vitorias,t.empates,t.derrotas,t.saldo].map((n,i) => <td key={i}>{n}</td>)}</tr>)}</tbody></table></div></section>) : <p className="collection-empty">A classificação aparece após a primeira partida finalizada.</p>}</> : <>
      <p className="editor-description">Você altera apenas os atletas do seu clube nas categorias às quais tem acesso.</p>
      <CollectionSearch label="Buscar atleta para inscrição" value={search} onChange={setSearch} placeholder="Nome ou categoria"/>
      <div className="competition-registration-list">{players.filter(j => `${j.nome} ${j.categoria_nome}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(j => <label key={j.id}><input type="checkbox" checked={selected.includes(j.id)} onChange={e => setSelected(list => e.target.checked ? [...list,j.id] : list.filter(id => id !== j.id))}/><span><strong>{j.nome}</strong><small>{j.categoria_nome?.toUpperCase()}</small></span></label>)}</div>
      <Btn disabled={busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar inscrições'}</Btn>
    </>}
    {error && <p className="notice-error" role="alert">{error}</p>}{notice && <p className="match-notice" role="status">{notice}</p>}
  </Modal>;
}
