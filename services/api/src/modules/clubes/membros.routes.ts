import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { exigirMembroDoClube, exigirAdminDoClube } from '../../middlewares/permissoes.middleware';
import { validarCargo } from './membros.rules';
const router = Router();
router.use('/membros', exigirMembroDoClube, exigirAdminDoClube);
router.get('/membros', async (req, res) => {
  const members = await prisma.usuarioClube.findMany({ where: { clube_id: (req as any).clubeId },
    select: { id:true, papel:true, acesso_todas_categorias:true, usuario:{select:{id:true,nome:true}}, categorias:{select:{categoria_id:true}} }, orderBy:{id:'asc'} });
  res.json(members);
});
router.patch('/membros/:id', async (req, res) => {
  let input: ReturnType<typeof validarCargo>;
  try { input = validarCargo(req.body); } catch (e) { return res.status(400).json({error:(e as Error).message}); }
  const id = Number(req.params.id), clubeId = (req as any).clubeId;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:'Membro inválido'});
  try {
    await prisma.$transaction(async tx => {
      const actor = await tx.usuarioClube.findUnique({where:{usuario_id_clube_id:{usuario_id:(req as any).usuarioId,clube_id:clubeId}}});
      if(actor?.papel !== 'ADMIN') throw new Error('Seu acesso administrativo mudou. Atualize a página.');
      const member = await tx.usuarioClube.findFirst({where:{id,clube_id:clubeId}});
      if (!member) throw new Error('Membro não encontrado neste clube');
      // Evita perder o acesso administrativo por engano; outro admin pode alterar esse cargo.
      if (member.usuario_id === (req as any).usuarioId) throw new Error('Peça a outro administrador para alterar seu cargo');
      const valid = await tx.categoria.count({where:{id:{in:input.ids},clube_id:clubeId}});
      if (valid !== input.ids.length) throw new Error('Categoria de outro clube');
      await tx.usuarioClubeCategoria.deleteMany({where:{usuario_clube_id:id}});
      await tx.usuarioClube.update({where:{id},data:{papel:input.papel,acesso_todas_categorias:input.acessoTotal,
        categorias:{create:input.ids.map(categoria_id=>({categoria_id}))}}});
    }, {isolationLevel:'Serializable'});
    res.json({ok:true});
  } catch (e) { res.status(409).json({error:(e as any).code === 'P2034' ? 'Outra alteração ocorreu. Atualize e tente novamente.' : (e as Error).message}); }
});
export default router;
