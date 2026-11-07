// Execução única após a confirmação humana registrada para este piloto.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { confirmarCandidato, executarCiclo } from '../src/modules/paulista/operations';
import { importar } from '../src/modules/paulista/service';
import { baixarEvento } from '../src/modules/paulista/provider';
async function main() {
  if (!process.argv.includes('--confirmar-ocian') || process.env.PAULISTA_ENABLED !== 'true') throw new Error('Execução exige --confirmar-ocian e módulo habilitado.');
  const clube = await prisma.clube.findUniqueOrThrow({ where: { id: 2 }, include: { categorias: true } });
  if (clube.nome !== 'Ocian' || !clube.categorias.some(c => c.id === 9 && c.faixaIdade === 7)) throw new Error('Cadastro difere da identidade confirmada; interrompido.');
  const operador = await prisma.usuario.findFirstOrThrow({ where: { papel_plataforma: 'SUPERADMIN' }, select: { id: true } });
  const sync = async (id: number) => importar(prisma, await baixarEvento(id), null);
  await executarCiclo(prisma, sync);
  await confirmarCandidato(prisma, 900, 12423, 2, operador.id, 'Confirmação humana do usuário: clube 2 é Ocian Praia Clube de Praia Grande; Sub-7 local 9, equipe oficial 12423. Operação técnica autorizada nesta tarefa.');
  await executarCiclo(prisma, sync);
  const c = await prisma.fpfsCatalogo.findUniqueOrThrow({ where: { id: 900 } });
  if (c.erro) throw new Error(c.erro);
  console.log({ evento: 900, equipeOficial: 12423, clube: 2, partidasOperacionais: await prisma.fpfsJogo.count({ where: { eventoId: 900, partidaId: { not: null } } }), catalogo: await prisma.fpfsCatalogo.count(), proxima: c.proximaEm });
}
main().catch(e => { console.error(e.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[conexão omitida]')); process.exitCode = 1; }).finally(() => prisma.$disconnect());
