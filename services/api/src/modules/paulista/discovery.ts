import { load } from 'cheerio';
import type { PrismaClient } from '@prisma/client';
import { extrairEquipes, inteiroFonte, lerFonte } from './provider';
import { json } from './service';
import type { EquipePaulista } from '../../../../../packages/shared-types/src/paulista';

export type Descoberto = { id: number; ano: number; divisao: string; categoria: string; equipes: EquipePaulista[] };
type Leitor = (path: string) => Promise<any>;
// O ano seguinte só é consultado se existir no seletor publicado. Não adivinha IDs.
export async function descobrirFonte(ler: Leitor = lerFonte, ano = new Date().getFullYear()) {
  const $ = load(await ler('/'));
  const anos = $('#select_temporada option').map((_i, e) => Number($(e).attr('value'))).get().filter(a => a === ano || a === ano + 1);
  if (!anos.length) throw new Error('Seletor de temporadas não reconhecido; catálogo anterior preservado.');
  const tarefas: Omit<Descoberto, 'equipes'>[] = [];
  for (const a of [...new Set(anos)]) {
    const response = await ler(`/api/get_divisoes/${a}/16`);
    if (!Array.isArray(response.divisoes) || response.divisoes.length > 8) throw new Error('Catálogo de divisões inválido.');
    for (const d of response.divisoes) {
      const cats = await ler(`/api/get_categorias/${a}/16/${inteiroFonte(d.id_divisao)}`);
      if (!Array.isArray(cats) || cats.length > 24) throw new Error('Catálogo de categorias inválido.');
      for (const c of cats) {
        if (Number(c.id_titulo) !== 16 || Number(c.temporada) !== a || !/^Sub-(7|8|9|10|12|14|16|18)$/.test(c.categoria?.nome)) continue;
        tarefas.push({ id: inteiroFonte(c.id_evento), ano: a, divisao: String(d.nome), categoria: c.categoria.nome });
      }
    }
  }
  if (tarefas.length > 64) throw new Error('Catálogo maior que o limite; revisar fonte.');
  const resultado: Descoberto[] = []; let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < tarefas.length) {
      const t = tarefas[next++];
      resultado.push({ ...t, equipes: extrairEquipes(await ler(`/evento/${t.id}/equipes`), t.id) });
    }
  }));
  return resultado.sort((a, b) => a.id - b.id);
}

export async function guardarDescoberta(banco: PrismaClient, rows: Descoberto[]) {
  // Toda a descoberta termina antes de gravar. Falha parcial não apaga catálogo.
  await banco.$transaction(async tx => {
    for (const row of rows) {
      const data = { ano: row.ano, divisao: row.divisao, categoria: row.categoria, equipes: json(row.equipes) };
      const old = await tx.fpfsCatalogo.findUnique({ where: { id: row.id } });
      if (old && (old.ano !== row.ano || old.divisao !== row.divisao || old.categoria !== row.categoria)) throw new Error('Identidade do evento mudou no catálogo.');
      const confirmado = !old && await tx.fpfsVinculo.findFirst({ where: { equipeId: { in: row.equipes.map(e => e.id) }, equipe: { times: { some: { evento: { categoria: row.categoria } } } } } });
      // Só um ID já confirmado para o mesmo SUB acompanha uma nova edição.
      // Redescoberta preserva a pausa e os horários reais de tentativas.
      await tx.fpfsCatalogo.upsert({ where: { id: row.id }, create: { id: row.id, ...data, acompanhado: !!confirmado }, update: data });
    }
  }, { timeout: 90_000, isolationLevel: 'Serializable' });
}
