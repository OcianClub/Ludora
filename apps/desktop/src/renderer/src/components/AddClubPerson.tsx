import { useEffect, useRef, useState } from 'react';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { requestJson } from '../services/api';
import { AccountIdentity } from './AccountIdentity';
import { Btn, DesktopState, LoadingSkeleton } from './AdminUI';

export type ClubPerson = { id: number; nome: string; email: string };
export function AddClubPerson({ clubeId, onSelect }: { clubeId: number; onSelect: (pessoa: ClubPerson) => void }) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<ClubPerson[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [proximo, setProximo] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(true);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  const consulta = useRef(0);
  useEffect(() => {
    let ativo = true; const sequencia = ++consulta.current;
    setOcupado(true); setErro('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ busca, limite: '20', ...(cursor ? {cursor:String(cursor)} : {}) });
      requestJson<{pessoas:ClubPerson[];proximo:number|null}>(`/admin/clubes/${clubeId}/pessoas-disponiveis?${params}`).then(r => {
        if (!ativo || consulta.current !== sequencia) return;
        setLista(anterior => cursor ? [...anterior, ...r.pessoas.filter(p => !anterior.some(a=>a.id === p.id))] : r.pessoas);
        setProximo(r.proximo);
      }).catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setOcupado(false); });
    }, busca ? 220 : 0);
    return () => { ativo = false; clearTimeout(timer); };
  }, [clubeId, busca, cursor, revisao]);
  return <div className="club-person-picker">
    <p className="dica">Contas ativas que ainda não possuem vínculo com este clube.</p>
    <CollectionSearch label="Buscar pessoa por nome ou e-mail" placeholder="Nome ou e-mail…" value={busca} onChange={value=>{setBusca(value);setCursor(null);setLista([]);setProximo(null);}}/>
    {erro && <DesktopState error title="Não foi possível consultar as pessoas" description={erro} onRetry={()=>setRevisao(r=>r+1)}/>}
    {ocupado && !lista.length ? <LoadingSkeleton count={3} label="Buscando pessoas disponíveis"/> : !erro && !lista.length ? <DesktopState plain icon="people" title="Nenhuma pessoa disponível" description={busca ? 'Tente outro nome ou e-mail.' : 'Todas as contas disponíveis já possuem vínculo com este clube.'}/> : <div className="club-person-results" aria-busy={ocupado}>
      {lista.map(pessoa=><AccountIdentity key={pessoa.id} nome={pessoa.nome} email={pessoa.email} actions={<Btn size="sm" disabled={ocupado} onClick={()=>onSelect(pessoa)}>Escolher</Btn>}/>)}</div>}
    {proximo && <Btn variant="ghost" disabled={ocupado} onClick={()=>setCursor(proximo)}>{ocupado ? 'Carregando…' : 'Carregar mais pessoas'}</Btn>}
  </div>;
}
