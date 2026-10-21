import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { requestJson } from '../services/api';
import { Btn, Modal } from './UI';
import './Notifications.css';
type Notice = {id:number; titulo:string; corpo:string; lida:boolean; partida_id:number|null; criada_em:string};
export function Notifications() {
  const { clube } = useAuth();
  const navigate=useNavigate();
  const [open,setOpen]=useState(false),[error,setError]=useState('');
  const [data,setData]=useState<{notificacoes:Notice[];totalNaoLidas:number}>({notificacoes:[],totalNaoLidas:0});
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true, pending=false;
    setData({notificacoes:[],totalNaoLidas:0});setError('');setOpen(false);
    const refresh=async()=>{if(!clube?.meuPapel || pending)return;pending=true;
      try{const value=await requestJson<typeof data>('/notificacoes');if(active){setData(value);setError('');}}
      catch(e){if(active)setError((e as Error).message);}finally{pending=false;}};
    void refresh(); const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},30000);
    return()=>{active=false;window.clearInterval(timer);};
  },[clube?.id,clube?.meuPapel]);
  async function read(notice?:Notice) {
    setBusy(true);setError('');
    try{await requestJson(notice?`/notificacoes/${notice.id}/lida`:'/notificacoes/lidas',{method:'PATCH'});
      setData(d=>{const rows=d.notificacoes.map(n=>!notice||n.id===notice.id?{...n,lida:true}:n);return {notificacoes:rows,totalNaoLidas:notice?Math.max(0,d.totalNaoLidas-(notice.lida?0:1)):0};});
      if(notice?.partida_id){setOpen(false);navigate(`/partidas/${notice.partida_id}`);}
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <><button className="profile-link notifications-trigger" type="button" aria-label={`Notificações, ${data.totalNaoLidas} não lidas`} onClick={()=>setOpen(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{data.totalNaoLidas>0&&<span className="notification-count">{data.totalNaoLidas>9?'9+':data.totalNaoLidas}</span>}</button>
    <Modal open={open} onClose={()=>setOpen(false)} title="Notificações"><p className="scout-help">Avisos do {clube?.nome}</p>{error&&<p role="alert" className="notice-error">{error}</p>}{!clube?.meuPapel?<p>Siga o clube para receber avisos.</p>:<><div className="notification-list">{data.notificacoes.map(n=><button key={n.id} disabled={busy} className={`notification-row ${n.lida?'':'unread'}`} onClick={()=>void read(n)}><strong>{n.titulo}</strong><span>{n.corpo}</span><small>{new Date(n.criada_em).toLocaleString('pt-BR')}{n.lida?' · Lida':' · Não lida'}</small></button>)}</div>{!data.notificacoes.length&&<p>Nenhum aviso por enquanto.</p>}{data.totalNaoLidas>0&&<Btn variant="ghost" disabled={busy} onClick={()=>void read()}>Marcar todas como lidas</Btn>}</>}</Modal>
  </>;
}
