import type { ReactNode } from 'react';
import './UserAccountDialog.css';

export function AccountIdentity({ nome, email, actions }: { nome: string; email: string; actions?: ReactNode }) {
  const initials = nome.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('pt-BR');
  return <div className="user-identity">
    <span className="user-identity-avatar" aria-hidden="true">{initials}</span>
    <div><strong>{nome}</strong><p>{email}</p></div>{actions}
  </div>;
}
