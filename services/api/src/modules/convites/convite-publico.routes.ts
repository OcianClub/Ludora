import { Router } from 'express';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { JWT_OPTIONS, JWT_SECRET } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { limitarAuth } from '../../middlewares/rate-limit.middleware';
import { obterFiltroCredencialConvite } from './convite.utils';

const router = Router();

router.get([
  '/convites/codigo/:codigo',
  '/convites/:token',
], limitarAuth, async (req, res) => {
  const filtroConvite = obterFiltroCredencialConvite(
    req.params
  );

  if (!filtroConvite) {
    return res.status(404).json({
      error: 'Convite inválido',
    });
  }

  try {
    const convite = await prisma.conviteClube.findUnique({
      where: filtroConvite,

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
            cidade: true,
            estado: true,
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
                tipo: true,
              },
            },
          },
        },
      },
    });

    if (!convite) {
      return res.status(404).json({
        error: 'Convite inválido',
      });
    }

    if (convite.status === 'REVOGADO') {
      return res.status(410).json({
        error: 'Este convite foi revogado',
      });
    }

    if (convite.status === 'ACEITO') {
      return res.status(409).json({
        error: 'Este convite já foi utilizado',
      });
    }

    if (convite.expira_em.getTime() <= Date.now()) {
      return res.status(410).json({
        error: 'Este convite expirou',
      });
    }

    const [parteLocal, dominio] = convite.email.split('@');

    const emailMascarado =
      `${parteLocal.slice(0, 2)}***@${dominio}`;

      const possuiConta = await prisma.usuario.count({
        where: {
          email: convite.email,
        },
      });

    return res.json({
      convite: {
        id: convite.id,
        email: emailMascarado,
        possui_conta: possuiConta > 0,
        papel: convite.papel,
        acesso_todas_categorias:
          convite.acesso_todas_categorias,
        expira_em: convite.expira_em,
        clube: convite.clube,
        convidado_por:
          convite.criadoPor?.nome ?? 'Administrador',
        categorias: convite.categorias.map(
          item => item.categoria
        ),
      },
    });
  } catch (error) {
    console.error('Erro ao consultar convite:', error);

    return res.status(500).json({
      error: 'Erro ao consultar convite',
    });
  }
});

router.post(
  [
    '/convites/codigo/:codigo/aceitar',
    '/convites/:token/aceitar',
  ],
  limitarAuth,
  async (req, res) => {
    const filtroConvite = obterFiltroCredencialConvite(
      req.params
    );
    const nome = String(req.body?.nome || '').trim();
    const senha = String(req.body?.senha || '');

    if (!filtroConvite) {
      return res.status(404).json({
        error: 'Convite inválido',
      });
    }

    if (nome.length < 2 || nome.length > 100) {
      return res.status(400).json({
        error: 'Nome inválido',
      });
    }

    if (senha.length < 8 || senha.length > 128) {
      return res.status(400).json({
        error: 'A senha deve possuir entre 8 e 128 caracteres',
      });
    }

    try {
      const convite = await prisma.conviteClube.findUnique({
        where: filtroConvite,

        select: {
          id: true,
          clube_id: true,
          email: true,
          papel: true,
          acesso_todas_categorias: true,
          status: true,
          expira_em: true,

          categorias: {
            select: {
              categoria_id: true,
            },
          },
        },
      });

      if (!convite) {
        return res.status(404).json({
          error: 'Convite inválido',
        });
      }

      if (convite.status === 'REVOGADO') {
        return res.status(410).json({
          error: 'Este convite foi revogado',
        });
      }

      if (convite.status === 'ACEITO') {
        return res.status(409).json({
          error: 'Este convite já foi utilizado',
        });
      }

      if (convite.expira_em.getTime() <= Date.now()) {
        return res.status(410).json({
          error: 'Este convite expirou',
        });
      }

      const usuarioExistente = await prisma.usuario.findUnique({
        where: {
          email: convite.email,
        },
        select: {
          id: true,
        },
      });

      if (usuarioExistente) {
        return res.status(409).json({
          error: 'Já existe uma conta com este e-mail. Faça login para aceitar o convite.',
          codigo: 'CONTA_EXISTENTE',
        });
      }

      const senhaHash = await bcrypt.hash(senha, 12);
      const agora = new Date();

      const resultado = await prisma.$transaction(
        async transaction => {
          // Tenta reservar o convite. Apenas uma requisição consegue
          // transformar o mesmo convite de PENDENTE para ACEITO.
          const conviteReservado =
            await transaction.conviteClube.updateMany({
              where: {
                id: convite.id,
                ...filtroConvite,
                status: 'PENDENTE',
                expira_em: {
                  gt: agora,
                },
              },

              data: {
                status: 'ACEITO',
                aceito_em: agora,
              },
            });

          if (conviteReservado.count !== 1) {
            throw new Error('CONVITE_INDISPONIVEL');
          }

          const usuario = await transaction.usuario.create({
            data: {
              nome,
              email: convite.email,
              senha: senhaHash,
            },

            select: {
              id: true,
              nome: true,
              email: true,
              criadoEm: true,
            },
          });

          const vinculo =
            await transaction.usuarioClube.create({
              data: {
                usuario_id: usuario.id,
                clube_id: convite.clube_id,
                papel: convite.papel,
                acesso_todas_categorias:
                  convite.acesso_todas_categorias,

                categorias:
                  convite.acesso_todas_categorias
                    ? undefined
                    : {
                        create: convite.categorias.map(
                          categoria => ({
                            categoria_id:
                              categoria.categoria_id,
                          })
                        ),
                      },
              },

              include: {
                clube: {
                  select: {
                    id: true,
                    nome: true,
                    escudo: true,
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

          await transaction.conviteClube.update({
            where: {
              id: convite.id,
            },

            data: {
              aceito_por_id: usuario.id,
            },
          });

          return {
            usuario,
            vinculo,
          };
        }
      );

      const tokenLogin = jwt.sign(
        {
          id: resultado.usuario.id,
        },
        JWT_SECRET,
        JWT_OPTIONS
      );

      return res.status(201).json({
        mensagem: 'Conta criada e convite aceito',
        token: tokenLogin,

        usuario: resultado.usuario,

        clube: {
          id: resultado.vinculo.clube.id,
          nome: resultado.vinculo.clube.nome,
          escudo: resultado.vinculo.clube.escudo,
          papel: resultado.vinculo.papel,
          acesso_todas_categorias:
            resultado.vinculo.acesso_todas_categorias,

          categorias: resultado.vinculo.categorias.map(
            item => item.categoria
          ),
        },
      });
    } catch (error: any) {
      if (error?.message === 'CONVITE_INDISPONIVEL') {
        return res.status(409).json({
          error: 'Este convite não está mais disponível',
        });
      }

      console.error('Erro ao aceitar convite:', error);

      return res.status(500).json({
        error: 'Erro ao aceitar convite',
      });
    }
  }
);

router.post(
  [
    '/convites/codigo/:codigo/aceitar-existente',
    '/convites/:token/aceitar-existente',
  ],
  limitarAuth,
  exigirAutenticacao,
  async (req, res) => {
    const filtroConvite = obterFiltroCredencialConvite(
      req.params
    );
    const usuarioId = (req as any).usuarioId as number;

    if (!filtroConvite) {
      return res.status(404).json({
        error: 'Convite inválido',
      });
    }

    try {
      const [convite, usuario] = await Promise.all([
        prisma.conviteClube.findUnique({
          where: filtroConvite,

          select: {
            id: true,
            clube_id: true,
            email: true,
            papel: true,
            acesso_todas_categorias: true,
            status: true,
            expira_em: true,

            categorias: {
              select: {
                categoria_id: true,
              },
            },
          },
        }),

        prisma.usuario.findUnique({
          where: {
            id: usuarioId,
          },

          select: {
            id: true,
            nome: true,
            email: true,
          },
        }),
      ]);

      if (!convite) {
        return res.status(404).json({
          error: 'Convite inválido',
        });
      }

      if (!usuario) {
        return res.status(401).json({
          error: 'Usuário não encontrado',
        });
      }

      if (convite.status === 'REVOGADO') {
        return res.status(410).json({
          error: 'Este convite foi revogado',
        });
      }

      if (convite.status === 'ACEITO') {
        return res.status(409).json({
          error: 'Este convite já foi utilizado',
        });
      }

      if (convite.expira_em.getTime() <= Date.now()) {
        return res.status(410).json({
          error: 'Este convite expirou',
        });
      }

      if (
        usuario.email.trim().toLowerCase() !==
        convite.email.trim().toLowerCase()
      ) {
        return res.status(403).json({
          error: 'Este convite pertence a outro e-mail',
        });
      }

      if (
        !convite.acesso_todas_categorias &&
        convite.categorias.length === 0
      ) {
        return res.status(409).json({
          error: 'Este convite não possui categorias válidas',
        });
      }

      const agora = new Date();

      const resultado = await prisma.$transaction(
        async transaction => {
          const conviteReservado =
            await transaction.conviteClube.updateMany({
              where: {
                id: convite.id,
                ...filtroConvite,
                status: 'PENDENTE',
                expira_em: {
                  gt: agora,
                },
              },

              data: {
                status: 'ACEITO',
                aceito_em: agora,
                aceito_por_id: usuario.id,
              },
            });

          if (conviteReservado.count !== 1) {
            throw new Error('CONVITE_INDISPONIVEL');
          }

          let vinculo =
            await transaction.usuarioClube.findUnique({
              where: {
                usuario_id_clube_id: {
                  usuario_id: usuario.id,
                  clube_id: convite.clube_id,
                },
              },
            });

          if (vinculo?.papel === 'ADMIN') {
            throw new Error('JA_ADMINISTRA_CLUBE');
          }

          if (
            vinculo &&
            vinculo.papel !== 'TORCEDOR' &&
            vinculo.papel !== convite.papel
          ) {
            throw new Error('PAPEL_CONFLITANTE');
          }

          if (!vinculo) {
            vinculo = await transaction.usuarioClube.create({
              data: {
                usuario_id: usuario.id,
                clube_id: convite.clube_id,
                papel: convite.papel,
                acesso_todas_categorias:
                  convite.acesso_todas_categorias,
              },
            });
          } else {
            vinculo = await transaction.usuarioClube.update({
              where: {
                id: vinculo.id,
              },

              data: {
                papel:
                  vinculo.papel === 'TORCEDOR'
                    ? convite.papel
                    : vinculo.papel,

                acesso_todas_categorias:
                  vinculo.acesso_todas_categorias ||
                  convite.acesso_todas_categorias,
              },
            });
          }

          if (
            !vinculo.acesso_todas_categorias &&
            convite.categorias.length > 0
          ) {
            await transaction.usuarioClubeCategoria.createMany({
              data: convite.categorias.map(categoria => ({
                usuario_clube_id: vinculo!.id,
                categoria_id: categoria.categoria_id,
              })),

              skipDuplicates: true,
            });
          }

          return transaction.usuarioClube.findUniqueOrThrow({
            where: {
              id: vinculo.id,
            },

            include: {
              clube: {
                select: {
                  id: true,
                  nome: true,
                  escudo: true,
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
        }
      );

      return res.json({
        mensagem: 'Convite aceito com sucesso',

        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
        },

        clube: {
          id: resultado.clube.id,
          nome: resultado.clube.nome,
          escudo: resultado.clube.escudo,
          papel: resultado.papel,
          acesso_todas_categorias:
            resultado.acesso_todas_categorias,

          categorias: resultado.categorias.map(
            item => item.categoria
          ),
        },
      });
    } catch (error: any) {
      if (error?.message === 'CONVITE_INDISPONIVEL') {
        return res.status(409).json({
          error: 'Este convite não está mais disponível',
        });
      }

      if (error?.message === 'JA_ADMINISTRA_CLUBE') {
        return res.status(409).json({
          error: 'Este usuário já administra o clube',
        });
      }

      if (error?.message === 'PAPEL_CONFLITANTE') {
        return res.status(409).json({
          error: 'Este usuário já possui outro papel de gestão neste clube',
        });
      }

      console.error(
        'Erro ao aceitar convite com conta existente:',
        error
      );

      return res.status(500).json({
        error: 'Erro ao aceitar convite',
      });
    }
  }
);


export default router;
