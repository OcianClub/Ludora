import type { PosicaoPaulista, SnapshotPaulista } from '../paulista';
import { chavePublicada, type ChavePaulista } from './paulistaBracket';

/** A team's key is a published fact, never a fallback based on its position. */
export function chavesDasEquipes(snapshot: SnapshotPaulista) {
  const publicadas = new Map<number, Set<ChavePaulista>>();
  const adicionar = (id: number, fase: string) => {
    if (/UNI[AÃ]O/i.test(fase)) return;
    const chave = chavePublicada(fase);
    if (!chave) return;
    if (!publicadas.has(id)) publicadas.set(id, new Set());
    publicadas.get(id)!.add(chave);
  };
  for (const jogo of snapshot.jogos) {
    adicionar(jogo.mandanteId, jogo.fase);
    adicionar(jogo.visitanteId, jogo.fase);
  }
  for (const linha of snapshot.classificacao) {
    if (!/CLASSIFICA/i.test(linha.fase)) adicionar(linha.equipeId, `${linha.fase} ${linha.grupo}`);
  }
  return new Map([...publicadas].flatMap(([id, chaves]) => chaves.size === 1 ? [[id, [...chaves][0]] as const] : []));
}

export interface FaixaPublicada {
  chave: ChavePaulista | null;
  inicio: number;
  fim: number;
}

/** Visual bands only when the actual publications establish contiguous keys.
 * Independent groups (e.g. Base A3), partial tables and conflicting keys get no
 * positional bands. Preserve source positions; do not recalculate advancement.
 */
export function faixasPublicadas(rows: PosicaoPaulista[], chaves: Map<number, ChavePaulista>): FaixaPublicada[] {
  if (!rows.length || !rows.every((r, i) => /CLASSIFICA/i.test(r.fase)
    && /^(CHAVE UNICA|GRUPO UNICO)$/i.test(r.grupo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
    && r.faseId === rows[0].faseId && r.grupo === rows[0].grupo && r.posicao === i + 1)) return [];
  const faixas: FaixaPublicada[] = [];
  const ordem = ['OURO', 'PRATA', 'BRONZE', 'RUBI'];
  for (const row of rows) {
    const chave = chaves.get(row.equipeId) || null;
    const anterior = faixas[faixas.length - 1];
    if (anterior && anterior.chave === chave) anterior.fim = row.posicao;
    else {
      if (faixas.some(f => f.chave === chave) || anterior && (anterior.chave === null
        || chave !== null && ordem.indexOf(chave) < ordem.indexOf(anterior.chave))) return [];
      faixas.push({ chave, inicio: row.posicao, fim: row.posicao });
    }
  }
  return faixas.filter(f => f.chave).length >= 2 ? faixas : [];
}
