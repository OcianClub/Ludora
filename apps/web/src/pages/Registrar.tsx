import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { AccessFeedback, AccessSteps, AuthField, BackArrow, InviteCard, useAccessForm, useResendCountdown } from '../components/auth';
import { cadastrar, solicitarCodigoCadastro } from '../services/auth';
import { codigoValido, erroConfirmacao, erroEmail, erroNome, erroSenha, formatarCodigo, normalizarEmail } from '../utils/authValidation';
import './Auth.css';

const STEPS = ['Seus dados', 'Segurança', 'Confirmar e-mail'];

export default function RegistrarPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [codigo, setCodigo] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; email: string } | null>(null);
  const [notice, setNotice] = useState('');
  const access = useAccessForm();
  const resend = useResendCountdown();

  function changeStep(next: number) {
    access.reset();
    setNotice('');
    setStep(next);
  }

  async function sendCode() {
    const id = await solicitarCodigoCadastro(email);
    setChallenge({ id, email: normalizarEmail(email) });
    setCodigo('');
    resend.start();
    changeStep(3);
    setNotice('Código enviado. Confira também a caixa de spam.');
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (access.validate({ nome: erroNome(nome), email: erroEmail(email) })) changeStep(2);
      return;
    }
    if (step === 2) {
      if (!access.validate({ senha: erroSenha(senha), confirmacao: erroConfirmacao(senha, confirmacao) })) return;
      if (challenge?.email === normalizarEmail(email)) changeStep(3);
      else void access.run(sendCode);
      return;
    }
    if (!access.validate({ codigo: codigoValido(codigo) ? '' : 'Informe os 8 caracteres do código recebido por e-mail.' })) return;
    if (!challenge || challenge.email !== normalizarEmail(email)) { changeStep(1); return; }
    void access.run(async () => {
      await cadastrar({ nome, email, senha, codigo, cadastro_id: challenge.id });
      setSenha('');
      setConfirmacao('');
      navigate('/login', { replace: true, state: { email: normalizarEmail(email), message: 'Conta criada e e-mail confirmado. Entre para continuar.' } });
    });
  }

  return (
    <AuthShell
      title={step === 1 ? 'Crie sua conta' : step === 2 ? 'Proteja sua conta' : 'Confirme seu e-mail'}
      subtitle={step === 1 ? 'Vamos começar pelo seu nome e e-mail.' : step === 2 ? 'Escolha uma senha para acessar o Ludora.' : 'Informe os 8 caracteres recebidos por e-mail. O código vale por 15 minutos.'}
      back={step > 1
        ? <button type="button" className="access-back" aria-label="Voltar à etapa anterior" disabled={access.busy} onClick={() => changeStep(step - 1)}><BackArrow /></button>
        : <Link className="access-back" to="/login" aria-label="Voltar para o login"><BackArrow /></Link>}
      progress={<AccessSteps step={step} labels={STEPS} />}
    >
      <AccessFeedback message={access.error} />
      {!access.error && <AccessFeedback message={notice} success />}
      {step > 1 && (
        <div className="access-summary">
          <span><small>Sua conta</small><strong>{email}</strong></span>
          <button className="access-text-link" disabled={access.busy} onClick={() => changeStep(1)}>Editar e-mail</button>
        </div>
      )}
      <form ref={access.formRef} onSubmit={submit} className="auth-form" noValidate>
        <fieldset className="access-fields" disabled={access.busy}>
          {step === 1 && <>
            <AuthField label="Nome completo" icon="user" name="nome" autoComplete="name" maxLength={100}
              placeholder="Como você quer ser chamado?" value={nome} onChange={e => setNome(e.target.value)}
              onBlur={() => access.blur('nome')} error={access.feedback('nome', erroNome(nome))} />
            <AuthField label="E-mail" name="email" type="email" autoComplete="email" maxLength={254}
              placeholder="email@exemplo.com" value={email} onChange={e => { setEmail(e.target.value); setChallenge(null); }}
              onBlur={() => access.blur('email')} error={access.feedback('email', erroEmail(email))} />
          </>}
          {step === 2 && <>
            <AuthField label="Crie uma senha" icon="password" name="senha" type="password" autoComplete="new-password" maxLength={128}
              placeholder="Pelo menos 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)}
              onBlur={() => access.blur('senha')} error={access.feedback('senha', erroSenha(senha))} hint="Use pelo menos 8 caracteres. Evite senhas fáceis de adivinhar." />
            <AuthField label="Confirme sua senha" icon="password" name="confirmacao" type="password" autoComplete="new-password" maxLength={128}
              placeholder="Digite a senha novamente" value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
              onBlur={() => access.blur('confirmacao')} error={access.feedback('confirmacao', erroConfirmacao(senha, confirmacao))} />
          </>}
          {step === 3 && <AuthField label="Código de confirmação" name="codigo" icon="code" autoComplete="one-time-code" spellCheck={false}
            className="access-code" placeholder="ABCD-2345" maxLength={9} value={codigo} onChange={e => setCodigo(formatarCodigo(e.target.value))}
            error={access.feedback('codigo', codigoValido(codigo) ? '' : 'Informe os 8 caracteres do código recebido por e-mail.')} />}
          <button className="btn btn-primary auth-btn" type="submit" aria-busy={access.busy}>
            {access.busy ? 'Aguarde…' : step === 1 ? 'Continuar' : step === 2 ? 'Enviar código de confirmação' : 'Confirmar e criar conta'}
          </button>
        </fieldset>
      </form>
      {step === 3 && <button type="button" className="access-resend" disabled={access.busy || resend.seconds > 0} onClick={() => void access.run(sendCode)}>
        {resend.seconds ? `Reenviar código em ${resend.seconds}s` : 'Não recebeu? Reenviar código'}
      </button>}
      <p className="auth-link">Já tem conta? <Link to="/login">Entrar</Link></p>
      <InviteCard />
    </AuthShell>
  );
}
