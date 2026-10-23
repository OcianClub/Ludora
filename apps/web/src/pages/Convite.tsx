import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthShell } from '../components/AuthShell';
import { ClubBadge } from '../components/Brand';
import { AccessFeedback, AuthField, BackArrow, useAccessForm } from '../components/auth';
import { useAuth } from '../contexts/AuthContext';
import { aceitarConvite, aceitarConviteExistente, consultarConvite, type Convite, type ResultadoConvite } from '../services/auth';
import { AuthError } from '../services/authHttp';
import { codigoValido, erroConfirmacao, erroNome, erroSenha, formatarCodigo } from '../utils/authValidation';
import './Auth.css';

const ROLES: Record<string, string> = { ADMIN: 'Administrador', TECNICO: 'Técnico', MESARIO: 'Mesário' };

export default function ConvitePage() {
  const { codigo: credential } = useParams();
  const location = useLocation();
  const byToken = location.pathname.startsWith('/convite/token/');
  const navigate = useNavigate();
  const { token, usuario, iniciarSessao, definirClube } = useAuth();
  const [codigo, setCodigo] = useState('');
  const [convite, setConvite] = useState<Convite | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [help, setHelp] = useState(false);
  const [accepted, setAccepted] = useState<ResultadoConvite | null>(null);
  const access = useAccessForm();

  useEffect(() => {
    let active = true;
    setConvite(null);
    setAccepted(null);
    setSenha('');
    setConfirmacao('');
    setLoadError('');
    access.reset();
    if (!credential) { setLoading(false); return; }
    setLoading(true);
    consultarConvite(credential, byToken)
      .then(result => { if (active) setConvite(result); })
      .catch(error => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [credential, byToken, version]);

  function finish(result: ResultadoConvite) {
    // O convite é consumido no servidor antes de persistir a sessão local.
    setAccepted(result);
    setSenha('');
    setConfirmacao('');
    try {
      const sessionToken = result.token ?? token;
      if (!sessionToken) throw new Error();
      iniciarSessao({ token: sessionToken, usuario: result.usuario });
      definirClube({ ...result.clube, meuPapel: result.clube.papel, isSeguindo: true });
    } catch {
      access.setError('Convite aceito, mas não conseguimos salvar o acesso neste navegador. Entre novamente para acessar o clube.');
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!credential) {
      if (access.validate({ codigo: codigoValido(codigo) ? '' : 'Digite ou cole os 8 caracteres recebidos por e-mail.' })) {
        navigate(`/convite/${encodeURIComponent(codigo)}`);
      }
      return;
    }
    if (!convite) return;
    if (convite.possui_conta) {
      if (!token) {
        navigate('/login', { state: { convite: location.pathname } });
        return;
      }
      void access.run(async () => finish(await aceitarConviteExistente(credential, byToken, token)));
    } else {
      if (!access.validate({ nome: erroNome(nome), senha: erroSenha(senha), confirmacao: erroConfirmacao(senha, confirmacao) })) return;
      void access.run(async () => {
        try {
          finish(await aceitarConvite(credential, byToken, { nome: nome.trim(), senha }));
        } catch (error) {
          if (error instanceof AuthError && error.code === 'CONTA_EXISTENTE') {
            setConvite({ ...convite, possui_conta: true });
            setSenha('');
            setConfirmacao('');
          }
          throw error;
        }
      });
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!codigoValido(text)) throw new Error();
      setCodigo(formatarCodigo(text));
      access.setError('');
    } catch {
      access.setError('Não foi possível colar um código válido. Digite os 8 caracteres ou use Ctrl+V no campo.');
    }
  }

  return (
    <AuthShell
      title={accepted ? 'Você faz parte do time' : credential ? 'Seu convite para o clube' : 'Entrar em um clube'}
      subtitle={accepted ? 'Convite aceito com sucesso. Seu acesso ao clube está pronto.' : credential ? 'Confira o clube e as permissões antes de continuar.' : 'Digite ou cole os 8 caracteres do código recebido por e-mail.'}
      back={<Link className="access-back" to={credential ? '/convite' : '/login'} aria-label={credential ? 'Voltar para inserir outro código' : 'Voltar para o login'}><BackArrow /></Link>}
    >
      <AccessFeedback message={access.error || loadError} />
      {accepted ? <>
        <div className="access-club"><ClubBadge src={accepted.clube.escudo} size={56} /><div><h2>{accepted.clube.nome}</h2><p>{ROLES[accepted.clube.papel] || accepted.clube.papel}</p></div></div>
        <Link className="btn btn-primary auth-btn" to={access.error ? '/login' : '/dashboard'} replace>{access.error ? 'Entrar novamente' : 'Acessar clube'}</Link>
      </> : loading ? <div role="status" className="access-loading"><span className="spinner" />Consultando convite…</div> : loadError ? (
        <div className="access-fields">
          <button className="btn btn-primary auth-btn" onClick={() => setVersion(current => current + 1)}>Tentar novamente</button>
          <Link className="access-resend" to="/convite">Usar outro código</Link>
        </div>
      ) : (
        <form ref={access.formRef} className="auth-form" onSubmit={submit} noValidate>
          <fieldset className="access-fields" disabled={access.busy}>
            {!credential ? <>
              <AuthField label="Código do convite" name="codigo" icon="code" autoComplete="one-time-code" spellCheck={false}
                className="access-code" value={codigo} maxLength={9} placeholder="ABCD-2345" onChange={e => setCodigo(formatarCodigo(e.target.value))}
                action={<button type="button" className="access-text-link" onClick={() => void paste()}>Colar código</button>}
                error={access.feedback('codigo', codigoValido(codigo) ? '' : 'Digite ou cole os 8 caracteres recebidos por e-mail.')} />
            </> : convite && <>
              <section className="access-invitation" aria-label="Dados do convite">
                <div className="access-club"><ClubBadge src={convite.clube.escudo} size={52} /><div><h2>{convite.clube.nome}</h2><p>{[convite.clube.cidade, convite.clube.estado].filter(Boolean).join(' · ')}</p></div></div>
                <dl>
                  <div><dt>Seu papel</dt><dd>{ROLES[convite.papel] || convite.papel}</dd></div>
                  <div><dt>Categorias</dt><dd>{convite.acesso_todas_categorias ? 'Todas as categorias' : convite.categorias.map(c => c.nome).join(', ')}</dd></div>
                  <div><dt>Enviado para</dt><dd>{convite.email}</dd></div>
                  <div><dt>Convidado por</dt><dd>{convite.convidado_por}</dd></div>
                  <div><dt>Válido até</dt><dd>{new Date(convite.expira_em).toLocaleString('pt-BR')}</dd></div>
                </dl>
              </section>
              {convite.possui_conta ? <>
                <p className="access-note">{token ? `Você está conectado como ${usuario?.email || 'usuário'}. O convite deve pertencer a esse e-mail.` : 'Você já tem uma conta. Entre com o e-mail que recebeu o convite para aceitar.'}</p>
                {token && <Link className="access-text-link" to="/login" state={{ convite: location.pathname }}>Entrar com outra conta</Link>}
              </> : <>
                <p className="access-note">Crie sua conta usando o e-mail deste convite. Não é necessário solicitar outro código.</p>
                <AuthField label="Nome completo" name="nome" icon="user" autoComplete="name" maxLength={100}
                  value={nome} onChange={e => setNome(e.target.value)} onBlur={() => access.blur('nome')}
                  error={access.feedback('nome', erroNome(nome))} />
                <AuthField label="Crie uma senha" name="senha" icon="password" type="password" autoComplete="new-password" maxLength={128}
                  value={senha} placeholder="Pelo menos 8 caracteres" onChange={e => setSenha(e.target.value)} onBlur={() => access.blur('senha')}
                  error={access.feedback('senha', erroSenha(senha))} />
                <AuthField label="Confirme sua senha" name="confirmacao" icon="password" type="password" autoComplete="new-password" maxLength={128}
                  value={confirmacao} onChange={e => setConfirmacao(e.target.value)} onBlur={() => access.blur('confirmacao')}
                  error={access.feedback('confirmacao', erroConfirmacao(senha, confirmacao))} />
              </>}
            </>}
            <button className="btn btn-primary auth-btn" type="submit" aria-busy={access.busy}>
              {access.busy ? 'Aguarde…' : !credential ? 'Consultar convite' : convite?.possui_conta ? token ? 'Aceitar convite' : 'Entrar para aceitar' : 'Criar conta e aceitar convite'}
            </button>
          </fieldset>
        </form>
      )}
      {!credential && <>
        <button className="access-resend" aria-expanded={help} aria-controls="invite-help" onClick={() => setHelp(current => !current)}>Ainda não recebi um convite</button>
        {help && <p className="access-note" id="invite-help">Peça a um administrador do clube para enviar o convite ao seu e-mail. Confira a caixa de entrada e o spam. Se ele expirou, solicite um novo envio.</p>}
      </>}
    </AuthShell>
  );
}
