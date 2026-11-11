import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { PapelClube } from '@ludora/shared-types';
import { Btn, DesktopState, Input, LoadingSkeleton, Modal } from './AdminUI';
import { Toast } from '@web/components/Toast';
import { requestJson } from '../services/api';
import { DesktopTable } from './DesktopTable';
import { CargoClube } from './CargoClube';
import { Icon } from '@web/components/Icon';

interface Convite { id:string; email:string|null; papel:PapelClube; situacao:string; expira_em:string; codigo_disponivel?:boolean }
const situacoes:Record<string,string> = {PENDENTE:'Pendente',ACEITO:'Aceito',EXPIRADO:'Expirado',REVOGADO:'Revogado'};
type Credencial = {codigo:string;expira_em:string};
export function ClubeConvites({ clubeId, ativo=true, podeGerenciar=true }: {clubeId:number;ativo?:boolean;podeGerenciar?:boolean}) {
  const endpoint = `/admin/clubes/${clubeId}/convites`;
  const [convites,setConvites] = useState<Convite[]|null>(null);
  const [email,setEmail] = useState('');
  const [entrega,setEntrega] = useState<'email'|'codigo'>('email');
  const [codigo,setCodigo] = useState<Credencial|null>(null);
  const [aviso,setAviso] = useState('');
  const [erro,setErro] = useState('');
  const [erroLista,setErroLista] = useState('');
  const [atualizando,setAtualizando] = useState(false);
  const [proximo,setProximo] = useState<string|null>(null);
  const [ocupado,setOcupado] = useState('');
  const [acao,setAcao] = useState<{convite:Convite;tipo:'reenviar'|'revogar'}|null>(null);
  const [agora,setAgora] = useState(Date.now());
  const vivo = useRef(true), busy = useRef(false), carga = useRef(0);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;carga.current++;};},[]);
  const carregar = useCallback(async(cursor?:string)=>{
    const seq = ++carga.current;
    setAtualizando(true);setErroLista('');
    try {
      const params=new URLSearchParams({limite:'20',...(cursor?{cursor}:{})});
      const r = await requestJson<{convites:Convite[];proximo?:string|null}>(`${endpoint}?${params}`);
      if (vivo.current && seq === carga.current) {
        setConvites(anterior=>cursor?[...(anterior||[]),...r.convites.filter(c=>!anterior?.some(a=>a.id===c.id))]:r.convites);
        setProximo(r.proximo||null);
      }
    } catch(e) {if(vivo.current && seq===carga.current)setErroLista((e as Error).message);}
    finally {if(vivo.current && seq===carga.current)setAtualizando(false);}
  },[endpoint]);
  useEffect(()=>{void carregar();},[carregar]);
  useEffect(()=>{const timer=setInterval(()=>setAgora(Date.now()),15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(codigo && new Date(codigo.expira_em).getTime()<=agora)setCodigo(null);},[codigo,agora]);
  async function executar(chave:string,fn:()=>Promise<void>) {
    if(busy.current)return;
    busy.current=true;setOcupado(chave);setErro('');setAviso('');
    try {await fn();} catch(e){if(vivo.current)setErro((e as Error).message);}
    finally{busy.current=false;if(vivo.current)setOcupado('');}
  }
  function criar(e:FormEvent) {
    e.preventDefault();
    void executar('criar',async()=>{
      const r = await requestJson<{codigo?:string;convite:Convite;email_enviado:boolean;aviso?:string}>(endpoint,{method:'POST',body:{email:email.trim(),entrega,papel:'ADMIN'}});
      if(!vivo.current)return;
      setEmail('');
      if(r.codigo)setCodigo({codigo:r.codigo,expira_em:r.convite.expira_em});
      setAviso(r.aviso || (r.email_enviado ? 'Convite enviado por e-mail.' : 'Convite criado. Copie o código para compartilhar.'));
      await carregar();
    });
  }
  async function confirmar() {
    if(!acao)return;
    const {convite,tipo}=acao;
    await executar(`${tipo}:${convite.id}`,async()=>{
      const r = await requestJson<{codigo?:string;convite?:Convite;email_enviado?:boolean;aviso?:string}>(`${endpoint}/${convite.id}/${tipo}`,{method:'POST'});
      if(!vivo.current)return;
      setAcao(null);setCodigo(r.codigo && r.convite ? {codigo:r.codigo,expira_em:r.convite.expira_em}:null);
      setAviso(tipo==='revogar' ? 'Convite revogado.' : r.aviso || 'Convite reenviado. O código anterior deixou de valer.');
      await carregar();
    });
  }
  const mostrarCodigo = (convite:Convite)=>void executar(`codigo:${convite.id}`,async()=>{
    const r=await requestJson<Credencial>(`${endpoint}/${convite.id}/codigo`);
    if(vivo.current)setCodigo(r);
  });
  return <>
    {podeGerenciar && <section className="club-invite-form card">
      <header className="club-invite-heading"><span><Icon name="email" size={20}/></span><div><h2>Convidar administrador</h2><p>Envie acesso a todas as categorias do clube.</p></div></header>
      <form onSubmit={criar} className="club-invite-fields">
        <div className="actions" role="group" aria-label="Forma de entrega">
          <Btn type="button" size="sm" disabled={!!ocupado} variant={entrega==='email'?'primary':'ghost'} aria-pressed={entrega==='email'} onClick={()=>setEntrega('email')}>Por e-mail</Btn>
          <Btn type="button" size="sm" disabled={!!ocupado} variant={entrega==='codigo'?'primary':'ghost'} aria-pressed={entrega==='codigo'} onClick={()=>setEntrega('codigo')}>Compartilhar código</Btn>
        </div>
        <div className="club-invite-send"><Input label={entrega==='email'?'E-mail do administrador (obrigatório)':'E-mail do administrador (opcional)'} type="email" maxLength={254} required={entrega==='email'} value={email} disabled={!!ocupado} placeholder="nome@exemplo.com" onChange={e=>setEmail(e.target.value)}/>
          <Btn type="submit" disabled={!!ocupado||!ativo}>{ocupado==='criar'?'Criando convite…':entrega==='email'?'Enviar convite':'Gerar código'}</Btn></div>
        {!ativo && <p className="dica">Reative o clube para criar, consultar códigos ou reenviar convites.</p>}
        <p className="dica">Válido por 72 horas, para um único aceite. {entrega==='codigo' && 'Sem destinatário, a primeira pessoa autenticada que usar o código recebe o acesso.'}</p>
      </form>
    </section>}
    {erro && !acao && <p className="notice-error" role="alert">{erro}</p>}
    <Toast message={aviso} onClose={()=>setAviso('')}/>
    <section className="club-access-section">
      <div className="bloco-topo"><h2 className="section-title">Convites do clube</h2><Btn size="sm" variant="ghost" disabled={atualizando||!!ocupado} onClick={()=>{setCodigo(null);void carregar();}}>{atualizando?'Atualizando…':'Atualizar'}</Btn></div>
      {erroLista && <DesktopState error title="Não foi possível atualizar os convites" description={erroLista} onRetry={()=>void carregar()}/>}
      {!convites ? !erroLista && <LoadingSkeleton kind="table" label="Carregando convites"/> : !convites.length ? <DesktopState plain icon="clipboard" title="Nenhum convite registrado" description="Os convites enviados para este clube aparecerão aqui."/> :
        <DesktopTable label="Convites do clube" tableClassName="club-invites-table">
          <thead><tr><th scope="col">Destinatário</th><th scope="col">Cargo</th><th scope="col">Situação</th><th scope="col">Validade</th>{podeGerenciar && <th scope="col">Ações</th>}</tr></thead>
          <tbody>{convites.map(convite=>{
            const situacao=convite.situacao==='PENDENTE' && new Date(convite.expira_em).getTime()<=agora?'EXPIRADO':convite.situacao;
            const podeReenviar=!!convite.email && ['PENDENTE','EXPIRADO','REVOGADO'].includes(situacao);
            return <tr key={convite.id}><td>{convite.email||'Código sem e-mail'}</td><td><CargoClube papel={convite.papel}/></td>
              <td><span className="club-invite-status" data-status={situacao}><Icon name={situacao==='ACEITO'?'checkAll':situacao==='PENDENTE'?'clock':'cancel'} size={13}/>{situacoes[situacao]||situacao}</span></td>
              <td>{new Date(convite.expira_em).toLocaleString('pt-BR')}</td>{podeGerenciar && <td><div className="actions club-invite-actions">
                {situacao==='PENDENTE' && <Btn size="sm" variant="ghost" disabled={!!ocupado||!ativo||!convite.codigo_disponivel} title={!convite.codigo_disponivel?'Código antigo não recuperável. Reenvie por e-mail ou crie outro convite.':undefined} onClick={()=>mostrarCodigo(convite)}>Ver código</Btn>}
                {podeReenviar && <Btn size="sm" variant="ghost" disabled={!!ocupado||!ativo} onClick={()=>{setErro('');setAcao({convite,tipo:'reenviar'});}}>Reenviar</Btn>}
                {situacao==='PENDENTE' && <Btn size="sm" variant="danger" disabled={!!ocupado} onClick={()=>{setErro('');setAcao({convite,tipo:'revogar'});}}>Revogar</Btn>}
              </div></td>}</tr>;
          })}</tbody>
        </DesktopTable>}
      {proximo && <Btn variant="ghost" disabled={atualizando||!!ocupado} onClick={()=>void carregar(proximo)}>{atualizando?'Carregando…':'Carregar mais convites'}</Btn>}
    </section>
    <Modal open={!!codigo} title="Código do convite" onClose={()=>setCodigo(null)}>
      {codigo && <div className="club-code-preview"><p>Compartilhe apenas com a pessoa que receberá o acesso de administrador.</p><code>{codigo.codigo}</code><p className="dica">Validade: {new Date(codigo.expira_em).toLocaleString('pt-BR')}</p>
        <Btn onClick={()=>void navigator.clipboard.writeText(codigo.codigo).then(()=>setAviso('Código copiado.'),()=>setErro('Não foi possível copiar automaticamente. Selecione e copie o código.'))}>Copiar código</Btn>{erro && <p className="notice-error" role="alert">{erro}</p>}</div>}
    </Modal>
    <Modal open={!!acao} title={acao?.tipo==='revogar'?'Revogar convite?':'Reenviar convite?'} onClose={()=>{if(!ocupado)setAcao(null);}}>
      <p>{acao?.tipo==='revogar'?'O código deixa de funcionar imediatamente após a revogação.':'O código e o link anteriores serão substituídos. A validade será renovada por 72 horas e um novo e-mail será enviado.'}</p>
      <p><strong>{acao?.convite.email||'Convite sem e-mail'}</strong></p>
      {erro && <p className="notice-error" role="alert">{erro}</p>}
      <div className="schedule-review-actions"><Btn variant="ghost" disabled={!!ocupado} onClick={()=>setAcao(null)}>Voltar</Btn><Btn variant={acao?.tipo==='revogar'?'danger':'primary'} disabled={!!ocupado} onClick={()=>void confirmar()}>{ocupado?'Aguarde…':acao?.tipo==='revogar'?'Revogar convite':'Confirmar reenvio'}</Btn></div>
    </Modal>
  </>;
}
