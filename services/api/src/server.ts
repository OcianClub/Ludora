import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import importacaoRoutes from './routes/importacao.routes';
import 'dotenv/config';
import campeonatoRoutes from './routes/campeonato.routes';
import cron from 'node-cron';
import { sincronizarTodos } from './services/campeonato.service';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/partidas/importar', importacaoRoutes);
app.use('/campeonato', campeonatoRoutes);

sincronizarTodos().catch(console.error);

cron.schedule('*/30 * * * *', () => {
  sincronizarTodos().catch(console.error);
});

const JWT_SECRET = process.env.JWT_SECRET;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL;

if (!JWT_SECRET) {
  console.error('ERRO FATAL: A variável JWT_SECRET não foi encontrada no arquivo .env!');
  process.exit(1);
}

if (!PYTHON_AI_URL) {
  console.warn('⚠️  PYTHON_AI_URL não definida — Scout IA desativado.');
}

// ==========================================
// 1. AUTENTICAÇÃO
// ==========================================

app.post('/auth/registrar', async (req, res) => {
  const { email, senha, nome, role } = req.body;
  try {
    const hashSenha = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { email, senha: hashSenha, nome, role }
    });
    res.status(201).json({ mensagem: 'Usuário criado', id: usuario.id });
  } catch (error: any) { res.status(400).json({ error: 'Erro ao criar usuário' }); }
});

app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return res.status(401).json({ error: 'Usuário não encontrado' });
  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) return res.status(401).json({ error: 'Senha incorreta' });
  const token = jwt.sign({ id: usuario.id, role: usuario.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: usuario.role, nome: usuario.nome, criadoEm: usuario.criadoEm, email: usuario.email });
});

app.patch('/usuarios/me', async (req, res) => {
  const { nome, email, senha } = req.body;
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token não enviado' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const data: any = { nome, email };
    if (senha && senha.length >= 6) data.senha = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.update({ where: { id: decoded.id }, data });
    res.json({ nome: usuario.nome, email: usuario.email });
  } catch (error: any) { res.status(401).json({ error: 'Token inválido' }); }
});

app.delete('/usuarios/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token não enviado' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    await prisma.usuario.delete({ where: { id: decoded.id } });
    res.json({ mensagem: 'Conta excluída com sucesso' });
  } catch (error: any) { res.status(401).json({ error: 'Token inválido ou usuário não encontrado' }); }
});

// ==========================================
// 2. CADASTROS E BUSCAS
// ==========================================

app.post('/times', async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const time = await prisma.time.create({
      data: { nome, escudo, categoria_id: Number(categoria_id) },
      include: { categoria: true }
    });
    res.status(201).json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar time' }); }
});

app.patch('/times/:id', async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const time = await prisma.time.update({
      where: { id: Number(req.params.id) },
      data: { nome, escudo, categoria_id: Number(categoria_id) },
      include: { categoria: true }
    });
    res.json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar time' }); }
});

app.get('/times', async (req, res) => {
  try {
    const times = await prisma.time.findMany({
      orderBy: { nome: 'asc' },
      include: { categoria: true }
    });
    res.json(times);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar times' }); }
});

app.delete('/times/:id', async (req, res) => {
  try {
    await prisma.time.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Time excluído' });
  } catch (error: any) {
    res.status(409).json({ error: 'Time possui partidas vinculadas e não pode ser excluído.' });
  }
});

app.post('/competicoes', async (req, res) => {
  const { nome, ano, tipo } = req.body;
  try {
    const competicao = await prisma.competicao.create({ data: { nome, ano: Number(ano), tipo } });
    res.status(201).json(competicao);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar competição' }); }
});

app.patch('/competicoes/:id', async (req, res) => {
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
  try {
    const competicoes = await prisma.competicao.findMany({ orderBy: { nome: 'asc' } });
    res.json(competicoes);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar competições' }); }
});

app.get('/campeonato/sincronizar-todos', async (_req, res) => {
  try {
    const { sincronizarTodos } = require('./services/campeonato.service');
    await sincronizarTodos();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/competicoes/:id', async (req, res) => {
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

app.put('/competicoes/:id/jogadores', async (req, res) => {
  const competicao_id = Number(req.params.id);
  const { jogador_ids }: { jogador_ids: number[] } = req.body;
  if (!Array.isArray(jogador_ids)) return res.status(400).json({ error: 'jogador_ids deve ser um array' });
  try {
    await prisma.competicaoJogador.deleteMany({ where: { competicao_id } });
    const idsValidos = jogador_ids.filter((id): id is number => id != null && !isNaN(Number(id)));
    if (idsValidos.length > 0) {
      await prisma.competicaoJogador.createMany({
        data: idsValidos.map(jogador_id => ({ competicao_id, jogador_id: Number(jogador_id) })),
        skipDuplicates: true,
      });
    }
    res.json({ ok: true, total: jogador_ids.length });
  } catch (error: any) {
    console.error('Erro ao salvar elenco:', error.message || error);
    res.status(500).json({ error: 'Erro ao salvar elenco da competição' });
  }
});

app.get('/categorias', async (req, res) => {
  try {
    const categorias = await prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
    res.json(categorias);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar categorias' }); }
});

// ==========================================
// JOGADORES
// ==========================================

app.post('/jogadores', async (req, res) => {
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
      where: { nome: { equals: categoriaAdequada.nome, mode: 'insensitive' } }
    });
    if (!categoria) return res.status(404).json({ error: `Categoria ${categoriaAdequada.nome} não encontrada no banco.` });

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

app.get('/jogadores/perfis', async (req, res) => {
  const { categoria_id } = req.query;
  try {
    const jogadores = await prisma.jogador.findMany({
      where: {
        ativo: true,
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
        dtNasc:            j.dtNasc,
        perfil_ml:         j.perfil_ml || 'Sem dados',
        scores_ml:         j.scores_ml,
        nota_geral:        j.nota_geral ?? 0,
        categoria:         j.categoria.nome,
        categoria_tipo:    j.categoria.tipo,
        categoria_id:      j.categoria_id,
        time:              'CFA Ocian',
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

app.get('/jogadores', async (req, res) => {
  try {
    const jogadores = await prisma.jogador.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    res.json(jogadores);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar jogadores' }); }
});

app.patch('/jogadores/:id', async (req, res) => {
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
          where: { nome: { equals: catAdequada.nome, mode: 'insensitive' } }
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

app.delete('/jogadores/:id', async (req, res) => {
  try {
    await prisma.jogador.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Excluído com sucesso' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMIN
// ==========================================

app.patch('/admin/atualizar-idades', async (req, res) => {
  try {
    const anoAtual = new Date().getFullYear();
    const regras = [
      { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
      { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
      { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
      { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
    ];
    const [jogadores, categorias] = await Promise.all([
      prisma.jogador.findMany({ select: { id: true, dtNasc: true, categoria_id: true, ativo: true } }),
      prisma.categoria.findMany(),
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

app.post('/partidas', async (req, res) => {
  const { mandante_id, visitante_id, data, horario, local, emCasa, categoria_id, competicao_id, rodada, grupo } = req.body;
  try {
    console.log('BODY RECEBIDO:', JSON.stringify(req.body, null, 2));
    const dataFormatada = data ? new Date(`${data}T00:00:00Z`) : new Date();
    const catId  = Number(categoria_id);
    const compId = competicao_id ? Number(competicao_id) : null;

    if (horario) {
      const choqueHorario = await prisma.partida.findFirst({
        where: { categoria_id: catId, data: dataFormatada, horario }
      });
      if (choqueHorario) return res.status(400).json({ error: 'Conflito de agenda! A categoria já tem jogo neste horário.' });
    }

    const partida = await prisma.partida.create({
      data: {
        mandante_id: Number(mandante_id), visitante_id: Number(visitante_id),
        data: dataFormatada, horario, local,
        emCasa: emCasa !== undefined ? emCasa : true,
        categoria_id: catId, competicao_id: compId,
        rodada: rodada ? Number(rodada) : null, grupo, status: 'AGENDADA',
      },
      include: { mandante: true, visitante: true, categoria: true, competicao: true },
    });
    res.status(201).json(partida);
  } catch (error: any) {
    console.error('ERRO AO CRIAR PARTIDA:', error);
    console.error('Erro ao criar partida:', error.message || error);
    res.status(500).json({ error: 'Erro ao criar partida' });
  }
});

app.get('/partidas', async (req, res) => {
  const { categoria_id, mes, status, competicao_id } = req.query;
  try {
    const where: any = {};
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
      include: { mandante: true, visitante: true, categoria: true, eventos: true },
    });
    res.json(partidas);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar partidas' }); }
});

app.patch('/partidas/:id', async (req, res) => {
  const { mandante_id, visitante_id, data, horario, local, emCasa, rodada, grupo, categoria_id } = req.body;
  try {
    const partida = await prisma.partida.update({
      where: { id: Number(req.params.id) },
      data: {
        mandante_id:  mandante_id  ? Number(mandante_id)  : undefined,
        visitante_id: visitante_id ? Number(visitante_id) : undefined,
        data:         data ? new Date(`${data}T00:00:00Z`) : undefined,
        horario, local, emCasa,
        rodada:       rodada     ? Number(rodada)     : undefined,
        grupo:        grupo ?? null,
        categoria_id: categoria_id ? Number(categoria_id) : undefined,
      },
      include: { mandante: true, visitante: true, categoria: true },
    });
    res.json(partida);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/partidas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.evento.deleteMany({ where: { partida_id: id } });
    await prisma.escalacaoPartida.deleteMany({ where: { partida_id: id } });
    await prisma.partida.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? 'Erro ao excluir partida' });
  }
});

app.patch('/partidas/:id/placar', async (req, res) => {
  const { gols_mandante, gols_visitante } = req.body;
  try {
    const partida = await prisma.partida.update({
      where: { id: Number(req.params.id) },
      data: { gols_mandante: Number(gols_mandante), gols_visitante: Number(gols_visitante) },
    });
    io.emit('placar_atualizado', partida);
    res.json(partida);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar placar' }); }
});

app.patch('/partidas/:id/status', async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { status } = req.body;
  try {
    const partida = await prisma.partida.update({ where: { id: partidaId }, data: { status } });
    // ✅ CORRIGIDO: dispara em background sem bloquear a resposta
    if (status === 'FINALIZADA') {
      setImmediate(() => {
        processarMachineLearning().catch(err => console.error('Erro na IA:', err));
      });
    }
    res.json(partida);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar status' }); }
});

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

app.post('/partidas/:id/eventos', async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { jogador_id, doOcian, tipo, minuto, periodo } = req.body;
  try {
    const evento = await prisma.evento.create({
      data: {
        partida_id: partidaId,
        jogador_id: jogador_id ? Number(jogador_id) : null,
        doOcian:    doOcian !== undefined ? Boolean(doOcian) : true,
        tipo,
        minuto:  minuto  != null ? Number(minuto)  : null,
        periodo: periodo != null ? Number(periodo)  : 1,
      } as any,
    });

    let nomeJogador = 'Adversário';
    if (evento.jogador_id) {
      const jog = await prisma.jogador.findUnique({
        where: { id: evento.jogador_id },
        select: { nome: true },
      });
      nomeJogador = jog?.nome ?? 'Adversário';
    }

    io.emit('evento_partida', {
      tipo:       evento.tipo,
      jogador:    nomeJogador,
      minuto:     evento.minuto,
      partida_id: partidaId,
    });

    res.status(201).json({ ...evento, jogador: nomeJogador ? { nome: nomeJogador } : null });
  } catch (error: any) { res.status(500).json({ error: 'Erro ao salvar evento' }); }
});

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

app.delete('/eventos/:id', async (req, res) => {
  try {
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
    // ✅ CORRIGIDO: timeout de 2 minutos para o Render acordar do modo sleep
    const resposta = await axios.post(
      `${PYTHON_AI_URL}/internal/ml/treinar-perfis`,
      payload,
      { timeout: 120000 }
    );
    for (const resultado of resposta.data) {
      await prisma.jogador.update({
        where: { id: resultado.jogador_id },
        data: {
          perfil_ml:  resultado.perfil_ml,
          scores_ml:  resultado.scores,
          nota_geral: resultado.nota_geral,
        },
      });
    }
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

app.put('/partidas/:id/escalacao', async (req, res) => {
  const partidaId = Number(req.params.id);
  const { jogadores } = req.body as {
    jogadores: { jogador_id: number; numCamisa: number; titular: boolean }[];
  };
  if (!Array.isArray(jogadores)) {
    return res.status(400).json({ error: 'jogadores deve ser um array' });
  }
  try {
    await prisma.escalacaoPartida.deleteMany({ where: { partida_id: partidaId } });
    await prisma.escalacaoPartida.createMany({
      data: jogadores.map(j => ({
        partida_id: partidaId,
        jogador_id: Number(j.jogador_id),
        numCamisa:  Number(j.numCamisa),
        titular:    Boolean(j.titular),
      })),
    });
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
});

app.post('/admin/reprocessar-scout', async (req, res) => {
  if (!PYTHON_AI_URL) {
    return res.status(503).json({ error: 'PYTHON_AI_URL não configurada no servidor.' });
  }
  res.json({ ok: true, mensagem: 'Scout IA iniciado em background. Aguarde ~60s e consulte /jogadores/perfis.' });
  processarMachineLearning().catch(err => console.error('Erro no reprocessamento manual:', err));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT as number, '0.0.0.0', () => {
  console.log(`Core Service rodando na porta ${PORT}`);
});