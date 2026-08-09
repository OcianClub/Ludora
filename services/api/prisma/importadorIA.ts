// import 'dotenv/config';
// import fs from 'fs';
// import { PrismaClient, TipoCompeticao, TipoCategoria, StatusPartida } from '@prisma/client';
// import { GoogleGenerativeAI } from '@google/generative-ai';

// const prisma = new PrismaClient();
// const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// const NOME_COMPETICAO = "Campeonato Paulista de Futsal 2026";
// const TIPO_COMPETICAO = TipoCompeticao.BASE;
// const ANO_COMPETICAO = 2026;
// const CAMINHO_ARQUIVO = './tabela_federacao.csv';

// async function main() {
//     console.log(`Iniciando Importador IA para [${TIPO_COMPETICAO}]...`);

//     let competicao = await prisma.competicao.findFirst({ where: { nome: NOME_COMPETICAO } });
//     if (!competicao) {
//         competicao = await prisma.competicao.create({
//             data: { nome: NOME_COMPETICAO, ano: ANO_COMPETICAO, tipo: TIPO_COMPETICAO }
//         });
//         console.log(`Competição criada: ${competicao.nome}`);
//     }

//     if (!fs.existsSync(CAMINHO_ARQUIVO)) {
//         console.error(`Arquivo ${CAMINHO_ARQUIVO} não encontrado!`);
//         process.exit(1);
//     }

//     const conteudoTabela = fs.readFileSync(CAMINHO_ARQUIVO, 'utf-8');

//     const linhas = conteudoTabela.split('\n');
//     const indicesOcian = linhas.reduce((acc: number[], linha, i) => {
//         if (linha.toLowerCase().includes('ocian')) acc.push(i);
//         return acc;
//     }, []);

//     const indicesComContexto = new Set<number>();
//     indicesOcian.forEach(i => {
//         for (let j = Math.max(0, i - 2); j <= Math.min(linhas.length - 1, i + 2); j++) {
//             indicesComContexto.add(j);
//         }
//     });

//     const conteudoFiltrado = Array.from(indicesComContexto)
//         .sort((a, b) => a - b)
//         .map(i => linhas[i])
//         .join('\n');

//     console.log(`CSV: ${linhas.length} linhas → ${indicesComContexto.size} linhas filtradas`);

//     const ehBase = TIPO_COMPETICAO === TipoCompeticao.BASE;

//     const prompt = `
// Você é especialista em ler tabelas da Federação Paulista de Futsal.
// Extraia TODOS os jogos únicos onde "Ocian" (ou "Ocian Praia Clube" ou "Ocian Praia Clube/AJR") aparece.

// Tipo: ${TIPO_COMPETICAO}

// ${ehBase ? `COMPETIÇÃO BASE - tem grupos A, B e C:
// - O grupo pode aparecer no texto perto do time. Capture a letra do grupo.` 
// : `COMPETIÇÃO INICIAÇÃO - sem grupos`}

// REGRAS:
// 1. Extraia TODOS os jogos, tanto em casa quanto fora
// 2. Ocian no lado DIREITO do "vs" = visitante (ocianMandante: false)
// 3. Ocian no lado ESQUERDO do "vs" = mandante (ocianMandante: true)
// 4. Data converta para YYYY-MM-DD
// 5. Horário converta para HH:MM (ex: "14h30" → "14:30")
// 6. Local vem após "Local:" na linha
// 7. NÃO duplique jogos - cada confronto único aparece UMA vez

// Devolva APENAS o array JSON, sem texto antes ou depois, sem markdown.

// Formato:
// [
//   {
//     "grupo": "C",
//     "data": "2026-05-02",
//     "horario": "14:30",
//     "local": "Arena SEECLAG",
//     "adversario": "AD GALATA",
//     "ocianMandante": false
//   }
// ]

// Jogos:
// ${conteudoFiltrado}
// `;

//     console.log("Enviando para a IA...");

//     const model = genIA.getGenerativeModel({ model: "gemini-2.5-flash" });
//     const result = await model.generateContent(prompt);

//     let respostaIA = result.response.text().trim();
//     respostaIA = respostaIA.replace(/```json/g, '').replace(/```/g, '').trim();

//     const inicioJSON = respostaIA.indexOf('[');
//     const fimJSON = respostaIA.lastIndexOf(']');
//     if (inicioJSON === -1 || fimJSON === -1) {
//         console.error("IA não retornou JSON válido:", respostaIA);
//         process.exit(1);
//     }
//     respostaIA = respostaIA.slice(inicioJSON, fimJSON + 1);

//     let jogosMapeados: any[];
//     try {
//         jogosMapeados = JSON.parse(respostaIA);
//     } catch {
//         console.error("Erro ao parsear JSON:", respostaIA);
//         process.exit(1);
//     }

//     const vistos = new Set<string>();
//     jogosMapeados = jogosMapeados.filter(j => {
//         const chave = `${j.data}_${j.adversario}_${j.ocianMandante}`;
//         if (vistos.has(chave)) return false;
//         vistos.add(chave);
//         return true;
//     });

//     jogosMapeados.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
//     const grupoGlobal = jogosMapeados.find(j => j.grupo && j.grupo !== null)?.grupo || null;

//     for (let i = 0; i < jogosMapeados.length; i++) {
//         jogosMapeados[i].rodada = i + 1; 
//         if (grupoGlobal && ehBase) {
//             jogosMapeados[i].grupo = grupoGlobal; 
//         }
//     }

//     console.log(`\nIA identificou ${jogosMapeados.length} jogo(s) únicos do Ocian:`);
//     jogosMapeados.forEach((j: any) => {
//         const casa = j.ocianMandante ? 'CASA' : 'FORA';
//         const grupoStr = j.grupo ? ` | Grupo ${j.grupo}` : '';
//         console.log(`  Rodada ${j.rodada}${grupoStr} | ${casa} vs ${j.adversario} | ${j.data} ${j.horario}`);
//     });

//     const tipoCategoria = TIPO_COMPETICAO === TipoCompeticao.BASE
//         ? TipoCategoria.BASE
//         : TipoCategoria.INICIACAO;

//     const categoriasNoBanco = await prisma.categoria.findMany({
//         where: { tipo: tipoCategoria }
//     });

//     if (categoriasNoBanco.length === 0) {
//         console.error(`Nenhuma categoria ${tipoCategoria} encontrada.`);
//         process.exit(1);
//     }

//     const ordemBase = ['sub-18', 'sub-14', 'sub-16', 'sub-12'];
//     const ordemIniciacao = ['sub-7', 'sub-8', 'sub-9', 'sub-10'];
//     const ordemEscolhida = ehBase ? ordemBase : ordemIniciacao;

//     categoriasNoBanco.sort((a, b) => {
//         const nomeA = a.nome.toLowerCase();
//         const nomeB = b.nome.toLowerCase();
//         const idxA = ordemEscolhida.findIndex(o => nomeA.includes(o));
//         const idxB = ordemEscolhida.findIndex(o => nomeB.includes(o));
//         return idxA - idxB;
//     });

//     console.log(`\nOrdem das categorias: ${categoriasNoBanco.map(c => c.nome).join(' → ')}`);
//     console.log(`Criando partidas para ${categoriasNoBanco.length} categoria(s)...\n`);

//     for (const jogo of jogosMapeados) {
//         console.log(`Processando Rodada ${jogo.rodada} | vs ${jogo.adversario}`);

//         const [horaBase, minutoBase] = jogo.horario.split(':').map(Number);

//         for (let i = 0; i < categoriasNoBanco.length; i++) {
//             const cat = categoriasNoBanco[i];

//             const hora = (horaBase + i) % 24;
//             const horarioFinal = `${hora.toString().padStart(2, '0')}:${minutoBase.toString().padStart(2, '0')}`;
            
//             const dataDaPartida = new Date(`${jogo.data}T00:00:00Z`);
//             const hoje = new Date();
//             const statusDaPartida = dataDaPartida < hoje ? StatusPartida.FINALIZADA : StatusPartida.AGENDADA;

//             let timeOcian = await prisma.time.findFirst({
//                 where: { nome: { contains: "Ocian", mode: 'insensitive' }, categoria_id: cat.id }
//             });
//             if (!timeOcian) {
//                 timeOcian = await prisma.time.create({
//                     data: { nome: "CFA Ocian", categoria_id: cat.id }
//                 });
//             }

//             let timeAdversario = await prisma.time.findFirst({
//                 where: { nome: { contains: jogo.adversario, mode: 'insensitive' }, categoria_id: cat.id }
//             });
            
//             if (!timeAdversario) {
//                 timeAdversario = await prisma.time.create({
//                     data: { nome: jogo.adversario, categoria_id: cat.id }
//                 });
//                 console.log(`  Novo time: ${jogo.adversario} (${cat.nome})`);
//             }

//             if (jogo.rodada) {
//             const rodadaDuplicada = await prisma.partida.findFirst({
//                 where: {
//                     competicao_id: competicao.id,
//                     categoria_id: cat.id,
//                     rodada: Number(jogo.rodada)
//                 }
//             });

//             if (rodadaDuplicada) {
//                     console.log(`  Rodada ${jogo.rodada} já cadastrada para o ${cat.nome}. Pulando...`);
//                     continue;
//                 }
//             }

//             const choqueHorario = await prisma.partida.findFirst({
//                 where: {
//                     categoria_id: cat.id,
//                     data: dataDaPartida,
//                     horario: horarioFinal
//                 }
//             });

//             if (choqueHorario) {
//                 console.log(`  CONFLITO: O ${cat.nome} já possui jogo no dia ${jogo.data} às ${horarioFinal}! Pulando...`);
//                 continue; 
//             }

//             await prisma.partida.create({
//                 data: {
//                     competicao_id: competicao.id,
//                     categoria_id: cat.id,
//                     rodada: jogo.rodada ? Number(jogo.rodada) : null,
//                     grupo: jogo.grupo || null,
//                     data: dataDaPartida,
//                     horario: horarioFinal,
//                     status: statusDaPartida,
//                     local: jogo.local,
//                     emCasa: Boolean(jogo.ocianMandante),
//                     mandante_id: jogo.ocianMandante ? timeOcian.id : timeAdversario.id,
//                     visitante_id: jogo.ocianMandante ? timeAdversario.id : timeOcian.id,
//                 }
//             });
            
//             const casaOuFora = jogo.ocianMandante ? 'CASA' : 'FORA';
//             console.log(`   ${cat.nome} | ${statusDaPartida} | ${casaOuFora} | ${horarioFinal}`);
//         }
//     }

//     console.log("\n Importação concluída!");
// }

// main()
//     .then(async () => { await prisma.$disconnect(); process.exit(0); })
//     .catch(async (e) => { console.error("Erro:", e); await prisma.$disconnect(); process.exit(1); });