import type { Prisma } from '@prisma/client';
import { SUBS_PADRAO } from './admin.rules';

// Agrupamento para conferência humana; não funde Times nem identidades FPFS.
export const cascaDisponivel = { clube_representado_id: null, arquivado: false, fpfsTime: { none: {} } } satisfies Prisma.TimeWhereInput;
export const cascaSelect = { id: true, nome: true, escudo: true, categoria: { select: {
  nome: true, faixaIdade: true, clube_id: true, clube: { select: { nome: true } },
} } } satisfies Prisma.TimeSelect;
export type Casca = Prisma.TimeGetPayload<{ select: typeof cascaSelect }>;
export function subDoTime(time: Pick<Casca, 'categoria'>): number | null {
  const idade = time.categoria?.faixaIdade ?? Number(time.categoria?.nome.match(/^sub[\s-]*(\d+)$/i)?.[1]);
  return SUBS_PADRAO.some(sub => sub === idade) ? idade : null;
}
export function nomeBaseTime(time: Pick<Casca, 'nome' | 'categoria'>): string {
  const nome = time.nome.trim().replace(/\s+/g, ' ');
  const sufixo = nome.match(/[\s·–—_-]+sub[\s-]*(\d{1,2})$/i);
  // Só retira o SUB se ele concorda com a categoria do registro.
  return sufixo && Number(sufixo[1]) === subDoTime(time) ? nome.slice(0, sufixo.index).trim() : nome;
}
export function chaveTime(time: Pick<Casca, 'nome' | 'categoria'>): string {
  return nomeBaseTime(time).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}
export function agruparTimes(times: Casca[]) {
  const grupos = new Map<string, Casca[]>();
  for (const time of times) {
    const chave = chaveTime(time);
    grupos.set(chave, [...(grupos.get(chave) || []), time]);
  }
  return [...grupos.entries()].map(([chave, registros]) => {
    registros.sort((a,b) => a.id - b.id);
    const principal = registros[0];
    return { ...principal, nome: nomeBaseTime(principal), chave, agrupada: true as const,
      escudo: registros.find(t => t.escudo)?.escudo || null,
      subs: [...new Set(registros.flatMap(t => subDoTime(t) === null ? [] : [subDoTime(t)!]))].sort((a,b)=>a-b),
      registros: registros.length, origens: [...new Set(registros.flatMap(t => t.categoria ? [t.categoria.clube.nome] : []))],
    };
  }).sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id-b.id);
}
