import { useState, type FormEvent } from 'react';
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
  const erroSenha = senha ? '' : 'Informe sua senha para entrar.';

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access.validate({ email: erroEmail(email), senha: erroSenha })) return;
    void access.run(() => entrar(email, senha));
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre com sua conta Super Admin para gerenciar a plataforma Ludora."
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
    </AuthShell>
  );
}
