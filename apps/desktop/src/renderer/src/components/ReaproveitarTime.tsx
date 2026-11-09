import { useEffect, useState } from 'react';
import { Btn, LoadingSkeleton, Modal, StatusBadge } from '@web/components/UI';
import { ClubBadge } from '@web/components/Brand';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { Icon } from '@web/components/Icon';
import { requestJson } from '../services/api';

type Time = { id: number; nome: string; escudo?: string | null };
type Casca = Time & { categoria: { nome: string; clube_id: number; clube: { nome: string } } | null };
type Jogo = { id: number; data: string; horario?: string | null; status: string; mandante: Time; visitante: Time; categoria: { nome: string } };
export type CascaPrevia = { time: Casca; times: Casca[]; jogos: Jogo[] };

export function ReaproveitarTime({ buscaInicial, onClose, onConfirm }: {
  buscaInicial: string; onClose: () => void; onConfirm: (previa: CascaPrevia) => void;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [lista, setLista] = useState<Casca[] | null>(null);
  const [escolhido, setEscolhido] = useState<Casca | null>(null);
  const [previa, setPrevia] = useState<CascaPrevia | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativa = true;
    setLista(null); setErro('');
    const timer = window.setTimeout(() => {
      requestJson<Casca[]>(`/admin/clubes/cascas?nome=${encodeURIComponent(busca.trim())}`)
        .then(dados => { if (ativa) setLista(dados); })
        .catch(e => { if (ativa) setErro(e.message); });
    }, 230);
    return () => { ativa = false; clearTimeout(timer); };
  }, [busca, tentativa]);

  useEffect(() => {
    if (!escolhido) return;
    let ativa = true;
    setPrevia(null); setErro('');
    requestJson<CascaPrevia>(`/admin/clubes/cascas/${escolhido.id}/previa`)
      .then(dados => { if (ativa) setPrevia(dados); })
      .catch(e => { if (ativa) setErro(e.message); });
    return () => { ativa = false; };
  }, [escolhido, tentativa]);

  const grupos = new Map<string, Casca>();
  for (const time of lista || []) {
    const chave = time.categoria ? `${time.categoria.clube_id}:${time.nome.toLocaleLowerCase('pt-BR')}` : String(time.id);
    if (!grupos.has(chave)) grupos.set(chave, time);
  }
  const subs = [...new Set(previa?.times.flatMap(t => t.categoria ? [t.categoria.nome.toUpperCase()] : []) || [])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const ids = new Set(previa?.times.map(t => t.id));

  return <Modal open title={escolhido ? 'Confirmar time existente' : 'Reaproveitar time existente'} className="club-shell-dialog" onClose={onClose}
    footer={<div className="schedule-review-actions">
      <Btn type="button" variant="ghost" onClick={() => { if (escolhido) { setEscolhido(null); setErro(''); } else onClose(); }}>{escolhido ? 'Voltar à lista' : 'Cancelar'}</Btn>
      {escolhido && <Btn type="button" disabled={!previa} onClick={() => previa && onConfirm(previa)}>Confirmar vínculo</Btn>}
    </div>}>
    {erro && <p className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Btn></p>}
    {!escolhido ? <>
      <p className="club-settings-hint">Selecione um adversário para conferir as categorias e as partidas antes do vínculo.</p>
      <CollectionSearch label="Buscar time existente" placeholder="Nome do time…" value={busca} onChange={setBusca}/>
      {!lista && !erro && <LoadingSkeleton kind="cards"/>}
      {lista && !lista.length && <p>Nenhum time disponível para esta busca.</p>}
      {!!grupos.size && <div className="club-shell-grid">{[...grupos.values()].map(t => <button type="button" className="ticket-card" key={t.id} onClick={() => setEscolhido(t)}>
        <ClubBadge src={t.escudo} name={t.nome} size={40}/><span className="ticket-card-copy"><strong>{t.nome}</strong><small>{t.categoria ? `Cadastro de ${t.categoria.clube.nome}` : 'Time sem categoria'}</small></span><Icon name="chevronRight" size={17}/>
      </button>)}</div>}
    </> : !previa ? !erro && <LoadingSkeleton kind="cards"/> : <>
      <ClubSettingsSection icon="team" title={previa.time.nome} description={previa.time.categoria ? `Cadastro de ${previa.time.categoria.clube.nome}` : 'Time sem categoria'}>
        <div className="club-shell-identity"><ClubBadge src={previa.time.escudo} name={previa.time.nome} size={54}/><ul aria-label="Categorias do time">{subs.length ? subs.map(s => <li key={s}>{s}</li>) : <li>Sem SUB cadastrado</li>}</ul></div>
      </ClubSettingsSection>
      <ClubSettingsSection icon="calendar" title="Últimas partidas" description="Até cinco confrontos já cadastrados para este time.">
        {!previa.jogos.length ? <p className="club-settings-hint">Nenhuma partida cadastrada.</p> : <ul className="club-shell-matches">{previa.jogos.map(j => {
          const adversario = ids.has(j.mandante.id) ? j.visitante : j.mandante;
          return <li key={j.id}><ClubBadge src={adversario.escudo} name={adversario.nome} size={34}/><span><strong>{adversario.nome}</strong><small>{j.categoria.nome.toUpperCase()} · {j.data.slice(0, 10).split('-').reverse().join('/')}{j.horario && ` · ${j.horario}`}</small></span><StatusBadge status={j.status}/></li>;
        })}</ul>}
      </ClubSettingsSection>
    </>}
  </Modal>;
}
