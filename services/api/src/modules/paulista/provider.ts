import axios from 'axios';
import { load } from 'cheerio';
import type { EquipePaulista, JogoPaulista, PosicaoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
export const ORIGEM = 'https://eventos.admfutsal.com.br';
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z\d]+/gi, ' ').trim().toUpperCase();
const limpo = (s: string) => s.replace(/\s+/g, ' ').trim();
const excluida = (s: string) => /UNI[AÃ]O/i.test(s);
export function inteiroFonte(v: unknown) {
  if (typeof v !== 'string' && typeof v !== 'number') throw new Error('Identificador externo inválido.');
  if (!/^[1-9]\d{0,7}$/.test(String(v))) throw new Error('Identificador externo inválido.');
  return Number(v);
}
export async function lerFonte(path: string) {
  return (await axios.get(ORIGEM + path, { timeout: 20_000, maxRedirects: 0, maxContentLength: 8_000_000,
    headers: { 'User-Agent': 'Ludora Paulista pilot / schedule verification' } })).data;
}
export function extrairEquipes(html: string, evento: number): EquipePaulista[] {
  const $ = load(html), equipes = new Map<number, EquipePaulista>();
  $(`a[href^="/evento/${evento}/equipe/"]`).each((_i, node) => {
    const a = $(node), id = inteiroFonte(a.attr('href')!.split('/').at(-1));
    const src = a.find('img').attr('src');
    const nome = limpo(a.find('p').text());
    if (!nome) throw new Error('Equipe oficial sem nome.');
    let escudo: string | null = null;
    if (src) { const url = new URL(src, ORIGEM); if (url.hostname === 'admfutsal.com.br') { url.protocol = 'https:'; escudo = url.href; } }
    equipes.set(id, { id, nome, escudo });
  });
  if (!equipes.size) throw new Error('Lista de equipes mudou ou evento não encontrado.');
  return [...equipes.values()].sort((a, b) => a.id - b.id);
}
function dataISO(text: string, ano: number) {
  const m = text.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}|\d{2}))?$/);
  if (!m) return null;
  const a = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ano;
  const iso = `${a}-${m[2]}-${m[1]}`, d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}
export function interpretarEvento(id: number, html: string, equipes: EquipePaulista[], rankingHtml: string): SnapshotPaulista {
  const $ = load(html), heading = limpo($('h5').first().text());
  const meta = heading.match(/^Campeonato Paulista,\s*Temporada (\d{4}) Categoria (.+?), Divis[aã]o (.+)$/i);
  if (!meta) throw new Error('Somente Campeonato Paulista; cabeçalho desconhecido ou outro título.');
  const jogos: JogoPaulista[] = [], avisos: string[] = [], fasesExcluidas: string[] = [], keys = new Set<string>();
  $('[role="tabpanel"][id^="pills-fase-"]').each((_i, pane) => {
    const faseId = $(pane).attr('id')!.replace('pills-fase-', ''), fase = limpo($(`#pills-fase-${faseId}-tab`).text());
    if (!/^\d+$/.test(faseId) || !fase) throw new Error('Fase sem identificador da fonte.');
    if (excluida(fase)) { fasesExcluidas.push(faseId); return; }
    $(pane).find('tbody tr').each((_j, row) => {
      const cells = $(row).children('td'), names = $(row).find('.nome_clube');
      if (cells.length !== 4 || names.length !== 2) throw new Error('Formato de jogo alterado.');
      const ids = [0, 1].map(index => {
        const image = $(row).find('img.escudo').eq(index).attr('src');
        const imageId = image?.match(/\/escudo\/(\d+)\.[a-z]+(?:\?|$)/i)?.[1];
        const matches = equipes.filter(e => imageId ? e.id === Number(imageId) : normalizar(e.nome) === normalizar(names.eq(index).text()));
        if (matches.length !== 1) throw new Error('Equipe não identificada no catálogo oficial; conferir manualmente.');
        return matches[0].id;
      });
      if (ids[0] === ids[1]) throw new Error('Confronto com a mesma equipe.');
      // A fonte omite id_jogo em partidas futuras. A chave composta usa IDs da
      // própria fonte; repetição do par na fase é rejeitada, nunca adivinhada.
      const key = `${id}:${faseId}:${ids[0]}:${ids[1]}`;
      if (keys.has(key)) throw new Error('Identidade ambígua: par repetido na mesma fase.');
      keys.add(key);
      const result = limpo($(row).find('.result').text()), placar = result.match(/^(\d{1,3})\s*[xX×]\s*(\d{1,3})$/);
      const wo = /W\s*\.?\s*O\b/i.test($(row).find('a[href*="id_jogo="]').text());
      const adiada = /adiad|suspens/i.test(cells.eq(0).text() + cells.eq(1).text() + result);
      if (!placar && !/^[xX×]$/.test(result) && !adiada && !wo) throw new Error(`Resultado não reconhecido: ${result}`);
      const data = dataISO(limpo(cells.eq(0).text()), Number(meta[1]));
      const h = limpo(cells.eq(1).text()).match(/^([01]\d|2[0-3]):([0-5]\d)h?$/);
      const sumula = $(row).find('a[href*="id_jogo="]').attr('href')?.match(/id_jogo=(\d+)/)?.[1];
      if (!data || !h || wo || adiada) avisos.push(`${key}: ${wo ? 'W.O.; conferir regulamento' : adiada ? 'adiada/suspensa' : 'data/horário pendente'}`);
      jogos.push({ id: key, faseId, fase, sumulaId: sumula ? inteiroFonte(sumula) : null, mandanteId: ids[0], visitanteId: ids[1], data,
        horario: h ? `${h[1]}:${h[2]}` : null, local: limpo(cells.eq(2).text()) || null,
        golsMandante: placar ? Number(placar[1]) : null, golsVisitante: placar ? Number(placar[2]) : null, ocorrencia: wo ? 'WO' : adiada ? 'ADIADA' : null });
    });
  });
  if (!jogos.length) throw new Error('Nenhum jogo Paulista reconhecido.');
  const r = load(rankingHtml), classificacao: PosicaoPaulista[] = [];
  r('[role="tabpanel"][id^="pills-fase-"]').each((_i, pane) => {
    const faseId = r(pane).attr('id')!.replace('pills-fase-', ''), fase = limpo(r(`#pills-fase-${faseId}-tab`).text());
    // A página também contém cópias auxiliares "ID-chave" e um agregado
    // "total", sem identidade de fase. Não importar essas tabelas duplicadas.
    if (!/^\d+$/.test(faseId)) return;
    if (!fase) throw new Error('Classificação sem nome de fase oficial.');
    if (excluida(fase)) return;
    r(pane).find('tbody tr').each((_j, row) => {
      const c = r(row).children('td'); if (c.length < 11) throw new Error('Classificação em formato desconhecido.');
      const equipeId = Number(r(row).find('img.escudo').attr('src')?.match(/\/escudo\/(\d+)\./)?.[1]);
      if (!equipes.some(e => e.id === equipeId)) throw new Error('Equipe da classificação não reconhecida.');
      const publicados = Array.from({ length: 8 }, (_, k) => limpo(c.eq(k + 3).text()));
      // Pontos publicados como "8*" têm nota; não recalcular por vitórias.
      if (publicados.some((v, k) => !(k === 0 ? /^-?\d+\*?$/ : /^-?\d+$/).test(v))) throw new Error('Valores de classificação inválidos.');
      const valores = publicados.map(v => Number(v.replace(/\*$/, '')));
      classificacao.push({ faseId, fase, grupo: limpo(c.eq(0).text()), equipeId, posicao: parseInt(c.eq(1).text(), 10),
        pontos: valores[0], jogos: valores[1], vitorias: valores[2], empates: valores[3], derrotas: valores[4], golsPro: valores[5], golsContra: valores[6], saldo: valores[7], ...(publicados[0].endsWith('*') ? { pontosNota: publicados[0] } : {}) });
    });
  });
  if (!classificacao.length) avisos.push('Classificação oficial ainda não publicada.');
  return { id, ano: Number(meta[1]), titulo: 'Paulista', categoria: meta[2], divisao: meta[3], fonte: `${ORIGEM}/evento/${id}`, equipes,
    jogos: jogos.sort((a, b) => a.id.localeCompare(b.id)),
    classificacao: classificacao.sort((a, b) => a.faseId.localeCompare(b.faseId) || a.grupo.localeCompare(b.grupo) || a.posicao - b.posicao || a.equipeId - b.equipeId),
    avisos: avisos.sort(), fasesExcluidas: fasesExcluidas.sort() };
}
export async function baixarEvento(id: number) {
  inteiroFonte(id);
  const [teams, games, ranking] = await Promise.all([lerFonte(`/evento/${id}/equipes`), lerFonte(`/evento/${id}/jogos`), lerFonte(`/evento/${id}`)]);
  return interpretarEvento(id, games, extrairEquipes(teams, id), ranking);
}

export async function conferirCategorias(ano: number, equipeId: number) {
  if (ano < 2020 || ano > new Date().getFullYear() + 1) throw new Error('Temporada inválida.');
  const divs = (await lerFonte(`/api/get_divisoes/${ano}/16`)).divisoes as any[];
  // IDs identificam equipes, não necessariamente o clube em todas as categorias.
  // O nome apenas gera candidatos; cada ID continua exigindo confirmação.
  const anchor = extrairEquipes(await lerFonte('/evento/900/equipes'), 900).find(e => e.id === equipeId);
  if (!anchor) throw new Error('Equipe âncora não encontrada no evento piloto 900.');
  const termos = normalizar(anchor.nome).split(' ').filter(w => !['CLUBE', 'PRAIA', 'FUTSAL', 'FC'].includes(w));
  const linhas: { categoria: string; divisao: string; eventoId: number; equipeId: number; equipe: string }[] = [];
  const tarefas: { categoria: string; divisao: string; id: number }[] = [];
  for (const div of divs) {
    const cats = await lerFonte(`/api/get_categorias/${ano}/16/${inteiroFonte(div.id_divisao)}`);
    for (const cat of cats) {
      if (/^Sub-(7|8|9|10|12|14|16|18)$/.test(cat.categoria.nome)) tarefas.push({ categoria: cat.categoria.nome, divisao: div.nome, id: inteiroFonte(cat.id_evento) });
    }
  }
  let proxima = 0;
  await Promise.all([0, 1].map(async () => {
    while (proxima < tarefas.length) {
      const t = tarefas[proxima++];
      const teams = extrairEquipes(await lerFonte(`/evento/${t.id}/equipes`), t.id);
      const matches = teams.filter(e => e.id === equipeId || termos.some(w => normalizar(e.nome).split(' ').includes(w)));
      for (const m of matches) linhas.push({ categoria: t.categoria, divisao: t.divisao, eventoId: t.id, equipeId: m.id, equipe: m.nome });
    }
  }));
  return linhas.sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR', { numeric: true }) || a.divisao.localeCompare(b.divisao)).map(l => ({ ...l, estado: 'CANDIDATO_REQUER_CONFIRMACAO', inconsistencia: linhas.filter(x => x.categoria === l.categoria).length > 1 ? 'Mais de um candidato nesta categoria/divisão: revisar.' : null }));
}
