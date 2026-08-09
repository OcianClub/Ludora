// import fs from 'fs';
// import csv from 'csv-parser';
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// const NOME_COMPETICAO = "Campeonato Paulista de Futsal 2026 - Base";
// const ANO_COMPETICAO = 2026;

// const ORDEM_BASE = [
//   { nomeSub: "sub-18", acrescimoHoras: 0 }, 
//   { nomeSub: "sub-14", acrescimoHoras: 1 }, 
//   { nomeSub: "sub-16", acrescimoHoras: 2 }, 
//   { nomeSub: "sub-12", acrescimoHoras: 3 }  
// ];

// function calcularHorarioSequencial(horaBase: string | null, horasParaSomar: number): string | null {
//   if (!horaBase) return null;
//   let [hora, minuto] = horaBase.replace('h', ':').split(':').map(Number);
//   hora += horasParaSomar;
//   return `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
// }

// async function main() {
//   console.log("Iniciando o Robô Leitor de Tabela do Ocian...");

//   let competicao = await prisma.competicao.findFirst({ where: { nome: NOME_COMPETICAO } });
//   if (!competicao) {
//     competicao = await prisma.competicao.create({
//       data: { nome: NOME_COMPETICAO, ano: ANO_COMPETICAO }
//     });
//   }

//   // 1. A REPRESA: Guarda os dados aqui antes de ir pro banco
//   const jogosParaProcessar: any[] = [];
  
//   let dataSalva: string | null = null;
//   let horaSalva: string | null = null;
//   let localSalvo: string | null = null;

//   console.log(" Lendo o arquivo CSV...");

//   fs.createReadStream('tabela_federacao.csv')
//     .pipe(csv({ separator: ';', headers: false })) 
//     .on('data', (linha) => {
//       // SEM ASYNC AQUI! O Stream voa solto lendo o CSV.
//       const coluna0 = linha['0'] ? linha['0'].trim() : '';

//       if (coluna0.includes('/')) {
//         dataSalva = coluna0;
//         horaSalva = linha['2'] ? linha['2'].trim() : null; 
//         localSalvo = linha['4'] ? linha['4'].replace('Local: ', '').trim() : null;
//       } 
//       else if (coluna0.includes('Jogo nº')) {
//         const mandanteStr = linha['4'] ? linha['4'].trim() : '';
//         let visitanteStr = '';
        
//         // Correção do TypeScript que fizemos
//         const valoresDaLinha = Object.values(linha) as string[];
//         const indexVS = valoresDaLinha.findIndex(val => typeof val === 'string' && val.trim() === 'vs');
//         if (indexVS !== -1 && valoresDaLinha[indexVS + 1]) {
//             visitanteStr = valoresDaLinha[indexVS + 1].trim();
//         }

//         const envolveOcian = mandanteStr.toUpperCase().includes("OCIAN") || visitanteStr.toUpperCase().includes("OCIAN");

//         if (mandanteStr && visitanteStr && dataSalva && envolveOcian) {
//             // Guarda na Represa
//             jogosParaProcessar.push({
//                 mandanteStr, visitanteStr, dataSalva, horaSalva, localSalvo
//             });
//             dataSalva = null; 
//         }
//       }
//     })
//     .on('end', async () => {
//       console.log(`Leitura finalizada! Foram encontrados ${jogosParaProcessar.length} confrontos do Ocian.`);
//       console.log("Salvando no banco de dados com segurança...\n");

//       // 2. SALVANDO NO BANCO (Com calma, sem atropelar)
//       for (const jogo of jogosParaProcessar) {
//         console.log(`Processando: ${jogo.mandanteStr} x ${jogo.visitanteStr} (Data: ${jogo.dataSalva})`);

//         for (const regra of ORDEM_BASE) {
//             const categoria = await prisma.categoria.findFirst({ where: { nome: regra.nomeSub } });
//             if (!categoria) continue;

//             let mandante = await prisma.time.findFirst({ where: { nome: jogo.mandanteStr } });
//             if (!mandante) {
//                 mandante = await prisma.time.create({ 
//                 data: { 
//                     nome: jogo.mandanteStr, 
//                     categorias: { connect: [{ id: categoria.id }] } 
//                 } 
//               });
//             }

//             let visitante = await prisma.time.findFirst({ where: { nome: jogo.visitanteStr } });
//             if (!visitante) {
//                 visitante = await prisma.time.create({ data: { nome: jogo.visitanteStr } });
//             }

//             const [dia, mes, ano] = jogo.dataSalva.split('/');
//             const anoCompleto = ano.length === 2 ? `20${ano}` : ano; 
//             const dataFormatada = new Date(`${anoCompleto}-${mes}-${dia}T12:00:00Z`);

//             const horaDoJogo = calcularHorarioSequencial(jogo.horaSalva, regra.acrescimoHoras);
//             const emCasa = jogo.mandanteStr.toUpperCase().includes("OCIAN");

//             await prisma.partida.create({
//               data: {
//                 data: dataFormatada,
//                 horario: horaDoJogo,
//                 local: jogo.localSalvo,
//                 emCasa: emCasa,
//                 mandante_id: mandante.id,
//                 visitante_id: visitante.id,
//                 categoria_id: categoria.id,
//                 competicao_id: competicao.id,
//               }
//             });

//             console.log(`  -> Cadastrado: ${regra.nomeSub.toUpperCase()} jogará às ${horaDoJogo}`);
//         }
//       }

//       console.log("\nTudo salvo com sucesso! O banco de dados do Ocian está populado.");
//       await prisma.$disconnect();
//     });
// }

// main().catch(console.error);