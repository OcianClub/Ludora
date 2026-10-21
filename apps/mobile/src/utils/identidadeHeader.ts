export type PapelHeader = 'ADMIN' | 'TECNICO' | 'MESARIO' | 'TORCEDOR' | 'OLHEIRO';

export const NOMES_PAPEIS_HEADER: Record<PapelHeader, string> = {
  ADMIN: 'Administrador',
  TECNICO: 'Técnico',
  MESARIO: 'Mesário',
  TORCEDOR: 'Torcedor',
  OLHEIRO: 'Olheiro',
};

export function inicialHeader(nome: string) {
  return Array.from(nome.trim())[0]?.toLocaleUpperCase('pt-BR') || 'L';
}

export function identidadeClubeHeader(
  clube: {
    nome: string;
    escudo: string | null;
    papel: PapelHeader | null;
  } | null
) {
  return {
    nome: clube?.nome.trim() || 'Meu clube',
    escudo: clube?.escudo?.trim() || null,
    papel: clube?.papel ?? undefined,
  };
}
