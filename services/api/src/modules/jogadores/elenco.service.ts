import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { categoriaPorNascimento, planejarTemporada } from './elenco.rules';
import { fotoValida } from '../../utils/foto';

export class ErroElenco extends Error {
  constructor(public status: number, mensagem: string, public detalhes: object = {}) { super(mensagem); }
}

// SERIALIZABLE impede duas requisições concorrentes de reservarem a mesma camisa.
export async function transacaoElenco<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try { return await prisma.$transaction(operacao, { isolationLevel: 'Serializable', timeout: 20000 }); }
    catch (erro: any) {
      if (erro.code === 'P2034') {
        if (tentativa < 2) continue;
        throw new ErroElenco(409, 'O elenco mudou durante a operação. Tente novamente.');
      }
      if (erro.code === 'P2002') throw new ErroElenco(409, 'Este CPF já está cadastrado');
      throw erro;
    }
  }
}

export async function categoriaCalculada(tx: Prisma.TransactionClient, clubeId: number, nascimento: string) {
  let nome: string | null;
  try { nome = categoriaPorNascimento(nascimento); }
  catch (erro: any) { throw new ErroElenco(400, erro.message); }
  if (!nome) throw new ErroElenco(400, 'Aluno fora das categorias permitidas: idade de 4 a 18 anos na temporada.');
  const categoria = await tx.categoria.findFirst({ where: { clube_id: clubeId, nome: { equals: nome, mode: 'insensitive' } } });
  if (!categoria) throw new ErroElenco(409, `Categoria ${nome} não cadastrada no clube.`);
  return categoria;
}

async function exigirCategoria(tx: Prisma.TransactionClient, usuarioId: number, clubeId: number, categoriaId: number) {
  const vinculo = await tx.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } }, include: { categorias: true } });
  if (!vinculo || !['ADMIN', 'TECNICO', 'MESARIO'].includes(vinculo.papel) ||
      !(vinculo.papel === 'ADMIN' || vinculo.acesso_todas_categorias || vinculo.categorias.some(c => c.categoria_id === categoriaId))) {
    throw new ErroElenco(403, 'Você não pode administrar esta categoria.');
  }
}

function lerCamisa(valor: unknown): number | null {
  if (valor === null || valor === '') return null;
  if (typeof valor === 'string' && !/^[0-9]{1,2}$/.test(valor)) throw new ErroElenco(400, 'Camisa deve conter somente números.');
  if ((typeof valor !== 'string' && typeof valor !== 'number') || !Number.isInteger(Number(valor)) || Number(valor) < 1 || Number(valor) > 99) {
    throw new ErroElenco(400, 'A camisa deve ser um número inteiro de 1 a 99.');
  }
  return Number(valor);
}

export async function salvarAluno(clubeId: number, usuarioId: number, entrada: any, id?: number) {
  return transacaoElenco(async tx => {
    const atual = id ? await tx.jogador.findFirst({ where: { id, categoria: { clube_id: clubeId } } }) : null;
    if (id && !atual) throw new ErroElenco(404, 'Jogador não encontrado neste clube.');
    if (atual) await exigirCategoria(tx, usuarioId, clubeId, atual.categoria_id);
    if (atual && entrada.cpf !== undefined && entrada.cpf !== atual.cpf) throw new ErroElenco(400, 'O CPF não pode ser alterado.');
    if (entrada.foto !== undefined && !fotoValida(entrada.foto)) throw new ErroElenco(400, 'Use uma imagem JPEG, PNG ou WebP de até 130 KB.');
    const nome = entrada.nome === undefined ? atual?.nome : typeof entrada.nome === 'string' ? entrada.nome.trim() : '';
    if (!nome || !/\p{L}/u.test(nome) || /[\uFE0F\u20E3]/u.test(nome) || !/^[\p{L}\p{M} '\u2019-]+$/u.test(nome) || nome.length > 120) throw new ErroElenco(400, 'Informe um nome válido, sem emojis ou símbolos.');
    const nascimento = entrada.dtNasc ?? atual?.dtNasc.toISOString().slice(0, 10);
    if (typeof nascimento !== 'string') throw new ErroElenco(400, 'Data de nascimento obrigatória.');
    const categoria = await categoriaCalculada(tx, clubeId, nascimento);
    await exigirCategoria(tx, usuarioId, clubeId, categoria.id);
    if (!atual && (typeof entrada.cpf !== 'string' || !/^[0-9.\-\s]+$/.test(entrada.cpf))) throw new ErroElenco(400, 'CPF deve conter somente números e a pontuação da máscara.');
    const cpf = atual?.cpf ?? (typeof entrada.cpf === 'string' ? entrada.cpf.replace(/\D/g, '') : '');
    if (!atual && cpf.length !== 11) throw new ErroElenco(400, 'Informe os 11 dígitos do CPF.');
    if (!atual && await tx.jogador.findUnique({ where: { cpf } })) throw new ErroElenco(409, 'Este CPF já está cadastrado');
    const camisa = entrada.numCamisa === undefined ? atual?.numCamisa ?? null : lerCamisa(entrada.numCamisa);
    const anterior = atual?.categoria_id === categoria.id ? atual.numCamisa : null;
    const conflito = camisa === null ? null : await tx.jogador.findFirst({
      where: { categoria_id: categoria.id, ativo: true, numCamisa: camisa, ...(id ? { id: { not: id } } : {}) }, orderBy: { id: 'asc' },
    });
    if (conflito) {
      const confirmacao = entrada.confirmar_camisa;
      if (confirmacao?.jogador_id !== conflito.id || confirmacao?.camisa_anterior !== anterior) {
        throw new ErroElenco(409, `A camisa ${camisa} já pertence a ${conflito.nome} no ${categoria.nome.toUpperCase()}.`, {
          conflito_camisa: { jogador_id: conflito.id, nome: conflito.nome, camisa, categoria: categoria.nome, camisa_anterior: anterior },
        });
      }
      // Bases antigas podem conter duplicatas: não transferir silenciosamente várias camisas.
      const outros = await tx.jogador.count({ where: { categoria_id: categoria.id, ativo: true,
        id: { notIn: [conflito.id, ...(id ? [id] : [])] }, numCamisa: { in: [camisa!, ...(anterior === null ? [] : [anterior])] } } });
      if (outros) throw new ErroElenco(409, 'Existem camisas duplicadas no elenco. Resolva os números antes da troca.');
      await tx.jogador.update({ where: { id: conflito.id }, data: { numCamisa: anterior } });
    }
    const informada = entrada.posicao === undefined ? atual?.posicao ?? 'Alas' : entrada.posicao;
    const posicao = ['Ala', 'Ala Direito', 'Ala Esquerdo'].includes(informada) ? 'Alas' : informada;
    if (typeof posicao !== 'string' || !['Goleiro', 'Fixo', 'Pivô', 'Alas'].includes(posicao)) throw new ErroElenco(400, 'Posição inválida.');
    const data = { nome, dtNasc: new Date(`${nascimento}T00:00:00Z`), posicao, numCamisa: camisa, categoria_id: categoria.id, ...(entrada.foto !== undefined ? { foto: entrada.foto as string | null } : {}) };
    return atual ? tx.jogador.update({ where: { id: atual.id }, data, include: { categoria: true } }) :
      tx.jogador.create({ data: { ...data, cpf, perfil_ml: 'Sem dados' }, include: { categoria: true } });
  });
}

export async function atualizarTemporada(clubeId: number, agora = new Date()) {
  return transacaoElenco(async tx => {
    const alunos = await tx.jogador.findMany({ where: { categoria: { clube_id: clubeId }, ativo: true } });
    const categorias = await tx.categoria.findMany({ where: { clube_id: clubeId } });
    const planos = planejarTemporada(alunos, categorias, agora);
    for (const { id, alterado, ...data } of planos) {
      if (alterado) await tx.jogador.update({ where: { id }, data });
    }
    return { ok: true, atualizados: planos.filter(p => p.alterado && p.ativo).length,
      desativados: planos.filter(p => !p.ativo).length, total: alunos.length };
  });
}

// Ao iniciar e a cada hora: recupera a virada do ano mesmo após o servidor ficar desligado.
export function iniciarAtualizacaoTemporada() {
  let executando = false;
  const executar = async () => {
    if (executando) return;
    executando = true;
    try {
      const clubes = await prisma.clube.findMany({ select: { id: true } });
      for (const clube of clubes) {
        try { await atualizarTemporada(clube.id); }
        catch { console.error(`Não foi possível atualizar a temporada do clube ${clube.id}; haverá nova tentativa.`); }
      }
    } catch { console.error('Não foi possível consultar clubes para atualizar a temporada.'); }
    finally { executando = false; }
  };
  void executar();
  const timer = setInterval(() => void executar(), 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
