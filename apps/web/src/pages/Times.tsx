import { useEffect, useState } from 'react';
import { fetchTimes, criarTime, atualizarTime, deletarTime, fetchCategorias, type Time, type Categoria } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { Choice, ConfirmDelete, ViewToggle, type ViewMode } from '../components/CollectionControls';
import { useAuth } from '../contexts/AuthContext';
import './Times.css';
const EMPTY = { nome: '', escudo: '', categoria_id: '' };
function Crest({ src }: { src?: string }) {
  const [failed, setFailed] = useState('');
  return <span className="team-crest" aria-label={src && src !== failed ? 'Escudo do time' : 'Sem escudo'}>{src && src !== failed && <img src={src} alt="" onError={() => setFailed(src)} />}</span>;
}
export default function TimesPage() {
  const { podeGerenciar, clube } = useAuth();
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [category, setCategory] = useState('');
  const [order, setOrder] = useState('asc');
  const [view, setView] = useState<ViewMode>('grid');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Time | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<Time | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setLoadError(''); setModal(false); setDeleting(null);
    Promise.all([fetchTimes(), fetchCategorias()]).then(([t,c])=>{if(active){setTimes(t);setCategorias(c);}})
      .catch(e=>{if(active)setLoadError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[clube?.id,version]);
  function open(team?: Time) { setEditando(team ?? null);setForm(team?{nome:team.nome,escudo:team.escudo||'',categoria_id:String(team.categoria_id||'')}:EMPTY);setError('');setModal(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault();setError('');
    if (!form.nome.trim() || !form.categoria_id) { setError('Informe o nome e a categoria do time.'); return; }
    if (form.escudo.trim()) {
      try { const url = new URL(form.escudo.trim()); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { setError('Informe uma URL de escudo iniciada por http:// ou https://.'); return; }
    }
    setBusy(true);
    try {
      const data={nome:form.nome.trim(),escudo:form.escudo.trim(),categorias_ids:[Number(form.categoria_id)]};
      if(editando)await atualizarTime(editando.id,data);else await criarTime(data);
      setModal(false);setNotice('Time salvo com sucesso.');setVersion(v=>v+1);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar');}finally{setBusy(false);}
  }
  async function remove() {
    if(!deleting)return;setBusy(true);setError('');
    try {await deletarTime(deleting.id);setDeleting(null);setNotice('Categoria do time excluída.');setVersion(v=>v+1);}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível excluir');}finally{setBusy(false);}
  }
  const groups = new Map<string,Time[]>();
  times.filter(t=>(!busca||t.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))&&(!category||t.categoria_id===Number(category))).forEach(t=>{
    const key=t.nome.trim().toLocaleLowerCase();groups.set(key,[...(groups.get(key)||[]),t]);
  });
  const sorted=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')*(order==='asc'?1:-1));
  return <div>
    <div className="page-header"><div><h1 className="page-title">Times</h1><p className="page-sub">Encontre uma equipe e explore suas categorias.</p></div>{podeGerenciar&&<Btn onClick={()=>open()}>+ Adicionar time</Btn>}</div>
    <div className="collection-toolbar"><Input label="Buscar time" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome do time..." />
      <Choice label="Categoria" value={category} onChange={setCategory} options={[{value:'',label:'Todos os subs'},...categorias.map(c=>({value:String(c.id),label:c.nome.toUpperCase()}))]} />
      <Choice label="Ordenar" value={order} onChange={setOrder} options={[{value:'asc',label:'Nome A–Z'},{value:'desc',label:'Nome Z–A'}]} />
      <ViewToggle value={view} onChange={setView}/></div>
    {notice&&<div role="status" className="collection-notice">{notice}</div>}
    {loading?<Spinner/>:loadError?<p className="notice-error" role="alert">{loadError}<Btn onClick={()=>setVersion(v=>v+1)}>Tentar novamente</Btn></p>:
      <div className={`teams-collection teams-${view}`}>{sorted.map(([key,items])=>{
        const show=view==='list'||expanded.includes(key);
        const team=items[0];
        return <section key={key} className="team-group"><button type="button" className="team-heading" disabled={view === 'list'} aria-expanded={show} onClick={()=>setExpanded(v=>v.includes(key)?v.filter(k=>k!==key):[...v,key])}>
          <Crest src={items.find(t=>t.escudo)?.escudo}/><span><strong>{team.nome}</strong><small>{items.length} categoria(s)</small></span><span className="team-open">{show?'Categorias':'Ver subs'} <span aria-hidden="true">⌄</span></span></button>
          {show&&<div className="team-subs">{[...items].sort((a,b)=>Number(categorias.find(c=>c.id===a.categoria_id)?.nome.replace(/\D/g,''))-Number(categorias.find(c=>c.id===b.categoria_id)?.nome.replace(/\D/g,''))).map(t=><div className="team-sub" key={t.id}>
            <h3>{categorias.find(c=>c.id===t.categoria_id)?.nome.toUpperCase()||'Sem categoria'}</h3>
            {podeGerenciar&&<div className="actions"><Btn size="sm" variant="ghost" onClick={()=>open(t)}>Editar</Btn><Btn size="sm" variant="danger" onClick={()=>{setError('');setDeleting(t);}}>Excluir</Btn></div>}
          </div>)}</div>}
        </section>;
      })}{!sorted.length&&<p className="collection-empty">Nenhum time encontrado para esses filtros.</p>}</div>}
    <Modal open={modal} onClose={()=>{if(!busy)setModal(false);}} title={editando?'Editar categoria do time':'Adicionar time'}>
      <form noValidate onSubmit={save} className="form-grid"><Input label="Nome do time" value={form.nome} maxLength={120} onChange={e=>setForm(f=>({...f,nome:e.target.value.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu,'')}))} required className="full" />
        <Input label="URL do escudo (opcional)" type="url" value={form.escudo} onChange={e=>setForm(f=>({...f,escudo:e.target.value}))} placeholder="https://..." className="full"/>
        <Choice label="Categoria" value={form.categoria_id} onChange={value=>setForm(f=>({...f,categoria_id:value}))} options={categorias.map(c=>({value:String(c.id),label:c.nome.toUpperCase()}))}/>
        <p className="full text-muted">Cada cadastro representa um sub. Nomes iguais aparecem juntos na visualização.</p>
        {error&&<p className="full notice-error" role="alert">{error}</p>}<div className="full collection-dialog-actions"><Btn type="button" variant="ghost" disabled={busy} onClick={()=>setModal(false)}>Cancelar</Btn><Btn type="submit" disabled={busy||!form.categoria_id}>{busy?'Salvando...':'Salvar time'}</Btn></div>
      </form>
    </Modal>
    <ConfirmDelete name={deleting?`${deleting.nome} — ${categorias.find(c=>c.id===deleting.categoria_id)?.nome||''}`:null} busy={busy} error={error} onClose={()=>setDeleting(null)} onConfirm={()=>void remove()}/>
  </div>;
}
