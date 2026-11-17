import { Icon } from './Icon';
import type { Categoria } from '../services/api';
import './MatchOverdueBadge.css';

export function MatchOverdueBadge(_props: {category?:Categoria}) {
  return <span className="match-overdue"><Icon name="clock" size={14}/><span>Atrasada</span></span>;
}
