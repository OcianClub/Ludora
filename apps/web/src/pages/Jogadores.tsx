import { useEffect, useRef, useState } from 'react';
import { requestJson, criarJogador, fetchCategorias, preverCategoria, ErroJogador,
  type Jogador, type Categoria, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './Jogadores.css';
import { Choice, PositionBadge, POSITIONS, normalizePosition, ViewToggle, type ViewMode } from '../components/CollectionControls';
import { BirthDateField } from '../components/BirthDateField';
import { formatCpf, digitsOnly, cleanName } from '../utils/playerForm';
import { BlockColumns } from '../components/BlockColumns';
import { Icon } from '../components/Icon';
import { Link, useSearchParams } from 'react-router-dom';
import { playerAge } from '../utils/playerAge';


const FORM_VAZIO = { nome: '', cpf: '', dtNasc: '', posicao: 'Alas', numCamisa: '' };

export default function JogadoresPage() {
  const { podeGerenciar, clube } = useAuth();
  const [params, setParams] = useSearchParams();
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const changeFilter = (key: string, value: string) => setParams(current => { const next = new URLSearchParams(current); value ? next.set(key, value) : next.delete(key); return next; }, { replace: true });
  const busca = params.get('busca') || '';
  const setBusca = (value: string) => changeFilter('busca', value);
  const tipo = params.get('fase') === 'BASE' ? 'BASE' : 'INICIACAO';
  const setTipo = (value: string) => setParams(current => { const next = new URLSearchParams(current); next.set('fase', value); next.delete('subs'); return next; }, { replace: true });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState<ConflitoCamisa | null>(null);
  const [previsao, setPrevisao] = useState<{ nascimento: string; categoria: Categoria; temporada: number } | null>(null);
  const [erroCategoria, setErroCategoria] = useState('');
  const [versao, setVersao] = useState(0);
  const view: ViewMode = params.get('visualizacao') === 'lista' ? 'list' : 'grid';
  const setView = (value: ViewMode) => changeFilter('visualizacao', value === 'list' ? 'lista' : '');
  const position = params.get('posicao') || '', shirtFilter = params.get('camisa') || '', order = params.get('ordem') === 'desc' ? 'desc' : 'asc';
  const setPosition = (value: string) => changeFilter('posicao', value);
  const setShirtFilter = (value: string) => changeFilter('camisa', value);
  const setOrder = (value: string) => changeFilter('ordem', value);
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState<Categoria | null>(null);
  const expanded = (params.get('subs') || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  const setExpanded = (value: number[] | ((ids: number[]) => number[])) => setParams(current => { const next = new URLSearchParams(current); const ids = typeof value === 'function' ? value((current.get('subs') || '').split(',').map(Number).filter(n => n > 0)) : value; if (ids.length) next.set('subs', ids.join(',')); else next.delete('subs'); return next; }, { replace: true });
  const [counts, setCounts] = useState<{ categoria_id: number; total: number; semCamisa: number }[]>([]);
  const [busyCategories, setBusyCategories] = useState<number[]>([]);
  const [categoryErrors, setCategoryErrors] = useState<Record<number, string>>({});
  const generation = useRef(0);
  const pending = useRef(new Set<number>());
  const query = new URLSearchParams({ busca, posicao: position, camisa: shirtFilter, ordem: order }).toString();

  useEffect(() => {
    let ativo = true;
    generation.current++;
    pending.current.clear();
    setJogadores([]); setBusyCategories([]); setCategoryErrors({});
    setLoading(true); setErroLista(''); setModal(false);
    const timer = setTimeout(() => Promise.all([requestJson<typeof counts>(`/jogadores?resumo=true&${query}`), fetchCategorias()])
      .then(([j, c]) => { if (ativo) {
        if (!Array.isArray(j) || j.some(row => !Number.isInteger(row.total) || !Number.isInteger(row.semCamisa))) throw new Error('A API em execução precisa ser atualizada para carregar os totais do elenco.');
        setCounts(j); setCategorias(c);
      } })
      .catch(err => { if (ativo) setErroLista(err.message); })
      .finally(() => { if (ativo) setLoading(false); }), 200);
    return () => { ativo = false; clearTimeout(timer); generation.current++; };
  }, [clube?.id, versao, query, tipo]);

  useEffect(() => {
    if (!loading && !erroLista) expanded.forEach(id => { if (!jogadores.some(j => j.categoria_id === id) && !categoryErrors[id]) void loadCategory(id); });
  }, [loading]);

  async function loadCategory(categoryId: number, remaining = false) {
    if (pending.current.has(categoryId)) return;
    const version = generation.current;
    pending.current.add(categoryId);
    setBusyCategories(ids => [...ids, categoryId]);
    setCategoryErrors(errors => ({ ...errors, [categoryId]: '' }));
    try {
      let offset = remaining ? jogadores.filter(j => j.categoria_id === categoryId).length : 0;
      const loaded: Jogador[] = [];
      // Fetch in bounded pages; the first expansion only transfers five athletes.
      do {
        const page = await requestJson<Jogador[]>(`/jogadores?${query}&categoria_id=${categoryId}&limite=${remaining ? 100 : 5}&offset=${offset}`);
        if (version !== generation.current) return;
        loaded.push(...page); offset += page.length;
        if (!remaining || page.length < 100) break;
      } while (true);
      setJogadores(current => [...current.filter(j => j.categoria_id !== categoryId || remaining), ...loaded].filter((player, i, all) => all.findIndex(item => item.id === player.id) === i));
    } catch (error) {
      if (version === generation.current) setCategoryErrors(errors => ({ ...errors, [categoryId]: error instanceof Error ? error.message : 'Não foi possível carregar os alunos.' }));
    } finally {
      if (version === generation.current) { pending.current.delete(categoryId); setBusyCategories(ids => ids.filter(id => id !== categoryId)); }
    }
  }

  function toggleCategory(categoryId: number) {
    if (expanded.includes(categoryId)) setExpanded(ids => ids.filter(id => id !== categoryId));
    else { setExpanded(ids => [...ids, categoryId]); void loadCategory(categoryId); }
  }

  useEffect(() => {
    let ativo = true;
    setPrevisao(null); setErroCategoria('');
    if (!modal || !form.dtNasc) return;
    const timer = setTimeout(() => {
      preverCategoria(form.dtNasc).then(resultado => {
        if (ativo) setPrevisao({ ...resultado, nascimento: form.dtNasc });
      }).catch(err => { if (ativo) setErroCategoria(err.message); });
    }, 250);
    return () => { ativo = false; clearTimeout(timer); };
  }, [form.dtNasc, modal, clube?.id]);

  function abrir(categoria: Categoria | null = null) {
    setOrigin(categoria);
    setErro(''); setConflito(null); setPrevisao(null); setForm(FORM_VAZIO);
    setModal(true);
  }
  function alterar(campo: keyof typeof form, valor: string) {
    const sanitized = campo === 'cpf' ? formatCpf(valor) : campo === 'numCamisa' ? digitsOnly(valor).slice(0, 2) : campo === 'nome' ? cleanName(valor) : valor;
    setForm(f => ({ ...f, [campo]: sanitized })); setConflito(null); setErro('');
  }
  const categoriaPronta = previsao?.nascimento === form.dtNasc ? previsao : null;
  async function salvar(confirmacao?: ConflitoCamisa) {
    if (salvando || !categoriaPronta) return;
    if (!form.nome.trim()) { setErro('Informe o nome completo do aluno.'); return; }
    if (digitsOnly(form.cpf).length !== 11) { setErro('Informe os 11 dígitos do CPF.'); return; }
    if (form.numCamisa && (Number(form.numCamisa) < 1 || Number(form.numCamisa) > 99)) { setErro('A camisa deve estar entre 1 e 99.'); return; }
    setErro(''); setSalvando(true);
    try {
      const dados: DadosJogador = { nome: form.nome, dtNasc: form.dtNasc, posicao: form.posicao,
        numCamisa: form.numCamisa === '' ? null : Number(form.numCamisa),
        cpf: form.cpf,
        ...(confirmacao ? { confirmar_camisa: { jogador_id: confirmacao.jogador_id, camisa_anterior: confirmacao.camisa_anterior } } : {}) };
      await criarJogador(dados);
      setNotice('Aluno salvo com sucesso.'); setTipo(categoriaPronta.categoria.tipo); setModal(false); setVersao(v => v + 1);
    } catch (err) {
      if (err instanceof ErroJogador && err.conflito) setConflito(err.conflito);
      else { setConflito(null); setErro(err instanceof Error ? err.message : 'Não foi possível salvar'); }
    } finally { setSalvando(false); }
  }

  const blocos = categorias.filter(c => c.tipo === tipo).sort((a, b) =>
    Number(a.nome.replace(/\D/g, '')) - Number(b.nome.replace(/\D/g, '')));

  return <div className="alunos-page">
    <div className="page-header">
      <div><h1 className="page-title">Alunos e categorias</h1><p className="page-sub">Elencos do {clube?.nome} · {loading ? 'Consultando elenco…' : `${counts.reduce((total, item) => total + item.total, 0)} alunos nos filtros atuais`}</p></div>
      {podeGerenciar && <Btn onClick={() => abrir()}>+ Adicionar aluno</Btn>}
    </div>
    <div className="collection-toolbar">
      <div className="alunos-tabs" aria-label="Grupo de categorias">
        {['INICIACAO', 'BASE'].map(item => <button key={item} type="button" aria-pressed={tipo === item} onClick={() => setTipo(item)}>{item === 'INICIACAO' ? 'Iniciação' : 'Base'}</button>)}
      </div>
      <Input label="Buscar aluno" placeholder="Nome completo..." value={busca} onChange={e => setBusca(e.target.value)} />
      <Choice label="Posição" value={position} onChange={setPosition} options={[{value:'',label:'Todas'},...POSITIONS.map(value=>({value,label:value}))]} />
      <Choice label="Camisa" value={shirtFilter} onChange={setShirtFilter} options={[{value:'',label:'Todas'},{value:'missing',label:'Sem número'},{value:'assigned',label:'Com número'}]} />
      <Choice label="Ordenar" value={order} onChange={setOrder} options={[{value:'asc',label:'Nome A–Z'},{value:'desc',label:'Nome Z–A'}]} />
      <ViewToggle value={view} onChange={setView}/>
    </div>
    {notice && <div className="collection-notice" role="status">{notice}</div>}
    {erroLista ? <div role="alert" className="alunos-error">{erroLista} <Btn onClick={() => setVersao(v => v + 1)}>Tentar novamente</Btn></div> : loading ? <Spinner /> :
      <BlockColumns list={view === 'list'} minWidth={390} maxColumns={2}>{blocos.map(categoria => {
        const alunos = jogadores.filter(j => j.categoria_id === categoria.id);
        const count = counts.find(item => item.categoria_id === categoria.id);
        const visiveis = alunos.filter(j => j.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) && (!position || normalizePosition(j.posicao) === position) && (!shirtFilter || (shirtFilter === 'missing' ? j.numCamisa == null : j.numCamisa != null))).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')*(order==='asc'?1:-1));
        return <section className="alunos-category" key={categoria.id}>
          <header><button type="button" className="alunos-category-toggle" aria-expanded={expanded.includes(categoria.id)} aria-controls={`students-panel-${categoria.id}`} onClick={() => toggleCategory(categoria.id)}><span><strong>{categoria.nome.toUpperCase()}</strong><small>{count?.total ?? 0} alunos · {count?.semCamisa ?? 0} sem camisa</small></span><Icon name="chevronRight" size={20}/></button>
            {podeGerenciar && <Btn variant="ghost" size="sm" onClick={() => abrir(categoria)}>Adicionar aluno</Btn>}</header>
          <div id={`students-panel-${categoria.id}`} hidden={!expanded.includes(categoria.id)}>
          {visiveis.length ? <ul id={`students-${categoria.id}`} className="alunos-students">{visiveis.map(aluno => <li key={aluno.id}>
            <span className={`alunos-shirt ${aluno.numCamisa == null ? 'is-empty' : ''}`} aria-label={aluno.numCamisa == null ? 'Sem camisa' : `Camisa ${aluno.numCamisa}`}>{aluno.numCamisa ?? '—'}</span>
            <div className="student-identity"><Link to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }}><strong>{aluno.nome}</strong></Link><small><PositionBadge position={aluno.posicao}/> <span>{normalizePosition(aluno.posicao)} · {playerAge(aluno.dtNasc)} anos</span></small></div>
            <span className="student-games"><strong>{(aluno as Jogador & { totalPartidas?: number }).totalPartidas ?? '—'}</strong><small>partidas</small></span>
            <Link className="student-open" to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} aria-label={`Abrir perfil de ${aluno.nome}`}><Icon name="chevronRight" size={20}/></Link>
          </li>)}</ul> : !busyCategories.includes(categoria.id) && !categoryErrors[categoria.id] && <p className="alunos-empty">Nenhum aluno encontrado nesta categoria.</p>}
          {busyCategories.includes(categoria.id) && <p className="alunos-hint" role="status">Carregando alunos…</p>}
          {categoryErrors[categoria.id] && <div className="notice-error" role="alert">{categoryErrors[categoria.id]} <Btn variant="ghost" onClick={() => void loadCategory(categoria.id, alunos.length > 0)}>Tentar novamente</Btn></div>}
          {visiveis.length > 0 && (count?.total ?? 0) > visiveis.length && <button className="collection-expand" type="button" disabled={busyCategories.includes(categoria.id)} onClick={() => void loadCategory(categoria.id, true)}>Mostrar mais ({(count?.total ?? 0) - visiveis.length}) <Icon name="plus" size={16}/></button>}
          </div>
        </section>;
      })}{!blocos.length && <p>Nenhuma categoria cadastrada neste grupo.</p>}</BlockColumns>}

    <Modal open={modal} onClose={() => { if (!salvando) setModal(false); }} title="Adicionar aluno">
      <form noValidate onSubmit={e => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={salvando || !!conflito} className="form-grid alunos-fields">
          <Input label="Nome completo" value={form.nome} onChange={e => alterar('nome', e.target.value)} required className="full" />
          <Input label="CPF" value={form.cpf} onChange={e => alterar('cpf', e.target.value)} required placeholder="000.000.000-00" inputMode="numeric" maxLength={14} pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}" />
          <BirthDateField value={form.dtNasc} onChange={value => alterar("dtNasc", value)} />
          <div className="alunos-preview" role="status">{origin && <p>Você abriu o cadastro pelo {origin.nome.toUpperCase()}. {categoriaPronta && (categoriaPronta.categoria.id === origin.id ? "O aluno pertence a este sub." : `Pelo nascimento, será cadastrado no ${categoriaPronta.categoria.nome.toUpperCase()}, não no ${origin.nome.toUpperCase()}.`)}</p>}{categoriaPronta ? `${categoriaPronta.categoria.nome.toUpperCase()} · ${categoriaPronta.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'} · Temporada ${categoriaPronta.temporada}` : erroCategoria || (form.dtNasc ? 'Calculando categoria...' : 'Informe a data de nascimento para determinar o sub.')}</div>
          <div className="full"><span className="field-label">Posição</span><div className="position-options" role="group" aria-label="Posição do aluno">{POSITIONS.map(value=><button type="button" key={value} data-tooltip={value} aria-pressed={form.posicao === value} onClick={()=>alterar("posicao",value)}><PositionBadge position={value} showLabel/></button>)}</div></div>
          <Input label="Camisa (opcional)" type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} disabled={!categoriaPronta} value={form.numCamisa} onChange={e => alterar('numCamisa', e.target.value)} />
        </fieldset>
        {conflito && <div className="alunos-conflict" role="alert">
          <strong>A camisa {conflito.camisa} já pertence a {conflito.nome} no {conflito.categoria.toUpperCase()}.</strong>
          <p>{conflito.camisa_anterior === null ? `${conflito.nome} ficará sem camisa. ${form.nome} receberá a ${conflito.camisa}.` : `${conflito.nome} receberá a camisa ${conflito.camisa_anterior}; ${form.nome} receberá a ${conflito.camisa}.`}</p>
          <div className="actions"><Btn type="button" variant="ghost" disabled={salvando} onClick={() => setConflito(null)}>Cancelar troca</Btn><Btn type="button" disabled={salvando} onClick={() => void salvar(conflito)}>Confirmar {conflito.camisa_anterior === null ? 'transferência' : 'troca'}</Btn></div>
        </div>}
        {erro && <p className="alunos-error" role="alert">{erro}</p>}
        <div className="alunos-footer"><Btn variant="ghost" type="button" disabled={salvando} onClick={() => setModal(false)}>Fechar</Btn>
          {!conflito && <Btn type="submit" disabled={salvando || !categoriaPronta}>{salvando ? 'Salvando...' : 'Salvar aluno'}</Btn>}</div>
      </form>
    </Modal>
  </div>;
}
