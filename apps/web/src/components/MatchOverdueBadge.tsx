import { Icon } from './Icon';
import './MatchOverdueBadge.css';

export function MatchOverdueBadge() {
  return <span className="match-overdue"><Icon name="clock" size={14}/>Atrasada</span>;
}
