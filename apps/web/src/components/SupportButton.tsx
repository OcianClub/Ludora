import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { novoRequestId } from '../services/requestId';
import { requestJson } from '../services/api';
import { CollectionViewToggle } from './CollectionToolbar';
import { FilterSelect } from './FilterSelect';
import { Btn, Input, Modal, Spinner } from './UI';
import { Icon } from './Icon';
import './SupportButton.css';

export const SUPPORT_STATUS: Record<string, string> = {
  NOVO: 'Novo', EM_TRIAGEM: 'Em triagem', AGUARDANDO_CLIENTE: 'Aguardando sua resposta', EM_ANDAMENTO: 'Em andamento',
  ENCAMINHADO_DEVS: 'Com os desenvolvedores', RESOLVIDO: 'Resolvido', REABERTO: 'Reaberto',
};
const tipos = [{ value: 'CONVITE', label: 'Convite' }, { value: 'RECUPERACAO', label: 'Recuperação de acesso' }, { value: 'SEGURANCA', label: 'Segurança' }, { value: 'CONFIGURACAO', label: 'Configuração' }, { value: 'DUVIDA', label: 'Dúvida' }, { value: 'ERRO', label: 'Erro no sistema' }, { value: 'OUTRO', label: 'Outro' }];
const impactos = [{ value: 'DUVIDA', label: 'Tenho uma dúvida' }, { value: 'DIFICULDADE', label: 'Consigo usar com dificuldade' }, { value: 'OPERACAO_BLOQUEADA', label: 'Não consigo concluir a ação' }];
type Chamado = { id: string; assunto: string; status: string; criadoEm: string; historico?: { motivo: string; criadoEm: string }[] };
const vazio = { assunto: '', descricao: '', tipo: 'OUTRO', impacto: 'DIFICULDADE' };
const versao = import.meta.env.VITE_APP_VERSION || 'desenvolvimento';
const data = (valor: string) => new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function SupportButton({ variant = 'menu' }: { variant?: 'sidebar' | 'menu' }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  if (!token) return null;
  return <>
    <button type="button" className={`support-trigger ${variant === 'sidebar' ? 'nav-item' : 'mobile-more-item'}`}
      aria-label="Suporte e ajuda" aria-haspopup="dialog" data-tooltip="Suporte e ajuda" data-tooltip-icon-only onClick={() => setOpen(true)}>
      <span className={variant === 'sidebar' ? 'nav-icon' : 'mobile-more-item-icon'}><Icon name="headset" /></span>
      <span className={variant === 'sidebar' ? 'nav-label' : undefined}>Suporte e ajuda</span>
      {variant === 'menu' && <Icon name="chevronRight" size={18} />}
    </button>
    <SupportDialog open={open} onClose={() => setOpen(false)} />
  </>;
}

export function SupportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, clubeSelecionado } = useAuth();
  const { pathname } = useLocation();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lista, setLista] = useState<Chamado[]>([]);
  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [aba, setAba] = useState<'novo' | 'historico'>('novo');
  const [resposta, setResposta] = useState('');
  const [form, setForm] = useState(vazio);
  const [requestId, setRequestId] = useState(() => novoRequestId());
  const [reload, setReload] = useState(0);
  const detailRequest = useRef<AbortController>();
  const contexto = `${token}:${clubeSelecionado?.id || ''}`;
  const contextoAnterior = useRef(contexto);
  useEffect(() => {
    if (contextoAnterior.current === contexto) return;
    contextoAnterior.current = contexto;
    detailRequest.current?.abort();
    setForm(vazio); setLista([]); setDetalhe(null); setResposta(''); setError(''); setMessage('');
    setRequestId(novoRequestId()); setAba('novo'); onClose();
  }, [contexto]);
  // Visitantes relatam problemas da própria conta, sem alegar vínculo com o clube visitado.
  const semClube = !clubeSelecionado?.meuPapel;
  const pagina = location.origin + pathname;
  useEffect(() => {
    if (!open) { detailRequest.current?.abort(); setLoading(false); return; }
    setError(''); setMessage('');
  }, [open]);
  useEffect(() => {
    if (!open || aba !== 'historico' || detalhe || !token) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    requestJson<Chamado[]>('/suporte', { cache: 'no-store', signal: controller.signal, semClube })
      .then(value => { if (!controller.signal.aborted) setLista(value); })
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, aba, detalhe, reload, token, semClube]);
  useEffect(() => () => detailRequest.current?.abort(), []);
  if (!token) return null;

  function fechar() { if (!busy) onClose(); }
  async function copiarPagina() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(pagina); setMessage('Endereço copiado.');
    } catch { setError('Não foi possível copiar o endereço.'); }
  }
  function trocarAba(value: string) {
    if (busy) return;
    detailRequest.current?.abort();
    setLoading(false); setError(''); setMessage(''); setDetalhe(null); setResposta('');
    setAba(value === 'novo' ? 'novo' : 'historico');
  }
  async function enviar(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (form.assunto.trim().length < 3 || form.descricao.trim().length < 10 || !form.tipo || !form.impacto) {
      setError('Informe um assunto com pelo menos 3 caracteres e descreva o ocorrido em pelo menos 10 caracteres.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const chamado = await requestJson<Chamado>('/suporte', { method: 'POST', semClube, body: JSON.stringify({ ...form, assunto: form.assunto.trim(), descricao: form.descricao.trim(), requestId, rota: pathname, versao }) });
      setMessage('Chamado enviado. Acompanhe as respostas por aqui.');
      setLista(atual => [chamado, ...atual.filter(item => item.id !== chamado.id)]);
      setDetalhe(chamado); setAba('historico');
      setForm(vazio); setRequestId(novoRequestId());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function consultar(chamado: Chamado) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setError(''); setMessage(''); setLoading(true);
    try {
      const value = await requestJson<Chamado>(`/suporte/${chamado.id}`, { cache: 'no-store', semClube, signal: controller.signal });
      if (!controller.signal.aborted) { setDetalhe(value); setResposta(''); }
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function responder(event: React.FormEvent) {
    event.preventDefault(); if (busy || !detalhe || resposta.trim().length < 5) return;
    setBusy(true); setError('');
    try {
      await requestJson(`/suporte/${detalhe.id}/responder`, { method: 'POST', semClube, body: JSON.stringify({ mensagem: resposta.trim() }) });
      setResposta('');
      const atualizado = await requestJson<Chamado>(`/suporte/${detalhe.id}`, { cache: 'no-store', semClube });
      setDetalhe(atualizado);
      setLista(atual => atual.map(item => item.id === atualizado.id ? atualizado : item));
      setMessage('Resposta enviada.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <Modal open={open} title="Suporte e ajuda" className="support-dialog" onClose={fechar}
    footer={aba === 'novo' ? <div className="support-actions"><Btn variant="ghost" disabled={busy} onClick={fechar}>Cancelar</Btn><Btn type="submit" form={`${id}-novo`} disabled={busy}>{busy ? 'Enviando…' : 'Enviar chamado'}<Icon name="arrow" size={16} /></Btn></div> : undefined}>
    <CollectionViewToggle label="Atendimento" value={aba} onChange={trocarAba} className="support-tabs"
      options={[{ value: 'novo', label: 'Novo chamado', icon: 'plus' }, { value: 'historico', label: 'Meus chamados', icon: 'clock' }]} />
    {error && <p className="support-feedback support-error" role="alert"><Icon name="alert" size={18} />{error}</p>}
    {message && <p className="support-feedback support-success" role="status"><Icon name="checkAll" size={18} />{message}</p>}
    {aba === 'novo' ? <>
      <div className="support-intro"><strong>Como podemos ajudar?</strong><p>Conte o que tentou fazer e o que aconteceu.</p></div>
      <form id={`${id}-novo`} onSubmit={enviar} className="support-form" aria-busy={busy}>
        <fieldset disabled={busy}>
          <Input label="Assunto" placeholder="Resuma o que você precisa" value={form.assunto} required minLength={3} maxLength={120} onChange={e => setForm({ ...form, assunto: e.target.value })} />
          <div className="field"><label className="field-label" htmlFor={`${id}-descricao`}>O que aconteceu?</label><textarea id={`${id}-descricao`} className="field-input" rows={4} required minLength={10} maxLength={4000} placeholder="Descreva os passos e o resultado que você esperava." aria-describedby={`${id}-privacidade`} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="support-selects">
            <FilterSelect overlayInDialog label="Tipo de ajuda" emptyLabel="Escolha um tipo" value={form.tipo} options={tipos} onChange={tipo => setForm({ ...form, tipo })} />
            <FilterSelect overlayInDialog label="Como isso afeta seu uso?" emptyLabel="Selecione o impacto" value={form.impacto} options={impactos} onChange={impacto => setForm({ ...form, impacto })} />
          </div>
        </fieldset>
      </form>
      <div className="support-context"><Icon name="location" size={17} /><div><strong>Página incluída no chamado</strong><span title={pagina}>{pathname}</span></div><button type="button" aria-label="Copiar endereço da página" data-tooltip="Copiar endereço" onClick={() => void copiarPagina()}><Icon name="copy" size={17} /></button></div>
      <p id={`${id}-privacidade`} className="support-privacy"><Icon name="defense" size={16} />Não envie senhas, documentos ou códigos de acesso.</p>
    </> : <>
      <div className="support-history-heading">{detalhe ? <button type="button" className="support-back" disabled={busy} onClick={() => { detailRequest.current?.abort(); setDetalhe(null); setError(''); setMessage(''); }}><Icon name="chevronLeft" size={16} />Meus chamados</button> : <><strong>Seus chamados</strong><button type="button" className="support-back" disabled={loading} onClick={() => setReload(value => value + 1)}><Icon name="refresh" size={16} />Atualizar</button></>}</div>
      {loading && <div className="support-loading" role="status"><Spinner /><span>Carregando atendimento…</span></div>}
      {!loading && !detalhe && !lista.length && !error && <div className="support-empty"><Icon name="headset" size={32} /><strong>Nenhum chamado por aqui</strong><p>Quando precisar de ajuda, abra um chamado.</p><Btn variant="ghost" onClick={() => trocarAba('novo')}>Criar chamado</Btn></div>}
      {!detalhe && lista.length > 0 && <div className="support-tickets" aria-label="Seus chamados">{lista.map(chamado => <button type="button" key={chamado.id} disabled={loading} onClick={() => void consultar(chamado)}><Icon name="headset" size={20} /><span><strong>{chamado.assunto}</strong><small>{data(chamado.criadoEm)}</small><span className={`support-status${chamado.status === 'RESOLVIDO' ? ' is-resolved' : ''}`}>{SUPPORT_STATUS[chamado.status] || chamado.status}</span></span><Icon name="chevronRight" size={16} /></button>)}</div>}
      {detalhe && <section className="support-detail"><header><span className="support-status">{SUPPORT_STATUS[detalhe.status] || detalhe.status}</span><h3>{detalhe.assunto}</h3><small>Protocolo {detalhe.id}</small></header>
        {detalhe.historico && detalhe.historico.length > 0 && <ol className="support-timeline">{detalhe.historico.map((item, index) => <li key={index}><p>{item.motivo}</p><time dateTime={item.criadoEm}>{data(item.criadoEm)}</time></li>)}</ol>}
        <form onSubmit={responder} className="support-form"><div className="field"><label className="field-label" htmlFor={`${id}-resposta`}>Responder ao atendimento</label><textarea className="field-input" id={`${id}-resposta`} rows={3} required minLength={5} maxLength={4000} disabled={busy} value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Acrescente informações ou responda à equipe." /></div><Btn type="submit" disabled={busy || resposta.trim().length < 5}>{busy ? 'Enviando…' : detalhe.status === 'RESOLVIDO' ? 'Reabrir com resposta' : 'Enviar resposta'}</Btn></form>
      </section>}
    </>}
  </Modal>;
}
