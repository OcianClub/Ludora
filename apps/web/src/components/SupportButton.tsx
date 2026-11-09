import { novoRequestId } from '../services/requestId';
import { CollectionViewToggle } from './CollectionToolbar';
import { FilterSelect } from './FilterSelect';
import { useState } from 'react';
import { Btn, Input, Modal } from './UI';
import { Icon } from './Icon';
import { getToken, requestJson } from '../services/api';

export const SUPPORT_STATUS: Record<string, string> = {
  NOVO: 'Novo', EM_TRIAGEM: 'Em triagem', AGUARDANDO_CLIENTE: 'Aguardando cliente', EM_ANDAMENTO: 'Em andamento',
  ENCAMINHADO_DEVS: 'Encaminhado aos desenvolvedores', RESOLVIDO: 'Resolvido', REABERTO: 'Reaberto',
};
const tipos = [{ value: 'CONVITE', label: 'Convite' }, { value: 'RECUPERACAO', label: 'Recuperação de acesso' }, { value: 'SEGURANCA', label: 'Segurança' }, { value: 'CONFIGURACAO', label: 'Configuração' }, { value: 'DUVIDA', label: 'Dúvida' }, { value: 'ERRO', label: 'Erro' }, { value: 'OUTRO', label: 'Outro' }];
type Chamado = { id: string; assunto: string; status: string; criadoEm: string; historico?: { motivo: string; criadoEm: string }[] };
const versao = import.meta.env.VITE_APP_VERSION || 'desenvolvimento';
export default function SupportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lista, setLista] = useState<Chamado[]>([]);
  const [detalhe, setDetalhe] = useState<Chamado | null>(null);
  const [aba, setAba] = useState<'novo' | 'historico'>('novo');
  const [resposta, setResposta] = useState('');
  const [form, setForm] = useState({ assunto: '', descricao: '', tipo: 'OUTRO', impacto: 'DIFICULDADE' });
  const [requestId, setRequestId] = useState(() => novoRequestId());
  const pagina = location.origin + location.pathname;
  if (!getToken()) return null;
  async function abrir() {
    setOpen(true); setError(''); setBusy(true);
    try { setLista(await requestJson('/suporte', { cache: 'no-store' })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function enviar(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const c = await requestJson<Chamado>('/suporte', { method: 'POST', body: JSON.stringify({ ...form, requestId, rota: location.pathname, versao }) });
      setMessage(`Chamado ${c.id} recebido. Você pode acompanhar por aqui.`);
      setAba('historico');
      setLista(atual => [c, ...atual.filter(item => item.id !== c.id)]);
      setForm({ assunto: '', descricao: '', tipo: 'OUTRO', impacto: 'DIFICULDADE' }); setRequestId(novoRequestId());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function consultar(id: string) {
    setError(''); setBusy(true);
    try { setDetalhe(await requestJson(`/suporte/${id}`, { cache: 'no-store' })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="support-trigger" aria-label="Suporte" data-tooltip="Suporte" onClick={() => void abrir()}><Icon name="info" size={20}/></button>
    <Modal open={open} title="Suporte Ludora" onClose={() => { if (!busy) setOpen(false); }}>
      <CollectionViewToggle label="Atendimento" value={aba} onChange={v => setAba(v === 'novo' ? 'novo' : 'historico')}
        options={[{ value: 'novo', label: 'Novo chamado', icon: 'plus' }, { value: 'historico', label: 'Meus chamados', icon: 'clock' }]}/>
      {error && <p className="notice-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      {aba === 'novo' ? <>
      <p>Conte o que tentou fazer e o que aconteceu. Evite incluir senhas, documentos e códigos de acesso.</p>
      <Input label="Página atual" value={pagina} readOnly />
      <p className="dica">Este endereço aparece na barra superior do navegador. A página é incluída automaticamente no chamado.</p>
      <Btn variant="ghost" onClick={() => void navigator.clipboard.writeText(pagina).then(() => setMessage('Endereço copiado.')).catch(() => setError('Selecione o endereço acima e copie pelo teclado.'))}>Copiar endereço</Btn>
      <form onSubmit={enviar} className="auth-form">
        <Input label="Assunto" value={form.assunto} required minLength={3} maxLength={120} onChange={e => setForm({ ...form, assunto: e.target.value })}/>
        <label className="field">O que aconteceu?<textarea className="field-input" rows={4} required minLength={10} maxLength={4000} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}/></label>
        <FilterSelect inlineOptions label="Tipo" emptyLabel="Selecione o tipo" value={form.tipo} options={tipos} onChange={tipo => setForm({ ...form, tipo })}/>
        <FilterSelect inlineOptions label="Impacto" emptyLabel="Selecione o impacto" value={form.impacto} options={[{ value: 'DUVIDA', label: 'Tenho uma dúvida' }, { value: 'DIFICULDADE', label: 'Consigo usar com dificuldade' }, { value: 'OPERACAO_BLOQUEADA', label: 'Não consigo concluir a ação' }]} onChange={impacto => setForm({ ...form, impacto })}/>
        <Btn type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Enviar chamado'}</Btn>
      </form>
      </> : <>
      <h3>Seus chamados</h3>{!busy && !lista.length && <p>Nenhum chamado enviado.</p>}
      {lista.map(c => <div key={c.id}><Btn variant="ghost" disabled={busy} onClick={() => void consultar(c.id)}>{c.assunto} · {SUPPORT_STATUS[c.status]}</Btn><small>{new Date(c.criadoEm).toLocaleString('pt-BR')}</small></div>)}
      {detalhe && <section><h3>{detalhe.assunto}</h3><p>Protocolo {detalhe.id} · {SUPPORT_STATUS[detalhe.status]}</p>{detalhe.historico?.map((h, i) => <p key={i}>{h.motivo} · {new Date(h.criadoEm).toLocaleString('pt-BR')}</p>)}
        <Input label="Responder ao atendimento" value={resposta} maxLength={4000} onChange={e => setResposta(e.target.value)}/>
        <Btn disabled={busy || resposta.trim().length < 5} onClick={async () => {
          setBusy(true); setError('');
          try {
            await requestJson(`/suporte/${detalhe.id}/responder`, { method: 'POST', body: JSON.stringify({ mensagem: resposta }) });
            setResposta(''); await consultar(detalhe.id); setLista(await requestJson('/suporte', { cache: 'no-store' }));
          } catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        }}>{detalhe.status === 'RESOLVIDO' ? 'Reabrir com resposta' : 'Enviar resposta'}</Btn>
      </section>}
      </>}
    </Modal>
  </>;
}
