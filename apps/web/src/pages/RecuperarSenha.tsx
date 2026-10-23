import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { AccessFeedback, AccessSteps, AuthField, BackArrow, useAccessForm, useResendCountdown } from '../components/auth';
import { redefinirSenha, solicitarCodigoSenha } from '../services/auth';
import { codigoValido, erroConfirmacao, erroEmail, erroSenha, formatarCodigo } from '../utils/authValidation';
import './Auth.css';

export default function RecuperarSenhaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; convite?: string } | null;
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(state?.email ?? '');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [notice, setNotice] = useState('');
  const access = useAccessForm();
  const resend = useResendCountdown();

  async function send() {
    await solicitarCodigoSenha(email);
    resend.start();
    setCodigo('');
    access.reset();
    setStep(2);
    setNotice('Se houver uma conta com esse e-mail, enviaremos um código. Confira também a caixa de spam.');
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (access.validate({ email: erroEmail(email) })) void access.run(send);
      return;
    }
    if (!access.validate({
      codigo: codigoValido(codigo) ? '' : 'Informe os 8 caracteres recebidos por e-mail.',
      senha: erroSenha(senha),
      confirmacao: erroConfirmacao(senha, confirmacao),
    })) return;
    void access.run(async () => {
      await redefinirSenha(email, codigo, senha);
      setSenha('');
      setConfirmacao('');
      navigate('/login', { replace: true, state: { email, convite: state?.convite, message: 'Senha alterada. Entre com sua nova senha.' } });
    });
  }

  return (
    <AuthShell
      title={step === 1 ? 'Esqueceu sua senha?' : 'Crie uma nova senha'}
      subtitle={step === 1 ? 'Informe o e-mail da sua conta para receber um código de recuperação.' : 'Use o código recebido por e-mail e escolha sua nova senha. Ele vale por 15 minutos.'}
      back={step === 1 ? <Link className="access-back" to="/login" aria-label="Voltar para o login" state={{ convite: state?.convite }}><BackArrow /></Link> : (
        <button type="button" className="access-back" aria-label="Voltar à etapa anterior" disabled={access.busy} onClick={() => { setStep(1); access.reset(); setNotice(''); }}><BackArrow /></button>
      )}
      progress={<AccessSteps step={step} labels={['Seu e-mail', 'Nova senha']} />}
    >
      <AccessFeedback message={access.error} />
      {!access.error && <AccessFeedback message={notice} success />}
      {step === 2 && <p className="access-note">Código solicitado para <strong>{email}</strong>.</p>}
      <form className="auth-form" ref={access.formRef} onSubmit={submit} noValidate>
        <fieldset className="access-fields" disabled={access.busy}>
          {step === 1 ? (
            <AuthField label="E-mail" name="email" type="email" maxLength={254} autoComplete="email"
              value={email} placeholder="email@exemplo.com" onChange={e => setEmail(e.target.value)}
              onBlur={() => access.blur('email')} error={access.feedback('email', erroEmail(email))} />
          ) : <>
            <AuthField label="Código de recuperação" name="codigo" icon="code" autoComplete="one-time-code"
              className="access-code" spellCheck={false} maxLength={9} placeholder="ABCD-2345"
              value={codigo} onChange={e => setCodigo(formatarCodigo(e.target.value))}
              error={access.feedback('codigo', codigoValido(codigo) ? '' : 'Informe os 8 caracteres recebidos por e-mail.')} />
            <AuthField label="Nova senha" name="senha" type="password" icon="password" autoComplete="new-password"
              maxLength={128} placeholder="Pelo menos 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)}
              onBlur={() => access.blur('senha')} error={access.feedback('senha', erroSenha(senha))} />
            <AuthField label="Confirme a nova senha" name="confirmacao" type="password" icon="password" autoComplete="new-password"
              maxLength={128} placeholder="Digite a nova senha novamente" value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
              onBlur={() => access.blur('confirmacao')} error={access.feedback('confirmacao', erroConfirmacao(senha, confirmacao))} />
          </>}
          <button className="btn btn-primary auth-btn" type="submit" aria-busy={access.busy}>
            {access.busy ? 'Aguarde…' : step === 1 ? 'Enviar código de recuperação' : 'Salvar nova senha'}
          </button>
        </fieldset>
      </form>
      {step === 2 && <button className="access-resend" disabled={access.busy || resend.seconds > 0} onClick={() => void access.run(send)}>
        {resend.seconds ? `Reenviar código em ${resend.seconds}s` : 'Reenviar código'}
      </button>}
      <p className="auth-link"><Link to="/login" state={{ email, convite: state?.convite }}>Voltar para o login</Link></p>
    </AuthShell>
  );
}
