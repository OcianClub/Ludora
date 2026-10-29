import { Router } from 'express';

import { getUsuarioId } from '../../auth/jwt';
import { prisma } from '../../lib/prisma';

const router = Router();

// ==========================================
// 1.1 CLUBES (descoberta + seguir)
// ==========================================
// OBS: "seguir" um clube = criar um vínculo UsuarioClube com papel TORCEDOR.
// Isso reaproveita o modelo que já existe (não precisou de migration nova).
// ADMIN/MESARIO/TECNICO continuam contando como "segue" também (isSeguindo=true),
// mas só quem é TORCEDOR pode "deixar de seguir" por aqui.

router.get('/clubes', async (req, res) => {
  const usuarioId = await getUsuarioId(req);
  const busca = String(req.query.busca || '').trim();

  try {
    const [clubes, partidasAoVivo] = await Promise.all([
      prisma.clube.findMany({
        where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
        orderBy: { nome: 'asc' },
        include: {
          usuarios: usuarioId ? {
            where: { usuario_id: usuarioId },
            select: {
              papel: true,
              acesso_todas_categorias: true,
              categorias: { select: { categoria: { select: { id: true, nome: true } } } },
            },
          } : false,
          _count: { select: { usuarios: true } },
        },
      }),
      prisma.partida.findMany({
        where: { status: 'AO_VIVO' },
        select: {
          categoria: { select: { clube_id: true } },
          mandante: { select: { clube_representado_id: true } },
          visitante: { select: { clube_representado_id: true } },
        },
      }),
    ]);
    const aoVivoPorClube = new Map<number, number>();
    for (const partida of partidasAoVivo) {
      const participantes = new Set([
        partida.categoria.clube_id,
        partida.mandante.clube_representado_id,
        partida.visitante.clube_representado_id,
      ]);
      for (const id of participantes) {
        if (id != null) aoVivoPorClube.set(id, (aoVivoPorClube.get(id) || 0) + 1);
      }
    }

    const formatados = clubes.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      escudo: c.escudo,
      cidade: c.cidade,
      estado: c.estado,
      plano: c.plano,
      seguidores: c._count.usuarios,
      partidasAoVivo: aoVivoPorClube.get(c.id) || 0,
      isSeguindo: usuarioId ? c.usuarios.length > 0 : false,
      papel: usuarioId && c.usuarios.length > 0 ? c.usuarios[0].papel : null,
      meuPapel: usuarioId && c.usuarios.length > 0 ? c.usuarios[0].papel : null,
      acessoTodasCategorias: usuarioId && c.usuarios.length > 0
        ? c.usuarios[0].papel === 'ADMIN' || c.usuarios[0].acesso_todas_categorias
        : false,
      categoriasAcesso: usuarioId && c.usuarios.length > 0
        ? c.usuarios[0].categorias.map((item: any) => item.categoria)
          .sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
        : [],
    }));

    res.json(formatados);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar clubes' });
  }
});

router.post('/clubes/:id/seguir', async (req, res) => {
  const usuarioId = await getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Token inválido ou não enviado' });

  const clube_id = Number(req.params.id);
  try {
    const vinculo = await prisma.usuarioClube.upsert({
      where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id } },
      update: {},
      create: { usuario_id: usuarioId, clube_id, papel: 'TORCEDOR' },
      include: { clube: true },
    });
    res.status(201).json({
      clube_id: vinculo.clube.id,
      nome: vinculo.clube.nome,
      escudo: vinculo.clube.escudo,
      papel: vinculo.papel,
      seguidores: await prisma.usuarioClube.count({ where: { clube_id } }),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao seguir clube' });
  }
});

router.delete('/clubes/:id/seguir', async (req, res) => {
  const usuarioId = await getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Token inválido ou não enviado' });

  const clube_id = Number(req.params.id);
  try {
    const vinculo = await prisma.usuarioClube.findUnique({
      where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id } },
    });
    if (!vinculo) return res.status(404).json({ error: 'Você não segue este clube' });
    if (vinculo.papel !== 'TORCEDOR' && vinculo.papel !== 'OLHEIRO') {
      return res.status(403).json({
        error: 'Apenas torcedores podem deixar de seguir por aqui. Admins/técnicos precisam transferir o cargo antes.',
      });
    }
    await prisma.usuarioClube.delete({ where: { id: vinculo.id } });
    res.json({ ok: true, seguidores: await prisma.usuarioClube.count({ where: { clube_id } }) });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao deixar de seguir clube' });
  }
});


export default router;
