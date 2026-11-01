import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { exigirMembroDoClube, exigirAdminDoClube } from '../../middlewares/permissoes.middleware';
import { ErroOperacao, responderErroOperacao } from '../../utils/erro-operacao';
const router = Router();
// Até existir o administrador global da empresa, exige administração dos dois clubes.
router.patch('/times/vinculo', exigirMembroDoClube, exigirAdminDoClube, async (req,res) => {
  const {time_ids:ids, clube_id:target, motivo} = req.body ?? {};
  if (!Array.isArray(ids) || !ids.length || ids.length > 30 || ids.some(id=>!Number.isSafeInteger(id)||id<1) || new Set(ids).size!==ids.length || (target !== null && (!Number.isSafeInteger(target)||target<1)) || typeof motivo !== 'string' || motivo.trim().length<5 || motivo.length>300) return res.status(400).json({error:'Informe times, clube (ou null para desfazer) e motivo'});
  try {
    await prisma.$transaction(async tx => {
      const actor=await tx.usuarioClube.findUnique({where:{usuario_id_clube_id:{usuario_id:(req as any).usuarioId,clube_id:(req as any).clubeId}}});
      if(actor?.papel!=='ADMIN') throw new ErroOperacao('Seu acesso administrativo mudou');
      const times = await tx.time.findMany({where:{id:{in:ids},categoria:{clube_id:(req as any).clubeId}}});
      if (times.length !== ids.length) throw new ErroOperacao('Times fora do clube ativo');
      const affected = [...new Set([...times.map(t=>t.clube_representado_id),target].filter((id):id is number=>id!==null))];
      const managed = await tx.usuarioClube.count({where:{usuario_id:(req as any).usuarioId,clube_id:{in:affected},papel:'ADMIN'}});
      if(managed!==affected.length) throw new ErroOperacao('É necessário administrar os clubes envolvidos no vínculo');
      for(const time of times) {
        if(time.clube_representado_id===target) continue;
        await tx.auditoriaVinculoTime.create({data:{time_id:time.id,clube_anterior_id:time.clube_representado_id,clube_novo_id:target,usuario_id:(req as any).usuarioId,motivo:motivo.trim()}});
        await tx.time.update({where:{id:time.id},data:{clube_representado_id:target}});
      }
    },{isolationLevel:'Serializable'});
    res.json({ok:true});
  }catch(e){ responderErroOperacao(res, e, 'Não foi possível atualizar o vínculo do time. Tente novamente.'); }
});
export default router;
