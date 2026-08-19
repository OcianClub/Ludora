import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import importacaoRoutes from './routes/importacao.routes';
import 'dotenv/config';
import campeonatoRoutes from './routes/campeonato.routes';
import cron from 'node-cron';
import { sincronizarTodos } from './services/campeonato.service';
import { prisma } from './lib/prisma';

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production';
const origensPermitidas = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const validarOrigem: cors.CorsOptions['origin'] = (origin, callback) => {
  // Apps nativos e chamadas servidor-servidor normalmente não enviam Origin.
  if (!origin || origensPermitidas.has(origin)) return callback(null, true);
  return callback(new Error('Origem não permitida pelo CORS'));
};

const corsOptions: cors.CorsOptions = {
  origin: validarOrigem,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'x-clube-id', 'x-request-id'],
  maxAge: 86400,
};

const io = new Server(server, { cors: corsOptions });

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
app.use(cors(corsOptions));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function limitarRequisicoes({ janelaMs, limite, prefixo }: { janelaMs: number; limite: number; prefixo: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const agora = Date.now();
    const identidade = `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
    const chave = `${prefixo}:${identidade}`;
    const atual = rateBuckets.get(chave);
    const entrada = !atual || atual.resetAt <= agora ? { count: 0, resetAt: agora + janelaMs } : atual;
    entrada.count += 1;
    rateBuckets.set(chave, entrada);

    res.setHeader('RateLimit-Limit', String(limite));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limite - entrada.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entrada.resetAt / 1000)));
    if (entrada.count > limite) {
      res.setHeader('Retry-After', String(Math.ceil((entrada.resetAt - agora) / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    }
    next();
  };
}

const limitarAuth = limitarRequisicoes({ janelaMs: 15 * 60_000, limite: 20, prefixo: 'auth' });
const limitarOperacaoPesada = limitarRequisicoes({ janelaMs: 10 * 60_000, limite: 5, prefixo: 'heavy' });

// Remove buckets vencidos sem manter o processo vivo apenas por causa da limpeza.
const rateCleanup = setInterval(() => {
  const agora = Date.now();
  for (const [chave, entrada] of rateBuckets) {
    if (entrada.resetAt <= agora) rateBuckets.delete(chave);
  }
}, 10 * 60_000);
rateCleanup.unref();

const PYTHON_AI_URL = process.env.PYTHON_AI_URL;

if (!process.env.JWT_SECRET) {
  console.error('ERRO FATAL: A variável JWT_SECRET não foi encontrada no arquivo .env!');
  process.exit(1);
}

// Depois do guard acima, o processo já teria sido encerrado se JWT_SECRET não existisse.
// O "as string" só deixa isso explícito pro TypeScript (que não enxerga esse tipo de
// narrowing entre módulos/closures), evitando repetir esse cast em cada rota.
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_ISSUER = 'ludora-api';
const JWT_AUDIENCE = 'ludora-apps';
const JWT_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256',
  expiresIn: '8h',
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

if (isProduction && JWT_SECRET.length < 32) {
  console.error('ERRO FATAL: JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  process.exit(1);
}

if (isProduction && !process.env.CORS_ORIGINS) {
  console.error('ERRO FATAL: CORS_ORIGINS deve ser configurada em produção.');
  process.exit(1);
}

if (!PYTHON_AI_URL) {
  console.warn('⚠️  PYTHON_AI_URL não definida — Scout IA desativado.');
}

// ==========================================
// 1. AUTENTICAÇÃO
// ==========================================

// Extrai o id do usuário logado a partir do token, sem lançar erro se não houver token
// (algumas rotas, como listar clubes, funcionam tanto logado quanto deslogado)
function getUsuarioIdPeloToken(token: string): number | null {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    const id = Number(decoded.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function getUsuarioId(req: express.Request): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return getUsuarioIdPeloToken(authHeader.slice(7).trim());
}

function exigirAutenticacao(req: express.Request, res: express.Response, next: express.NextFunction) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Não autorizado' });
  (req as any).usuarioId = usuarioId;
  next();
}

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// ==========================================
// MIDDLEWARE DE PERMISSÃO (multi-tenant)
// ==========================================
// Papel é por CLUBE (UsuarioClube.papel), não mais global no usuário.
// TORCEDOR só pode ver dados; ADMIN/TECNICO/MESARIO podem gerenciar partidas
// (criar, editar, apontar placar/eventos etc.) dentro do clube em que atuam.
//
// Este middleware:
//  1. Confere o token (401 se ausente/inválido)
//  2. Confere o header x-clube-id (400 se ausente — mesmo padrão já usado
//     nas rotas GET deste arquivo)
//  3. Busca o vínculo UsuarioClube do usuário logado com esse clube
//  4. Bloqueia (403) se não houver vínculo, ou se o papel for TORCEDOR
//  5. Anexa req.usuarioId / req.clubeId / req.papelUsuario pra rota usar
const PAPEIS_GESTORES = ['ADMIN', 'TECNICO', 'MESARIO'] as const;

function exigirGestorDoClube(req: express.Request, res: express.Response, next: express.NextFunction) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Token inválido ou não enviado' });

  const clube_id = idPositivo(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id inválido ou ausente' });

  prisma.usuarioClube
    .findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id } } })
    .then((vinculo) => {
      if (!vinculo) {
        return res.status(403).json({ error: 'Você não tem vínculo com este clube' });
      }
      if (!PAPEIS_GESTORES.includes(vinculo.papel as any)) {
        return res.status(403).json({ error: 'Apenas administradores, técnicos ou mesários podem gerenciar partidas' });
      }
      (req as any).usuarioId = usuarioId;
      (req as any).clubeId = clube_id;
      (req as any).papelUsuario = vinculo.papel;
      next();
    })
    .catch(() => res.status(500).json({ error: 'Erro ao verificar permissão do clube' }));
}

// Além de exigir papel de gestor, confere que a PARTIDA em questão (:id na URL)
// realmente pertence ao clube ativo (req.clubeId) — evita que um gestor do
// Clube A edite/apague uma partida do Clube B só trocando o header x-clube-id.
async function partidaPertenceAoClube(partidaId: number, clubeId: number): Promise<boolean> {
  const partida = await prisma.partida.findUnique({
    where: { id: partidaId },
    include: { categoria: { select: { clube_id: true } } },
  });
  return !!partida && partida.categoria?.clube_id === clubeId;
}

function exigirPartidaDoClube(idParam: (req: express.Request) => number) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const partidaId = idParam(req);
    const clubeId = (req as any).clubeId as number;
    const pertence = await partidaPertenceAoClube(partidaId, clubeId).catch(() => false);
    if (!pertence) {
      return res.status(403).json({ error: 'Esta partida não pertence ao clube ativo' });
    }
    next();
  };
}

function exigirRecursoDoClube(
  pertence: (id: number, clubeId: number) => Promise<boolean>,
  idParam: (req: express.Request) => number = (req) => Number(req.params.id),
) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = idPositivo(idParam(req));
    const clubeId = (req as any).clubeId as number;
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    try {
      if (!(await pertence(id, clubeId))) {
        return res.status(403).json({ error: 'Recurso não pertence ao clube ativo' });
      }
      next();
    } catch {
      return res.status(500).json({ error: 'Erro ao verificar permissão do recurso' });
    }
  };
}

const exigirTimeDoClube = exigirRecursoDoClube(async (id, clubeId) => {
  const total = await prisma.time.count({ where: { id, categoria: { clube_id: clubeId } } });
  return total === 1;
});

const exigirCompeticaoDoClube = exigirRecursoDoClube(async (id, clubeId) => {
  const total = await prisma.competicao.count({ where: { id, clube_id: clubeId } });
  return total === 1;
});

const exigirJogadorDoClube = exigirRecursoDoClube(async (id, clubeId) => {
  const total = await prisma.jogador.count({ where: { id, categoria: { clube_id: clubeId } } });
  return total === 1;
});

io.use(async (socket, next) => {
  const authHeader = String(socket.handshake.headers.authorization || '');
  const tokenInformado = String(socket.handshake.auth?.token || authHeader.replace(/^Bearer\s+/i, ''));
  const clubeId = idPositivo(socket.handshake.auth?.clubeId || socket.handshake.headers['x-clube-id']);
  const usuarioId = getUsuarioIdPeloToken(tokenInformado);
  if (!usuarioId || !clubeId) return next(new Error('Não autorizado'));
  try {
    const vinculo = await prisma.usuarioClube.findUnique({
      where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } },
      select: { id: true },
    });
    if (!vinculo) return next(new Error('Não autorizado'));
    socket.data.clubeId = clubeId;
    socket.data.usuarioId = usuarioId;
    next();
  } catch {
    next(new Error('Não autorizado'));
  }
});

io.on('connection', (socket) => {
  socket.join(`clube:${socket.data.clubeId}`);
});

// Routers que modificam dados são montados somente depois dos middlewares de autorização.
app.use('/partidas/importar', exigirGestorDoClube, limitarOperacaoPesada, importacaoRoutes);
app.use('/campeonato/sincronizar', exigirGestorDoClube, limitarOperacaoPesada);
app.use('/campeonato', campeonatoRoutes);

app.post('/auth/registrar', limitarAuth, async (req, res) => {
  // Removemos o 'role' daqui, pois novos usuários nascem sem vínculo ou vinculam-se depois
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  const nome = String(req.body?.nome || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || nome.length < 2 || nome.length > 100 || senha.length < 8 || senha.length > 128) {
    return res.status(400).json({ error: 'Nome, e-mail ou senha inválidos. A senha deve ter ao menos 8 caracteres.' });
  }
  try {
    const hashSenha = await bcrypt.hash(senha, 12);
    const usuario = await prisma.usuario.create({
      data: { email, senha: hashSenha, nome }
    });
    res.status(201).json({ mensagem: 'Usuário criado', id: usuario.id });
  } catch (error: any) { 
    res.status(400).json({ error: 'Erro ao criar usuário' }); 
  }
});

app.post('/auth/login', limitarAuth, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  if (!email || !senha || email.length > 254 || senha.length > 128) {
    return res.status(400).json({ error: 'Credenciais inválidas' });
  }
  
  // Agora buscamos o usuário E também a lista de clubes que ele faz parte
  const usuario = await prisma.usuario.findUnique({ 
    where: { email },
    include: {
      clubes: {
        include: { clube: true }
      }
    }
  });
  
  if (!usuario) return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  
  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  
  // O JWT não carrega mais a "role" global, apenas o ID do usuário
  const token = jwt.sign({ id: usuario.id }, JWT_SECRET, JWT_OPTIONS);
  
  // Formatamos os clubes para o app mobile montar a tela "Seus Clubes"
  const clubesDoUsuario = usuario.clubes.map(vinculo => ({
    clube_id: vinculo.clube.id,
    nome: vinculo.clube.nome,
    escudo: vinculo.clube.escudo,
    papel: vinculo.papel
  }));

  res.json({ 
    token, 
    nome: usuario.nome, 
    criadoEm: usuario.criadoEm, 
    email: usuario.email,
    clubes: clubesDoUsuario // <-- Lista de clubes enviada direto no login!
  });
});

app.patch('/usuarios/me', exigirAutenticacao, async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = req.body?.senha == null ? '' : String(req.body.senha);
  if (nome.length < 2 || nome.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || (senha && (senha.length < 8 || senha.length > 128))) {
    return res.status(400).json({ error: 'Dados de usuário inválidos' });
  }
  try {
    const data: any = { nome, email };
    if (senha) data.senha = await bcrypt.hash(senha, 12);
    const usuario = await prisma.usuario.update({ where: { id: (req as any).usuarioId }, data });
    res.json({ nome: usuario.nome, email: usuario.email });
  } catch { res.status(400).json({ error: 'Não foi possível atualizar os dados' }); }
});

app.delete('/usuarios/me', exigirAutenticacao, async (req, res) => {
  try {
    await prisma.usuario.delete({ where: { id: (req as any).usuarioId } });
    res.json({ mensagem: 'Conta excluída com sucesso' });
  } catch { res.status(400).json({ error: 'Não foi possível excluir a conta' }); }
});
// ==========================================
// 1.1 CLUBES (descoberta + seguir)
// ==========================================
// OBS: "seguir" um clube = criar um vínculo UsuarioClube com papel TORCEDOR.
// Isso reaproveita o modelo que já existe (não precisou de migration nova).
// ADMIN/MESARIO/TECNICO continuam contando como "segue" também (isSeguindo=true),
// mas só quem é TORCEDOR pode "deixar de seguir" por aqui.

app.get('/clubes', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  const busca = String(req.query.busca || '').trim();

  try {
    const clubes = await prisma.clube.findMany({
      where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
      orderBy: { nome: 'asc' },
      include: {
        usuarios: usuarioId ? { where: { usuario_id: usuarioId } } : false,
        _count: { select: { usuarios: true } },
      },
    });

    const formatados = clubes.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      escudo: c.escudo,
      cidade: c.cidade,
      estado: c.estado,
      seguidores: c._count.usuarios,
      isSeguindo: usuarioId ? c.usuarios.length > 0 : false,
      papel: usuarioId && c.usuarios.length > 0 ? c.usuarios[0].papel : null,
    }));

    res.json(formatados);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar clubes' });
  }
});

app.post('/clubes/:id/seguir', async (req, res) => {
  const usuarioId = getUsuarioId(req);
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
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao seguir clube' });
  }
});

app.delete('/clubes/:id/seguir', async (req, res) => {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Token inválido ou não enviado' });

  const clube_id = Number(req.params.id);
  try {
    const vinculo = await prisma.usuarioClube.findUnique({
      where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id } },
    });
    if (!vinculo) return res.status(404).json({ error: 'Você não segue este clube' });
    if (vinculo.papel !== 'TORCEDOR') {
      return res.status(403).json({
        error: 'Apenas torcedores podem deixar de seguir por aqui. Admins/técnicos precisam transferir o cargo antes.',
      });
    }
    await prisma.usuarioClube.delete({ where: { id: vinculo.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao deixar de seguir clube' });
  }
});

// ==========================================
// 2. CADASTROS E BUSCAS
// ==========================================

app.post('/times', exigirGestorDoClube, async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const categoriaId = idPositivo(categoria_id);
    if (!categoriaId) return res.status(400).json({ error: 'Categoria inválida' });
    const categoriaValida = await prisma.categoria.count({
      where: { id: categoriaId, clube_id: (req as any).clubeId },
    });
    if (!categoriaValida) return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    const time = await prisma.time.create({
      data: { nome, escudo, categoria_id: categoriaId },
      include: { categoria: true }
    });
    res.status(201).json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar time' }); }
});

app.patch('/times/:id', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const categoriaId = idPositivo(categoria_id);
    if (!categoriaId) return res.status(400).json({ error: 'Categoria inválida' });
    const categoriaValida = await prisma.categoria.count({
      where: { id: categoriaId, clube_id: (req as any).clubeId },
    });
    if (!categoriaValida) return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    const time = await prisma.time.update({
      where: { id: Number(req.params.id) },
      data: { nome, escudo, categoria_id: categoriaId },
      include: { categoria: true }
    });
    res.json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar time' }); }
});

app.get('/times', async (req, res) => {
  const clube_id = Number(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id é obrigatório' });

  try {
    const times = await prisma.time.findMany({
      where: { categoria: { clube_id } }, // Filtra apenas times do clube logado
      orderBy: { nome: 'asc' },
      include: { categoria: true }
    });
    res.json(times);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar times' }); }
});

app.delete('/times/:id', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  try {
    await prisma.time.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Time excluído' });
  } catch (error: any) {
    res.status(409).json({ error: 'Time possui partidas vinculadas e não pode ser excluído.' });
  }
});

app.post('/competicoes', exigirGestorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  const { nome, ano, tipo } = req.body;
  try {
    // RESOLVIDO: Passando o clube_id para a criação
    const competicao = await prisma.competicao.create({ 
      data: { nome, ano: Number(ano), tipo, clube_id } 
    });
    res.status(201).json(competicao);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar competição' }); }
});

app.patch('/competicoes/:id', exigirGestorDoClube, exigirCompeticaoDoClube, async (req, res) => {
  const { nome, ano, tipo } = req.body;
  try {
    const competicao = await prisma.competicao.update({
      where: { id: Number(req.params.id) },
      data: { nome, ano: Number(ano), tipo },
    });
    res.json(competicao);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar competição' }); }
});

app.get('/competicoes', async (req, res) => {
  const clube_id = Number(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id é obrigatório' });

  try {
    const competicoes = await prisma.competicao.findMany({ 
      where: { clube_id },
      orderBy: { nome: 'asc' } 
    });
    res.json(competicoes);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar competições' }); }
});

app.post('/campeonato/sincronizar-todos', exigirGestorDoClube, limitarOperacaoPesada, async (_req, res) => {
  try {
    await executarSincronizacao();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/competicoes/:id', exigirGestorDoClube, exigirCompeticaoDoClube, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const totalPartidas = await prisma.partida.count({ where: { competicao_id: id } });
    if (totalPartidas > 0) {
      return res.status(409).json({
        error: `Não é possível excluir: este campeonato possui ${totalPartidas} partida(s) vinculada(s). Exclua as partidas primeiro.`
      });
    }
    await prisma.competicaoJogador.deleteMany({ where: { competicao_id: id } });
    await prisma.competicaoTime.deleteMany({ where: { competicao_id: id } });
    await prisma.competicao.delete({ where: { id } });
    res.json({ mensagem: 'Campeonato excluído com sucesso.' });
  } catch (error: any) { res.status(500).json({ error: 'Erro ao excluir campeonato.' }); }
});

app.get('/competicoes/:id/jogadores', async (req, res) => {
  const competicao_id = Number(req.params.id);
  const categoria_id  = req.query.categoria_id ? Number(req.query.categoria_id) : undefined;
  try {
    const where: any = { competicao_id };
    if (categoria_id) where.jogador = { categoria_id };
    const inscricoes = await prisma.competicaoJogador.findMany({
      where,
      include: {
        jogador: { select: { id: true, nome: true, posicao: true, numCamisa: true, categoria_id: true } },
      },
      orderBy: { jogador: { numCamisa: 'asc' } },
    });
    res.json(inscricoes.map(i => ({
      id_jogador: i.jogador.id,
      nome:       i.jogador.nome,
      posicao:    i.jogador.posicao,
      numCamisa:  i.jogador.numCamisa,
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar elenco da competição' });
  }
});

app.put('/competicoes/:id/jogadores', exigirGestorDoClube, exigirCompeticaoDoClube, async (req, res) => {
  const competicao_id = Number(req.params.id);
  const { jogador_ids }: { jogador_ids: number[] } = req.body;
  if (!Array.isArray(jogador_ids)) return res.status(400).json({ error: 'jogador_ids deve ser um array' });
  try {
    const idsValidos = [...new Set(jogador_ids.map(Number))]
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (idsValidos.length !== jogador_ids.length || idsValidos.length > 200) {
      return res.status(400).json({ error: 'Lista de jogadores inválida ou muito grande' });
    }
    const jogadoresDoClube = await prisma.jogador.count({
      where: { id: { in: idsValidos }, categoria: { clube_id: (req as any).clubeId } },
    });
    if (jogadoresDoClube !== idsValidos.length) {
      return res.status(403).json({ error: 'Um ou mais jogadores não pertencem ao clube ativo' });
    }
    await prisma.$transaction([
      prisma.competicaoJogador.deleteMany({ where: { competicao_id } }),
      prisma.competicaoJogador.createMany({
        data: idsValidos.map((jogador_id) => ({ competicao_id, jogador_id })),
        skipDuplicates: true,
      }),
    ]);
    res.json({ ok: true, total: idsValidos.length });
  } catch (error: any) {
    console.error('Erro ao salvar elenco:', error.message || error);
    res.status(500).json({ error: 'Erro ao salvar elenco da competição' });
  }
});

app.get('/categorias', async (req, res) => {
  const clube_id = Number(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id é obrigatório' });

  try {
    const categorias = await prisma.categoria.findMany({ 
      where: { clube_id },
      orderBy: { nome: 'asc' } 
    });
    res.json(categorias);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar categorias' }); }
});

// ==========================================
// JOGADORES
// ==========================================

app.post('/jogadores', exigirGestorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  const { nome, cpf, dtNasc, posicao, numCamisa } = req.body;
  if (!nome || !cpf || !dtNasc) return res.status(400).json({ error: 'Nome, CPF e data de nascimento obrigatórios' });
  try {
    const cpfExistente = await prisma.jogador.findUnique({ where: { cpf } });
    if (cpfExistente) return res.status(409).json({ error: 'Este CPF já está cadastrado' });

    const anoNasc = new Date(dtNasc).getFullYear();
    const idade = new Date().getFullYear() - anoNasc;
    const regrasCategorias = [
      { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
      { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
      { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
      { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
    ];
    const categoriaAdequada = regrasCategorias.find(r => idade <= r.limite);
    if (!categoriaAdequada) return res.status(403).json({ error: 'Idade fora das categorias permitidas.' });

    const categoria = await prisma.categoria.findFirst({
      where: { nome: categoriaAdequada.nome, clube_id }
    });
    
    if (!categoria) return res.status(404).json({ error: `Categoria ${categoriaAdequada.nome} não encontrada no banco do clube.` });

    if (numCamisa) {
      const camisaEmUso = await prisma.jogador.findFirst({
        where: { categoria_id: categoria.id, numCamisa: Number(numCamisa) }
      });
      if (camisaEmUso) return res.status(409).json({ error: `A camisa ${numCamisa} já está sendo usada na categoria.` });
    }

    const jogador = await prisma.jogador.create({
      data: {
        nome, cpf, dtNasc: new Date(dtNasc),
        posicao: posicao || 'Ala',
        numCamisa: numCamisa ? Number(numCamisa) : null,
        categoria_id: categoria.id,
        perfil_ml: 'Sem dados',
      },
      include: { categoria: true }
    });
    res.status(201).json(jogador);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/jogadores/perfis', exigirGestorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  const { categoria_id } = req.query;

  try {
    const jogadores = await prisma.jogador.findMany({
      where: {
        ativo: true,
        categoria: { clube_id },
        ...(categoria_id ? { categoria_id: Number(categoria_id) } : {}),
      },
      include: { eventos: true, categoria: true, escalacoes: true },
      orderBy: { nota_geral: 'desc' },
    });
    
    const formatados = jogadores.map(j => {
      const stats = j.eventos.reduce((acc: any, ev) => {
        acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
        return acc;
      }, {});
      const jogos = j.escalacoes ? j.escalacoes.length : 0;
      return {
        id_jogador:        j.id,
        nome:              j.nome,
        posicao:           j.posicao,
        numCamisa:         j.numCamisa,
        idade:             new Date().getFullYear() - new Date(j.dtNasc).getFullYear(),
        perfil_ml:         j.perfil_ml || 'Sem dados',
        scores_ml:         j.scores_ml,
        nota_geral:        j.nota_geral ?? 0,
        categoria:         j.categoria.nome,
        categoria_tipo:    j.categoria.tipo,
        categoria_id:      j.categoria_id,
        time:              'Clube', // Pode ser ajustado futuramente para buscar o nome do clube
        jogos_disputados:  jogos,
        gols:              stats['GOL']             || 0,
        assistencias:      stats['ASSISTENCIA']     || 0,
        defesas:           stats['DEFESA']          || 0,
        cartoes_amarelos:  stats['CARTAO_AMARELO']  || 0,
        cartoes_vermelhos: stats['CARTAO_VERMELHO'] || 0,
        faltas_cometidas:  stats['FALTA']           || 0,
      };
    });
    res.json(formatados);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar perfis' });
  }
});

app.get('/jogadores', exigirGestorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  try {
    const jogadores = await prisma.jogador.findMany({
      where: { 
        ativo: true,
        categoria: { clube_id }
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        dtNasc: true,
        posicao: true,
        numCamisa: true,
        categoria_id: true,
        ativo: true,
      },
    });
    res.json(jogadores);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar jogadores' }); }
});

app.patch('/jogadores/:id', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  const { nome, dtNasc, posicao, numCamisa } = req.body;
  try {
    let dados: any = { nome, posicao, numCamisa: numCamisa ? Number(numCamisa) : null };
    if (dtNasc) {
      const anoNasc = new Date(dtNasc).getFullYear();
      const idade = new Date().getFullYear() - anoNasc;
      const regras = [
        { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
        { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
        { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
        { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
      ];
      const catAdequada = regras.find(r => idade <= r.limite);
      if (catAdequada) {
        const cat = await prisma.categoria.findFirst({
          where: { nome: catAdequada.nome, clube_id }
        });
        if (cat) { dados.dtNasc = new Date(dtNasc); dados.categoria_id = cat.id; }
      }
    }
    const jogador = await prisma.jogador.update({
      where: { id: Number(req.params.id) },
      data: dados,
      include: { categoria: true },
    });
    res.json(jogador);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/jogadores/:id', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  try {
    await prisma.jogador.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Excluído com sucesso' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMIN
// ==========================================

app.patch('/admin/atualizar-idades', exigirGestorDoClube, limitarOperacaoPesada, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  try {
    const anoAtual = new Date().getFullYear();
    const regras = [
      { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
      { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
      { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
      { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
    ];
    const [jogadores, categorias] = await Promise.all([
      prisma.jogador.findMany({ 
        where: { categoria: { clube_id } },
        select: { id: true, dtNasc: true, categoria_id: true, ativo: true } 
      }),
      prisma.categoria.findMany({ where: { clube_id } }),
    ]);
    
    let atualizados = 0, desativados = 0;
    for (const j of jogadores) {
      const idade = anoAtual - new Date(j.dtNasc).getFullYear();
      const catAdequada = regras.find(r => idade <= r.limite);
      if (!catAdequada) {
        if (j.ativo) { await prisma.jogador.update({ where: { id: j.id }, data: { ativo: false } }); desativados++; }
      } else {
        const cat = categorias.find(c => c.nome.toLowerCase() === catAdequada.nome.toLowerCase());
        if (cat && (cat.id !== j.categoria_id || !j.ativo)) {
          await prisma.jogador.update({ where: { id: j.id }, data: { categoria_id: cat.id, ativo: true } });
          atualizados++;
        }
      }
    }
    res.json({ ok: true, atualizados, desativados, total: jogadores.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 3. PARTIDAS E EVENTOS
// ==========================================

app.post('/partidas', exigirGestorDoClube, async (req, res) => {
  const { mandante_id, visitante_id, data, horario, local, emCasa, categoria_id, competicao_id, rodada, grupo } = req.body;
  try {
    const dataFormatada = data ? new Date(`${data}T00:00:00Z`) : new Date();
    const catId = idPositivo(categoria_id);
    const mandanteId = idPositivo(mandante_id);
    const visitanteId = idPositivo(visitante_id);
    const compId = competicao_id ? idPositivo(competicao_id) : null;
    if (!catId || !mandanteId || !visitanteId || mandanteId === visitanteId || (competicao_id && !compId)) {
      return res.status(400).json({ error: 'Dados da partida inválidos' });
    }
    if (Number.isNaN(dataFormatada.getTime())) return res.status(400).json({ error: 'Data inválida' });

    // Garante que a categoria escolhida pertence mesmo ao clube ativo
    // (evita criar partida "vazando" pra categoria de outro clube).
    const categoria = await prisma.categoria.findUnique({ where: { id: catId } });
    if (!categoria || categoria.clube_id !== (req as any).clubeId) {
      return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    }
    const timesValidos = await prisma.time.count({
      where: { id: { in: [mandanteId, visitanteId] }, categoria_id: catId },
    });
    if (timesValidos !== 2) return res.status(403).json({ error: 'Times não pertencem à categoria selecionada' });
    if (compId) {
      const competicaoValida = await prisma.competicao.count({
        where: { id: compId, clube_id: (req as any).clubeId },
      });
      if (!competicaoValida) return res.status(403).json({ error: 'Competição não pertence ao clube ativo' });
    }

    if (horario) {
      const choqueHorario = await prisma.partida.findFirst({
        where: { categoria_id: catId, data: dataFormatada, horario }
      });
      if (choqueHorario) return res.status(400).json({ error: 'Conflito de agenda! A categoria já tem jogo neste horário.' });
    }

    const partida = await prisma.partida.create({
      data: {
        mandante_id: mandanteId, visitante_id: visitanteId,
        data: dataFormatada, horario, local,
        emCasa: emCasa !== undefined ? emCasa : true,
        categoria_id: catId, competicao_id: compId,
        rodada: rodada ? Number(rodada) : null, grupo, status: 'AGENDADA',
      },
      include: { mandante: true, visitante: true, categoria: true, competicao: true },
    });
    res.status(201).json(partida);
  } catch (error: any) {
    console.error('Erro ao criar partida:', error.message || error);
    res.status(500).json({ error: 'Erro ao criar partida' });
  }
});

app.get('/partidas', async (req, res) => {
  const clube_id = Number(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id é obrigatório' });

  const { categoria_id, mes, status, competicao_id } = req.query;
  try {
    const where: any = { categoria: { clube_id } }; // Garante restrição do tenant
    if (categoria_id)  where.categoria_id  = Number(categoria_id);
    if (status)        where.status        = status;
    if (competicao_id) where.competicao_id = Number(competicao_id);
    if (mes) {
      const ano    = new Date().getFullYear();
      const mesNum = Number(mes);
      const dataInicio = new Date(Date.UTC(ano, mesNum - 1, 1));
      const dataFim    = new Date(Date.UTC(ano, mesNum, 1));
      where.data = { gte: dataInicio, lt: dataFim };
    }
    const partidas = await prisma.partida.findMany({
      where,
      orderBy: { data: 'asc' },
      include: {
        mandante: true,
        visitante: true,
        categoria: true,
        competicao: true,
        eventos: true,
      },
    });
    res.json(partidas);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar partidas' }); }
});

app.patch<{ id: string }>(
  '/partidas/:id',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const { mandante_id, visitante_id, data, horario, local, emCasa, rodada, grupo, categoria_id } = req.body;
    try {
      const atual = await prisma.partida.findUnique({
        where: { id: Number(req.params.id) },
        select: { mandante_id: true, visitante_id: true, categoria_id: true },
      });
      if (!atual) return res.status(404).json({ error: 'Partida não encontrada' });
      const categoriaId = categoria_id ? idPositivo(categoria_id) : atual.categoria_id;
      const mandanteId = mandante_id ? idPositivo(mandante_id) : atual.mandante_id;
      const visitanteId = visitante_id ? idPositivo(visitante_id) : atual.visitante_id;
      if (!categoriaId || !mandanteId || !visitanteId || mandanteId === visitanteId) {
        return res.status(400).json({ error: 'Dados da partida inválidos' });
      }
      const [categoriaValida, timesValidos] = await Promise.all([
        prisma.categoria.count({ where: { id: categoriaId, clube_id: (req as any).clubeId } }),
        prisma.time.count({ where: { id: { in: [mandanteId, visitanteId] }, categoria_id: categoriaId } }),
      ]);
      if (!categoriaValida || timesValidos !== 2) {
        return res.status(403).json({ error: 'Categoria ou times não pertencem ao clube ativo' });
      }
      const dataAtualizada = data ? new Date(`${data}T00:00:00Z`) : undefined;
      if (dataAtualizada && Number.isNaN(dataAtualizada.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
      const partida = await prisma.partida.update({
        where: { id: Number(req.params.id) },
        data: {
          mandante_id: mandante_id ? mandanteId : undefined,
          visitante_id: visitante_id ? visitanteId : undefined,
          data: dataAtualizada,
          horario, local, emCasa,
          rodada:       rodada     ? Number(rodada)     : undefined,
          grupo:        grupo ?? null,
          categoria_id: categoria_id ? categoriaId : undefined,
        },
        include: { mandante: true, visitante: true, categoria: true },
      });
      res.json(partida);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
);

app.delete<{ id: string }>(
  '/partidas/:id',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await prisma.evento.deleteMany({ where: { partida_id: id } });
      await prisma.escalacaoPartida.deleteMany({ where: { partida_id: id } });
      await prisma.partida.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? 'Erro ao excluir partida' });
    }
  }
);

app.patch<{ id: string }>(
  '/partidas/:id/placar',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const { gols_mandante, gols_visitante } = req.body;
    const golsMandante = Number(gols_mandante);
    const golsVisitante = Number(gols_visitante);
    if (![golsMandante, golsVisitante].every((gols) => Number.isSafeInteger(gols) && gols >= 0 && gols <= 99)) {
      return res.status(400).json({ error: 'Placar inválido' });
    }
    try {
      const partida = await prisma.partida.update({
        where: { id: Number(req.params.id) },
        data: { gols_mandante: golsMandante, gols_visitante: golsVisitante },
      });
      io.to(`clube:${(req as any).clubeId}`).emit('placar_atualizado', partida);
      res.json(partida);
    } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar placar' }); }
  }
);

app.patch<{ id: string }>(
  '/partidas/:id/status',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    const { status } = req.body;
    if (!['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    try {
      const partida = await prisma.partida.update({ where: { id: partidaId }, data: { status } });
      if (status === 'FINALIZADA') {
        setImmediate(() => {
          processarMachineLearning().catch(err => console.error('Erro na IA:', err));
        });
      }
      res.json(partida);
    } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar status' }); }
  }
);

app.get('/jogadores/:id/estatisticas', async (req, res) => {
  const jogadorId = parseInt(req.params.id);
  const estatisticas = await prisma.evento.groupBy({
    by: ['tipo'],
    where: { jogador_id: jogadorId },
    _count: { tipo: true }
  });
  const formatado = estatisticas.reduce((acc: any, curr: any) => {
    acc[curr.tipo] = curr._count.tipo;
    return acc;
  }, {});
  res.json({ jogador_id: jogadorId, estatisticas: formatado });
});

app.post<{ id: string }>(
  '/partidas/:id/eventos',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    // RESOLVIDO: Removendo o doOcian do payload, ele não existe mais!
    const { jogador_id, tipo, minuto, periodo } = req.body;
    const tiposPermitidos = ['GOL', 'ASSISTENCIA', 'DEFESA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'FALTA'];
    if (!tiposPermitidos.includes(tipo)) return res.status(400).json({ error: 'Tipo de evento inválido' });
    const minutoNumero = minuto == null ? null : Number(minuto);
    const periodoNumero = periodo == null ? 1 : Number(periodo);
    if ((minutoNumero != null && (!Number.isSafeInteger(minutoNumero) || minutoNumero < 0 || minutoNumero > 200)) ||
        !Number.isSafeInteger(periodoNumero) || periodoNumero < 1 || periodoNumero > 10) {
      return res.status(400).json({ error: 'Minuto ou período inválido' });
    }
    try {
      if (jogador_id) {
        const jogadorValido = await prisma.jogador.count({
          where: { id: Number(jogador_id), categoria: { clube_id: (req as any).clubeId } },
        });
        if (!jogadorValido) return res.status(403).json({ error: 'Jogador não pertence ao clube ativo' });
      }
      const evento = await prisma.evento.create({
        data: {
          partida_id: partidaId,
          jogador_id: jogador_id ? Number(jogador_id) : null,
          tipo,
          minuto: minutoNumero,
          periodo: periodoNumero,
        },
      });

      let nomeJogador = 'Adversário';
      if (evento.jogador_id) {
        const jog = await prisma.jogador.findUnique({
          where: { id: evento.jogador_id },
          select: { nome: true },
        });
        nomeJogador = jog?.nome ?? 'Adversário';
      }

      io.to(`clube:${(req as any).clubeId}`).emit('evento_partida', {
        tipo:       evento.tipo,
        jogador:    nomeJogador,
        minuto:     evento.minuto,
        partida_id: partidaId,
      });

      res.status(201).json({ ...evento, jogador: nomeJogador ? { nome: nomeJogador } : null });
    } catch (error: any) { res.status(500).json({ error: 'Erro ao salvar evento' }); }
  }
);

app.get('/partidas/:id/eventos', async (req, res) => {
  try {
    const eventos = await prisma.evento.findMany({
      where: { partida_id: Number(req.params.id) },
      include: { jogador: true },
      orderBy: { id: 'asc' }
    });
    res.json(eventos);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar eventos' }); }
});

app.delete<{ id: string }>('/eventos/:id', exigirGestorDoClube, async (req, res) => {
  try {
    const evento = await prisma.evento.findUnique({ where: { id: Number(req.params.id) } });
    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });

    const pertence = await partidaPertenceAoClube(evento.partida_id, (req as any).clubeId);
    if (!pertence) return res.status(403).json({ error: 'Este evento não pertence ao clube ativo' });

    await prisma.evento.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Evento deletado' });
  } catch (error: any) { res.status(500).json({ error: 'Erro ao deletar evento' }); }
});

// ==========================================
// 4. INTEGRAÇÃO COM IA
// ==========================================

async function processarMachineLearning() {
  if (!PYTHON_AI_URL) {
    console.warn('Scout IA: PYTHON_AI_URL não definida, pulando processamento.');
    return;
  }

  // Como o processamento de IA roda em background e é pesado, ele vai varrer 
  // todos os jogadores ativos do banco independentemente do clube. O Python devolve pelo ID do jogador.
  const jogadores = await prisma.jogador.findMany({
    include: { eventos: true, escalacoes: true }
  });

  const payload = jogadores
    .map(j => {
      const stats = j.eventos.reduce((acc: any, ev) => {
        acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
        return acc;
      }, {});
      const jogos = j.escalacoes ? j.escalacoes.length : 0;
      if (jogos === 0) return null;
      return {
        jogador_id:       j.id,
        GOL:              stats['GOL']             || 0,
        ASSISTENCIA:      stats['ASSISTENCIA']     || 0,
        DEFESA:           stats['DEFESA']          || 0,
        CARTAO_AMARELO:   stats['CARTAO_AMARELO']  || 0,
        CARTAO_VERMELHO:  stats['CARTAO_VERMELHO'] || 0,
        FALTA:            stats['FALTA']           || 0,
        jogos_disputados: jogos,
      };
    })
    .filter(Boolean);

  if (payload.length < 3) {
    console.log('Scout IA: Jogadores insuficientes para calcular perfis.');
    return;
  }

  try {
    console.log(`Scout IA: Enviando ${payload.length} jogadores para o Python...`);
    const resposta = await axios.post(
      `${PYTHON_AI_URL}/internal/ml/treinar-perfis`,
      payload,
      { timeout: 120000 }
    );
    await prisma.$transaction(
      resposta.data.map((resultado: any) => prisma.jogador.update({
        where: { id: resultado.jogador_id },
        data: {
          perfil_ml:  resultado.perfil_ml,
          scores_ml:  resultado.scores,
          nota_geral: resultado.nota_geral,
        },
      })),
    );
    console.log(`Scout IA: ${resposta.data.length} jogadores processados e atualizados. ✅`);
  } catch (error: any) {
    console.error('Falha ao comunicar com microsserviço de IA Python:', error.message || error);
  }
}

// ==========================================
// ROTAS DE ESCALAÇÃO
// ==========================================

app.get('/partidas/:id/escalacao', async (req, res) => {
  const partidaId = Number(req.params.id);
  try {
    const escalacao = await prisma.escalacaoPartida.findMany({
      where: { partida_id: partidaId },
      include: {
        jogador: { select: { nome: true, posicao: true, numCamisa: true } },
      },
      orderBy: [{ titular: 'desc' }, { numCamisa: 'asc' }],
    });
    res.json(escalacao);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar escalação' });
  }
});

app.put<{ id: string }>(
  '/partidas/:id/escalacao',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    const { jogadores } = req.body as {
      jogadores: { jogador_id: number; numCamisa: number; titular: boolean }[];
    };
    if (!Array.isArray(jogadores)) {
      return res.status(400).json({ error: 'jogadores deve ser um array' });
    }
    if (jogadores.length > 50) return res.status(400).json({ error: 'Escalação muito grande' });
    try {
      const normalizados = jogadores.map((j) => ({
        jogador_id: Number(j.jogador_id),
        numCamisa: Number(j.numCamisa),
        titular: Boolean(j.titular),
      }));
      const ids = [...new Set(normalizados.map((j) => j.jogador_id))];
      const entradaValida = ids.length === normalizados.length && normalizados.every((j) =>
        Number.isSafeInteger(j.jogador_id) && j.jogador_id > 0 &&
        Number.isSafeInteger(j.numCamisa) && j.numCamisa >= 0 && j.numCamisa <= 99,
      );
      if (!entradaValida) return res.status(400).json({ error: 'Dados da escalação inválidos' });
      const jogadoresValidos = await prisma.jogador.count({
        where: { id: { in: ids }, categoria: { clube_id: (req as any).clubeId } },
      });
      if (jogadoresValidos !== ids.length) {
        return res.status(403).json({ error: 'Um ou mais jogadores não pertencem ao clube ativo' });
      }
      await prisma.$transaction([
        prisma.escalacaoPartida.deleteMany({ where: { partida_id: partidaId } }),
        prisma.escalacaoPartida.createMany({
          data: normalizados.map(j => ({
          partida_id: partidaId,
            ...j,
          })),
        }),
      ]);
      const nova = await prisma.escalacaoPartida.findMany({
        where: { partida_id: partidaId },
        include: { jogador: { select: { nome: true, posicao: true, numCamisa: true } } },
        orderBy: [{ titular: 'desc' }, { numCamisa: 'asc' }],
      });
      res.json(nova);
    } catch (error: any) {
      console.error('Erro ao salvar escalação:', error.message);
      res.status(500).json({ error: error.message || 'Erro ao salvar escalação' });
    }
  }
);

app.post('/admin/reprocessar-scout', exigirGestorDoClube, limitarOperacaoPesada, async (req, res) => {
  if (!PYTHON_AI_URL) {
    return res.status(503).json({ error: 'PYTHON_AI_URL não configurada no servidor.' });
  }
  res.json({ ok: true, mensagem: 'Scout IA iniciado em background. Aguarde ~60s e consulte /jogadores/perfis.' });
  processarMachineLearning().catch(err => console.error('Erro no reprocessamento manual:', err));
});

let sincronizacaoEmAndamento: Promise<void> | null = null;
function executarSincronizacao(): Promise<void> {
  if (sincronizacaoEmAndamento) return sincronizacaoEmAndamento;
  sincronizacaoEmAndamento = sincronizarTodos()
    .finally(() => { sincronizacaoEmAndamento = null; });
  return sincronizacaoEmAndamento;
}

executarSincronizacao().catch((error) => {
  console.error('Erro na sincronização inicial:', error?.message || error);
});

cron.schedule('*/30 * * * *', () => {
  executarSincronizacao().catch((error) => {
    console.error('Erro na sincronização agendada:', error?.message || error);
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error?.type === 'entity.too.large' ? 413 : error?.message === 'Origem não permitida pelo CORS' ? 403 : 500;
  if (status === 500) console.error('Erro não tratado:', error?.message || error);
  res.status(status).json({
    error: status === 413 ? 'Payload muito grande' : status === 403 ? 'Origem não permitida' : 'Erro interno do servidor',
  });
});

const PORT = Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT inválida');
}
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Core Service rodando na porta ${PORT}`);
});

server.requestTimeout = 130_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

let encerrando = false;
async function encerrar(signal: string) {
  if (encerrando) return;
  encerrando = true;
  console.log(`Recebido ${signal}; encerrando API...`);
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => void encerrar('SIGTERM'));
process.once('SIGINT', () => void encerrar('SIGINT'));
