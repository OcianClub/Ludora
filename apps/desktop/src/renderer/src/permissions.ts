import type { PapelPlataforma } from '@ludora/shared-types';

const ABAS_OPERACIONAIS = ['/chamados', '/manutencao', '/clubes', '/usuarios', '/paulista', '/banco', '/logs', '/ajustes'];
const ABAS_POR_PAPEL: Record<PapelPlataforma, readonly string[]> = {
  USUARIO: [],
  SUPORTE: ['/chamados', '/manutencao', '/ajustes'],
  DESENVOLVEDOR: ABAS_OPERACIONAIS,
  SUPERADMIN: ABAS_OPERACIONAIS,
};

export function podeAbrirAba(papel: PapelPlataforma | undefined, aba: string) {
  return papel !== undefined && ABAS_POR_PAPEL[papel].includes(aba);
}
