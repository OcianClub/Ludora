import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const target = new URL(process.env.PAULISTA_TEST_DATABASE_URL || '');
assert.equal(target.hostname, '127.0.0.1'); assert.ok(target.port === '55441' && target.pathname === '/ludora_paulista' || target.port === '55442' && target.pathname === '/ludora_paulista_ops', 'Somente bancos descartáveis autorizados.');
Object.assign(process.env, { DATABASE_URL: target.href, DIRECT_URL: target.href, NODE_ENV: 'test' });
async function main() {
  const { prisma } = await import('../src/lib/prisma.js');
  const bcrypt = (await import('bcrypt')).default;
  try {
    const user = await prisma.usuario.update({ where: { email: 'pilot@example.test' }, data: { senha: await bcrypt.hash('LocalPilotFixture123!', 10) } });
    const clube = await prisma.clube.findFirstOrThrow({ where: { nome: 'Ocian · TESTE ISOLADO' } });
    await prisma.usuarioClube.upsert({ where: { usuario_id_clube_id: { usuario_id: user.id, clube_id: clube.id } }, create: { usuario_id: user.id, clube_id: clube.id, papel: 'ADMIN', acesso_todas_categorias: true }, update: {} });
    const categoria = await prisma.categoria.findFirstOrThrow({ where: { clube_id: clube.id, faixaIdade: 7 } });
    await prisma.jogador.upsert({ where: { cpf: '99999999999' }, create: { nome: 'Taylor Example · TESTE', cpf: '99999999999', dtNasc: new Date('2019-05-01'), posicao: 'Fixo', numCamisa: 8, categoria_id: categoria.id }, update: {} });
    const jogo = await prisma.fpfsJogo.findUniqueOrThrow({ where: { sumulaId: 139195 } });
    await prisma.partida.update({ where: { id: jogo.partidaId! }, data: { gols_mandante: 9 } });
    const evento = await prisma.fpfsEvento.findUniqueOrThrow({ where: { id: 900 } });
    const snapshot = evento.payload as any;
    await prisma.fpfsCatalogo.upsert({ where: { id: 900 }, create: { id: 900, ano: evento.ano, categoria: evento.categoria, divisao: evento.divisao, equipes: snapshot.equipes, acompanhado: true, sucessoEm: new Date(), proximaEm: new Date(Date.now() + 86_400_000) }, update: {} });
    const { importar } = await import('../src/modules/paulista/service.js');
    await importar(prisma, snapshot, user.id);
    const sintetico = await prisma.clube.findFirstOrThrow({ where: { nome: 'Harbor FC · TESTE' } });
    await prisma.fpfsAuditoria.deleteMany({ where: { eventoId: 99000003, acao: 'SUGESTAO_REJEITADA' } });
    await fs.writeFile('../../test-results/paulista/ui-context.json', JSON.stringify({ clube: { ...clube, meuPapel: 'ADMIN' }, clubeSinteticoId: sintetico.id, usuario: { id: user.id, nome: user.nome, email: user.email }, localId: jogo.partidaId }));
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
