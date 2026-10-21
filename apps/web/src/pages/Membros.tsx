import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchCategorias, requestJson, type Categoria } from '../services/api';
import { Btn, Input, Modal, PapelBadge, Spinner } from '../components/UI';
import { Choice } from '../components/CollectionControls';
import './Membros.css';
type Member = {id:number;papel:string;acesso_todas_categorias:boolean;usuario:{id:number;nome:string};categorias:{categoria_id:number}[]};
const roles=[{value:'TORCEDOR',label:'Visitante'},{value:'OLHEIRO',label:'Olheiro'},{value:'TECNICO',label:'Técnico'},{value:'MESARIO',label:'Mesário'},{value:'ADMIN',label:'Administrador'}];
export default function MembrosPage(){
  const {clube,usuario}=useAuth();
  const [members,setMembers]=useState<Member[]>([]),[categories,setCategories]=useState<Categoria[]>([]);
  const [search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState('');
  const [selected,setSelected]=useState<Member|null>(null),[role,setRole]=useState('TORCEDOR');
  const [all,setAll]=useState(false),[ids,setIds]=useState<number[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[version,setVersion]=useState(0);
  useEffect(()=>{let active=true;setSelected(null);setError('');setLoading(true);
    if(clube?.meuPapel!=='ADMIN'){setLoading(false);return;}
    Promise.all([requestJson<Member[]>('/membros'),fetchCategorias()]).then(([m,c])=>{if(active){setMembers(m);setCategories(c);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
  },[clube?.id,clube?.meuPapel,version]);
  if(clube?.meuPapel!=='ADMIN')return <p className="notice-error">Somente o administrador do clube pode gerenciar pessoas.</p>;
  async function save(){if(!selected)return;setBusy(true);setError('');try{await requestJson(`/membros/${selected.id}`,{method:'PATCH',body:JSON.stringify({papel:role,acesso_todas_categorias:all,categoria_ids:ids})});setSelected(null);setNotice('Cargo e categorias atualizados.');setVersion(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div><div className="page-header"><div><span className="eyebrow">ADMINISTRAÇÃO DO CLUBE</span><h1 className="page-title">Pessoas e acessos</h1><p className="page-sub">Quem acompanha o {clube?.nome} e quem pode trabalhar nas categorias.</p></div></div>
    <div className="member-guide"><strong>O acesso pertence ao clube</strong><p>Visitantes e olheiros consultam os dados publicados. Técnicos e mesários gerenciam as categorias atribuídas. Administradores gerenciam todas as categorias e os acessos.</p><small>O cargo de olheiro identifica a função; relatórios privados e permissões personalizadas ainda não existem.</small></div>
    <div className="collection-toolbar"><Input label="Buscar pessoa" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome..."/><Choice label="Cargo" value={roleFilter} onChange={setRoleFilter} options={[{value:'',label:'Todos os cargos'},...roles]}/></div>
    {notice&&<p role="status" className="collection-notice">{notice}</p>}{error&&!selected&&<p role="alert" className="notice-error">{error}</p>}{loading?<Spinner/>:<div className="member-list">{members.filter(m=>m.usuario.nome.toLowerCase().includes(search.toLowerCase())&&(!roleFilter||m.papel===roleFilter)).map(m=><article key={m.id} className="member-row"><span className="member-avatar">{m.usuario.nome[0]}</span><div><h2>{m.usuario.nome}{m.usuario.id===usuario?.id?' · Você':''}</h2><p>{m.papel==='ADMIN'||m.acesso_todas_categorias?'Todas as categorias':m.categorias.length?m.categorias.map(x=>categories.find(c=>c.id===x.categoria_id)?.nome).join(', '):'Consulta do conteúdo público'}</p></div><PapelBadge papel={m.papel}/><Btn size="sm" variant="ghost" disabled={m.usuario.id===usuario?.id} onClick={()=>{setSelected(m);setRole(m.papel);setAll(m.acesso_todas_categorias);setIds(m.categorias.map(c=>c.categoria_id));setError('');}}>Gerenciar acesso</Btn></article>)}</div>}
    <Modal open={!!selected} onClose={()=>{if(!busy)setSelected(null);}} title={`Acesso de ${selected?.usuario.nome||''}`}><Choice label="Cargo no clube" value={role} onChange={v=>{setRole(v);setIds([]);setAll(false);}} options={roles}/>{['TECNICO','MESARIO'].includes(role)&&<><label className="member-check"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Todas as categorias</label>{!all&&<fieldset className="member-categories"><legend>Categorias permitidas</legend>{categories.map(c=><label key={c.id}><input type="checkbox" checked={ids.includes(c.id)} onChange={e=>setIds(current=>e.target.checked?[...current,c.id]:current.filter(id=>id!==c.id))}/>{c.nome.toUpperCase()}</label>)}</fieldset>}</>}{role==='ADMIN'&&<p className="member-warning">Esse cargo poderá alterar pessoas, jogadores, competições e partidas de todo o clube.</p>}{error&&<p role="alert" className="notice-error">{error}</p>}<div className="collection-dialog-actions"><Btn variant="ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancelar</Btn><Btn disabled={busy} onClick={()=>void save()}>{busy?'Salvando...':'Confirmar acesso'}</Btn></div></Modal>
  </div>;
}
