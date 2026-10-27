import { useEffect, useRef, useState } from 'react';
import { requestJson, criarJogador, fetchCategorias, preverCategoria, ErroJogador,
  type Jogador, type Categoria, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './Jogadores.css';
import { Choice, PositionBadge, POSITIONS, normalizePosition } from '../components/CollectionControls';
import { BirthDateField } from '../components/BirthDateField';
import { formatCpf, digitsOnly, cleanName } from '../utils/playerForm';
import { Icon } from '../components/Icon';
import { Link, useSearchParams } from 'react-router-dom';
import { playerAge } from '../utils/playerAge';
import { PhaseFilter } from '../components/CategoryFilter';


const FORM_VAZIO = { nome: '', cpf: '', dtNasc: '', posicao: 'Alas', numCamisa: '' };
const PAGE_SIZE = 25;

function storedSelection(clubId?: number): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(`ludora_jogadores_filtros_${clubId}`) || '{}');
    return {
      fase: saved.fase === 'BASE' ? 'BASE' : 'INICIACAO',
      ...(Number.isSafeInteger(Number(saved.categoria)) && Number(saved.categoria) > 0 ? { categoria: String(saved.categoria) } : {}),
    };
  } catch {
    return { fase: 'INICIACAO' };
  }
}

export default function JogadoresPage() {
  const { podeGerenciar, clube } = useAuth();
  const [params, setParams] = useSearchParams(storedSelection(clube?.id));
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const changeFilter = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    value ? next.set(key, value) : next.delete(key);
    next.delete('pagina');
    return next;
  }, { replace: true, preventScrollReset: true });
  const busca = params.get('busca') || '';
  const setBusca = (value: string) => changeFilter('busca', value);
  const tipo = params.get('fase') === 'BASE' ? 'BASE' : 'INICIACAO';
  const setTipo = (value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('fase', value);
    ['categoria', 'pagina', 'subs', 'visualizacao'].forEach(key => next.delete(key));
    return next;
  }, { replace: true, preventScrollReset: true });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState<ConflitoCamisa | null>(null);
  const [previsao, setPrevisao] = useState<{ nascimento: string; categoria: Categoria; temporada: number } | null>(null);
  const [erroCategoria, setErroCategoria] = useState('');
  const [versao, setVersao] = useState(0);
  const position = params.get('posicao') || '', shirtFilter = params.get('camisa') || '', order = params.get('ordem') === 'desc' ? 'desc' : 'asc';
  const setPosition = (value: string) => changeFilter('posicao', value);
  const setShirtFilter = (value: string) => changeFilter('camisa', value);
  const setOrder = (value: string) => changeFilter('ordem', value);
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState<Categoria | null>(null);
  const [counts, setCounts] = useState<{ categoria_id: number; total: number; semCamisa: number }[]>([]);
  const categoryFilter = params.get('categoria') || '';
  const requestedPage = Number(params.get('pagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const query = new URLSearchParams({
    busca, posicao: position, camisa: shirtFilter, ordem: order, fase: tipo,
    ...(categoryFilter ? { categoria_id: categoryFilter } : {}),
  }).toString();
  const previousClub = useRef(clube?.id);
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (previousClub.current !== clube?.id) {
      previousClub.current = clube?.id;
      setParams(storedSelection(clube?.id), { replace: true });
      setModal(false);
      return;
    }
    if (!clube?.id) return;
    try {
      localStorage.setItem(`ludora_jogadores_filtros_${clube.id}`, JSON.stringify({ fase: tipo, categoria: categoryFilter }));
    } catch {}
  }, [clube?.id, tipo, categoryFilter, setParams]);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();
    setJogadores([]);
    setLoading(true);
    setErroLista('');
    const timer = setTimeout(() => Promise.all([
      requestJson<typeof counts>(`/jogadores?resumo=true&${query}`, { signal: controller.signal }),
      requestJson<Jogador[]>(`/jogadores?${query}&limite=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`, { signal: controller.signal }),
      fetchCategorias(),
    ])
      .then(([summary, players, categories]) => { if (ativo) {
        if (!Array.isArray(summary) || summary.some(row => !Number.isInteger(row.total) || !Number.isInteger(row.semCamisa))) throw new Error('Não foi possível carregar os totais dos jogadores. Tente novamente.');
        setCounts(summary);
        setJogadores(players);
        setCategorias(categories);
      } })
      .catch(err => { if (ativo) setErroLista(err instanceof Error ? err.message : 'Não foi possível carregar os jogadores.'); })
      .finally(() => { if (ativo) setLoading(false); }), 200);
    return () => { ativo = false; clearTimeout(timer); controller.abort(); };
  }, [clube?.id, versao, query, page]);

  function changePage(value: number) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('pagina', String(value));
      return next;
    }, { replace: true, preventScrollReset: true });
    listHeading.current?.focus({ preventScroll: true });
    listHeading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
      setNotice('Aluno salvo com sucesso.');
      setParams({ fase: categoriaPronta.categoria.tipo, categoria: String(categoriaPronta.categoria.id) }, { replace: true });
      setModal(false);
      setVersao(v => v + 1);
    } catch (err) {
      if (err instanceof ErroJogador && err.conflito) setConflito(err.conflito);
      else { setConflito(null); setErro(err instanceof Error ? err.message : 'Não foi possível salvar'); }
    } finally { setSalvando(false); }
  }

  const blocos = categorias.filter(c => c.tipo === tipo).sort((a, b) =>
    Number(a.nome.replace(/\D/g, '')) - Number(b.nome.replace(/\D/g, '')));
  const displayed = blocos.filter(category => !categoryFilter || String(category.id) === categoryFilter);
  const totals = counts.filter(count => displayed.some(category => category.id === count.categoria_id));
  const total = totals.reduce((sum, count) => sum + count.total, 0);
  const missingShirts = totals.reduce((sum, count) => sum + count.semCamisa, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedCategory = blocos.find(category => String(category.id) === categoryFilter);
  useEffect(() => {
    if (loading || erroLista) return;
    if (categoryFilter && !selectedCategory || page > pages) {
      setParams(current => {
        const next = new URLSearchParams(current);
        if (categoryFilter && !selectedCategory) next.delete('categoria');
        next.delete('pagina');
        return next;
      }, { replace: true, preventScrollReset: true });
    }
  }, [loading, erroLista, categoryFilter, selectedCategory?.id, page, pages, setParams]);
  const filtered = Boolean(busca || position || shirtFilter || categoryFilter);
  const extraFilterCount = [position, shirtFilter].filter(Boolean).length;
  function clearFilters() {
    setParams(current => { const next = new URLSearchParams(current); ['busca', 'posicao', 'camisa', 'categoria', 'pagina'].forEach(key => next.delete(key)); return next; }, { replace: true, preventScrollReset: true });
  }
  function chooseSub(value: string) {
    changeFilter('categoria', value);
  }

  return <div className="alunos-page">
    <div className="page-header">
      <div><h1 className="page-title">Jogadores</h1><p className="page-sub">Cadastros, camisas e categorias do {clube?.nome}.</p></div>
      {podeGerenciar && <Btn aria-label="+ Adicionar aluno" onClick={() => abrir(selectedCategory)}><Icon name="plus" size={18} />Adicionar aluno</Btn>}
    </div>
    <section className="alunos-controls" aria-label="Filtros de jogadores">
    <div className="alunos-navigation">
      <PhaseFilter value={tipo} onChange={setTipo} />
      <Choice label="Subcategoria" value={categoryFilter} onChange={chooseSub} options={[{ value: '', label: 'Todos os subs' }, ...blocos.map(category => ({ value: String(category.id), label: category.nome.toUpperCase() }))]} />
    </div>
    <div className="alunos-filters">
      <label className="alunos-search"><Icon name="search" size={18} /><span className="sr-only">Buscar aluno</span><input type="search" placeholder="Buscar jogador pelo nome" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <button className="alunos-filter-toggle" type="button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}><Icon name="filters" size={18}/>Filtros{extraFilterCount > 0 && <span>{extraFilterCount}</span>}</button>
      <div className="alunos-extra-filters">
      <Choice label="Posição" value={position} onChange={setPosition} options={[{value:'',label:'Todas'},...POSITIONS.map(value=>({value,label:value}))]} />
      <Choice label="Camisa" value={shirtFilter} onChange={setShirtFilter} options={[{value:'',label:'Todas'},{value:'missing',label:'Sem número'},{value:'assigned',label:'Com número'}]} />
      <Choice label="Ordenar" value={order} onChange={setOrder} options={[{value:'asc',label:'Nome A–Z'},{value:'desc',label:'Nome Z–A'}]} />
      </div>
    </div>
    </section>
    <div className="alunos-results-bar">
      <p role="status">{loading ? 'Carregando jogadores…' : erroLista ? 'Consulta indisponível' : <><strong>{total} {total === 1 ? 'jogador' : 'jogadores'}</strong><span>{missingShirts} sem camisa · {displayed.length} {displayed.length === 1 ? 'categoria' : 'categorias'}</span></>}</p>
      {filtered && <button type="button" className="alunos-clear" onClick={clearFilters}>Limpar filtros</button>}
    </div>
    {(position || shirtFilter) && <div className="alunos-active-filters" aria-label="Filtros ativos">
      {position && <button type="button" onClick={() => setPosition('')} aria-label={`Remover filtro de posição: ${position}`}>{position}<span aria-hidden="true">×</span></button>}
      {shirtFilter && <button type="button" onClick={() => setShirtFilter('')} aria-label="Remover filtro de camisa">{shirtFilter === 'missing' ? 'Sem camisa' : 'Com camisa'}<span aria-hidden="true">×</span></button>}
    </div>}
    {notice && <div className="collection-notice" role="status">{notice}</div>}
    <section className="alunos-directory" aria-labelledby="alunos-list-heading" aria-busy={loading}>
      <h2 id="alunos-list-heading" className="sr-only" tabIndex={-1} ref={listHeading}>Lista de jogadores</h2>
      {erroLista ? <div role="alert" className="alunos-error">{erroLista}<Btn variant="ghost" onClick={() => setVersao(v => v + 1)}>Tentar novamente</Btn></div> : loading ? <Spinner /> : jogadores.length ? <>
        <table className="alunos-table">
          <caption className="sr-only">Jogadores de {selectedCategory?.nome.toUpperCase() || (tipo === 'BASE' ? 'Base' : 'Iniciação')}</caption>
          <thead><tr>
            <th scope="col">Camisa</th>
            <th scope="col">Jogador</th>
            <th scope="col">Posição</th>
            <th scope="col">Idade</th>
            {!categoryFilter && <th scope="col">Categoria</th>}
            <th scope="col"><span className="sr-only">Acessar ficha</span></th>
          </tr></thead>
          <tbody>{jogadores.map(aluno => {
            const categoryName = categorias.find(category => category.id === aluno.categoria_id)?.nome.toUpperCase() || '—';
            const age = playerAge(aluno.dtNasc);
            const ageLabel = Number.isFinite(age) ? `${age} anos` : 'Idade não informada';
            return <tr key={aluno.id}>
              <td className="alunos-cell-shirt"><span className={`alunos-shirt ${aluno.numCamisa == null ? 'is-empty' : ''}`} aria-label={aluno.numCamisa == null ? 'Sem camisa' : `Camisa ${aluno.numCamisa}`}>{aluno.numCamisa ?? '—'}</span></td>
              <td className="alunos-cell-name">
                <Link to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} className="alunos-player-link">{aluno.nome}</Link>
                <span className="alunos-mobile-meta">{normalizePosition(aluno.posicao)} · {ageLabel}{!categoryFilter && ` · ${categoryName}`}</span>
              </td>
              <td className="alunos-cell-position"><span><PositionBadge position={aluno.posicao}/>{normalizePosition(aluno.posicao)}</span></td>
              <td className="alunos-cell-age">{ageLabel}</td>
              {!categoryFilter && <td className="alunos-cell-category">{categoryName}</td>}
              <td className="alunos-cell-open"><Link className="student-open" to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} aria-label={`Abrir perfil de ${aluno.nome}`}><Icon name="chevronRight" size={18}/></Link></td>
            </tr>;
          })}</tbody>
        </table>
        <nav className="alunos-pagination" aria-label="Páginas de jogadores">
          <p>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} jogadores</p>
          {pages > 1 && <div>
            <Btn variant="ghost" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Página anterior"><Icon name="chevronLeft" size={17}/></Btn>
            <span aria-live="polite">{page} de {pages}</span>
            <Btn variant="ghost" disabled={page >= pages} onClick={() => changePage(page + 1)} aria-label="Próxima página"><Icon name="chevronRight" size={17}/></Btn>
          </div>}
        </nav>
      </> : <div className="alunos-directory-empty">
        <Icon name="team" size={28}/>
        <h3>{filtered ? 'Nenhum jogador encontrado' : 'Nenhum jogador neste grupo'}</h3>
        <p>{filtered ? 'Tente outro nome ou ajuste os filtros para ampliar a busca.' : 'Os jogadores cadastrados nesta faixa aparecerão aqui.'}</p>
        {filtered && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}
      </div>}
    </section>

    <Modal open={filtersOpen} className="alunos-filter-dialog" title="Filtrar jogadores" onClose={() => setFiltersOpen(false)} footer={<div className="alunos-footer"><Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn><Btn onClick={() => setFiltersOpen(false)}>Ver jogadores</Btn></div>}>
      <p className="alunos-form-intro">Combine os filtros para encontrar os jogadores do clube.</p>
      {[
        { label: 'Posição', value: position, change: setPosition, options: [{ value: '', label: 'Todas' }, ...POSITIONS.map(value => ({ value, label: value }))] },
        { label: 'Camisa', value: shirtFilter, change: setShirtFilter, options: [{ value: '', label: 'Todas' }, { value: 'missing', label: 'Sem número' }, { value: 'assigned', label: 'Com número' }] },
        { label: 'Ordenar por nome', value: order, change: setOrder, options: [{ value: 'asc', label: 'A–Z' }, { value: 'desc', label: 'Z–A' }] },
      ].map(group => <fieldset className="alunos-filter-group" key={group.label}><legend>{group.label}</legend><div>{group.options.map(option => <button key={option.value} type="button" aria-pressed={group.value === option.value} onClick={() => group.change(option.value)}>{option.label}{group.value === option.value && <Icon name="checkAll" size={16}/>}</button>)}</div></fieldset>)}
    </Modal>

    <Modal open={modal} className="alunos-create-dialog" onClose={() => { if (!salvando) setModal(false); }} title="Adicionar aluno" footer={<div className="alunos-footer"><Btn variant="ghost" type="button" disabled={salvando} onClick={() => setModal(false)}>Cancelar</Btn>
      {!conflito && <Btn type="submit" form="alunos-create-form" disabled={salvando || !categoriaPronta}>{salvando ? 'Salvando…' : 'Salvar aluno'}</Btn>}</div>}>
      <p className="alunos-form-intro">Cadastre o aluno no clube. A categoria será definida pela data de nascimento.</p>
      <form id="alunos-create-form" noValidate onSubmit={e => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={salvando || !!conflito} className="form-grid alunos-fields">
          <div className="alunos-form-heading full"><h3>Dados do aluno</h3><span>Campos obrigatórios</span></div>
          <Input label="Nome completo" placeholder="Ex.: João Pedro da Silva" autoComplete="name" value={form.nome} onChange={e => alterar('nome', e.target.value)} required />
          <Input label="CPF" value={form.cpf} onChange={e => alterar('cpf', e.target.value)} required placeholder="000.000.000-00" inputMode="numeric" maxLength={14} pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}" />
          <BirthDateField value={form.dtNasc} onChange={value => alterar("dtNasc", value)} />
          <div className="alunos-preview" role="status"><Icon name="team" size={18}/><div><strong>Categoria do aluno</strong>{origin && <p>Você abriu o cadastro pelo {origin.nome.toUpperCase()}. {categoriaPronta && (categoriaPronta.categoria.id === origin.id ? "O aluno pertence a este sub." : `Pelo nascimento, será cadastrado no ${categoriaPronta.categoria.nome.toUpperCase()}, não no ${origin.nome.toUpperCase()}.`)}</p>}<p>{categoriaPronta ? `${categoriaPronta.categoria.nome.toUpperCase()} · ${categoriaPronta.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'} · Temporada ${categoriaPronta.temporada}` : erroCategoria || (form.dtNasc ? 'Calculando categoria...' : 'Selecione dia, mês e ano para identificar o sub.')}</p></div></div>
          <div className="alunos-form-heading alunos-form-heading--section full"><h3>Dentro de campo</h3></div>
          <div className="full"><span className="field-label">Posição</span><div className="position-options" role="group" aria-label="Posição do aluno">{POSITIONS.map(value => (
            <button type="button" key={value} aria-pressed={form.posicao === value} onClick={() => alterar('posicao', value)}>
              <PositionBadge position={value} showLabel />
              {form.posicao === value && <Icon name="checkAll" size={15}/>}
            </button>
          ))}</div></div>
          <div className="alunos-shirt-field full"><Input label="Camisa (opcional)" placeholder="1 a 99" type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} disabled={!categoriaPronta} value={form.numCamisa} onChange={e => alterar('numCamisa', e.target.value)} /><small>Deixe em branco se ainda não houver número definido.</small></div>
        </fieldset>
        {conflito && <div className="alunos-conflict" role="alert">
          <strong>A camisa {conflito.camisa} já pertence a {conflito.nome} no {conflito.categoria.toUpperCase()}.</strong>
          <p>{conflito.camisa_anterior === null ? `${conflito.nome} ficará sem camisa. ${form.nome} receberá a ${conflito.camisa}.` : `${conflito.nome} receberá a camisa ${conflito.camisa_anterior}; ${form.nome} receberá a ${conflito.camisa}.`}</p>
          <div className="actions"><Btn type="button" variant="ghost" disabled={salvando} onClick={() => setConflito(null)}>Cancelar troca</Btn><Btn type="button" disabled={salvando} onClick={() => void salvar(conflito)}>Confirmar {conflito.camisa_anterior === null ? 'transferência' : 'troca'}</Btn></div>
        </div>}
        {erro && <p className="alunos-error" role="alert">{erro}</p>}
      </form>
    </Modal>
  </div>;
}
