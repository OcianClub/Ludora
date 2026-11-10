import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PartidaRevisao } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Icon } from '@web/components/Icon';
import { Btn, Modal } from './AdminUI';
import { DesktopSelect } from './DesktopSelect';
import { requestJson } from '../services/api';

type Contexto = { organizador: { id: number; nome: string; ativo: boolean } | null; gestores: { id: number; nome: string; email?: string; papel: string }[]; ultimoEnvio: string | null; disponivelEm: string | null; podeEnviar: boolean };
const data = (s: string) => new Date(s).toLocaleString('pt-BR');

function Lembrete({ partida }: { partida: PartidaRevisao }) {
  const [aberto, setAberto] = useState(false);
  const [ctx, setCtx] = useState<Contexto | null>(null);
  const [gestor, setGestor] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);
  const destinatarios = (ctx?.gestores ?? []).map(g => {
    const cargo = g.papel === 'ADMIN' ? 'Administrador' : 'Técnico';
    const nome = g.nome.trim();
    const label = nome.localeCompare(cargo, 'pt-BR', { sensitivity: 'base' }) === 0 ? nome : `${nome} · ${cargo}`;
    const homonimos = ctx!.gestores.filter(outro => outro.nome.trim().localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0);
    return { value: String(g.id), label: homonimos.length > 1 && g.email ? `${label} · ${g.email}` : label };
  });
  const url = `/admin/overview/partidas/${partida.id}/lembrete`;
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setOcupado(true); setErro('');
    requestJson<Contexto>(url).then(r => { if (ativo) { setCtx(r); setGestor(String(r.gestores[0]?.id ?? '')); } })
      .catch(e => { if (ativo) setErro(e.message); }).finally(() => { if (ativo) setOcupado(false); });
    return () => { ativo = false; };
  }, [aberto, url]);
  async function enviar() {
    if (ocupado || !gestor || !ctx?.podeEnviar) return;
    setOcupado(true); setErro('');
    try {
      await requestJson(url, { method: 'POST', body: { usuarioId: Number(gestor) } });
      setEnviado(true); setCtx({ ...ctx, podeEnviar: false });
    } catch (e) {
      setErro((e as Error).message);
      // Mesmo após uma perda de conexão, consulta o registro antes de permitir novo envio.
      try {
        const atual = await requestJson<Contexto>(url);
        setCtx(atual);
        if (atual.ultimoEnvio && !atual.podeEnviar) { setEnviado(true); setErro(''); }
      } catch { setCtx(null); }
    } finally { setOcupado(false); }
  }
  return <div className="overview-reminder" data-open={aberto}>
    {!aberto ? <Btn variant="ghost" aria-label="Solicitar revisão ao organizador" disabled={!partida.organizador_id} onClick={() => setAberto(true)}><Icon name="bell" size={15}/>Solicitar revisão</Btn> : <>
      {ocupado && !ctx && <p role="status">Consultando responsáveis…</p>}
      {ctx && <><strong>Organizador: {ctx.organizador?.nome ?? 'Não identificado'}</strong>
        {ctx.gestores.length > 0 ? <DesktopSelect label="Gestor destinatário" placeholder="Selecione o responsável" fullWidth showLabel value={gestor} onChange={setGestor} disabled={ocupado || !ctx.podeEnviar}
          options={destinatarios}/> : <p>Nenhum gestor habilitado disponível para esta categoria.</p>}
        {ctx.ultimoEnvio && <small>Último lembrete: {data(ctx.ultimoEnvio)}. Novo envio a partir de {ctx.disponivelEm && data(ctx.disponivelEm)}.</small>}
        <p>O responsável receberá um aviso para conferir e finalizar a súmula, se o jogo já terminou. A partida continuará ativa.</p>
      </>}
      {enviado && <p role="status">Lembrete salvo nas notificações do gestor.</p>}
      {erro && <p role="alert">{erro}</p>}
      <div className="overview-reminder-actions">
        {ctx && !enviado && <Btn variant="ghost" disabled={ocupado || !ctx.podeEnviar || !gestor} onClick={enviar}>{ocupado ? 'Enviando…' : 'Enviar lembrete'}</Btn>}
        <button className="overview-reminder-close" type="button" disabled={ocupado} onClick={() => setAberto(false)}>Fechar opções</button>
      </div>
    </>}
  </div>;
}

export function LiveMatchesReview({ open, onClose, partidas, consultadoEm }: { open: boolean; onClose: () => void; partidas: PartidaRevisao[]; consultadoEm?: string }) {
  return <Modal open={open} title="Revisar partidas ao vivo" className="overview-review-dialog" onClose={onClose}>
    <div className="overview-review-intro"><p className="overview-modal-note">O prazo conta desde a mudança para “Ao vivo”. Sem registro do início, a duração não pode ser confirmada.</p>
    {consultadoEm && <small className="overview-modal-note">Consulta: {data(consultadoEm)}</small>}</div>
    <ul className="overview-old-matches">{partidas.map(p => <li key={p.id}>
      <div className="overview-review-match-main">
      <div className="overview-review-teams"><span><ClubBadge src={p.mandante.escudo} name={p.mandante.nome} size={32}/><strong>{p.mandante.nome}</strong></span><span aria-hidden="true">×</span><span><ClubBadge src={p.visitante.escudo} name={p.visitante.nome} size={32}/><strong>{p.visitante.nome}</strong></span></div>
      <small>{p.categoria.nome} · {p.inicioAoVivo ? `Ao vivo desde ${data(p.inicioAoVivo)}` : 'Início não registrado · duração desconhecida'}</small>
      </div>
      <div className="overview-review-actions"><Lembrete partida={p}/><Link to={`/clubes/${p.organizador_id ?? p.categoria.clube_id}`} onClick={onClose}>Gerenciar clube<Icon name="chevronRight" size={14}/></Link></div>
    </li>)}</ul>
  </Modal>;
}
