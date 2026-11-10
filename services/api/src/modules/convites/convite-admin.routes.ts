import { CLUBE_DESATIVADO } from '../../middlewares/permissoes.middleware';
import { exigirOperacao } from '../manutencao/service';
import { randomBytes } from 'crypto';
import { cifrarCodigo, decifrarCodigo } from './codigo-seguro';
import { Router, type Request, type Response } from 'express';

import { prisma } from '../../lib/prisma';
import {
  exigirAdminDoClube,
  exigirGestorDoClube,
} from '../../middlewares/permissoes.middleware';
import { enviarEmailConvite } from '../../services/email';
import {
  gerarCodigoConvite,
  gerarHashCodigoConvite,
  gerarHashConvite,
} from './convite.utils';

const router = Router();

export async function listarConvites(req: Request, res: Response) {
  const clubeId = (req as any).clubeId as number;

  const statusInformado = req.query.status
    ? String(req.query.status).trim().toUpperCase()
    : null;

  const statusPermitidos = [
    'PENDENTE',
    'ACEITO',
    'REVOGADO',
    'EXPIRADO',
  ];

  if (
    statusInformado &&
    !statusPermitidos.includes(statusInformado)
  ) {
    return res.status(400).json({
      error: 'Status inválido',
    });
  }

  const limiteInformado = Number(req.query.limite || 50);
  const cursor = req.query.cursor ? String(req.query.cursor) : '';
  if (cursor && !/^[A-Za-z0-9_-]{1,100}$/.test(cursor)) return res.status(400).json({ error: 'Cursor inválido.' });

  const limite =
    Number.isSafeInteger(limiteInformado) &&
    limiteInformado > 0
      ? Math.min(limiteInformado, 100)
      : 50;

  try {
    const agora = new Date();
    const where: any = {
      clube_id: clubeId,
    };

    if (statusInformado === 'EXPIRADO') {
      where.status = 'PENDENTE';
      where.expira_em = {
        lte: agora,
      };
    } else if (statusInformado) {
      where.status = statusInformado;
      if (statusInformado === 'PENDENTE') where.expira_em = { gt: agora };
    }

    const convites = await prisma.conviteClube.findMany({
      where,
      take: limite + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),

      orderBy: [{ criado_em: 'desc' }, { id: 'desc' }],

      select: {
        id: true,
        email: true,
        papel: true,
        acesso_todas_categorias: true,
        status: true,
        expira_em: true,
        criado_em: true,
        aceito_em: true,
        revogado_em: true,
        codigo_cifrado: true,

        criadoPor: {
          select: {
            id: true,
            nome: true,
          },
        },

        aceitoPor: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },

        categorias: {
          select: {
            categoria: {
              select: {
                id: true,
                nome: true,
                tipo: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      total: Math.min(convites.length, limite),
      proximo: convites.length > limite ? convites[limite - 1].id : null,

      convites: convites.slice(0, limite).map(convite => {
        const expirado =
          convite.status === 'PENDENTE' &&
          convite.expira_em.getTime() <= agora.getTime();

        return {
          id: convite.id,
          email: convite.email,
          papel: convite.papel,
          acesso_todas_categorias:
            convite.acesso_todas_categorias,

          status: convite.status,
          situacao: expirado
            ? 'EXPIRADO'
            : convite.status,
          codigo_disponivel: !expirado && convite.status === 'PENDENTE' && !!convite.codigo_cifrado,

          expira_em: convite.expira_em,
          criado_em: convite.criado_em,
          aceito_em: convite.aceito_em,
          revogado_em: convite.revogado_em,

          criado_por: convite.criadoPor,
          aceito_por: convite.aceitoPor,

          categorias: convite.categorias.map(
            item => item.categoria
          ),
        };
      }),
    });
  } catch (error) {
    console.error('Erro ao listar convites:', error);

    return res.status(500).json({
      error: 'Erro ao listar convites',
    });
  }
}

router.get('/convites', exigirGestorDoClube, exigirAdminDoClube, listarConvites);

export async function criarConvite(req: Request, res: Response) {
  const clubeId = (req as any).clubeId as number;
  if (await prisma.clube.count({ where: { id: clubeId, ativo: false } })) return res.status(423).json({ error: CLUBE_DESATIVADO, code: 'CLUBE_DESATIVADO' });
  await exigirOperacao(['ENVIAR_CONVITES'], { clubes: [clubeId] });
  const usuarioId = (req as any).usuarioId as number;

  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();

  const papel = String(req.body?.papel || '');
  const entrega = req.body?.entrega ?? 'email';
  if (entrega !== 'email' && entrega !== 'codigo') {
    return res.status(400).json({ error: 'Forma de entrega inválida' });
  }
  const acessoTotal = papel === 'ADMIN' || (papel !== 'OLHEIRO' && req.body?.acesso_todas_categorias === true);
  const categoriasInformadas = req.body?.categoria_ids;

  if ((entrega === 'email' || email) && !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({
      error: 'E-mail inválido',
    });
  }

  if (papel !== 'ADMIN' && papel !== 'OLHEIRO' && papel !== 'TECNICO' && papel !== 'MESARIO') {
    return res.status(400).json({
      error: 'Papel inválido para o convite',
    });
  }

  const categoriaIds = acessoTotal || papel === 'OLHEIRO'
    ? []
    : Array.isArray(categoriasInformadas)
      ? [...new Set(categoriasInformadas.map(Number))]
      : [];

  if (!acessoTotal && papel !== 'OLHEIRO' && categoriaIds.length === 0) {
    return res.status(400).json({
      error: 'Selecione pelo menos uma categoria',
    });
  }

  if (
    categoriaIds.some(
      id => !Number.isSafeInteger(id) || id <= 0
    )
  ) {
    return res.status(400).json({
      error: 'Lista de categorias inválida',
    });
  }

  try {
    if (categoriaIds.length > 0) {
      const totalCategoriasValidas =
        await prisma.categoria.count({
          where: {
            id: {
              in: categoriaIds,
            },
            clube_id: clubeId,
          },
        });

      if (totalCategoriasValidas !== categoriaIds.length) {
        return res.status(403).json({
          error: 'Uma ou mais categorias não pertencem ao clube',
        });
      }
    }

    // E-mail vazio representa código sem destinatário; seu aceite exige login.
    const convitePendente = email ?
      await prisma.conviteClube.findFirst({
        where: {
          clube_id: clubeId,
          email,
          status: 'PENDENTE',
          expira_em: {
            gt: new Date(),
          },
        },
      }) : null;

    if (convitePendente) {
      return res.status(409).json({
        error: 'Já existe um convite pendente para este e-mail',
      });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = gerarHashConvite(token);
    const codigo = gerarCodigoConvite();
    const codigoHash = gerarHashCodigoConvite(codigo);

    const expiraEm = new Date(
      Date.now() + 72 * 60 * 60 * 1000
    );

    const convite = await prisma.conviteClube.create({
      data: {
        clube_id: clubeId,
        criado_por_id: usuarioId,
        email,
        papel,
        acesso_todas_categorias: acessoTotal,
        token_hash: tokenHash,
        codigo_hash: codigoHash,
        codigo_cifrado: cifrarCodigo(codigo, clubeId),
        expira_em: expiraEm,

        categorias: acessoTotal
          ? undefined
          : {
              create: categoriaIds.map(categoriaId => ({
                categoria_id: categoriaId,
              })),
            },
      },

      select: {
        id: true,
        email: true,
        papel: true,
        acesso_todas_categorias: true,
        status: true,
        expira_em: true,

        clube: {
          select: {
            id: true,
            nome: true,
            escudo: true,
          },
        },

        criadoPor: {
          select: {
            nome: true,
          },
        },

        categorias: {
          select: {
            categoria: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    let emailEnviado = false;
    let aviso: string | undefined;

    if (entrega === 'email') try {
      await enviarEmailConvite({
        email: convite.email,
        nomeClube: convite.clube.nome,
        nomeConvidante:
          convite.criadoPor?.nome ?? 'Administrador',
        token,
        codigo,
      });
      emailEnviado = true;
    } catch (error) {
      emailEnviado = false;
      aviso = 'Convite criado, mas o e-mail não pôde ser enviado';

      console.error('Falha no provedor de e-mail do convite.');
    }

    return res.status(201).json({
      convite,
      email_enviado: emailEnviado,
      aviso,
      codigo,
    });
  } catch (error) {
    console.error('Erro ao criar convite:', error);

    return res.status(500).json({
      error: 'Erro ao criar convite',
    });
  }
}

router.post('/convites', exigirGestorDoClube, exigirAdminDoClube, criarConvite);

export async function revogarConvite(req: Request, res: Response) {
  const clubeId = (req as any).clubeId as number;
  const conviteId = String(req.params.id || '').trim();

  if (!conviteId || conviteId.length > 100) {
    return res.status(400).json({
      error: 'ID do convite inválido',
    });
  }

  try {
    const convite = await prisma.conviteClube.findFirst({
      where: {
        id: conviteId,
        clube_id: clubeId,
      },

      select: {
        id: true,
        status: true,
        email: true,
      },
    });

    if (!convite) {
      return res.status(404).json({
        error: 'Convite não encontrado',
      });
    }

    if (convite.status === 'ACEITO') {
      return res.status(409).json({
        error: 'Um convite aceito não pode ser revogado',
      });
    }

    if (convite.status === 'REVOGADO') {
      return res.status(409).json({
        error: 'Este convite já foi revogado',
      });
    }

    const agora = new Date();

    const atualizado =
      await prisma.conviteClube.updateMany({
        where: {
          id: conviteId,
          clube_id: clubeId,
          status: 'PENDENTE',
        },

        data: {
          status: 'REVOGADO',
          revogado_em: agora,
        },
      });

    if (atualizado.count !== 1) {
      return res.status(409).json({
        error: 'Este convite não está mais disponível',
      });
    }

    return res.json({
      mensagem: 'Convite revogado com sucesso',

      convite: {
        id: convite.id,
        email: convite.email,
        status: 'REVOGADO',
        revogado_em: agora,
      },
    });
  } catch (error) {
    console.error('Erro ao revogar convite:', error);

    return res.status(500).json({
      error: 'Erro ao revogar convite',
    });
  }
}

router.post('/convites/:id/revogar', exigirGestorDoClube, exigirAdminDoClube, revogarConvite);

export async function reenviarConvite(req: Request, res: Response) {
  const clubeId = (req as any).clubeId as number;
  if (await prisma.clube.count({ where: { id: clubeId, ativo: false } })) return res.status(423).json({ error: CLUBE_DESATIVADO, code: 'CLUBE_DESATIVADO' });
  await exigirOperacao(['ENVIAR_CONVITES'], { clubes: [clubeId] });
  const conviteId = String(req.params.id || '').trim();

  if (!conviteId || conviteId.length > 100) {
    return res.status(400).json({
      error: 'ID do convite inválido',
    });
  }

  try {
    const convite = await prisma.conviteClube.findFirst({
      where: {
        id: conviteId,
        clube_id: clubeId,
      },

      select: {
        id: true,
        email: true,
        papel: true,
        acesso_todas_categorias: true,
        status: true,
        token_hash: true,

        clube: {
          select: {
            nome: true,
          },
        },

        criadoPor: {
          select: {
            nome: true,
          },
        },
      },
    });

    if (!convite) {
      return res.status(404).json({
        error: 'Convite não encontrado',
      });
    }

    if (convite.status === 'ACEITO') {
      return res.status(409).json({
        error: 'Um convite aceito não pode ser reenviado',
      });
    }
    if (!convite.email) {
      return res.status(400).json({ error: 'Este convite não tem e-mail. Cancele-o e gere um novo código para compartilhar.' });
    }

    const tokenNovo = randomBytes(32).toString('base64url');
    const tokenHashNovo = gerarHashConvite(tokenNovo);
    const codigoNovo = gerarCodigoConvite();
    const codigoHashNovo =
      gerarHashCodigoConvite(codigoNovo);

    const agora = new Date();

    const novaExpiracao = new Date(
      agora.getTime() + 72 * 60 * 60 * 1000
    );

    const atualizado =
      await prisma.conviteClube.updateMany({
        where: {
          id: convite.id,
          clube_id: clubeId,
          token_hash: convite.token_hash,

          status: {
            in: ['PENDENTE', 'REVOGADO'],
          },
        },

        data: {
          token_hash: tokenHashNovo,
          codigo_hash: codigoHashNovo,
          codigo_cifrado: cifrarCodigo(codigoNovo, clubeId),
          status: 'PENDENTE',
          expira_em: novaExpiracao,
          revogado_em: null,
          aceito_em: null,
          aceito_por_id: null,
        },
      });

    if (atualizado.count !== 1) {
      return res.status(409).json({
        error: 'O convite foi alterado por outra operação',
      });
    }

    let emailEnviado = true;
    let aviso: string | undefined;

    try {
      await enviarEmailConvite({
        email: convite.email,
        nomeClube: convite.clube.nome,
        nomeConvidante:
          convite.criadoPor?.nome ?? 'Administrador',
        token: tokenNovo,
        codigo: codigoNovo,
      });
    } catch (error) {
      emailEnviado = false;
      aviso =
        'Novo token gerado, mas o e-mail não pôde ser enviado';

      console.error('Falha no provedor de reenvio do convite.');
    }

    return res.json({
      mensagem: 'Novo token gerado com sucesso',

      convite: {
        id: convite.id,
        email: convite.email,
        papel: convite.papel,
        acesso_todas_categorias:
          convite.acesso_todas_categorias,
        status: 'PENDENTE',
        expira_em: novaExpiracao,
      },

      email_enviado: emailEnviado,
      aviso,
      codigo: codigoNovo,
    });
  } catch (error) {
    console.error('Erro ao reenviar convite:', error);

    return res.status(500).json({
      error: 'Erro ao reenviar convite',
    });
  }
}

router.post('/convites/:id/reenviar', exigirGestorDoClube, exigirAdminDoClube, reenviarConvite);

// Montado somente na rota administrativa protegida por exigirSuperAdmin.
export async function consultarCodigoConvite(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  const clubeId = (req as any).clubeId as number;
  if (await prisma.clube.count({ where: { id: clubeId, ativo: false } })) return res.status(423).json({ error: CLUBE_DESATIVADO, code: 'CLUBE_DESATIVADO' });
  const id = String(req.params.id || '');
  if (!id || id.length > 100) return res.status(400).json({ error: 'Convite inválido.' });
  const convite = await prisma.conviteClube.findFirst({ where: { id, clube_id: clubeId },
    select: { status: true, expira_em: true, codigo_cifrado: true, codigo_hash: true } });
  if (!convite) return res.status(404).json({ error: 'Convite não encontrado.' });
  if (convite.status !== 'PENDENTE' || convite.expira_em.getTime() <= Date.now()) {
    return res.status(410).json({ error: 'Este convite não está mais válido.' });
  }
  const codigo = convite.codigo_cifrado && decifrarCodigo(convite.codigo_cifrado, clubeId);
  if (!codigo || gerarHashCodigoConvite(codigo) !== convite.codigo_hash) {
    return res.status(409).json({ error: 'O código deste convite antigo não pode ser recuperado. Reenvie por e-mail ou revogue e crie outro convite.' });
  }
  return res.json({ codigo, expira_em: convite.expira_em });
}



export default router;
