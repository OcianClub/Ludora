import { Link } from 'react-router-dom';
import { Icon } from '../Icon';

export function InviteCard() {
  return (
    <Link className="access-invite" to="/convite">
      <span className="access-invite-icon"><Icon name="defense" size={25} /></span>
      <span>
        <strong><span className="access-invite-full-title">Tem um código de convite?</span><span className="access-invite-short-title">Entrar com código de convite</span></strong>
        <small>Consulte o convite e entre para a equipe do clube.</small>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
