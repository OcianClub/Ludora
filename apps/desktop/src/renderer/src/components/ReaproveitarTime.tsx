import { useEffect, useState } from 'react';
import { Btn, DesktopState, LoadingSkeleton, Modal, StatusBadge } from './AdminUI';
import { ClubBadge } from '@web/components/Brand';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { Icon } from '@web/components/Icon';
import { ClubSubChoices, SUBS } from './ClubeCadastroFields';
import { requestJson } from '../services/api';

type Time = { id: number; nome: string; escudo?: string | null };
type Casca = Time & { categoria: { nome: string; faixaIdade?: number; clube_id: number; clube: { nome: string } } | null };
type Grupo = Casca & { subs: number[]; registros: number; origens: string[] };
type Jogo = { id: number; data: string; horario?: string | null; status: string; mandante: Time; visitante: Time; categoria: { nome: string } };
export type CascaPrevia = { time: Casca; times: Casca[]; jogos: Jogo[]; agrupada?: boolean; subs?: number[]; subsSelecionados?: number[] };
export function subCasca(time: Casca) {
  const sub = time.categoria?.faixaIdade ?? Number(time.categoria?.nome.match(/^sub[\s-]*(\d+)$/i)?.[1]);
  return SUBS.includes(sub) ? sub : null;
}

export function ReaproveitarTime({ buscaInicial, onClose, onConfirm }: {
  buscaInicial: string; onClose: () => void; onConfirm: (previa: CascaPrevia) => void;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [lista, setLista] = useState<Grupo[] | null>(null);
  const [proximo, setProximo] = useState<number|null>(null);
  const [cursor, setCursor] = useState<number|null>(null);
  const [carregando, setCarregando] = useState(false);
  const [escolhido, setEscolhido] = useState<Grupo | null>(null);
  const [previa, setPrevia] = useState<CascaPrevia | null>(null);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [excluidos, setExcluidos] = useState<number[]>([]);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if(escolhido)return;
    let ativa = true;
    setCarregando(true);setErro('');
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ agrupar:'clube', nome:busca.trim(), ...(cursor ? {cursor:String(cursor)} : {}) });
      requestJson<{grupos:Grupo[];proximo:number|null}>(`/admin/clubes/cascas?${params}`)
        .then(dados => { if (ativa) { setLista(antes=>cursor ? [...(antes||[]),...dados.grupos.filter(t=>!antes?.some(a=>a.id===t.id))] : dados.grupos);setProximo(dados.proximo); } })
        .catch(e => { if (ativa) setErro(e.message); })
        .finally(()=>{if(ativa)setCarregando(false);});
    }, cursor ? 0 : 230);
    return () => { ativa = false; clearTimeout(timer); };
  }, [busca, cursor, tentativa, escolhido]);

  useEffect(() => {
    if (!escolhido) return;
    let ativa = true;
    setPrevia(null);setErro('');setExcluidos([]);
    requestJson<CascaPrevia>(`/admin/clubes/cascas/${escolhido.id}/previa?agrupar=clube`)
      .then(dados => { if (ativa) { setPrevia(dados);setSelecionados(dados.subs?.length ? dados.subs : [...SUBS]); } })
      .catch(e => { if (ativa) setErro(e.message); });
    return () => { ativa = false; };
  }, [escolhido, tentativa]);

  const times = previa?.times.filter(t=>!excluidos.includes(t.id) && (subCasca(t)===null || selecionados.includes(subCasca(t)!))) || [];
  const ids = new Set(times.map(t => t.id));
  const jogos = previa?.jogos.filter(j=>ids.has(j.mandante.id)||ids.has(j.visitante.id)) || [];
  const subs = previa?.subs?.length ? previa.subs : SUBS;
  function confirmar() {
    if(!previa || !times.length || !selecionados.length)return;
    onConfirm({...previa, time:{...times[0],nome:previa.time.nome,escudo:previa.time.escudo},times,subsSelecionados:selecionados,agrupada:true});
  }
  return <Modal open title={escolhido ? 'Confirmar time existente' : 'Reaproveitar time existente'} className="club-shell-dialog" onClose={onClose}
    footer={<div className="schedule-review-actions">
      <Btn type="button" variant="ghost" onClick={() => { if (escolhido) { setEscolhido(null);setErro(''); } else onClose(); }}>{escolhido ? 'Voltar à lista' : 'Cancelar'}</Btn>
      {escolhido && <Btn type="button" disabled={!previa||!times.length||!selecionados.length} onClick={confirmar}>Confirmar vínculo</Btn>}
    </div>}>
    {erro && <p className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Btn></p>}
    {!escolhido ? <>
      <p className="club-settings-hint">Selecione o clube. Na próxima etapa, escolha quais SUBs deseja reaproveitar.</p>
      <CollectionSearch label="Buscar time existente" placeholder="Nome do clube…" value={busca} onChange={valor=>{setBusca(valor);setCursor(null);setLista(null);setProximo(null);}}/>
      {!lista && !erro && <LoadingSkeleton kind="cards"/>}
      {lista && !lista.length && <DesktopState plain icon="shield" title="Nenhum clube disponível" description="Tente buscar por outro nome."/>}
      {!!lista?.length && <div className="club-shell-grid" aria-busy={carregando}>{lista.map(t => <button type="button" className="ticket-card" key={t.id} disabled={carregando} onClick={() => setEscolhido(t)}>
        <ClubBadge src={t.escudo} name={t.nome} size={40}/><span className="ticket-card-copy"><strong>{t.nome}</strong><small>{t.subs.length ? `${t.subs.length} categorias disponíveis` : 'Categorias a definir'}</small></span><Icon name="chevronRight" size={17}/>
      </button>)}</div>}
      {proximo && <Btn type="button" variant="ghost" disabled={carregando} onClick={()=>setCursor(proximo)}>{carregando?'Carregando…':'Carregar mais clubes'}</Btn>}
    </> : !previa ? !erro && <LoadingSkeleton kind="cards"/> : <>
      <ClubSettingsSection icon="team" title={previa.time.nome} description="Escolha os SUBs que serão cadastrados no Ludora. Você pode ajustar as categorias depois.">
        <ClubSubChoices options={subs.map(id=>({id,nome:`SUB-${id}`,tipo:id<=10?'INICIACAO':'BASE'}))} selected={selecionados}
          onChange={sub=>setSelecionados(antes=>antes.includes(sub)?antes.filter(n=>n!==sub):[...antes,sub])}/>
        {!selecionados.length && <p className="dica" role="status">Selecione pelo menos um SUB para continuar.</p>}
        <details className="club-shell-sources"><summary>Conferir cadastros de origem ({previa.times.length})</summary>
          <p className="dica">Somente os SUBs selecionados serão vinculados. Confira a identidade e desmarque cadastros que pertençam a outro clube. Os jogos e IDs originais serão preservados.</p>
          {previa.times.map(t=><label key={t.id}><input type="checkbox" checked={ids.has(t.id)} disabled={subCasca(t)!==null && !selecionados.includes(subCasca(t)!)} onChange={()=>setExcluidos(antes=>antes.includes(t.id)?antes.filter(id=>id!==t.id):[...antes,t.id])}/><span><strong>{t.nome}</strong><small>{t.categoria ? `${t.categoria.nome.toUpperCase()} · Cadastro de ${t.categoria.clube.nome}` : 'Sem categoria definida'}</small></span></label>)}
        </details>
      </ClubSettingsSection>
      <ClubSettingsSection icon="calendar" title="Últimas partidas" description="Amostra dos cinco confrontos recentes, limitada aos cadastros selecionados.">
        {!jogos.length ? <p className="club-settings-hint">Nenhuma partida nesta amostra.</p> : <ul className="club-shell-matches">{jogos.map(j => {
          const adversario = ids.has(j.mandante.id) ? j.visitante : j.mandante;
          return <li key={j.id}><ClubBadge src={adversario.escudo} name={adversario.nome} size={34}/><span><strong>{adversario.nome}</strong><small>{j.categoria.nome.toUpperCase()} · {j.data.slice(0, 10).split('-').reverse().join('/')}{j.horario && ` · ${j.horario}`}</small></span><StatusBadge status={j.status}/></li>;
        })}</ul>}
      </ClubSettingsSection>
    </>}
  </Modal>;
}
