import type { NextFunction, Request, Response } from 'express';

import { getUsuarioId } from '../auth/jwt';
import { prisma } from '../lib/prisma';
import { idPositivo } from '../utils/id';

const PAPEIS_GESTORES = ['ADMIN', 'TECNICO', 'MESARIO'] as const;

export function exigirGestorDoClube(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) {
    return res.status(401).json({ error: 'Token inválido ou não enviado' });
  }

  const clubeId = idPositivo(req.headers['x-clube-id']);
  if (!clubeId) {
    return res
      .status(400)
      .json({ error: 'Header x-clube-id inválido ou ausente' });
  }

  prisma.usuarioClube
    .findUnique({
      where: {
        usuario_id_clube_id: {
          usuario_id: usuarioId,
          clube_id: clubeId,
        },
      },
    })
    .then(vinculo => {
      if (!vinculo) {
        return res
          .status(403)
          .json({ error: 'Você não tem vínculo com este clube' });
      }

      if (!PAPEIS_GESTORES.includes(vinculo.papel as any)) {
        return res.status(403).json({
          error:
            'Apenas administradores, técnicos ou mesários podem gerenciar partidas',
        });
      }

      (req as any).usuarioId = usuarioId;
      (req as any).clubeId = clubeId;
      (req as any).papelUsuario = vinculo.papel;
      next();
    })
    .catch(() =>
      res.status(500).json({ error: 'Erro ao verificar permissão do clube' })
    );
}

export function exigirAdminDoClube(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if ((req as any).papelUsuario !== 'ADMIN') {
    return res.status(403).json({
      error: 'Apenas administradores podem enviar convites',
    });
  }

  next();
}

export interface EscopoCategorias {
  acessoTotal: boolean;
  categoriaIds: number[];
}

export async function obterEscopoCategorias(
  usuarioId: number,
  clubeId: number
): Promise<EscopoCategorias> {
  const vinculo = await prisma.usuarioClube.findUnique({
    where: {
      usuario_id_clube_id: {
        usuario_id: usuarioId,
        clube_id: clubeId,
      },
    },
    select: {
      papel: true,
      acesso_todas_categorias: true,
      categorias: {
        select: {
          categoria_id: true,
        },
      },
    },
  });

  if (!vinculo || vinculo.papel === 'TORCEDOR') {
    return { acessoTotal: false, categoriaIds: [] };
  }

  const acessoTotal =
    vinculo.papel === 'ADMIN' || vinculo.acesso_todas_categorias;

  return {
    acessoTotal,
    categoriaIds: vinculo.categorias.map(categoria => categoria.categoria_id),
  };
}

export async function podeAcessarCategoria(
  usuarioId: number,
  clubeId: number,
  categoriaId: number
): Promise<boolean> {
  const escopo = await obterEscopoCategorias(usuarioId, clubeId);
  return escopo.acessoTotal || escopo.categoriaIds.includes(categoriaId);
}

export async function exigirAcessoTotalCategorias(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const escopo = await obterEscopoCategorias(
      (req as any).usuarioId as number,
      (req as any).clubeId as number
    );

    if (!escopo.acessoTotal) {
      return res.status(403).json({
        error: 'Esta operação exige acesso a todas as categorias do clube',
      });
    }

    next();
  } catch {
    return res
      .status(500)
      .json({ error: 'Erro ao verificar o escopo de categorias' });
  }
}

export function exigirPartidaDoClube(idParam: (req: Request) => number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const partidaId = idParam(req);
    const clubeId = (req as any).clubeId as number;
    const usuarioId = (req as any).usuarioId as number;

    try {
      const partida = await prisma.partida.findUnique({
        where: { id: partidaId },
        select: {
          categoria_id: true,
          categoria: { select: { clube_id: true } },
        },
      });

      if (!partida || partida.categoria.clube_id !== clubeId) {
        return res
          .status(403)
          .json({ error: 'Esta partida não pertence ao clube ativo' });
      }

      if (
        !(await podeAcessarCategoria(
          usuarioId,
          clubeId,
          partida.categoria_id
        ))
      ) {
        return res.status(403).json({
          error: 'Você não administra a categoria desta partida',
        });
      }

      next();
    } catch {
      return res
        .status(500)
        .json({ error: 'Erro ao verificar permissão da partida' });
    }
  };
}

function exigirRecursoDoClube(
  pertence: (
    id: number,
    clubeId: number,
    usuarioId: number
  ) => Promise<boolean>,
  idParam: (req: Request) => number = req => Number(req.params.id)
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = idPositivo(idParam(req));
    const clubeId = (req as any).clubeId as number;
    const usuarioId = (req as any).usuarioId as number;

    if (!id) return res.status(400).json({ error: 'ID inválido' });

    try {
      if (!(await pertence(id, clubeId, usuarioId))) {
        return res
          .status(403)
          .json({ error: 'Recurso fora do seu escopo de categorias' });
      }
      next();
    } catch {
      return res
        .status(500)
        .json({ error: 'Erro ao verificar permissão do recurso' });
    }
  };
}

export const exigirTimeDoClube = exigirRecursoDoClube(
  async (id, clubeId, usuarioId) => {
    const time = await prisma.time.findFirst({
      where: { id, categoria: { clube_id: clubeId } },
      select: { categoria_id: true },
    });
    return (
      !!time?.categoria_id &&
      podeAcessarCategoria(usuarioId, clubeId, time.categoria_id)
    );
  }
);

export const exigirCompeticaoDoClube = exigirRecursoDoClube(
  async (id, clubeId) => {
    const total = await prisma.competicao.count({
      where: { id, clube_id: clubeId },
    });
    return total === 1;
  }
);

export const exigirJogadorDoClube = exigirRecursoDoClube(
  async (id, clubeId, usuarioId) => {
    const jogador = await prisma.jogador.findFirst({
      where: { id, categoria: { clube_id: clubeId } },
      select: { categoria_id: true },
    });
    return (
      !!jogador &&
      podeAcessarCategoria(usuarioId, clubeId, jogador.categoria_id)
    );
  }
);
