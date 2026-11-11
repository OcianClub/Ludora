import type { JogoPaulista, SnapshotPaulista } from '../paulista';

export type ChavePaulista = 'OURO' | 'PRATA' | 'BRONZE' | 'RUBI';
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function chavePublicada(nome: string): ChavePaulista | null {
  // Variante encontrada no evento 919. Não aplicar aproximação genérica a nomes oficiais.
  const chaves = normalizar(nome).replace(/\bBRONE\b/g, 'BRONZE').match(/\b(OURO|PRATA|BRONZE|RUBI)\b/g) || [];
  return new Set(chaves).size === 1 ? chaves[0] as ChavePaulista : null;
}
export function etapaPublicada(nome: string) {
  const s = normalizar(nome);
  if (/^OITAVAS?\b/.test(s)) return 0;
  if (/^QUARTAS?\b/.test(s)) return 1;
  if (/^SEMIFINA/.test(s)) return 2;
  return /^FINA(L|IS)\b/.test(s) ? 3 : -1;
}
export const tituloEtapa = (etapa: number) => ['Oitavas de final', 'Quartas de final', 'Semifinais', 'Final'][etapa] || 'Outras fases publicadas';
const resultado = (j: JogoPaulista) => !j.ocorrencia && j.golsMandante !== null && j.golsVisitante !== null;
// A fonte usa esta combinação em registros ainda pendentes, inclusive em finais conflitantes.
// Exibir o valor publicado, mas não usá-lo para confirmar uma conexão ou uma agenda definitiva.
export const agendaProvisoria = (j: JogoPaulista) => !resultado(j) && !!j.data?.endsWith('-12-31') && j.horario === '00:00';

export interface AvisoChaveamento { id: string; tipo: 'conflito' | 'ocorrencia' | 'formato' | 'agenda'; mensagem: string; jogos: string[] }
export interface ConexaoPaulista { de: string; para: string; equipeId: number; empate: boolean }
export interface ColunaPaulista { etapa: number; titulo: string; jogos: JogoPaulista[]; futura: boolean }

/** Leitura da publicação. Não calcula ranking, desempates, cortes ou destinos futuros. */
export function caminhoPublicado(s: Pick<SnapshotPaulista, 'jogos'>, chave: string) {
  const publicados = s.jogos.filter(j => !/UNIAO/.test(normalizar(j.fase)) && chavePublicada(j.fase) === chave)
    .slice().sort((a, b) => `${a.data || '9999'} ${a.horario || '99:99'}`.localeCompare(`${b.data || '9999'} ${b.horario || '99:99'}`) || a.id.localeCompare(b.id));
  const repetidos = new Set(publicados.filter((j, i) => publicados.findIndex(g => g.id === j.id) !== i).map(j => j.id));
  const jogos = [...new Map(publicados.map(j => [j.id, j])).values()];
  const avisos: AvisoChaveamento[] = [];
  const bloqueados = new Set<string>();
  function aviso(tipo: AvisoChaveamento['tipo'], mensagem: string, afetados: JogoPaulista[], bloquear = false) {
    const ids = [...new Set(afetados.map(j => j.id))].sort();
    const id = `${tipo}:${ids.join('|')}:${mensagem}`;
    if (!avisos.some(a => a.id === id)) avisos.push({ id, tipo, mensagem, jogos: ids });
    if (bloquear) ids.forEach(id => bloqueados.add(id));
  }
  const etapas: number[] = [...new Set(jogos.map(j => etapaPublicada(j.fase)))].sort((a, b) => a - b);
  const colunas: ColunaPaulista[] = etapas.map(etapa => ({ etapa, titulo: tituloEtapa(etapa), jogos: jogos.filter(j => etapaPublicada(j.fase) === etapa), futura: false }));
  // Um aviso de fase futura não é uma partida: não atribuir equipes, quantidade de vagas ou setas.
  const conhecidas = etapas.filter(e => e >= 0);
  if (conhecidas.length) for (let etapa = Math.min(...conhecidas); etapa <= 3; etapa++) {
    if (!etapas.includes(etapa)) colunas.push({ etapa, titulo: tituloEtapa(etapa), jogos: [], futura: true });
  }
  colunas.sort((a, b) => a.etapa - b.etapa);

  for (const coluna of colunas) {
    const porEquipe = new Map<number, JogoPaulista[]>();
    for (const j of coluna.jogos) for (const id of [j.mandanteId, j.visitanteId]) porEquipe.set(id, [...(porEquipe.get(id) || []), j]);
    for (const repetidos of porEquipe.values()) if (repetidos.length > 1) {
      aviso('conflito', 'Há mais de um confronto para a mesma equipe nesta etapa. Confira a publicação antes de confirmar o avanço.', repetidos, true);
    }
  }
  for (const j of jogos) {
    if (etapaPublicada(j.fase) < 0) aviso('formato', `Fase não reconhecida: ${j.fase}. Nenhuma conexão foi presumida.`, [j], true);
    if (/\bBRONE\b/.test(normalizar(j.fase))) aviso('formato', 'A fonte escreveu “BRONE”. Exibido como Bronze; o nome original foi preservado.', [j]);
    if (agendaProvisoria(j)) aviso('agenda', 'Data publicada como 31/12 às 00:00, sem resultado. Aguarde a confirmação da federação.', [j], true);
    if (j.ocorrencia) aviso('ocorrencia', j.ocorrencia === 'WO' ? 'W.O. publicado: o placar não determina automaticamente quem avançou.' : 'Partida adiada ou suspensa: avanço a confirmar.', [j], true);
    if (repetidos.has(j.id)) aviso('conflito', 'Identificador de partida repetido na publicação. Avanço a conferir.', [j], true);
  }
  const conexoes: ConexaoPaulista[] = [];
  for (const origem of jogos) {
    const etapa = etapaPublicada(origem.fase);
    if (etapa < 0 || bloqueados.has(origem.id) || !resultado(origem) || !origem.data) continue;
    // Contar também destinos conflitantes: descartá-los antes da busca poderia criar
    // um falso vencedor único para o outro participante de um empate.
    const seguintes = jogos.filter(j => etapaPublicada(j.fase) === etapa + 1);
    const candidatos = [origem.mandanteId, origem.visitanteId].map(id => ({ id, destinos: seguintes.filter(j => j.mandanteId === id || j.visitanteId === id) }));
    const presentes = candidatos.filter(c => c.destinos.length === 1);
    if (candidatos.some(c => c.destinos.length > 1) || presentes.length !== 1) continue;
    const proximo = presentes[0];
    const destino = proximo.destinos[0];
    if (bloqueados.has(destino.id) || !destino.data || `${destino.data} ${destino.horario || '00:00'}` < `${origem.data} ${origem.horario || '00:00'}`) continue;
    const empate = origem.golsMandante === origem.golsVisitante;
    if (!empate && proximo.id !== (origem.golsMandante! > origem.golsVisitante! ? origem.mandanteId : origem.visitanteId)) {
      aviso('conflito', 'O resultado e a equipe publicada na etapa seguinte divergem. A conexão aguarda conferência.', [origem, destino], true);
      continue;
    }
    conexoes.push({ de: origem.id, para: proximo.destinos[0].id, equipeId: proximo.id, empate });
  }
  return { colunas, conexoes: conexoes.filter(c => !bloqueados.has(c.de) && !bloqueados.has(c.para)), avisos };
}

export const LARGURA_JOGO = 260;
export const ALTURA_JOGO = 162;
/** Layout determinístico por identidade e conexões. Placar/horário não reposicionam os cards. */
export function layoutChaveamento(caminho: ReturnType<typeof caminhoPublicado>, alturaJogo = ALTURA_JOGO) {
  const nodes = caminho.colunas.flatMap(c => c.jogos.map(j => ({ id: j.id, etapa: c.etapa })));
  const posicoes = new Map<string, number>();
  const entradas = new Map<string, string[]>();
  const saidas = new Set(caminho.conexoes.map(c => c.de));
  for (const c of caminho.conexoes) entradas.set(c.para, [...(entradas.get(c.para) || []), c.de].sort());
  let linha = 0;
  function colocar(id: string): number {
    const existente = posicoes.get(id);
    if (existente !== undefined) return existente;
    const anteriores = entradas.get(id) || [];
    const y = anteriores.length ? anteriores.map(colocar).reduce((a, b) => a + b, 0) / anteriores.length : linha++ * (alturaJogo + 28);
    posicoes.set(id, y); return y;
  }
  nodes.filter(n => !saidas.has(n.id)).sort((a, b) => b.etapa - a.etapa || a.id.localeCompare(b.id)).forEach(n => colocar(n.id));
  nodes.forEach(n => colocar(n.id));
  const altura = Math.max(alturaJogo, ...[...posicoes.values()].map(y => y + alturaJogo));
  return { altura, posicoes: nodes.map(n => ({ id: n.id, x: caminho.colunas.findIndex(c => c.etapa === n.etapa) * 326, y: posicoes.get(n.id)! })),
    colunas: caminho.colunas.map((c, i) => ({ etapa: c.etapa, titulo: c.titulo, futura: c.futura, x: i * 326, y: c.futura ? (altura - alturaJogo) / 2 : -46 })) };
}
