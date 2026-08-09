import 'dotenv/config';
import { PrismaClient, TipoCompeticao, TipoCategoria, StatusPartida } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const genIA  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ImportacaoInput {
  competicaoId: number;
  conteudo: string | Buffer;
  mimeType: string;
}

interface JogoExtraido {
  grupo: string | null;
  data: string;       // YYYY-MM-DD
  horario: string;    // HH:MM
  local: string | null;
  adversario: string;
  ocianMandante: boolean;
  rodada: number;
}

// ─── Ordem de horário por categoria (BASE) ────────────────────────────────────
const ORDEM_HORARIO_BASE: Record<string, number> = {
  'sub-18': 0,
  'sub-14': 1,
  'sub-16': 2,
  'sub-12': 3,
};

const ORDEM_HORARIO_INICIACAO: Record<string, number> = {
  'sub-7':  0,
  'sub-8':  1,
  'sub-9':  2,
  'sub-10': 3,
};

// ─── Filtro de linhas relevantes ──────────────────────────────────────────────

function filtrarLinhasOcian(texto: string): string {
  const linhas = texto.split('\n');
  const indices = new Set<number>();
  linhas.forEach((linha, i) => {
    if (linha.toLowerCase().includes('ocian')) {
      for (let j = Math.max(0, i - 2); j <= Math.min(linhas.length - 1, i + 2); j++) {
        indices.add(j);
      }
    }
  });
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map(i => linhas[i])
    .join('\n');
}

// ─── Conversor Excel → CSV ────────────────────────────────────────────────────
function excelParaCSV(buffer: Buffer): string {
  const wb   = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const nome = wb.SheetNames[0];
  return XLSX.utils.sheet_to_csv(wb.Sheets[nome]);
}

// ─── Helpers de chave para sets de deduplicação ───────────────────────────────
const chaveRodada  = (catId: number, rodada: number)                      => `${catId}:r${rodada}`;
const chaveHorario = (catId: number, data: string, horario: string)       => `${catId}:${data}:${horario}`;
const chaveTime    = (nome: string,  catId: number)                       => `${nome.toLowerCase().trim()}:${catId}`;

// ─── Exportação principal ─────────────────────────────────────────────────────
export async function importarPartidas({ competicaoId, conteudo, mimeType }: ImportacaoInput) {

  // ── 1. Converte Excel para CSV antes de qualquer coisa ─────────────────────
  let conteudoFinal = conteudo;
  let mimeTypeFinal = mimeType;

  const ehExcel = mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('xls');
  if (ehExcel) {
    const buf = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo as string);
    conteudoFinal = excelParaCSV(buf);
    mimeTypeFinal = 'text/csv';
  }

  // ── 2. Busca competição e categorias ───────────────────────────────────────
  const competicao = await prisma.competicao.findUniqueOrThrow({ where: { id: competicaoId } });
  const ehBase      = competicao.tipo === TipoCompeticao.BASE;
  const tipoCategoria = ehBase ? TipoCategoria.BASE : TipoCategoria.INICIACAO;

  const categoriasBruto = await prisma.categoria.findMany({ where: { tipo: tipoCategoria } });
  const ordemMapa       = ehBase ? ORDEM_HORARIO_BASE : ORDEM_HORARIO_INICIACAO;

  // Ordena pelo horário correto da federação
  const categorias = [...categoriasBruto].sort((a, b) => {
    const oa = ordemMapa[a.nome.toLowerCase()] ?? 99;
    const ob = ordemMapa[b.nome.toLowerCase()] ?? 99;
    return oa - ob;
  });

  const catIds = categorias.map(c => c.id);

  // ── 3. Pré-fetch: partidas já existentes → sets em memória ──────────────────
  // Evita N × M queries no loop principal.
  const partidasExistentes = await prisma.partida.findMany({
    where: { competicao_id: competicaoId },
    select: { categoria_id: true, rodada: true, data: true, horario: true },
  });

  const setRodadas  = new Set(partidasExistentes.map(p => chaveRodada(p.categoria_id, p.rodada!)));
  const setHorarios = new Set(partidasExistentes.map(p =>
    chaveHorario(p.categoria_id, p.data.toISOString().slice(0, 10), p.horario ?? '')
  ));

  // ── 4. Pré-fetch: times já cadastrados ────────────────────────────────────
  const timesExistentes = await prisma.time.findMany({
    where: { categoria_id: { in: catIds } },
    select: { id: true, nome: true, categoria_id: true },
  });

  // Mapa nome→id por categoria; atualizado ao criar novos times
  const mapaTime = new Map<string, number>(
    timesExistentes.map(t => [chaveTime(t.nome, t.categoria_id!), t.id])
  );

  // Garante que o CFA Ocian existe em cada categoria (cria se não existir)
  const ocianPorCat: Record<number, number> = {};
  for (const cat of categorias) {
    const chave = chaveTime('CFA Ocian', cat.id);
    if (!mapaTime.has(chave)) {
      // Tenta encontrar qualquer variação do nome
      const jaExiste = timesExistentes.find(
        t => t.nome.toLowerCase().includes('ocian') && t.categoria_id === cat.id
      );
      if (jaExiste) {
        mapaTime.set(chave, jaExiste.id);
      } else {
        const novo = await prisma.time.create({ data: { nome: 'CFA Ocian', categoria_id: cat.id } });
        mapaTime.set(chave, novo.id);
      }
    }
    ocianPorCat[cat.id] = mapaTime.get(chave)!;
  }
  const hoje = new Date();
  const insertsPartida: any[] = [];
  const resultado = { criados: 0, pulados: 0 };

  // ── 5. Chama a IA ──────────────────────────────────────────────────────────
    let respostaRaw: string;
  const model = genIA.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      // @ts-ignore
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  const prompt = `
Você é especialista em ler tabelas da Federação Paulista de Futsal.
Extraia TODOS os jogos únicos onde "Ocian" (ou "Ocian Praia Clube" / "Ocian Praia Clube/AJR") aparece.

Tipo: ${competicao.tipo}
${ehBase ? 'COMPETIÇÃO BASE — pode ter grupos A, B, C. Capture a letra do grupo.' : 'COMPETIÇÃO INICIAÇÃO — sem grupos.'}

REGRAS:
1. Extraia TODOS os jogos onde o Ocian participa.
2. Ocian no lado DIREITO = visitante (ocianMandante: false).
3. Ocian no lado ESQUERDO = mandante (ocianMandante: true).
4. Data em YYYY-MM-DD. Horário em HH:MM. Sem inferências.
5. NÃO duplique jogos.
6. Responda APENAS com o array JSON, sem texto extra, sem markdown.

Formato exato:
[{"grupo":"C","data":"2026-05-02","horario":"08:00","local":"Arena Ocian","adversario":"AD GALATA","ocianMandante":false}]
`.trim();


if (mimeTypeFinal.includes('text') || mimeTypeFinal.includes('csv')) {
    const texto    = typeof conteudoFinal === 'string' ? conteudoFinal : (conteudoFinal as Buffer).toString('utf-8');
    const filtrado = filtrarLinhasOcian(texto);

    console.log('Linhas filtradas:', filtrado.split('\n').length);

    console.time('gemini');
    const result = await model.generateContent(`${prompt}\n\nTabela:\n${filtrado}`);
    console.timeEnd('gemini');

    respostaRaw = result.response.text().trim();
  } else {
    console.time('gemini');
    const buffer = Buffer.isBuffer(conteudoFinal) ? conteudoFinal : Buffer.from(conteudoFinal as string);
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: buffer.toString('base64'), mimeType: mimeTypeFinal } },
    ]);
    console.timeEnd('gemini');

    respostaRaw = result.response.text().trim();
  }
  

  // ── 6. Parse da resposta da IA ─────────────────────────────────────────────
  const limpa = respostaRaw.replace(/```json/g, '').replace(/```/g, '').trim();
  let jogos: JogoExtraido[] = JSON.parse(
    limpa.slice(limpa.indexOf('['), limpa.lastIndexOf(']') + 1)
  );

  // Ordena por data e atribui rodadas
  jogos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const grupoGlobal = jogos.find(j => j.grupo)?.grupo ?? null;
  jogos = jogos.map((j, i) => ({ ...j, rodada: i + 1, grupo: grupoGlobal ?? j.grupo ?? null }));

  // ── 7. Monta inserts em memória, depois cria em batch ─────────────────────
  console.time('prisma-loop');
  for (const jogo of jogos) {
  const resultado = { criados: 0, pulados: 0 };
  const insertsPartida: any[] = [];
  const hoje = new Date();
  }
  console.timeEnd('prisma-loop');

  console.time('prisma-insert');
  if (insertsPartida.length > 0) {
  await prisma.partida.createMany({
    data: insertsPartida,
    skipDuplicates: true,
  });
}
console.timeEnd('prisma-insert');

  for (const jogo of jogos) {
    const [horaBase, minBase] = jogo.horario.split(':').map(Number);
    const dataDaPartida       = new Date(`${jogo.data}T00:00:00Z`);
    const dataStr             = jogo.data; // YYYY-MM-DD
    const statusDaPartida     = dataDaPartida < hoje ? StatusPartida.FINALIZADA : StatusPartida.AGENDADA;

    for (let i = 0; i < categorias.length; i++) {
      const cat         = categorias[i];
      const hora        = (horaBase + i) % 24;
      const horarioFinal = `${String(hora).padStart(2, '0')}:${String(minBase).padStart(2, '0')}`;

      // Deduplicação em memória (sem query extra)
      if (setRodadas.has(chaveRodada(cat.id, jogo.rodada)) ||
          setHorarios.has(chaveHorario(cat.id, dataStr, horarioFinal))) {
        resultado.pulados++;
        continue;
      }

      // Garante adversário no mapa (cria se necessário)
      const chaveAdv = chaveTime(jogo.adversario, cat.id);
      if (!mapaTime.has(chaveAdv)) {
        // Verifica se existe com variação de capitalização
        const jaExiste = await prisma.time.findFirst({
          where: { nome: { contains: jogo.adversario, mode: 'insensitive' }, categoria_id: cat.id },
        });
        if (jaExiste) {
          mapaTime.set(chaveAdv, jaExiste.id);
        } else {
          const novo = await prisma.time.create({ data: { nome: jogo.adversario, categoria_id: cat.id } });
          mapaTime.set(chaveAdv, novo.id);
        }
      }

      const adversarioId = mapaTime.get(chaveAdv)!;
      const ocianId      = ocianPorCat[cat.id];

      insertsPartida.push({
        competicao_id: competicaoId,
        categoria_id:  cat.id,
        rodada:        jogo.rodada,
        grupo:         jogo.grupo,
        data:          dataDaPartida,
        horario:       horarioFinal,
        status:        statusDaPartida,
        local:         jogo.local,
        emCasa:        Boolean(jogo.ocianMandante),
        mandante_id:   jogo.ocianMandante ? ocianId : adversarioId,
        visitante_id:  jogo.ocianMandante ? adversarioId : ocianId,
      });

      // Marca como usado para evitar duplicata dentro do mesmo lote
      setRodadas.add(chaveRodada(cat.id, jogo.rodada));
      setHorarios.add(chaveHorario(cat.id, dataStr, horarioFinal));
      resultado.criados++;
    }
  }

  // ── 8. Insert em lote ─────────────────────────────────────────────────────
  if (insertsPartida.length > 0) {
    await prisma.partida.createMany({
      data: insertsPartida as any,
      skipDuplicates: true,
    });
  }

  return resultado;
}