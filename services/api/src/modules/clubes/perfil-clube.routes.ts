import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirClubePublico, exigirGestorDoClube } from '../../middlewares/permissoes.middleware';
import { fotoValida } from '../../utils/foto';
import { lerEndereco } from './endereco';
const router = Router();
router.get('/clube/perfil', exigirClubePublico, async (req,res) => {
  try { const club = await prisma.clube.findUnique({ where: { id: (req as any).clubeId }, select: { id:true,nome:true,escudo:true,endereco:true,cidade:true,estado:true } }); return res.json(club); }
  catch { return res.status(500).json({ error:'Não foi possível carregar o clube.' }); }
});
router.patch('/clube/perfil', exigirGestorDoClube, async (req,res) => {
  if ((req as any).papelUsuario !== 'ADMIN') return res.status(403).json({ error:'Somente o administrador do clube pode editar a sede.' });
  const { nome, escudo, endereco } = req.body;
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 120 || /\p{Extended_Pictographic}/u.test(nome) || !fotoValida(escudo)) return res.status(400).json({ error:'Nome ou escudo inválido.' });
  let address;
  try { address = lerEndereco(endereco); } catch(error) { return res.status(400).json({ error:(error as Error).message }); }
  try {
    const club = await prisma.clube.update({ where:{ id:(req as any).clubeId }, data:{ nome:nome.trim(),escudo,endereco:address ?? Prisma.DbNull,...(address ? { cidade:address.cidade,estado:address.estado } : {}) }, select:{id:true,nome:true,escudo:true,endereco:true,cidade:true,estado:true} });
    return res.json(club);
  } catch { return res.status(500).json({ error:'Não foi possível salvar o clube.' }); }
});
export default router;
