import { Btn, Input, Modal } from '../components/AdminUI';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthShell } from '@web/components/AuthShell';
import { AccessFeedback } from '@web/components/auth/AccessFeedback';
import { AuthField } from '@web/components/auth/AuthField';
import { useAccessForm } from '@web/components/auth/useAccessForm';
import { erroEmail } from '@web/utils/authValidation';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export default function LoginPage() {
  const { entrar } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const access = useAccessForm();
  const [servidor, setServidor] = useState('');
  const [url, setUrl] = useState('');
  const [configAberta, setConfigAberta] = useState(false);
  const [erroConfig, setErroConfig] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { void window.ludora.config.obter().then(c => setServidor(c.apiUrl)).catch(() => undefined); }, []);
  async function salvarServidor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true); setErroConfig('');
    try {
      const r = await window.ludora.config.definirApiUrl(url);
      if (!r.ok) throw new Error(r.erro);
      setServidor(r.apiUrl); setConfigAberta(false); setSenha(''); access.setError('');
    } catch (e) { setErroConfig((e as Error).message); }
    finally { setSalvando(false); }
  }
  const erroSenha = senha ? '' : 'Informe sua senha para entrar.';

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access.validate({ email: erroEmail(email), senha: erroSenha })) return;
    void access.run(() => entrar(email, senha));
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta de funcionário para acessar a plataforma Ludora."
      footer={
        <button className="btn btn-primary auth-btn" type="submit" form="login-form" disabled={access.busy} aria-busy={access.busy}>
          {access.busy ? 'Entrando…' : 'Entrar'}
        </button>
      }
    >
      <AccessFeedback message={access.error} />
      <form id="login-form" ref={access.formRef} onSubmit={enviar} className="auth-form" noValidate>
        <fieldset disabled={access.busy} className="access-fields">
          <AuthField label="E-mail" name="email" type="email" autoComplete="email" maxLength={254}
            placeholder="email@exemplo.com" value={email}
            onChange={event => { setEmail(event.target.value); access.setError(''); }}
            onBlur={() => access.blur('email')} error={access.feedback('email', erroEmail(email))} />
          <AuthField label="Senha" name="senha" type="password" icon="password" autoComplete="current-password"
            placeholder="Digite sua senha" value={senha}
            onChange={event => { setSenha(event.target.value); access.setError(''); }}
            error={access.feedback('senha', erroSenha)} />
        </fieldset>
      </form>
      <p className="auth-link"><Btn variant="ghost" size="sm" type="button" disabled={access.busy} onClick={() => { setUrl(servidor); setErroConfig(''); setConfigAberta(true); }}>Configurar servidor</Btn></p>
      <Modal open={configAberta} title="Servidor do Ludora" onClose={() => { if (!salvando) setConfigAberta(false); }} className="schedule-review-dialog"
        footer={<div className="schedule-review-actions"><Btn type="submit" form="servidor-login" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar servidor'}</Btn></div>}>
        <form id="servidor-login" className="schedule-review" onSubmit={salvarServidor}>
          <p>Confira o endereço antes de entrar. Use a API local para testes e o servidor oficial para sua conta de trabalho.</p>
          <Input label="Endereço da API" type="url" value={url} required onChange={e => setUrl(e.target.value)}/>
          {erroConfig && <p className="notice-error" role="alert">{erroConfig}</p>}
        </form>
      </Modal>
    </AuthShell>
  );
}
