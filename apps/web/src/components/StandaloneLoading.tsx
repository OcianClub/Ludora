import { AuthShell } from './AuthShell';
import { Brand } from './Brand';
import { LoadingSkeleton } from './LoadingSkeleton';
import '../pages/Auth.css';
import '../pages/SelecionarClube.css';

export function ClubRowsSkeleton() {
  return <div className="club-picker-loading">
    <span className="loading-skeleton-line" aria-hidden="true" />
    <LoadingSkeleton label="Carregando clubes" count={3} />
  </div>;
}

export function StandaloneLoading({ pathname }: { pathname: string }) {
  if (pathname === '/selecionar-clube') return <div className="selecionar-page" aria-busy="true">
    <header className="selecionar-header"><div className="selecionar-header-inner">
      <Brand /><span className="loading-skeleton-mark" aria-hidden="true" />
    </div></header>
    <main className="selecionar-body">
      <div className="selecionar-intro"><h1>Encontre o seu clube</h1><p>Acesse qualquer clube. Seguir serve para deixar seus favoritos salvos aqui.</p></div>
      <ClubRowsSkeleton />
    </main>
  </div>;

  const register = pathname === '/registrar';
  const login = pathname === '/login';
  const recovery = pathname === '/recuperar-senha';
  const fields = login || register ? 2 : 1;
  return <div aria-busy="true">
    <AuthShell intent={register ? 'register' : login ? 'login' : undefined}
      title={register ? 'Crie sua conta' : login ? 'Bem-vindo de volta' : recovery ? 'Recupere sua senha' : 'Entre com convite'}
      subtitle={register ? 'Vamos começar pelo seu nome e e-mail.' : login ? 'Acesse sua conta para continuar com seu clube.' : recovery ? 'Use o e-mail da sua conta para continuar.' : 'Use o código recebido para acessar o seu clube.'}
      back={register || recovery ? <span className="access-back" aria-hidden="true" /> : undefined}
      progress={register ? <div className="access-steps access-loading-steps" aria-hidden="true"><span className="loading-skeleton-line" /><div><i className="is-active" /><i /><i /></div></div> : undefined}
      footer={<div aria-hidden="true"><div className="access-loading-button loading-skeleton-line" /><div className="access-loading-link loading-skeleton-line" /></div>}>
      <div className="access-loading-fields" role="status" aria-label="Carregando formulário">
        {Array.from({ length: fields }, (_, i) => <div className="access-field" key={i} aria-hidden="true">
          <div className={`access-label-row${login && i === 1 ? ' access-loading-password-label' : ''}`}>
            <span className="access-loading-label loading-skeleton-line" />
            {login && i === 1 && <span className="access-loading-label loading-skeleton-line" />}
          </div>
          <div className="access-input-row"><span className="access-loading-icon loading-skeleton-mark" /><span className="loading-skeleton-line" /></div>
        </div>)}
      </div>
      {(login || register) && <div className="access-invite" aria-hidden="true">
        <span className="access-invite-icon loading-skeleton-mark" /><span className="loading-skeleton-copy"><span className="loading-skeleton-line" /><span className="loading-skeleton-line loading-skeleton-line--short" /></span>
      </div>}
    </AuthShell>
  </div>;
}
