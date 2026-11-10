import { FilterSelect } from '@web/components/FilterSelect';
import { useEffect, useState } from 'react';
import { Btn, Input, Spinner } from './AdminUI';
import { requestJson } from '../services/api';
type Convite = { id: string; destinatario: string; status: string; criadoEm: string; podeReenviar: boolean };
type Data = { provedorConfigurado: boolean; conta: { id: number; destinatario: string; recuperacao: string } | null; acoes: { requestId: string; tipo: string; resultado: string; criadoEm: string }[]; recuperacoes: { id: string; status: string; novoEmail: string; justificativa: string; solicitanteId: number }[] };
const legivel = (s: string) => s.replace(/_/g, ' ').toLowerCase();
export default function SupportOperations({ id, admin }: { id: string; admin: boolean }) {
  const [dados, setDados] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState('');
  const [convite, setConvite] = useState('');
  const [emailConvite, setEmailConvite] = useState('');
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [novoEmail, setNovoEmail] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [verificacao, setVerificacao] = useState('');
  const base = `/admin/equipe/chamados/${id}/operacoes`;
  async function carregar() { setDados(await requestJson<Data>(base)); }
  useEffect(() => { setDados(null); setConvite(''); setResultado(''); void carregar().catch(e => setErro(e.message)); }, [id]);
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
  return <section className="support-operations"><h3>Atendimento guiado</h3>{erro && <p role="alert" className="notice-error">{erro}</p>}{resultado && <p role="status">Resultado: {resultado}</p>}
    {!dados ? <Spinner/> : <><p>Verificado: {dados.provedorConfigurado ? 'provedor configurado. Aceite do provedor não comprova entrega na caixa de entrada.' : 'envio indisponível: provedor não configurado.'}</p>
      <details><summary>Convite não recebido</summary><p>Confira o destinatário com o cliente. O reenvio invalida o código anterior e mantém o mesmo convite. Limite de três tentativas por dia e uma por minuto.</p>
        <Input label="E-mail usado no convite" type="email" value={emailConvite} disabled={busy} onChange={e => { setEmailConvite(e.target.value); setConvite(''); setConvites(null); }}/>
        <Btn variant="ghost" disabled={busy || !emailConvite.includes('@')} onClick={() => void localizar()}>Localizar convite</Btn>
        {convites && <FilterSelect label="Convite do clube" value={convite} emptyLabel="Escolha o convite" options={convites.map(c => ({ value: c.id, label: `${c.destinatario} · ${legivel(c.status)} · ${new Date(c.criadoEm).toLocaleDateString('pt-BR')}` }))} onChange={setConvite}/> }
        {convites?.length === 0 && <p>Nenhum convite encontrado para este clube.</p>}
        <Btn disabled={busy || !alvo?.podeReenviar || !dados.provedorConfigurado} onClick={() => void agir('/envio', { tipo: 'CONVITE', alvoId: convite, requestId: crypto.randomUUID() })}>Reenviar convite</Btn>
      </details>
      {dados.conta && <details><summary>Recuperação de acesso</summary><p>Conta do solicitante: {dados.conta.destinatario}. Recuperação: {dados.conta.recuperacao}.</p><p>O cliente recebe o código e escolhe a senha no fluxo Recuperar senha. A equipe não recebe esse código.</p>
        <Btn disabled={busy || !dados.provedorConfigurado} onClick={() => void agir('/envio', { tipo: 'RECUPERACAO', alvoId: String(dados.conta!.id), requestId: crypto.randomUUID() })}>Enviar recuperação de senha</Btn>
        <h4>Perda de acesso ao e-mail</h4><p>Esta ação é restrita: você solicita, outro administrador verifica a identidade e aprova. O cliente precisa confirmar o novo endereço. A confirmação encerra as sessões anteriores.</p>
        <Input label="Novo e-mail informado pelo cliente" type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}/>
        <Input label="Justificativa, sem documentos ou senhas" value={justificativa} maxLength={2000} onChange={e => setJustificativa(e.target.value)}/>
        <Btn disabled={busy || justificativa.trim().length < 20 || !novoEmail.includes('@')} onClick={() => void agir('/recuperacao-excepcional', { novoEmail, justificativa })}>Solicitar revisão de identidade</Btn>
        {dados.recuperacoes.map(p => <article key={p.id}><p>{p.novoEmail} · {legivel(p.status)}</p><p>{p.justificativa}</p>{admin && ['AGUARDANDO_APROVACAO', 'FALHA_ENVIO', 'EXPIRADA'].includes(p.status) && <>
          <Input label="Como confirmou a identidade por canal independente?" value={verificacao} maxLength={2000} onChange={e => setVerificacao(e.target.value)}/><div className="actions">
          <Btn disabled={busy || verificacao.trim().length < 20} onClick={() => void agir(`/recuperacao-excepcional/${p.id}/decidir`, { verificacao, aprovar: true })}>Aprovar e enviar confirmação</Btn>
          <Btn variant="ghost" disabled={busy || verificacao.trim().length < 20} onClick={() => void agir(`/recuperacao-excepcional/${p.id}/decidir`, { verificacao, aprovar: false })}>Rejeitar solicitação</Btn></div></>}</article>)}
      </details>}
      {!!dados.acoes.length && <details><summary>Resultados dos envios</summary>{dados.acoes.map(a => <p key={a.requestId}>{new Date(a.criadoEm).toLocaleString('pt-BR')} · {legivel(a.tipo)} · {legivel(a.resultado)}</p>)}</details>}
    </>}
  </section>;
}
