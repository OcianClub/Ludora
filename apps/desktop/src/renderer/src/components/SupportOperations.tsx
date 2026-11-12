import { FilterSelect } from '@web/components/FilterSelect';
import { useEffect, useState } from 'react';
import { Btn, Input, Spinner } from './AdminUI';
import { requestJson } from '../services/api';
type Convite = { id: string; destinatario: string; status: string; criadoEm: string; podeReenviar: boolean };
type Data = { provedorConfigurado: boolean; conta: { id: number; destinatario: string; recuperacao: string } | null; acoes: { requestId: string; tipo: string; resultado: string; criadoEm: string }[]; recuperacoes: { id: string; status: string; novoEmail: string; justificativa: string; solicitanteId: number }[] };
const legivel = (s: string) => s.replace(/_/g, ' ').toLowerCase();
export default function SupportOperations({ id, admin, tipo, temClube }: { id: string; admin: boolean; tipo: string; temClube: boolean }) {
  const [dados, setDados] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState('');
  const [convite, setConvite] = useState('');
  const [emailConvite, setEmailConvite] = useState('');
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [novoEmail, setNovoEmail] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [verificacoes, setVerificacoes] = useState<Record<string, string>>({});
  const base = `/admin/equipe/chamados/${id}/operacoes`;
  async function carregar() {
    setErro('');
    try { setDados(await requestJson<Data>(base)); }
    catch (e) { setErro((e as Error).message); }
  }
  useEffect(() => { void carregar(); }, [id]);
  async function agir(path: string, body: object) {
    if (busy) return;
    setBusy(true); setErro(''); setResultado('');
    try { const r = await requestJson<{ resultado?: string }>(base + path, { method: 'POST', body }); setResultado(r.resultado ? legivel(r.resultado) : 'Solicitação registrada para análise.'); await carregar(); }
    catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  async function localizar() {
    setBusy(true); setErro(''); setConvite(''); setConvites(null);
    try { setConvites(await requestJson<Convite[]>(`${base}/convites/localizar`, { method: 'POST', body: { email: emailConvite } })); }
    catch (e) { setErro((e as Error).message); } finally { setBusy(false); }
  }
  const alvo = convites?.find(c => c.id === convite);
  return <div className="support-operations">{erro && <p role="alert" className="notice-error">{erro}</p>}{resultado && <p role="status">Resultado: {resultado}</p>}
    {!dados ? erro ? <Btn size="sm" variant="ghost" onClick={() => void carregar()}>Tentar novamente</Btn> : <Spinner/> : <>
      <p className="ticket-provider">{dados.provedorConfigurado ? 'Provedor de e-mail configurado. A aceitação do envio não confirma a entrega.' : 'Envio indisponível. Provedor de e-mail não configurado.'}</p>
      {temClube && <details open={tipo === 'CONVITE'}>
        <summary>Convite não recebido</summary>
        <p>O reenvio invalida o código anterior. Limite de três tentativas por dia e uma por minuto.</p>
        <Input label="E-mail usado no convite" type="email" value={emailConvite} disabled={busy} onChange={e => { setEmailConvite(e.target.value); setConvite(''); setConvites(null); }}/>
        <Btn variant="ghost" disabled={busy || !emailConvite.includes('@')} onClick={() => void localizar()}>Localizar convite</Btn>
        {convites && <FilterSelect label="Convite do clube" value={convite} emptyLabel="Escolha o convite" options={convites.map(c => ({ value: c.id, label: `${c.destinatario} · ${legivel(c.status)} · ${new Date(c.criadoEm).toLocaleDateString('pt-BR')}` }))} onChange={setConvite}/> }
        {convites?.length === 0 && <p>Nenhum convite encontrado para este clube.</p>}
        <Btn disabled={busy || !alvo?.podeReenviar || !dados.provedorConfigurado} onClick={() => void agir('/envio', { tipo: 'CONVITE', alvoId: convite, requestId: crypto.randomUUID() })}>Reenviar convite</Btn>
      </details>}
      {dados.conta && <details open={tipo === 'RECUPERACAO' || tipo === 'SEGURANCA'}><summary>Recuperação de acesso</summary><p>Conta do solicitante: {dados.conta.destinatario}. Recuperação: {dados.conta.recuperacao}.</p><p>O cliente recebe o código e escolhe a senha no fluxo Recuperar senha. A equipe não recebe esse código.</p>
        <Btn disabled={busy || !dados.provedorConfigurado} onClick={() => void agir('/envio', { tipo: 'RECUPERACAO', alvoId: String(dados.conta!.id), requestId: crypto.randomUUID() })}>Enviar recuperação de senha</Btn>
        <details><summary>Perda de acesso ao e-mail</summary><p>Outro administrador verifica a identidade e aprova o pedido. O cliente confirma o novo endereço e as sessões anteriores são encerradas.</p>
        <Input label="Novo e-mail informado pelo cliente" type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}/>
        <Input label="Justificativa, sem documentos ou senhas" value={justificativa} maxLength={2000} onChange={e => setJustificativa(e.target.value)}/>
        <Btn disabled={busy || justificativa.trim().length < 20 || !novoEmail.includes('@')} onClick={() => void agir('/recuperacao-excepcional', { novoEmail, justificativa })}>Solicitar revisão de identidade</Btn>
        {dados.recuperacoes.map(p => <article key={p.id}><p>{p.novoEmail} · {legivel(p.status)}</p><p>{p.justificativa}</p>{admin && ['AGUARDANDO_APROVACAO', 'FALHA_ENVIO', 'EXPIRADA'].includes(p.status) && <>
          <Input label="Como confirmou a identidade por canal independente?" value={verificacoes[p.id] || ''} maxLength={2000} onChange={e => setVerificacoes(atual => ({ ...atual, [p.id]: e.target.value }))}/><div className="actions">
          <Btn disabled={busy || (verificacoes[p.id] || '').trim().length < 20} onClick={() => void agir(`/recuperacao-excepcional/${p.id}/decidir`, { verificacao: verificacoes[p.id], aprovar: true })}>Aprovar e enviar confirmação</Btn>
          <Btn variant="ghost" disabled={busy || (verificacoes[p.id] || '').trim().length < 20} onClick={() => void agir(`/recuperacao-excepcional/${p.id}/decidir`, { verificacao: verificacoes[p.id], aprovar: false })}>Rejeitar solicitação</Btn></div></>}</article>)}
        </details>
      </details>}
      {!!dados.acoes.length && <details><summary>Resultados dos envios</summary>{dados.acoes.map(a => <p key={a.requestId}>{new Date(a.criadoEm).toLocaleString('pt-BR')} · {legivel(a.tipo)} · {legivel(a.resultado)}</p>)}</details>}
    </>}
  </div>;
}
