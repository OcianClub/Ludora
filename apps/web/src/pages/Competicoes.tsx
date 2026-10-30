import { CompetitionPanel } from '../components/CompetitionPanel';
import './SharedMatches.css';
import { useEffect, useState } from 'react';
import { fetchCompeticoes, criarCompeticao, atualizarCompeticao, deletarCompeticao, type Competicao } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { Choice, ViewToggle, type ViewMode } from '../components/CollectionControls';
import { BlockColumns } from '../components/BlockColumns';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import './Competicoes.css';

const TIPOS = [{ value: 'BASE', label: 'Base' }, { value: 'INICIACAO', label: 'Iniciação' }];
const FORM_VAZIO = { nome: '', ano: new Date().getFullYear().toString(), tipo: 'BASE', titulares_necessarios: '5', exigir_inscricao: false };

export default function CompeticoesPage() {
  const { podeGerenciar, clube } = useAuth();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [busca, setBusca] = useState(''), [phase, setPhase] = useState(''), [year, setYear] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [details, setDetails] = useState<Competicao | null>(null);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Competicao | null>(null);
  const [deleting, setDeleting] = useState<Competicao | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [busy, setBusy] = useState(false), [erro, setErro] = useState('');

  useEffect(() => {
    let active = true; setLoading(true); setLoadError('');
    fetchCompeticoes().then(items => { if (active) setCompeticoes(items); })
      .catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clube?.id, version]);

  function open(c?: Competicao) {
    setEditando(c ?? null); setForm(c ? { nome:c.nome, ano:String(c.ano), tipo:c.tipo, titulares_necessarios: String(c.titulares_necessarios || 5), exigir_inscricao: c.exigir_inscricao || false } : FORM_VAZIO);
    setErro(''); setModal(true);
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setBusy(true);
    try {
      const dados = { nome:form.nome.trim(), ano:Number(form.ano), tipo:form.tipo, titulares_necessarios: Number(form.titulares_necessarios), exigir_inscricao: form.exigir_inscricao };
      if (editando) await atualizarCompeticao(editando.id, dados); else await criarCompeticao(dados);
      setModal(false); setVersion(v => v + 1);
    } catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  async function excluir() {
    if (!deleting) return; setBusy(true); setErro('');
    try { await deletarCompeticao(deleting.id); setDeleting(null); setVersion(v => v + 1); }
    catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  const visible = competicoes.filter(c => c.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) && (!phase || c.tipo === phase) && (!year || String(c.ano) === year)).sort((a,b) => b.ano-a.ano || a.nome.localeCompare(b.nome,'pt-BR'));
  return <div>
    <div className="page-header"><div><span className="eyebrow">CALENDÁRIO DO CLUBE</span><h1 className="page-title">Competições</h1><p className="page-sub">Competições organizadas pelo clube e confrontos compartilhados.</p></div>{podeGerenciar && <Btn onClick={() => open()}>+ Nova competição</Btn>}</div>
    <div className="collection-toolbar">
      <Input label="Buscar competição" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do torneio" />
      <Choice label="Fase" value={phase} onChange={setPhase} options={[{value:'',label:'Todas'},...TIPOS]} />
      <Choice label="Temporada" value={year} onChange={setYear} options={[{value:'',label:'Todas'},...[...new Set(competicoes.map(c=>c.ano))].sort((a,b)=>b-a).map(ano=>({value:String(ano),label:String(ano)}))]} />
      <ViewToggle value={view} onChange={setView} />
    </div>
    {loading ? <Spinner/> : loadError ? <p className="notice-error" role="alert">{loadError}</p> : <>
      <p className="competition-count">{visible.length} competições encontradas</p>
      <BlockColumns list={view === 'list'}>{visible.map(c => <article key={c.id} className={`competition-card ${view === 'list' ? 'competition-row' : ''}`}>
        <div className="competition-identity"><span className="competition-icon"><Icon name="trophy" size={24}/></span><div><small>{c.ano} · {c.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small><h2>{c.nome}</h2></div></div>
        <div className="competition-actions"><Btn variant="ghost" size="sm" onClick={() => setDetails(c)}>Ver competição</Btn>{podeGerenciar && !c.somente_leitura && <><Btn variant="ghost" size="sm" onClick={() => open(c)}>Regulamento</Btn><Btn variant="danger" size="sm" onClick={() => { setErro(''); setDeleting(c); }}>Arquivar</Btn></>}</div>
      </article>)}</BlockColumns>
      {!visible.length && <p className="collection-empty">Nenhuma competição corresponde aos filtros.</p>}
    </>}
    {details && <CompetitionPanel competition={details} onClose={() => setDetails(null)}/>}
    <Modal open={!!deleting} title="Arquivar competição" onClose={() => { if (!busy) setDeleting(null); }}>
      <p>Retirar <strong>{deleting?.nome}</strong> da lista? As partidas e o histórico existentes serão preservados.</p>
      {erro && <p role="alert" className="notice-error">{erro}</p>}
      <div className="editor-actions"><Btn variant="ghost" disabled={busy} onClick={() => setDeleting(null)}>Voltar</Btn><Btn disabled={busy} onClick={() => void excluir()}>{busy ? 'Salvando…' : 'Confirmar'}</Btn></div>
    </Modal>
    <Modal open={modal} onClose={() => { if (!busy) setModal(false); }} title={editando ? 'Editar competição' : 'Nova competição'}>
      <form onSubmit={salvar} className="form-grid">
        <Input label="Nome" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required maxLength={100} className="full"/>
        <Input label="Ano" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={form.ano} onChange={e=>setForm(f=>({...f,ano:e.target.value.replace(/\D/g,'')}))} required/>
        <Choice label="Fase" value={form.tipo} options={TIPOS} onChange={tipo=>setForm(f=>({...f,tipo}))}/>
        <Input label="Titulares por equipe" type="number" min="1" max="15" value={form.titulares_necessarios} onChange={e => setForm(f => ({ ...f, titulares_necessarios: e.target.value }))}/>
        <label className="full shared-own-goal"><input type="checkbox" checked={form.exigir_inscricao} onChange={e => setForm(f => ({ ...f, exigir_inscricao: e.target.checked }))}/>Exigir inscrição dos convocados</label>
        <p className="editor-description full">O regulamento fica fixo quando houver partidas. Para outras regras, organize uma nova competição.</p>
        {erro && <p className="notice-error full" role="alert">{erro}</p>}
        <div className="collection-dialog-actions full"><Btn variant="ghost" type="button" disabled={busy} onClick={()=>setModal(false)}>Cancelar</Btn><Btn type="submit" disabled={busy}>{busy?'Salvando…':'Salvar'}</Btn></div>
      </form>
    </Modal>
  </div>;
}
