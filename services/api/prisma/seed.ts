import { PrismaClient, TipoCategoria, Role, TipoEvento, StatusPartida, TipoCompeticao } from "@prisma/client";
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────────

function dataPartida(anoBase: number, mes: number, dia: number): Date {
  return new Date(`${anoBase}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
}

function escolher<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Adversários realistas para o sub-16 ───────────────────────────────────────

const ADVERSARIOS_SUB16 = [
  'Santos FC',
  'Guarujá EC',
  'Praia Grande FC',
  'São Vicente EC',
  'Mongaguá SC',
  'Itanhaém FC',
  'Peruíbe EC',
  'Bertioga SC',
  'Cubatão FC',
  'Litoral FC',
];

// ── Jogadores do sub-16 com perfis variados ───────────────────────────────────

const JOGADORES_SUB16 = [
  { nome: 'Murilo Paredão',     posicao: 'Goleiro', camisa: 1,  titular: true  },
  { nome: 'Felipe Fixo',        posicao: 'Fixo',    camisa: 4,  titular: true  },
  { nome: 'Jefferson Maestro',  posicao: 'Ala',     camisa: 10, titular: true  },
  { nome: 'Marcos Artilheiro',  posicao: 'Pivô',    camisa: 9,  titular: true  },
  { nome: 'Lucas Motorzinho',   posicao: 'Ala',     camisa: 7,  titular: true  },
  { nome: 'Gabriel Talento',    posicao: 'Ala',     camisa: 11, titular: false },
  { nome: 'Rafael Banco',       posicao: 'Pivô',    camisa: 13, titular: false },
  { nome: 'Diego Coringa',      posicao: 'Ala',     camisa: 8,  titular: false },
];

// ── Gerador de eventos por partida ────────────────────────────────────────────
// Recebe os IDs dos jogadores já criados e gera eventos variados e realistas

function gerarEventos(
  partidaId: number,
  jogadores: { id: number; posicao: string; titular: boolean }[],
  golsOcian: number,
  golsAdversario: number,
): Array<{
  partida_id: number;
  tipo: TipoEvento;
  periodo: number;
  minuto: number | null;
  doOcian: boolean;
  jogador_id: number | null;
}> {
  const eventos: ReturnType<typeof gerarEventos> = [];

  const goleiro    = jogadores.find(j => j.posicao === 'Goleiro')!;
  const pivos      = jogadores.filter(j => j.posicao === 'Pivô');
  const alas       = jogadores.filter(j => j.posicao === 'Ala');
  const fixos      = jogadores.filter(j => j.posicao === 'Fixo');
  const atacantes  = [...pivos, ...alas];

  // Gols do Ocian — distribuídos entre períodos, majoritariamente atacantes
  let golsRestantes = golsOcian;
  for (let g = 0; g < golsOcian; g++) {
    const periodo = g < Math.ceil(golsOcian / 2) ? 1 : 2;
    const artilheiro = escolher(atacantes);
    const assistente = escolher([...alas, ...fixos].filter(j => j.id !== artilheiro.id));
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.GOL, periodo, minuto: null, doOcian: true, jogador_id: artilheiro.id });
    // Assistência em ~70% dos gols
    if (Math.random() < 0.7 && assistente) {
      eventos.push({ partida_id: partidaId, tipo: TipoEvento.ASSISTENCIA, periodo, minuto: null, doOcian: true, jogador_id: assistente.id });
    }
    golsRestantes--;
  }

  // Gols do adversário (sem jogador específico do Ocian)
  for (let g = 0; g < golsAdversario; g++) {
    const periodo = g < Math.ceil(golsAdversario / 2) ? 1 : 2;
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.GOL, periodo, minuto: null, doOcian: false, jogador_id: null });
  }

  // Defesas do goleiro — mais defesas quanto mais gols o adversário fez + base
  const numDefesas = randInt(2, 4) + golsAdversario;
  for (let d = 0; d < numDefesas; d++) {
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.DEFESA, periodo: d % 2 === 0 ? 1 : 2, minuto: null, doOcian: true, jogador_id: goleiro.id });
  }

  // Faltas (2-5 por partida, qualquer jogador)
  const numFaltas = randInt(2, 5);
  for (let f = 0; f < numFaltas; f++) {
    const j = escolher(jogadores);
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.FALTA, periodo: randInt(1, 2), minuto: null, doOcian: true, jogador_id: j.id });
  }

  // Cartões (ocasionais — ~40% das partidas têm 1 cartão amarelo)
  if (Math.random() < 0.4) {
    const j = escolher(jogadores.filter(jj => jj.posicao !== 'Goleiro'));
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.CARTAO_AMARELO, periodo: 2, minuto: null, doOcian: true, jogador_id: j.id });
  }

  // Cartão azul ocasional (~15%)
  if (Math.random() < 0.15) {
    const j = escolher(jogadores);
    eventos.push({ partida_id: partidaId, tipo: TipoEvento.CARTAO_AZUL, periodo: 2, minuto: null, doOcian: true, jogador_id: j.id });
  }

  return eventos;
}

// ── Tabela de 30 partidas do sub-16 ───────────────────────────────────────────
// Distribuídas ao longo de 2025, resultados variados mas time forte (maioria vitorias)

const CRONOGRAMA_SUB16: Array<{
  mes: number; dia: number; rodada: number; grupo: string | null;
  adversario: string; emCasa: boolean; golsOcian: number; golsAdv: number;
}> = [
  // FASE DE GRUPOS — Grupo A e B
  { mes: 2, dia: 8,  rodada: 1,  grupo: 'A', adversario: 'Santos FC',      emCasa: true,  golsOcian: 4, golsAdv: 1 },
  { mes: 2, dia: 15, rodada: 1,  grupo: 'B', adversario: 'Guarujá EC',     emCasa: false, golsOcian: 3, golsAdv: 2 },
  { mes: 2, dia: 22, rodada: 2,  grupo: 'A', adversario: 'Praia Grande FC',emCasa: true,  golsOcian: 5, golsAdv: 0 },
  { mes: 3, dia: 1,  rodada: 2,  grupo: 'B', adversario: 'São Vicente EC', emCasa: false, golsOcian: 2, golsAdv: 2 },
  { mes: 3, dia: 8,  rodada: 3,  grupo: 'A', adversario: 'Mongaguá SC',    emCasa: true,  golsOcian: 6, golsAdv: 1 },
  { mes: 3, dia: 15, rodada: 3,  grupo: 'B', adversario: 'Itanhaém FC',    emCasa: false, golsOcian: 1, golsAdv: 3 },
  { mes: 3, dia: 22, rodada: 4,  grupo: 'A', adversario: 'Peruíbe EC',     emCasa: true,  golsOcian: 4, golsAdv: 2 },
  { mes: 3, dia: 29, rodada: 4,  grupo: 'B', adversario: 'Bertioga SC',    emCasa: false, golsOcian: 3, golsAdv: 1 },
  { mes: 4, dia: 5,  rodada: 5,  grupo: 'A', adversario: 'Cubatão FC',     emCasa: true,  golsOcian: 2, golsAdv: 0 },
  { mes: 4, dia: 12, rodada: 5,  grupo: 'B', adversario: 'Litoral FC',     emCasa: false, golsOcian: 4, golsAdv: 3 },
  // RODADA DE VOLTA
  { mes: 4, dia: 26, rodada: 6,  grupo: 'A', adversario: 'Santos FC',      emCasa: false, golsOcian: 3, golsAdv: 2 },
  { mes: 5, dia: 3,  rodada: 6,  grupo: 'B', adversario: 'Guarujá EC',     emCasa: true,  golsOcian: 5, golsAdv: 1 },
  { mes: 5, dia: 10, rodada: 7,  grupo: 'A', adversario: 'Praia Grande FC',emCasa: false, golsOcian: 2, golsAdv: 2 },
  { mes: 5, dia: 17, rodada: 7,  grupo: 'B', adversario: 'São Vicente EC', emCasa: true,  golsOcian: 4, golsAdv: 0 },
  { mes: 5, dia: 24, rodada: 8,  grupo: 'A', adversario: 'Mongaguá SC',    emCasa: false, golsOcian: 3, golsAdv: 1 },
  { mes: 5, dia: 31, rodada: 8,  grupo: 'B', adversario: 'Itanhaém FC',    emCasa: true,  golsOcian: 6, golsAdv: 2 },
  { mes: 6, dia: 7,  rodada: 9,  grupo: 'A', adversario: 'Peruíbe EC',     emCasa: false, golsOcian: 1, golsAdv: 1 },
  { mes: 6, dia: 14, rodada: 9,  grupo: 'B', adversario: 'Bertioga SC',    emCasa: true,  golsOcian: 5, golsAdv: 0 },
  { mes: 6, dia: 21, rodada: 10, grupo: 'A', adversario: 'Cubatão FC',     emCasa: false, golsOcian: 2, golsAdv: 3 },
  { mes: 6, dia: 28, rodada: 10, grupo: 'B', adversario: 'Litoral FC',     emCasa: true,  golsOcian: 4, golsAdv: 1 },
  // FASE ELIMINATÓRIA
  { mes: 7, dia: 19, rodada: 11, grupo: null, adversario: 'Santos FC',      emCasa: true,  golsOcian: 3, golsAdv: 1 },
  { mes: 7, dia: 26, rodada: 11, grupo: null, adversario: 'Guarujá EC',     emCasa: false, golsOcian: 4, golsAdv: 2 },
  { mes: 8, dia: 2,  rodada: 12, grupo: null, adversario: 'Praia Grande FC',emCasa: true,  golsOcian: 2, golsAdv: 1 },
  { mes: 8, dia: 9,  rodada: 12, grupo: null, adversario: 'Itanhaém FC',    emCasa: false, golsOcian: 5, golsAdv: 0 },
  { mes: 8, dia: 16, rodada: 13, grupo: null, adversario: 'Mongaguá SC',    emCasa: true,  golsOcian: 3, golsAdv: 2 },
  { mes: 8, dia: 23, rodada: 13, grupo: null, adversario: 'Cubatão FC',     emCasa: false, golsOcian: 1, golsAdv: 2 },
  { mes: 9, dia: 6,  rodada: 14, grupo: null, adversario: 'Litoral FC',     emCasa: true,  golsOcian: 4, golsAdv: 1 },
  { mes: 9, dia: 13, rodada: 14, grupo: null, adversario: 'São Vicente EC', emCasa: false, golsOcian: 3, golsAdv: 0 },
  // SEMIFINAL e FINAL
  { mes: 9, dia: 27, rodada: 15, grupo: null, adversario: 'Santos FC',      emCasa: true,  golsOcian: 4, golsAdv: 2 },
  { mes: 10,dia: 11, rodada: 16, grupo: null, adversario: 'Guarujá EC',     emCasa: true,  golsOcian: 3, golsAdv: 1 },
];

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧼 Limpando partidas, eventos e tabelas dependentes...");

  await prisma.evento.deleteMany({});
  await prisma.escalacaoPartida.deleteMany({});
  await prisma.partida.deleteMany({});
  await prisma.competicaoTime.deleteMany({});
  await prisma.competicaoJogador.deleteMany({});
  await prisma.jogador.deleteMany({});
  await prisma.time.deleteMany({});
  await prisma.competicao.deleteMany({});

  console.log("🏁 Banco limpo. Iniciando seeding...");

  // ── 1. CATEGORIAS ────────────────────────────────────────────────────────────
  const categoriasIniciacao = ['sub-7', 'sub-8', 'sub-9', 'sub-10'];
  for (const nome of categoriasIniciacao) {
    await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome, tipo: TipoCategoria.INICIACAO, faixaIdade: parseInt(nome.replace('sub-', '')) },
    });
  }

  const categoriasBases = ['sub-12', 'sub-14', 'sub-16', 'sub-18'];
  for (const nome of categoriasBases) {
    await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome, tipo: TipoCategoria.BASE, faixaIdade: parseInt(nome.replace('sub-', '')) },
    });
  }
  console.log("✅ Categorias criadas/verificadas.");

  // ── 2. ADMIN ─────────────────────────────────────────────────────────────────
  const hashSenha = await bcrypt.hash('123456', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@ocian.com' },
    update: {},
    create: { nome: 'Administrador', email: 'admin@ocian.com', senha: hashSenha, role: Role.ADMIN },
  });
  console.log('✅ Admin verificado.');

  // ── 3. SEED BASE — 1 partida por sub (igual ao original) ─────────────────────
  console.log("⚽ Gerando estrutura base por sub...");

  const todasCategorias = await prisma.categoria.findMany();
  const anoAtual = 2026;

  for (const cat of todasCategorias) {
    const ocianSub = await prisma.time.create({ data: { nome: "CFA Ocian", categoria_id: cat.id } });
    const rivalSub = await prisma.time.create({ data: { nome: "Rival FC",  categoria_id: cat.id } });

    const anoNasc  = anoAtual - cat.faixaIdade;
    const idStr    = cat.id.toString().padStart(2, '0');

    const jogadoresData = [
      { nome: `Murilo Paredão (${cat.nome})`,    posicao: 'Goleiro', camisa: 1,  titular: true  },
      { nome: `Felipe Fixo (${cat.nome})`,       posicao: 'Fixo',    camisa: 4,  titular: true  },
      { nome: `Jefferson Maestro (${cat.nome})`, posicao: 'Ala',     camisa: 10, titular: true  },
      { nome: `Marcos Artilheiro (${cat.nome})`, posicao: 'Pivô',    camisa: 9,  titular: true  },
      { nome: `Lucas Motorzinho (${cat.nome})`,  posicao: 'Ala',     camisa: 7,  titular: true  },
      { nome: `Gabriel Talento (${cat.nome})`,   posicao: 'Ala',     camisa: 11, titular: false },
    ];

    const jogadoresCriados = [];

    for (let i = 0; i < jogadoresData.length; i++) {
      const jData = jogadoresData[i];
      const cpf   = `${String(i + 1).repeat(3)}.${String(i + 1).repeat(3)}.${idStr}-00`;
      const j = await prisma.jogador.create({
        data: {
          nome: jData.nome, cpf, posicao: jData.posicao, categoria_id: cat.id,
          dtNasc: new Date(`${anoNasc}-05-10`), numCamisa: jData.camisa, ativo: true,
        },
      });
      jogadoresCriados.push({ jogador: j, titular: jData.titular, camisa: jData.camisa });
    }

    const partida = await prisma.partida.create({
      data: {
        mandante_id: ocianSub.id, visitante_id: rivalSub.id,
        gols_mandante: 4, gols_visitante: 1,
        emCasa: true, status: StatusPartida.FINALIZADA, categoria_id: cat.id,
        data: new Date(), horario: "09:00", local: "Ginásio Ocian Praia Clube", rodada: 1,
      },
    });

    await prisma.escalacaoPartida.createMany({
      data: jogadoresCriados.map(jc => ({
        partida_id: partida.id, jogador_id: jc.jogador.id,
        numCamisa: jc.camisa,  titular: jc.titular,
      })),
    });

    await prisma.evento.createMany({
      data: [
        { partida_id: partida.id, tipo: TipoEvento.GOL,           periodo: 1, minuto: null, doOcian: true, jogador_id: jogadoresCriados[3].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.GOL,           periodo: 1, minuto: null, doOcian: true, jogador_id: jogadoresCriados[3].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.GOL,           periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[3].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.ASSISTENCIA,   periodo: 1, minuto: null, doOcian: true, jogador_id: jogadoresCriados[2].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.ASSISTENCIA,   periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[2].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.GOL,           periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[2].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.DEFESA,        periodo: 1, minuto: null, doOcian: true, jogador_id: jogadoresCriados[0].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.DEFESA,        periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[0].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.FALTA,         periodo: 1, minuto: null, doOcian: true, jogador_id: jogadoresCriados[1].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.CARTAO_AMARELO,periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[1].jogador.id },
        { partida_id: partida.id, tipo: TipoEvento.CARTAO_AZUL,   periodo: 2, minuto: null, doOcian: true, jogador_id: jogadoresCriados[4].jogador.id },
      ],
    });

    console.log(`⚡ Base injetada para [${cat.nome.toUpperCase()}]`);
  }

  // ── 4. CAMPEONATO SUB-16 2025 ─────────────────────────────────────────────────
  console.log("\n🏆 Gerando campeonato sub-16 2025 com 30 partidas...");

  const catSub16 = await prisma.categoria.findFirst({ where: { nome: 'sub-16' } });
  if (!catSub16) throw new Error('Categoria sub-16 não encontrada');

  // Cria o campeonato
  const campeonato = await prisma.competicao.create({
    data: {
      nome: 'Campeonato Paulista Litorâneo',
      ano: 2025,
      tipo: TipoCompeticao.BASE,
    },
  });

  // Time Ocian sub-16 — pega o criado no loop acima
  const ocianSub16 = await prisma.time.findFirst({
    where: { nome: 'CFA Ocian', categoria_id: catSub16.id },
  });
  if (!ocianSub16) throw new Error('Time Ocian sub-16 não encontrado');

  // Inscreve o Ocian no campeonato
  await prisma.competicaoTime.create({
    data: { competicao_id: campeonato.id, time_id: ocianSub16.id },
  });

  // Cria times adversários e inscreve no campeonato
  const timesAdv: Record<string, number> = {};
  for (const nomeAdv of ADVERSARIOS_SUB16) {
    const timeExistente = await prisma.time.findFirst({
      where: { nome: nomeAdv, categoria_id: catSub16.id },
    });
    const timeAdv = timeExistente ?? await prisma.time.create({
      data: { nome: nomeAdv, categoria_id: catSub16.id },
    });
    timesAdv[nomeAdv] = timeAdv.id;
    // Inscreve no campeonato (ignora se já existir)
    await prisma.competicaoTime.upsert({
      where: { competicao_id_time_id: { competicao_id: campeonato.id, time_id: timeAdv.id } },
      update: {},
      create: { competicao_id: campeonato.id, time_id: timeAdv.id },
    });
  }

  // Jogadores do sub-16 — pega os criados no loop base
  const jogadoresSub16DB = await prisma.jogador.findMany({
    where: { categoria_id: catSub16.id },
    orderBy: { id: 'asc' },
  });

  // Cria jogadores extras para o sub-16 ter um elenco mais completo (8 jogadores)
  const anoNascSub16 = anoAtual - catSub16.faixaIdade;
  const idStrSub16   = catSub16.id.toString().padStart(2, '0');
  const extras = [
    { nome: 'Rafael Banco (sub-16)',  posicao: 'Pivô', camisa: 13 },
    { nome: 'Diego Coringa (sub-16)', posicao: 'Ala',  camisa: 8  },
  ];
  for (let i = 0; i < extras.length; i++) {
    const ex = extras[i];
    const cpf = `9${String(i + 1).repeat(2)}.${String(i + 1).repeat(3)}.${idStrSub16}-00`;
    const existente = await prisma.jogador.findUnique({ where: { cpf } });
    if (!existente) {
      const j = await prisma.jogador.create({
        data: {
          nome: ex.nome, cpf, posicao: ex.posicao, categoria_id: catSub16.id,
          dtNasc: new Date(`${anoNascSub16}-05-10`), numCamisa: ex.camisa, ativo: true,
        },
      });
      jogadoresSub16DB.push(j);
    }
  }

  // Inscreve todos os jogadores do sub-16 no campeonato
  for (const j of jogadoresSub16DB) {
    await prisma.competicaoJogador.upsert({
      where: { competicao_id_jogador_id: { competicao_id: campeonato.id, jogador_id: j.id } },
      update: {},
      create: { competicao_id: campeonato.id, jogador_id: j.id },
    });
  }

  // Monta lista de jogadores com posição para o gerador de eventos
  const jogadoresParaEventos = jogadoresSub16DB.map(j => ({
    id:      j.id,
    posicao: j.posicao,
    titular: JOGADORES_SUB16.find(jd => j.nome.includes(jd.nome.split(' ')[0]))?.titular ?? false,
  }));

  // ── 30 Partidas ──────────────────────────────────────────────────────────────
  for (const jogo of CRONOGRAMA_SUB16) {
    const advId    = timesAdv[jogo.adversario];
    const mandId   = jogo.emCasa ? ocianSub16.id : advId;
    const visitId  = jogo.emCasa ? advId : ocianSub16.id;
    const golsMand = jogo.emCasa ? jogo.golsOcian : jogo.golsAdv;
    const golsVis  = jogo.emCasa ? jogo.golsAdv   : jogo.golsOcian;

    const local = jogo.emCasa
      ? 'Ginásio Ocian Praia Clube'
      : `Arena ${jogo.adversario.replace(' FC', '').replace(' EC', '').replace(' SC', '')}`;

    const horarios = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

    const partida = await prisma.partida.create({
      data: {
        mandante_id:   mandId,
        visitante_id:  visitId,
        gols_mandante: golsMand,
        gols_visitante: golsVis,
        emCasa:        jogo.emCasa,
        status:        StatusPartida.FINALIZADA,
        categoria_id:  catSub16.id,
        competicao_id: campeonato.id,
        data:          dataPartida(2025, jogo.mes, jogo.dia),
        horario:       escolher(horarios),
        local,
        rodada:        jogo.rodada,
        grupo:         jogo.grupo,
      },
    });

    // Escalação — todos os jogadores do sub-16, camisas únicas por partida
    const titulares = jogadoresSub16DB.filter(j =>
      JOGADORES_SUB16.find(jd => j.nome.includes(jd.nome.split(' ')[0]))?.titular ?? false
    );
    const reservas = jogadoresSub16DB.filter(j =>
      !(JOGADORES_SUB16.find(jd => j.nome.includes(jd.nome.split(' ')[0]))?.titular ?? false)
    );

    const escalacao = [
      ...titulares.map(j => ({ jogador_id: j.id, numCamisa: j.numCamisa!, titular: true })),
      ...reservas.map(j =>  ({ jogador_id: j.id, numCamisa: j.numCamisa!, titular: false })),
    ];

    await prisma.escalacaoPartida.createMany({ data: escalacao.map(e => ({ ...e, partida_id: partida.id })) });

    // Eventos
    const eventos = gerarEventos(partida.id, jogadoresParaEventos, jogo.golsOcian, jogo.golsAdv);
    if (eventos.length > 0) {
      await prisma.evento.createMany({ data: eventos });
    }

    console.log(`  📅 ${jogo.mes.toString().padStart(2,'0')}/${jogo.dia.toString().padStart(2,'0')}/2025 R${jogo.rodada} — Ocian ${jogo.golsOcian}x${jogo.golsAdv} ${jogo.adversario} ${jogo.grupo ? `(Grp ${jogo.grupo})` : ''}`);
  }

  console.log(`\n✅ Campeonato "${campeonato.nome}" criado com 30 partidas e elenco completo do sub-16.`);
  console.log('🚀 Seeding concluído!');
}

main()
  .catch((e) => {
    console.error("Erro durante o seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });