import { concluirTarefasCadastro } from '../admin/tarefas-cadastro';
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirClubePublico, exigirGestorDoClube } from '../../middlewares/permissoes.middleware';
import { lerEndereco } from './endereco';
const router = Router();
router.get('/clube/perfil', exigirClubePublico, async (req,res) => {
  try { const club = await prisma.clube.findUnique({ where: { id: (req as any).clubeId }, select: { id:true,nome:true,escudo:true,endereco:true,cidade:true,estado:true } }); return res.json(club); }
  catch { return res.status(500).json({ error:'Não foi possível carregar o clube.' }); }
});
router.patch('/clube/perfil', exigirGestorDoClube, async (req,res) => {
  if ((req as any).papelUsuario !== 'ADMIN') return res.status(403).json({ error:'Somente o administrador do clube pode editar a sede.' });
  const { nome, escudo, endereco } = req.body ?? {};
  try {
    const atual = await prisma.clube.findUnique({ where: { id: (req as any).clubeId }, select: { nome: true, escudo: true } });
    if (!atual) return res.status(404).json({ error: 'Clube não encontrado.' });
    if ((nome !== undefined && nome !== atual.nome) || (escudo !== undefined && (escudo || null) !== atual.escudo)) {
      return res.status(403).json({ error: 'Nome e escudo do clube são gerenciados pelos superadministradores no desktop Ludora.' });
    }
    if (endereco === undefined) return res.status(400).json({ error: 'Informe os dados da sede que deseja atualizar.' });
    let address;
    try { address = lerEndereco(endereco); } catch(error) { return res.status(400).json({ error:(error as Error).message }); }
    const club = await prisma.$transaction(async tx => {
      const atual = await tx.clube.update({ where:{ id:(req as any).clubeId }, data:{ endereco:address ?? Prisma.DbNull,...(address ? { cidade:address.cidade,estado:address.estado } : {}) } });
      await concluirTarefasCadastro(tx, atual);
      return atual;
    });
    const { id, nome: nomeClube, escudo: escudoClube, endereco: sede, cidade, estado } = club;
    return res.json({ id, nome: nomeClube, escudo: escudoClube, endereco: sede, cidade, estado });
  } catch { return res.status(500).json({ error:'Não foi possível salvar o clube.' }); }
});
export default router;
