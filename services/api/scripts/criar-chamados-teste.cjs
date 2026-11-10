/* Exemplos idempotentes para a fila desktop. Não envia e-mails/notificações. */
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const prisma = new PrismaClient();
const categorias = ['novo', 'atrasado', 'recorrente', 'meus', 'encaminhado'];
const ids = categorias.map(c => `demo-desktop-chamado-${c}`);

async function main() {
  const email = process.argv.find(a => a.startsWith('--operador='))?.slice('--operador='.length);
  if (!email) throw new Error('Informe --operador=email-da-conta para o exemplo de Meus chamados.');
  const operador = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nome: true, papel_plataforma: true, suspenso: true } });
  if (!operador || operador.suspenso || !['SUPERADMIN', 'SUPORTE'].includes(operador.papel_plataforma)) throw new Error('O operador deve ser uma conta ativa de suporte ou administrador Ludora.');
  const agora = new Date();
  const h = n => new Date(agora.getTime() + n * 3600000);
  const base = { origem:'OPERACAO', impacto:'DIFICULDADE', tipo:'ERRO', prioridade:'NORMAL', fila:'SUPORTE', regra:'TRIAGEM_HUMANA', restrito:false, rota:'/partidas', servico:'web', versao:'teste visual desktop', revisarEm:h(48), criadoEm:h(-.5) };
  const exemplos = [
    { ...base, status:'NOVO', assunto:'[TESTE] Novo relato de alinhamento do placar', descricao:'Exemplo fictício para validar a aba Novos. Em uma janela estreita, conferir o alinhamento do placar e dos nomes das equipes.' },
    { ...base, status:'EM_TRIAGEM', prioridade:'ALTA', criadoEm:h(-48), revisarEm:h(-2), assunto:'[TESTE] Revisão de chamado com prazo vencido', descricao:'Exemplo fictício com revisão vencida há duas horas. Serve para testar o indicador de atraso e o filtro Revisão atrasada.' },
    { ...base, origem:'AUTOMATICO', status:'EM_ANDAMENTO', ocorrencias:3, assunto:'[TESTE] Ocorrência recorrente na busca de atletas', rota:'/jogadores', descricao:'Exemplo fictício de três relatos agrupados sobre a busca. Serve para validar a apresentação e o filtro de Recorrentes.' },
    { ...base, status:'AGUARDANDO_CLIENTE', responsavelId:operador.id, tipo:'DUVIDA', regra:'OPERACAO_CONHECIDA', assunto:'[TESTE] Acompanhamento atribuído à minha conta', descricao:'Exemplo fictício atribuído ao operador informado. Serve para validar a aba Meus chamados e a continuidade do atendimento.' },
    { ...base, status:'ENCAMINHADO_DEVS', fila:'DESENVOLVIMENTO', assunto:'[TESTE] Ajuste encaminhado ao desenvolvimento', servico:'desktop', rota:'/chamados', descricao:'Exemplo fictício encaminhado ao desenvolvimento para validar a caixa de desenvolvimento e o relatório técnico.', detalhesTecnicos:{ reproducao:'Abrir Chamados, reduzir a janela e conferir a legibilidade dos nomes e a área de toque dos filtros.' } },
  ];
  const existentes = await prisma.suporteChamado.findMany({ where:{id:{in:ids}}, select:{id:true} });
  if (!process.argv.includes('--aplicar')) {
    console.log(JSON.stringify({simulacao:true,operador:operador.nome,novos:ids.length - existentes.length,existentes:existentes.length,categorias}));
    return;
  }
  await prisma.$transaction(async tx => {
    for (const [i, dados] of exemplos.entries()) {
      const hash = createHash('sha256').update(ids[i]).digest('hex');
      const requestId = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
      await tx.suporteChamado.upsert({ where:{id:ids[i]}, update:{}, create:{ id:ids[i], requestId, ...dados,
        historico:{create:{ acao:'CRIADO_TESTE', motivo:'Chamado fictício para validação visual do desktop. Nenhum problema real foi reportado.', criadoEm:dados.criadoEm }},
      }});
    }
  });
  const testes = {Todos:{id:{in:ids}},Novos:{id:ids[0],status:'NOVO'},RevisaoAtrasada:{id:ids[1],status:{not:'RESOLVIDO'},revisarEm:{lt:agora}},Recorrentes:{id:ids[2],ocorrencias:{gt:1}},Meus:{id:ids[3],responsavelId:operador.id},Encaminhados:{id:ids[4],status:'ENCAMINHADO_DEVS',fila:'DESENVOLVIMENTO'}};
  const contagens = {};
  for (const [categoria, where] of Object.entries(testes)) contagens[categoria] = await prisma.suporteChamado.count({where});
  if (Object.values(contagens).some(n => n < 1)) throw new Error('Um exemplo existente foi modificado e não corresponde mais à categoria original. Seus dados foram preservados.');
  console.log(JSON.stringify({criados:ids.length - existentes.length,preservados:existentes.length,operador:operador.nome,contagens}));
}
main().catch(error => { console.error(error.code ? `Não foi possível criar os exemplos (${error.code}).` : error.message); process.exitCode=1; }).finally(() => prisma.$disconnect());
