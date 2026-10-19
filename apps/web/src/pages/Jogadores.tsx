import { useEffect, useState } from 'react';
import { fetchJogadores, criarJogador, atualizarJogador, deletarJogador, fetchCategorias, preverCategoria, ErroJogador,
  type Jogador, type Categoria, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Modal, Input, Select, Spinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './Jogadores.css';
import { Choice, ConfirmDelete, PositionBadge, POSITIONS, normalizePosition, ViewToggle, type ViewMode } from '../components/CollectionControls';
import { BirthDateField } from '../components/BirthDateField';
import { formatCpf, digitsOnly, cleanName } from '../utils/playerForm';


const FORM_VAZIO = { nome: '', cpf: '', dtNasc: '', posicao: 'Alas', numCamisa: '' };

export default function JogadoresPage() {
  const { podeGerenciar, clube } = useAuth();
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('INICIACAO');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Jogador | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState<ConflitoCamisa | null>(null);
  const [previsao, setPrevisao] = useState<{ nascimento: string; categoria: Categoria; temporada: number } | null>(null);
  const [erroCategoria, setErroCategoria] = useState('');
  const [versao, setVersao] = useState(0);
  const [view, setView] = useState<ViewMode>('grid');
  const [position, setPosition] = useState('');
  const [shirtFilter, setShirtFilter] = useState('');
  const [order, setOrder] = useState('asc');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<Jogador | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [origin, setOrigin] = useState<Categoria | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true); setErroLista(''); setModal(false);
    Promise.all([fetchJogadores(), fetchCategorias()])
      .then(([j, c]) => { if (ativo) { setJogadores(j); setCategorias(c); } })
      .catch(err => { if (ativo) setErroLista(err.message); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [clube?.id, versao]);

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

  function abrir(jogador: Jogador | null = null, categoria: Categoria | null = null) {
    setOrigin(categoria);
    setEditando(jogador); setErro(''); setConflito(null); setPrevisao(null);
    setForm(jogador ? { nome: jogador.nome, cpf: '', dtNasc: jogador.dtNasc.slice(0, 10),
      posicao: normalizePosition(jogador.posicao), numCamisa: jogador.numCamisa?.toString() ?? '' } : FORM_VAZIO);
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
    if (!editando && digitsOnly(form.cpf).length !== 11) { setErro('Informe os 11 dígitos do CPF.'); return; }
    if (form.numCamisa && (Number(form.numCamisa) < 1 || Number(form.numCamisa) > 99)) { setErro('A camisa deve estar entre 1 e 99.'); return; }
    setErro(''); setSalvando(true);
    try {
      const dados: DadosJogador = { nome: form.nome, dtNasc: form.dtNasc, posicao: form.posicao,
        numCamisa: form.numCamisa === '' ? null : Number(form.numCamisa),
        ...(editando ? {} : { cpf: form.cpf }),
        ...(confirmacao ? { confirmar_camisa: { jogador_id: confirmacao.jogador_id, camisa_anterior: confirmacao.camisa_anterior } } : {}) };
      if (editando) await atualizarJogador(editando.id, dados);
      else await criarJogador(dados);
      setNotice('Aluno salvo com sucesso.'); setTipo(categoriaPronta.categoria.tipo); setModal(false); setVersao(v => v + 1);
    } catch (err) {
      if (err instanceof ErroJogador && err.conflito) setConflito(err.conflito);
      else { setConflito(null); setErro(err instanceof Error ? err.message : 'Não foi possível salvar'); }
    } finally { setSalvando(false); }
  }

  async function excluir() {
    if (!deleting || salvando) return;
    setSalvando(true); setDeleteError('');
    try { await deletarJogador(deleting.id); setDeleting(null); setNotice('Aluno excluído.'); setVersao(v => v + 1); }
    catch (err) { setDeleteError(err instanceof Error ? err.message : 'Não foi possível excluir'); }
    finally { setSalvando(false); }
  }
  const blocos = categorias.filter(c => c.tipo === tipo).sort((a, b) =>
    Number(a.nome.replace(/\D/g, '')) - Number(b.nome.replace(/\D/g, '')));

  return <div className="alunos-page">
    <div className="page-header">
      <div><h1 className="page-title">Alunos e categorias</h1><p className="page-sub">Elencos do {clube?.nome} · {jogadores.length} alunos ativos</p></div>
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
      <div className={`alunos-grid alunos-${view}`}>{blocos.map(categoria => {
        const alunos = jogadores.filter(j => j.categoria_id === categoria.id);
        const visiveis = alunos.filter(j => j.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) && (!position || normalizePosition(j.posicao) === position) && (!shirtFilter || (shirtFilter === 'missing' ? j.numCamisa == null : j.numCamisa != null))).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')*(order==='asc'?1:-1));
        return <section className="alunos-category" key={categoria.id}>
          <header><div><h2>{categoria.nome.toUpperCase()}</h2><span>{alunos.length} alunos · {alunos.filter(a => a.numCamisa == null).length} sem camisa</span></div>
            {podeGerenciar && <Btn variant="ghost" size="sm" onClick={() => abrir(null, categoria)}>Adicionar aluno</Btn>}</header>
          <p className="alunos-hint">A data de nascimento determina o sub de destino.</p>
          {visiveis.length ? <ul className="alunos-students">{visiveis.map(aluno => <li key={aluno.id}>
            <span className={`alunos-shirt ${aluno.numCamisa == null ? 'is-empty' : ''}`} aria-label={aluno.numCamisa == null ? 'Sem camisa' : `Camisa ${aluno.numCamisa}`}>{aluno.numCamisa ?? '—'}</span>
            <div><strong>{aluno.nome}</strong><small><PositionBadge position={aluno.posicao}/>{aluno.numCamisa == null ? ' · Definir camisa' : ''}</small></div>
            {podeGerenciar && <div className="actions"><Btn variant="ghost" size="sm" onClick={() => abrir(aluno)}>Editar</Btn><Btn variant="danger" size="sm" onClick={() => { setDeleteError(''); setDeleting(aluno); }}>Excluir</Btn></div>}
          </li>)}</ul> : <p className="alunos-empty">{busca ? 'Nenhum aluno encontrado.' : 'Nenhum aluno nesta categoria.'}</p>}
        </section>;
      })}{!blocos.length && <p>Nenhuma categoria cadastrada neste grupo.</p>}</div>}

    <Modal open={modal} onClose={() => { if (!salvando) setModal(false); }} title={editando ? 'Editar aluno' : 'Adicionar aluno'}>
      <form noValidate onSubmit={e => { e.preventDefault(); void salvar(); }}>
        <fieldset disabled={salvando || !!conflito} className="form-grid alunos-fields">
          <Input label="Nome completo" value={form.nome} onChange={e => alterar('nome', e.target.value)} required className="full" />
          {!editando && <Input label="CPF" value={form.cpf} onChange={e => alterar('cpf', e.target.value)} required placeholder="000.000.000-00" inputMode="numeric" maxLength={14} pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}" />}
          <BirthDateField key={editando?.id ?? "new"} value={form.dtNasc} onChange={value => alterar("dtNasc", value)} />
          <div className="alunos-preview" role="status">{origin && <p>Você abriu o cadastro pelo {origin.nome.toUpperCase()}. {categoriaPronta && (categoriaPronta.categoria.id === origin.id ? "O aluno pertence a este sub." : `Pelo nascimento, será cadastrado no ${categoriaPronta.categoria.nome.toUpperCase()}, não no ${origin.nome.toUpperCase()}.`)}</p>}{categoriaPronta ? `${categoriaPronta.categoria.nome.toUpperCase()} · ${categoriaPronta.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'} · Temporada ${categoriaPronta.temporada}` : erroCategoria || (form.dtNasc ? 'Calculando categoria...' : 'Informe a data de nascimento para determinar o sub.')}</div>
          <div className="full"><span className="field-label">Posição</span><div className="position-options" role="group" aria-label="Posição do aluno">{POSITIONS.map(value=><button type="button" key={value} aria-pressed={form.posicao === value} onClick={()=>alterar("posicao",value)}><PositionBadge position={value}/></button>)}</div></div>
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
    <ConfirmDelete name={deleting?.nome ?? null} busy={salvando} error={deleteError} onClose={()=>setDeleting(null)} onConfirm={()=>void excluir()}/>
  </div>;
}
