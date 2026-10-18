export type Tema = 'light' | 'dark';
export type PreferenciaTema = Tema | 'system';

export function preferenciaTemaSalva(valor: string | null): PreferenciaTema {
  return valor === 'light' || valor === 'dark' ? valor : 'system';
}

export function resolverTema(preferencia: PreferenciaTema, sistema: string | null | undefined): Tema {
  return preferencia === 'system' ? (sistema === 'dark' ? 'dark' : 'light') : preferencia;
}
