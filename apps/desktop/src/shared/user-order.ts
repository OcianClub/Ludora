import type { UsuarioGlobal } from '@ludora/shared-types';

export type ColunaUsuario = 'conta' | 'clube' | 'cargo' | 'situacao';
export type OrdemUsuario = { coluna: ColunaUsuario; direcao: 'asc' | 'desc' } | null;
export function proximaOrdem(atual: OrdemUsuario, coluna: ColunaUsuario): OrdemUsuario {
  return atual?.coluna !== coluna ? { coluna, direcao: 'asc' } : atual.direcao === 'asc' ? { coluna, direcao: 'desc' } : null;
}
export function ordenarUsuarios(contas: UsuarioGlobal[], ordem: OrdemUsuario): UsuarioGlobal[] {
  if (!ordem) return contas;
  const valor = (u: UsuarioGlobal) => {
    switch (ordem.coluna) {
      case 'conta': return `${u.nome} ${u.email}`;
      case 'clube': return u.clubes.map(c => c.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ');
      case 'cargo': return u.papel_plataforma !== 'USUARIO' ? u.papel_plataforma : u.clubes.map(c => c.papel).sort().join(', ');
      case 'situacao': return u.suspenso ? 'Suspensa' : 'Ativa';
    }
  };
  return [...contas].sort((a, b) => valor(a).localeCompare(valor(b), 'pt-BR', { numeric: true, sensitivity: 'base' }) * (ordem.direcao === 'asc' ? 1 : -1));
}
