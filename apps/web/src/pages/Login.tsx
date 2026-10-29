import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { AccessFeedback, AuthField, InviteCard, useAccessForm } from '../components/auth';
import { erroEmail } from '../utils/authValidation';
import './Auth.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; message?: string; convite?: string; conviteAberto?: boolean } | null;
  const [email, setEmail] = useState(state?.email ?? '');
  const [senha, setSenha] = useState('');
  const access = useAccessForm();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!access.validate({ email: erroEmail(email), senha: senha ? '' : 'Informe sua senha para entrar.' })) return;
    void access.run(async () => {
      await login(email, senha);
      navigate(state?.convite?.startsWith('/convite/') ? state.convite : '/selecionar-clube', { replace: true });
    });
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre para acompanhar seus clubes, partidas e estatísticas.">
      <AccessFeedback message={access.error} />
      {!access.error && <AccessFeedback message={state?.message ?? ''} success />}
      {state?.convite && <p className="access-note">{state.conviteAberto ? 'Entre na sua conta para continuar com o código de convite.' : 'Entre com o e-mail que recebeu o convite para continuar.'}</p>}
      <form ref={access.formRef} onSubmit={submit} className="auth-form" noValidate>
        <fieldset disabled={access.busy} className="access-fields">
          <AuthField label="E-mail" name="email" type="email" autoComplete="email" maxLength={254}
            placeholder="email@exemplo.com" value={email} onChange={e => { setEmail(e.target.value); access.setError(''); }}
            onBlur={() => access.blur('email')} error={access.feedback('email', erroEmail(email))} />
          <AuthField label="Senha" name="senha" type="password" icon="password" autoComplete="current-password"
            placeholder="Digite sua senha" value={senha} onChange={e => { setSenha(e.target.value); access.setError(''); }}
            error={access.feedback('senha', senha ? '' : 'Informe sua senha para entrar.')}
            action={<Link className="access-text-link" to="/recuperar-senha" state={{ email, convite: state?.convite }}>Esqueceu sua senha?</Link>} />
          <button className="btn btn-primary auth-btn" type="submit" aria-busy={access.busy}>
            {access.busy ? 'Entrando…' : 'Entrar'}
          </button>
        </fieldset>
      </form>
      <p className="auth-link">Não tem conta? <Link to="/registrar" state={{ convite: state?.convite, conviteAberto: state?.conviteAberto }}>Criar conta</Link></p>
      <InviteCard />
    </AuthShell>
  );
}
