import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Card, Input } from '../components/UI';
import { requestJson } from '../services/api';
export default function ConfirmarEmail() {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  return <main style={{ maxWidth: 520, margin: '8vh auto', padding: 20 }}><Card><h1>Confirmar novo e-mail</h1><p>Use o código recebido após a revisão de identidade pelo suporte.</p>
    <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setErro(''); try { const r = await requestJson<{ mensagem: string }>('/auth/confirmar-troca-email', { method: 'POST', body: JSON.stringify({ email, codigo }) }); setMensagem(r.mensagem); setCodigo(''); } catch (e) { setErro((e as Error).message); } finally { setBusy(false); } }}>
      <Input label="Novo e-mail" type="email" required value={email} onChange={e => setEmail(e.target.value)}/><Input label="Código recebido" autoComplete="one-time-code" required value={codigo} onChange={e => setCodigo(e.target.value)} maxLength={43}/>
      {erro && <p role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}<Btn type="submit" disabled={busy || !!mensagem}>{busy ? 'Confirmando…' : 'Confirmar endereço'}</Btn>
    </form><Link to="/recuperar-senha">Recuperar senha</Link> · <Link to="/login">Voltar ao login</Link></Card></main>;
}
