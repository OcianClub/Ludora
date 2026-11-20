import { Link } from 'react-router-dom';
import { Icon } from '../Icon';

export function InviteCard() {
  return (
    <Link className="access-invite" to="/convite">
      <Icon name="defense" size={18} />
      <span className="access-invite-label">Tenho um código de convite</span>
      <Icon name="chevronRight" size={14} />
    </Link>
  );
}
