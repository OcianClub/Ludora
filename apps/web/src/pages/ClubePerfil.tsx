import { useEffect, useState } from 'react';
import { requestJson, type Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Input, Spinner } from '../components/UI';
import { ClubBadge } from '../components/Brand';
import './JogadorPerfil.css';
const emptyAddress = { logradouro:'',numero:'',complemento:'',bairro:'',cidade:'',estado:'',cep:'' };
type ClubProfile = Clube & { endereco: typeof emptyAddress | null };
export default function ClubePerfil() {
  const { clube, definirClube } = useAuth();
  const [data,setData] = useState<ClubProfile | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [saved,setSaved] = useState(false), [version,setVersion] = useState(0);
  useEffect(() => { const controller=new AbortController(); setData(null); setError(''); requestJson<ClubProfile>('/clube/perfil',{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(err=>{if(!controller.signal.aborted)setError(err.message);}); return()=>controller.abort(); },[clube?.id,version]);
  const editable=clube?.meuPapel==='ADMIN';
  if(!data)return error?<div className="notice-error" role="alert">{error}<Btn onClick={()=>setVersion(v=>v+1)}>Tentar novamente</Btn></div>:<Spinner/>;
  return <div className="player-profile-page"><header className="player-profile-header"><ClubBadge src={data.escudo} name={data.nome} size={84}/><div><p className="eyebrow">Clube Ludora</p><h1 className="page-title">{data.nome}</h1><p className="page-sub">Perfil e sede do clube</p></div></header><section className="player-panel"><h2>Identidade e endereço</h2><p className="player-empty">A sede cadastrada aparece nas sugestões de local ao organizar partidas.</p>
    <form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);try{const result=await requestJson<ClubProfile>('/clube/perfil',{method:'PATCH',body:JSON.stringify({nome:data.nome,escudo:data.escudo||null,endereco:Object.values(data.endereco||{}).some(Boolean)?data.endereco:null})});setData(result);if(clube)definirClube({...clube,...result});setSaved(true);}catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.');}finally{setBusy(false);}}}>
      <fieldset disabled={!editable||busy} className="form-grid alunos-fields"><Input className="full" label="Nome do clube" value={data.nome} maxLength={120} onChange={e=>setData({...data,nome:e.target.value})}/><Input className="full" label="Escudo · URL HTTPS" value={data.escudo||''} onChange={e=>setData({...data,escudo:e.target.value})}/>
      {(Object.keys(emptyAddress) as (keyof typeof emptyAddress)[]).map(key=><Input key={key} label={{logradouro:'Logradouro',numero:'Número',complemento:'Complemento',bairro:'Bairro',cidade:'Cidade',estado:'UF',cep:'CEP'}[key]} value={data.endereco?.[key]||''} maxLength={key==='cep'?8:key==='estado'?2:160} inputMode={key==='cep'?'numeric':undefined} onChange={e=>{const value=key==='cep'?e.target.value.replace(/\D/g,''):key==='estado'?e.target.value.toUpperCase().replace(/[^A-Z]/g,''):e.target.value;setData({...data,endereco:{...emptyAddress,...data.endereco,[key]:value}});}}/>)}
      </fieldset>{error&&<p className="notice-error" role="alert">{error}</p>}{saved&&<p className="collection-notice" role="status">Clube atualizado.</p>}{editable&&<div className="collection-dialog-actions"><Btn disabled={busy} type="submit">{busy?'Salvando…':'Salvar clube'}</Btn></div>}
    </form></section></div>;
}
