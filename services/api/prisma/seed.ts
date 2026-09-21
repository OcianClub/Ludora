import {
  PapelUsuario,
  PrismaClient,
  StatusPartida,
  TipoCategoria,
  TipoCompeticao,
  TipoEvento,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CATEGORIAS = [
  { nome: 'sub-7', faixaIdade: 7, tipo: TipoCategoria.INICIACAO },
  { nome: 'sub-8', faixaIdade: 8, tipo: TipoCategoria.INICIACAO },
  { nome: 'sub-9', faixaIdade: 9, tipo: TipoCategoria.INICIACAO },
  { nome: 'sub-10', faixaIdade: 10, tipo: TipoCategoria.INICIACAO },
  { nome: 'sub-12', faixaIdade: 12, tipo: TipoCategoria.BASE },
  { nome: 'sub-14', faixaIdade: 14, tipo: TipoCategoria.BASE },
  { nome: 'sub-16', faixaIdade: 16, tipo: TipoCategoria.BASE },
  { nome: 'sub-18', faixaIdade: 18, tipo: TipoCategoria.BASE },
] as const;

const NOMES_JOGADORES = [
  'Gabriel Costa', 'Lucas Almeida', 'Matheus Santos', 'Rafael Oliveira',
  'Pedro Henrique', 'João Vitor', 'Gustavo Lima', 'Felipe Rocha',
  'Bruno Martins', 'Caio Ribeiro', 'Diego Souza', 'Leonardo Alves',
] as const;

const POSICOES = [
  'Goleiro', 'Fixo', 'Ala', 'Pivô', 'Ala', 'Ala',
  'Fixo', 'Pivô', 'Ala', 'Goleiro', 'Fixo', 'Ala',
] as const;

const ADVERSARIOS = ['Aurora FC', 'Estrela Azul', 'União Esportiva'] as const;

const CENARIOS_PARTIDAS = [
  { dias: -28, status: StatusPartida.FINALIZADA, nossosGols: 4, golsRival: 1 },
  { dias: -21, status: StatusPartida.FINALIZADA, nossosGols: 2, golsRival: 2 },
  { dias: -14, status: StatusPartida.FINALIZADA, nossosGols: 1, golsRival: 3 },
  { dias: -7, status: StatusPartida.FINALIZADA, nossosGols: 5, golsRival: 2 },
  { dias: 0, status: StatusPartida.AGENDADA, nossosGols: 0, golsRival: 0 },
  { dias: 3, status: StatusPartida.PREPARADA, nossosGols: 0, golsRival: 0 },
  { dias: 8, status: StatusPartida.AGENDADA, nossosGols: 0, golsRival: 0 },
  { dias: 15, status: StatusPartida.CANCELADA, nossosGols: 0, golsRival: 0 },
] as const;

const PRIORIDADE_PAPEL: Record<PapelUsuario, number> = {
  ADMIN: 4,
  TECNICO: 3,
  MESARIO: 2,
  TORCEDOR: 1,
};

function hojeUtc(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function dataNascimento(faixaIdade: number, indice: number): Date {
  const ano = new Date().getUTCFullYear() - faixaIdade + (indice % 2);
  return new Date(Date.UTC(ano, (indice * 2) % 12, 2 + (indice * 3) % 25));
}

function criarCpfUnico(indiceCategoria: number, indiceJogador: number): string {
  return `${700 + indiceCategoria}${String(indiceJogador + 1).padStart(3, '0')}00000`;
}

function dadosScout(posicao: string, indice: number) {
  const variacao = (indice % 4) * 2;
  if (posicao === 'Goleiro') {
    return {
      perfil_ml: 'Paredão', nota_geral: 7.8 + variacao / 10,
      scores_ml: { finalizacao: 28 + variacao, visao_de_jogo: 64 + variacao,
        defesa: 91 - variacao, disciplina: 82 - variacao,
        intensidade: 72 + variacao, tecnica: 68 + variacao },
    };
  }
  if (posicao === 'Pivô') {
    return {
      perfil_ml: 'Artilheiro', nota_geral: 8.1 + variacao / 10,
      scores_ml: { finalizacao: 90 - variacao, visao_de_jogo: 72 + variacao,
        defesa: 42 + variacao, disciplina: 75 - variacao,
        intensidade: 84 + variacao, tecnica: 86 - variacao },
    };
  }
  return {
    perfil_ml: 'Armador', nota_geral: 7.6 + variacao / 10,
    scores_ml: { finalizacao: 70 + variacao, visao_de_jogo: 89 - variacao,
      defesa: posicao === 'Fixo' ? 82 : 60, disciplina: 80 - variacao,
      intensidade: 85 + variacao, tecnica: 88 - variacao },
  };
}

function papelMaisForte(papeis: PapelUsuario[]): PapelUsuario {
  return papeis.reduce<PapelUsuario>(
    (maisForte, papel) => PRIORIDADE_PAPEL[papel] > PRIORIDADE_PAPEL[maisForte] ? papel : maisForte,
    PapelUsuario.TORCEDOR,
  );
}

async function limparDadosEsportivos(): Promise<void> {
  await prisma.$transaction([
    prisma.usuarioClube.deleteMany(),
    prisma.campeonatoClassificacao.deleteMany(),
    prisma.evento.deleteMany(),
    prisma.escalacaoPartida.deleteMany(),
    prisma.partida.deleteMany(),
    prisma.competicaoJogador.deleteMany(),
    prisma.competicaoTime.deleteMany(),
    prisma.jogador.deleteMany(),
    prisma.time.deleteMany(),
    prisma.competicao.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.clube.deleteMany(),
  ]);
}

async function main(): Promise<void> {
  console.log('🌱 Iniciando seed de demonstração do Ludora...');

  // A tabela Usuario e os hashes das senhas nunca são apagados por este seed.
  let usuarios = await prisma.usuario.findMany({
    orderBy: { criadoEm: 'asc' },
    include: { clubes: { select: { papel: true } } },
  });
  const papeisAnteriores = new Map(
    usuarios.map((usuario) => [
      usuario.id,
      papelMaisForte(usuario.clubes.map((vinculo) => vinculo.papel)),
    ]),
  );

  await limparDadosEsportivos();
  console.log(`🧹 Dados esportivos removidos; ${usuarios.length} usuário(s) preservado(s).`);

  const clube = await prisma.clube.create({
    data: { nome: 'Ludora FC', cidade: 'São Paulo', estado: 'SP', plano: 'PRO' },
  });

  let usuarioTesteCriado = false;
  if (usuarios.length === 0) {
    const senha = await bcrypt.hash('Ludora@123', 12);
    const usuario = await prisma.usuario.create({
      data: { nome: 'Administrador Ludora', email: 'admin@ludora.dev', senha },
      include: { clubes: { select: { papel: true } } },
    });
    usuarios = [usuario];
    papeisAnteriores.set(usuario.id, PapelUsuario.ADMIN);
    usuarioTesteCriado = true;
  }

  const emailAdmin = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const usuarioAdminEscolhido =
    usuarios.find((usuario) => usuario.email.toLowerCase() === emailAdmin) ??
    usuarios.find((usuario) => papeisAnteriores.get(usuario.id) === PapelUsuario.ADMIN) ??
    usuarios[0];

  await prisma.usuarioClube.createMany({
    data: usuarios.map((usuario) => ({
      usuario_id: usuario.id,
      clube_id: clube.id,
      papel: usuario.id === usuarioAdminEscolhido.id
        ? PapelUsuario.ADMIN
        : (papeisAnteriores.get(usuario.id) ?? PapelUsuario.TORCEDOR),
    })),
  });

  const categorias = [];
  for (const categoria of CATEGORIAS) {
    categorias.push(await prisma.categoria.create({
      data: { clube_id: clube.id, ...categoria },
    }));
  }

  const anoAtual = new Date().getUTCFullYear();
  const competicaoIniciacao = await prisma.competicao.create({
    data: {
      clube_id: clube.id, nome: `Festival Ludora ${anoAtual}`,
      ano: anoAtual, tipo: TipoCompeticao.INICIACAO,
      categorias: { connect: categorias
        .filter((categoria) => categoria.tipo === TipoCategoria.INICIACAO)
        .map(({ id }) => ({ id })) },
    },
  });
  const competicaoBase = await prisma.competicao.create({
    data: {
      clube_id: clube.id, nome: `Liga Ludora ${anoAtual}`,
      ano: anoAtual, tipo: TipoCompeticao.BASE,
      categorias: { connect: categorias
        .filter((categoria) => categoria.tipo === TipoCategoria.BASE)
        .map(({ id }) => ({ id })) },
    },
  });

  let totalTimes = 0;
  let totalJogadores = 0;
  let totalPartidas = 0;
  let totalEventos = 0;

  for (const [indiceCategoria, categoria] of categorias.entries()) {
    const competicao = categoria.tipo === TipoCategoria.INICIACAO
      ? competicaoIniciacao : competicaoBase;
    const nossoTime = await prisma.time.create({
      data: { nome: `Ludora FC ${categoria.nome}`, categoria_id: categoria.id },
    });
    const rivais = [];
    for (const nome of ADVERSARIOS) {
      rivais.push(await prisma.time.create({
        data: { nome: `${nome} ${categoria.nome}`, categoria_id: categoria.id },
      }));
    }
    const times = [nossoTime, ...rivais];
    totalTimes += times.length;
    await prisma.competicaoTime.createMany({
      data: times.map((time) => ({ competicao_id: competicao.id, time_id: time.id })),
    });

    const jogadores = [];
    for (const [indiceJogador, nome] of NOMES_JOGADORES.entries()) {
      const posicao = POSICOES[indiceJogador];
      jogadores.push(await prisma.jogador.create({
        data: {
          nome: `${nome} (${categoria.nome})`,
          cpf: criarCpfUnico(indiceCategoria, indiceJogador),
          dtNasc: dataNascimento(categoria.faixaIdade, indiceJogador),
          numCamisa: indiceJogador + 1,
          posicao,
          categoria_id: categoria.id,
          ...dadosScout(posicao, indiceJogador),
        },
      }));
    }
    totalJogadores += jogadores.length;
    await prisma.competicaoJogador.createMany({
      data: jogadores.map((jogador) => ({ competicao_id: competicao.id, jogador_id: jogador.id })),
    });

    for (const [indicePartida, cenarioOriginal] of CENARIOS_PARTIDAS.entries()) {
      const cenario = categoria.nome === 'sub-16' && cenarioOriginal.dias === 0
        ? { ...cenarioOriginal, status: StatusPartida.AO_VIVO, nossosGols: 2, golsRival: 1 }
        : cenarioOriginal;
      const rival = rivais[indicePartida % rivais.length];
      const emCasa = indicePartida % 2 === 0;
      const partida = await prisma.partida.create({
        data: {
          mandante_id: emCasa ? nossoTime.id : rival.id,
          visitante_id: emCasa ? rival.id : nossoTime.id,
          gols_mandante: emCasa ? cenario.nossosGols : cenario.golsRival,
          gols_visitante: emCasa ? cenario.golsRival : cenario.nossosGols,
          horario: indicePartida % 2 === 0 ? '19:30' : '10:00',
          data: adicionarDias(hojeUtc(), cenario.dias),
          local: emCasa ? 'Ginásio Ludora' : `Arena ${rival.nome.replace(` ${categoria.nome}`, '')}`,
          rodada: indicePartida + 1, grupo: 'A', emCasa,
          status: cenario.status, categoria_id: categoria.id,
          competicao_id: competicao.id,
        },
      });
      totalPartidas++;

      if (cenario.status !== StatusPartida.CANCELADA) {
        await prisma.escalacaoPartida.createMany({
          data: jogadores.slice(0, 10).map((jogador, indice) => ({
            partida_id: partida.id, jogador_id: jogador.id,
            numCamisa: jogador.numCamisa ?? indice + 1, titular: indice < 5,
          })),
        });
      }

      const possuiScout = cenario.status === StatusPartida.FINALIZADA
        || cenario.status === StatusPartida.AO_VIVO;
      if (possuiScout) {
        const eventos: Array<{
          partida_id: number; tipo: TipoEvento; periodo: number;
          minuto: number | null; jogador_id: number | null;
        }> = [];
        for (let gol = 0; gol < cenario.nossosGols; gol++) {
          eventos.push({
            partida_id: partida.id, tipo: TipoEvento.GOL,
            periodo: gol % 2 === 0 ? 1 : 2, minuto: 4 + gol * 3,
            jogador_id: jogadores[2 + (gol % 6)].id,
          });
          if (gol > 0) {
            eventos.push({
              partida_id: partida.id, tipo: TipoEvento.ASSISTENCIA,
              periodo: gol % 2 === 0 ? 1 : 2, minuto: 4 + gol * 3,
              jogador_id: jogadores[4 + (gol % 3)].id,
            });
          }
        }
        for (let gol = 0; gol < cenario.golsRival; gol++) {
          eventos.push({
            partida_id: partida.id, tipo: TipoEvento.GOL,
            periodo: gol % 2 === 0 ? 1 : 2, minuto: 7 + gol * 4,
            jogador_id: null,
          });
        }
        eventos.push(
          { partida_id: partida.id, tipo: TipoEvento.DEFESA, periodo: 1, minuto: 9, jogador_id: jogadores[0].id },
          { partida_id: partida.id, tipo: TipoEvento.DEFESA, periodo: 2, minuto: 14, jogador_id: jogadores[0].id },
          { partida_id: partida.id, tipo: TipoEvento.FALTA, periodo: 2, minuto: 11, jogador_id: jogadores[1].id },
        );
        if (indicePartida % 2 === 0) {
          eventos.push({
            partida_id: partida.id, tipo: TipoEvento.CARTAO_AMARELO,
            periodo: 2, minuto: 12, jogador_id: jogadores[1].id,
          });
        }
        await prisma.evento.createMany({ data: eventos });
        totalEventos += eventos.length;
      }
    }
  }

  const classificacao = [
    { clube: 'Ludora FC', pontos: 10, jogos: 4, vitorias: 3, empates: 1, derrotas: 0, golsPro: 14, golsContra: 7 },
    { clube: 'Aurora FC', pontos: 7, jogos: 4, vitorias: 2, empates: 1, derrotas: 1, golsPro: 10, golsContra: 8 },
    { clube: 'Estrela Azul', pontos: 4, jogos: 4, vitorias: 1, empates: 1, derrotas: 2, golsPro: 8, golsContra: 11 },
    { clube: 'União Esportiva', pontos: 1, jogos: 4, vitorias: 0, empates: 1, derrotas: 3, golsPro: 5, golsContra: 11 },
  ];
  await prisma.campeonatoClassificacao.createMany({
    data: classificacao.map((item, indice) => ({
      temporada: String(anoAtual), titulo: `Liga Ludora ${anoAtual}`,
      divisao: 'Base', categoria: 'sub-16', eventoId: competicaoBase.id,
      tipoTabela: 'CLASSIFICACAO', grupo: 'A', posicao: indice + 1, ...item,
      saldo: item.golsPro - item.golsContra,
      average: item.golsContra === 0 ? item.golsPro : item.golsPro / item.golsContra,
      mediaGolsMarcados: item.golsPro / item.jogos,
      mediaGolsSofridos: item.golsContra / item.jogos,
      indiceTecnico: item.pontos / (item.jogos * 3), destaque: indice === 0,
    })),
  });

  console.log('\n✅ Seed concluído!');
  console.log(`   Clube: ${clube.nome}`);
  console.log(`   Usuários preservados/vinculados: ${usuarios.length}`);
  console.log(`   Categorias: ${categorias.length}`);
  console.log('   Competições: 2');
  console.log(`   Times: ${totalTimes}`);
  console.log(`   Jogadores: ${totalJogadores}`);
  console.log(`   Partidas: ${totalPartidas}`);
  console.log(`   Eventos: ${totalEventos}`);
  console.log(`   Administrador: ${usuarioAdminEscolhido.email}`);
  if (usuarioTesteCriado) {
    console.log('\n⚠️ Nenhum usuário existia; foi criada uma conta apenas para desenvolvimento:');
    console.log('   E-mail: admin@ludora.dev');
    console.log('   Senha: Ludora@123');
  }
}

main()
  .catch((error: unknown) => {
    console.error('❌ Erro ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
