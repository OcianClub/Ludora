import type { Clube } from './api';

export function clubAccessScope(club: Pick<Clube, 'id' | 'meuPapel' | 'acessoTodasCategorias' | 'categoriasAcesso'> | null) {
  return JSON.stringify([club?.id, club?.meuPapel, !!club?.acessoTodasCategorias,
    (Array.isArray(club?.categoriasAcesso) ? club.categoriasAcesso : []).map(category => category?.id).filter(Number.isSafeInteger).sort((a, b) => a - b)]);
}

export function reconcileClubAccess(selected: Clube, memberships: Clube[]): Clube {
  return memberships.find(item => item.id === selected.id) || {
    ...selected,
    meuPapel: null,
    acessoTodasCategorias: false,
    categoriasAcesso: [],
  };
}

export function clearSavedSession() {
  for (const key of ['ludora_token', 'ludora_clube_id', 'ludora_usuario', 'ludora_clube']) {
    try { localStorage.removeItem(key); } catch { /* A memória também é limpa pelo provedor. */ }
  }
}
