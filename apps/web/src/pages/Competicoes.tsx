import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCompeticoes, criarCompeticao, atualizarCompeticao, arquivarCompeticao, type Competicao } from '../services/api';
import { Btn, Modal, Input, LoadingSkeleton } from '../components/UI';
import { type ViewMode } from '../components/CollectionControls';
import { CollectionSearch, CollectionFilterButton, CollectionFilterDialog, CollectionViewToggle } from '../components/CollectionToolbar';
import { FilterSelect } from '../components/FilterSelect';
import { CompetitionPanel } from '../components/CompetitionPanel';
import { CompetitionMenu } from '../components/CompetitionMenu';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import './Competicoes.css';

const TIPOS = [{ value: 'BASE', label: 'Base' }, { value: 'INICIACAO', label: 'Iniciação' }];
const FORM_VAZIO = { nome: '', ano: String(new Date().getFullYear()), tipo: 'BASE', titulares_necessarios: '5', exigir_inscricao: false };
const SITUACOES = { SEM_PARTIDAS: 'Sem partidas', AGENDADA: 'Agendada', EM_ANDAMENTO: 'Em andamento', FINALIZADA: 'Jogos concluídos' };
type Tab = 'ativas' | 'finalizadas' | 'arquivadas';
const aba = (c: Competicao): Tab => c.arquivada ? 'arquivadas' : c.resumo?.situacao === 'FINALIZADA' ? 'finalizadas' : 'ativas';
const normalizar = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const dia = (value: string) => new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export default function CompeticoesPage() {
  const { podeGerenciar, clube } = useAuth();
  const podeAdministrar = podeGerenciar && (clube?.meuPapel === 'ADMIN' || clube?.acessoTodasCategorias === true);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true), [version, setVersion] = useState(0), [loadError, setLoadError] = useState('');
  const [busca, setBusca] = useState(''), [year, setYear] = useState(''), [tab, setTab] = useState<Tab>('ativas');
  const [filters, setFilters] = useState({ tipo: '', origem: '', andamento: '' }), [draft, setDraft] = useState(filters);
  const [view, setView] = useState<ViewMode>('grid'), [filtersOpen, setFiltersOpen] = useState(false);
  const [details, setDetails] = useState<Competicao | null>(null), [rules, setRules] = useState<Competicao | null>(null);
  const [modal, setModal] = useState(false), [editando, setEditando] = useState<Competicao | null>(null), [archive, setArchive] = useState<Competicao | null>(null);
  const [form, setForm] = useState(FORM_VAZIO), [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setLoadError(''); setCompeticoes([]);
    fetchCompeticoes({ resumo: true, incluirArquivadas: podeAdministrar }).then(items => { if (active) setCompeticoes(items); })
      .catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clube?.id, podeAdministrar, version]);
  useEffect(() => { if (!podeAdministrar && tab === 'arquivadas') setTab('ativas'); }, [podeAdministrar, tab]);
  function open(c?: Competicao) {
    setEditando(c || null); setErro('');
    setForm(c ? { nome: c.nome, ano: String(c.ano), tipo: c.tipo, titulares_necessarios: String(c.titulares_necessarios || 5), exigir_inscricao: !!c.exigir_inscricao } : FORM_VAZIO);
    setModal(true);
  }
  async function salvar(event: React.FormEvent) {
    event.preventDefault(); setErro('');
    if (!form.tipo || !form.nome.trim() || !Number.isInteger(Number(form.ano)) || Number(form.ano) < 2000 || Number(form.ano) > 2200) { setErro('Confira o nome e informe uma temporada entre 2000 e 2200.'); return; }
    if (!Number.isInteger(Number(form.titulares_necessarios)) || Number(form.titulares_necessarios) < 1 || Number(form.titulares_necessarios) > 15) { setErro('Informe de 1 a 15 titulares por equipe.'); return; }
    setBusy(true);
    try {
      const dados = { ...form, nome: form.nome.trim(), ano: Number(form.ano), titulares_necessarios: Number(form.titulares_necessarios) };
      if (editando) await atualizarCompeticao(editando.id, dados); else await criarCompeticao(dados);
      setModal(false); setNotice(editando ? 'Competição atualizada.' : 'Competição criada. Organize as partidas para acompanhar o andamento.'); setVersion(value => value + 1);
    } catch (error) { setErro((error as Error).message); } finally { setBusy(false); }
  }
  async function alterarArquivo() {
    if (!archive) return; setBusy(true); setErro('');
    try {
      await arquivarCompeticao(archive.id, !archive.arquivada);
      setCompeticoes(items => items.map(c => c.id === archive.id ? { ...c, arquivada: !c.arquivada } : c));
      setNotice(archive.arquivada ? 'Competição restaurada.' : 'Competição arquivada. Partidas e registros preservados.'); setArchive(null);
    } catch (error) { setErro((error as Error).message); } finally { setBusy(false); }
  }
  const seasons = [...new Set(competicoes.map(c => c.ano))].sort((a,b) => b-a).map(ano => ({ value: String(ano), label: String(ano) }));
  const filtered = competicoes.filter(c => normalizar(c.paulista_evento_id ? 'Campeonato Paulista Federação' : c.nome).includes(normalizar(busca)) && (!year || String(c.ano) === year)
    && (!filters.tipo || c.tipo === filters.tipo) && (!filters.origem || (filters.origem === 'paulista' ? !!c.paulista_evento_id : !c.paulista_evento_id))
    && (!filters.andamento || (!c.paulista_evento_id && c.resumo?.situacao === filters.andamento)));
  const oficiais = filtered.filter(c => c.paulista_evento_id && !c.arquivada);
  const locais = filtered.filter(c => !c.paulista_evento_id).sort((a,b) => b.ano-a.ano || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const visible = locais.filter(c => aba(c) === tab);
  const counts = { ativas: locais.filter(c => aba(c) === 'ativas').length, finalizadas: locais.filter(c => aba(c) === 'finalizadas').length, arquivadas: locais.filter(c => aba(c) === 'arquivadas').length };
  const locked = !!editando?.resumo?.total;
  return <div className="competition-page">
    <header className="page-header"><div><h1 className="page-title">Competições</h1><p className="page-sub">Acompanhe os torneios, a agenda e os resultados do clube.</p></div>{podeAdministrar && <Btn onClick={() => open()}><Icon name="plus" size={17}/>Nova competição</Btn>}</header>
    <div className="competition-tabs" role="group" aria-label="Situação das competições locais">{(['ativas', 'finalizadas', ...(podeAdministrar ? ['arquivadas'] : [])] as Tab[]).map(item => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item === 'ativas' ? 'Ativas' : item === 'finalizadas' ? 'Finalizadas' : 'Arquivadas'}<span>{counts[item]}</span></button>)}</div>
    <div className="competition-toolbar"><CollectionSearch label="Buscar competição" placeholder="Buscar competição por nome" value={busca} onChange={setBusca}/><div className="competition-season"><FilterSelect label="Temporada" value={year} onChange={setYear} emptyLabel="Todas as temporadas" options={seasons}/></div><CollectionFilterButton count={Object.values(filters).filter(Boolean).length} onClick={() => { setDraft(filters); setFiltersOpen(true); }}/><CollectionViewToggle className="competition-view" value={view} onChange={value => setView(value === 'list' ? 'list' : 'grid')} options={[{ value: 'grid', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'Lista', icon: 'list' }]}/></div>
    {notice && <p className="competition-notice" role="status"><Icon name="checkAll" size={16}/>{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></p>}
    {loading ? <LoadingSkeleton kind="cards"/> : loadError ? <div className="competition-empty" role="alert"><Icon name="alert" size={28}/><p>{loadError}</p><Btn variant="ghost" onClick={() => setVersion(v => v+1)}>Tentar novamente</Btn></div> : <>
      {oficiais.length > 0 && tab !== 'arquivadas' && <section className="competition-federation" aria-label="Competições da federação"><div className="competition-icon"><Icon name="trophy" size={22}/></div><div><small>FEDERAÇÃO PAULISTA DE FUTSAL</small><h2>Campeonato Paulista</h2><p>Temporadas, divisões e categorias · calendário e classificação oficiais.</p></div><Link className="btn btn-ghost btn-sm" to={`/competicoes/paulista?evento=${oficiais[0].paulista_evento_id}`}>Ver campeonato<Icon name="chevronRight" size={15}/></Link></section>}
      <div className="competition-results"><h2>{tab === 'arquivadas' ? 'Competições arquivadas' : 'Competições locais'}<span>{visible.length}</span></h2>{tab === 'finalizadas' && <p>Todas as partidas cadastradas foram finalizadas.</p>}</div>
      {visible.length ? <div className={`competition-grid${view === 'list' ? ' competition-list' : ''}`}>{visible.map(c => {
        const resumo = c.resumo, next = resumo?.proxima_partida;
        const manage = podeAdministrar && !c.somente_leitura;
        return <article className="competition-card" key={c.id}>
          <div className="competition-card-top"><span className={`competition-state${c.arquivada ? '' : ` competition-state-${resumo?.situacao.toLowerCase() || 'sem_partidas'}`}`}>{c.arquivada ? 'Arquivada' : resumo ? SITUACOES[resumo.situacao] : 'Andamento indisponível'}</span><CompetitionMenu name={c.nome} archived={c.arquivada} onRules={() => setRules(c)} onEdit={manage && !c.arquivada ? () => open(c) : undefined} archiveBlockedReason={!c.arquivada && resumo && resumo.total > resumo.finalizadas ? 'Conclua ou cancele os jogos pendentes.' : undefined} onArchive={manage ? () => { setErro(''); setArchive(c); } : undefined}/></div>
          <h2 className="competition-card-heading"><button type="button" className="competition-card-open" aria-label={`Abrir ${c.nome}`} onClick={() => setDetails(c)}><span className="competition-identity"><span className="competition-icon"><Icon name="trophy" size={21}/></span><span><strong className="competition-name" title={c.nome}>{c.nome}</strong><small>{c.ano} · {c.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small></span></span></button></h2>
          {resumo?.categorias.length ? <p className="competition-categories" title={resumo.categorias.join(' · ')}>{resumo.categorias.join(' · ')}</p> : null}
          <div className="competition-progress">{resumo?.total ? <><div><span>Partidas finalizadas</span><strong>{resumo.finalizadas}<span> / {resumo.total}</span></strong></div><progress value={resumo.finalizadas} max={resumo.total} aria-label={`Partidas finalizadas de ${c.nome}`}/></> : <p><Icon name="calendar" size={16}/>{resumo ? 'Tabela ainda não definida' : 'Atualize para consultar o andamento'}</p>}</div>
          <div className="competition-next">{next ? <><small>Próximo jogo · {dia(next.data)}{next.horario ? `, ${next.horario}` : ''}</small><strong title={`${next.mandante.nome} × ${next.visitante.nome}`}>{next.mandante.nome} × {next.visitante.nome}</strong></> : <small>{resumo?.situacao === 'FINALIZADA' ? 'Todas as partidas cadastradas foram finalizadas.' : c.arquivada ? 'Histórico preservado para consulta.' : 'Nenhuma próxima partida marcada.'}</small>}</div>
          <div className="competition-card-bottom"><span>{c.organizador?.nome || clube?.nome}</span><button type="button" onClick={() => setDetails(c)}>Ver competição<Icon name="chevronRight" size={15}/></button></div>
        </article>;
      })}</div> : <div className="competition-empty" role="status"><Icon name={tab === 'arquivadas' ? 'archive' : 'trophy'} size={30}/><strong>{tab === 'arquivadas' ? 'Nenhuma competição arquivada' : tab === 'finalizadas' ? 'Nenhuma competição com todos os jogos concluídos' : 'Nenhuma competição local encontrada'}</strong><p>{busca || year || Object.values(filters).some(Boolean) ? 'Tente outra busca ou ajuste os filtros.' : tab === 'arquivadas' ? 'As competições que você arquivar aparecerão aqui.' : 'As competições do clube aparecerão aqui.'}</p></div>}
    </>}
    <CollectionFilterDialog open={filtersOpen} title="Filtrar competições" onClose={() => setFiltersOpen(false)} onClear={() => setDraft({ tipo: '', origem: '', andamento: '' })} onApply={() => { setFilters(draft); setFiltersOpen(false); }}>
      <FilterSelect overlayInDialog label="Categorias" value={draft.tipo} onChange={tipo => setDraft(v => ({ ...v, tipo }))} emptyLabel="Todas as categorias" options={TIPOS}/>
      <FilterSelect overlayInDialog label="Organização" value={draft.origem} onChange={origem => setDraft(v => ({ ...v, origem }))} emptyLabel="Todas as organizações" options={[{ value: 'paulista', label: 'Paulista · Federação' }, { value: 'clube', label: 'Competições locais' }]}/>
      <FilterSelect overlayInDialog label="Andamento das partidas locais" value={draft.andamento} onChange={andamento => setDraft(v => ({ ...v, andamento }))} emptyLabel="Todos os andamentos" options={Object.entries(SITUACOES).map(([value, label]) => ({ value, label }))}/>
    </CollectionFilterDialog>
    {details && <CompetitionPanel competition={details} onClose={() => setDetails(null)}/>}
    <Modal open={!!rules} title="Regulamento" className="competition-rules-modal" onClose={() => setRules(null)} footer={<Btn variant="ghost" onClick={() => setRules(null)}>Fechar</Btn>}>
      <div className="competition-modal-identity"><span className="competition-icon"><Icon name="trophy" size={22}/></span><div><h3>{rules?.nome}</h3><p>{rules?.ano} · Competição local</p></div></div>
      <dl className="competition-rules"><div><dt><Icon name="team" size={15}/>Organização</dt><dd>{rules?.organizador?.nome || clube?.nome}</dd></div><div><dt><Icon name="grid" size={15}/>Categorias</dt><dd>{rules?.tipo === 'BASE' ? 'Base' : 'Iniciação'}</dd></div><div><dt><Icon name="user" size={15}/>Titulares por equipe</dt><dd>{rules?.titulares_necessarios || 5} atletas</dd></div><div><dt><Icon name="list" size={15}/>Inscrição dos convocados</dt><dd>{rules?.exigir_inscricao ? 'Obrigatória' : 'Não obrigatória'}</dd></div></dl>
      <section className="competition-scoring"><h3>Pontuação</h3><div>{[{label:'Vitória',points:3},{label:'Empate',points:1},{label:'Derrota',points:0}].map(item => <div key={item.label}><strong>{item.points}<small> pts</small></strong><span>{item.label}</span></div>)}</div></section>
      <div className="competition-tiebreak"><h3>Critérios de desempate</h3><ol><li>Mais vitórias</li><li>Maior saldo de gols</li><li>Mais gols marcados</li></ol></div>
    </Modal>
    <Modal open={!!archive} title={archive?.arquivada ? 'Restaurar competição?' : 'Arquivar competição?'} className="competition-confirm-modal" onClose={() => { if (!busy) setArchive(null); }} footer={<><Btn variant="ghost" disabled={busy} onClick={() => setArchive(null)}>Cancelar</Btn><Btn disabled={busy} onClick={() => void alterarArquivo()}>{busy ? 'Salvando…' : archive?.arquivada ? 'Restaurar competição' : 'Arquivar competição'}</Btn></>}><p><strong>{archive?.nome}</strong></p><p className="competition-help">{archive?.arquivada ? 'A competição voltará à lista, com suas partidas e registros.' : 'A competição irá para Arquivadas. As partidas, inscrições e registros serão preservados.'}</p>{erro && <p className="notice-error" role="alert">{erro}</p>}</Modal>
    <Modal open={modal} title={editando ? 'Editar competição' : 'Nova competição'} className="competition-editor" onClose={() => { if (!busy) setModal(false); }} footer={<><Btn type="button" variant="ghost" disabled={busy} onClick={() => setModal(false)}>Cancelar</Btn><Btn type="submit" form="competition-form" disabled={busy}>{busy ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar competição'}</Btn></>}>
      <form id="competition-form" onSubmit={salvar}><div className="competition-editor-intro"><span className="competition-icon"><Icon name={editando ? 'edit' : 'trophy'} size={21}/></span><p className="competition-help">{editando ? 'Atualize os dados do torneio. Partidas e inscrições serão preservadas.' : 'Defina o torneio para organizar as partidas e acompanhar os resultados.'}</p></div><h3 className="competition-form-heading">Identificação</h3><div className="competition-form-fields">
        <Input label="Nome da competição" placeholder="Ex.: Copa do clube" value={form.nome} required maxLength={100} onChange={e => setForm(v => ({ ...v, nome: e.target.value }))} className="full"/>
        <Input label="Temporada" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={form.ano} onChange={e => setForm(v => ({ ...v, ano: e.target.value.replace(/\D/g, '') }))}/>
        {locked ? <Input label="Categorias" readOnly value={form.tipo === 'BASE' ? 'Base' : 'Iniciação'}/> : <FilterSelect overlayInDialog label="Categorias" value={form.tipo} options={TIPOS} emptyLabel="Selecionar" onChange={tipo => setForm(v => ({ ...v, tipo }))}/>}
        <fieldset className="competition-regulation full"><legend>Convocação dos atletas</legend>{locked ? <><div className="competition-rule-summary"><span><strong>{form.titulares_necessarios}</strong> titulares por equipe</span><span>Inscrição <strong>{form.exigir_inscricao ? 'obrigatória' : 'não obrigatória'}</strong></span></div><p className="competition-locked-note"><Icon name="info" size={16}/>Categorias e regras estão bloqueadas porque já existem partidas. Para outras regras, crie uma nova competição.</p></> : <><Input label="Titulares por equipe" inputMode="numeric" pattern="[0-9]{1,2}" required value={form.titulares_necessarios} onChange={e => setForm(v => ({ ...v, titulares_necessarios: e.target.value.replace(/\D/g, '').slice(0,2) }))}/><label><input className="competition-checkbox" type="checkbox" checked={form.exigir_inscricao} onChange={e => setForm(v => ({ ...v, exigir_inscricao: e.target.checked }))}/><span>Exigir inscrição dos convocados<small>Somente atletas inscritos poderão ser convocados.</small></span></label></>}</fieldset>
      </div>{erro && <p className="notice-error" role="alert">{erro}</p>}</form>
    </Modal>
  </div>;
}
