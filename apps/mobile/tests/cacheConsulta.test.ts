import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  criarCacheConsulta,
  expiracaoTokenCache,
  identidadeSessaoCache,
  type EscopoCache,
} from '../src/utils/cacheConsulta';
import { executarConsultaComCache } from '../src/utils/consultaComCache';
import {
  selecionarJogadoresLocais,
  selecionarPartidasLocais,
} from '../src/utils/dadosConsultaLocal';
import { ErroConexao, ErroConsulta } from '../src/utils/request';
import { gerarJogadoresScout } from './scout.fixture';

const validar = (dados: unknown) =>
  Array.isArray(dados) && dados.every((item) => typeof item === 'number')
    ? (dados as number[])
    : null;

function preparar() {
  let agora = 1_800_000_000_000;
  const arquivos = new Map<string, string>();
  const cache = criarCacheConsulta(
    {
      listar: async () => [...arquivos.keys()],
      ler: async (chave) => arquivos.get(chave) ?? '',
      gravar: async (chave, texto) => {
        arquivos.set(chave, texto);
      },
      remover: async (chave) => {
        arquivos.delete(chave);
      },
    },
    () => agora
  );
  const escopo = (clubeId = 1, sessao = 'sessao-a'): EscopoCache => ({
    clubeId,
    sessao,
    geracao: cache.geracao(),
    validoAte: agora + 48 * 60 * 60_000,
  });
  return {
    cache,
    arquivos,
    escopo,
    agora: () => agora,
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

test('cache persiste por sessão, clube e recurso sem misturar dados', async () => {
  const { cache, arquivos, escopo, agora } = preparar();
  await cache.gravar(escopo(1), 'home', [1]);
  await cache.gravar(escopo(2), 'home', [2]);
  assert.deepEqual(await cache.ler(escopo(1), 'home', validar), {
    dados: [1],
    salvoEm: agora(),
  });
  assert.deepEqual(await cache.ler(escopo(2), 'home', validar), {
    dados: [2],
    salvoEm: agora(),
  });
  assert.equal(await cache.ler(escopo(1), 'scout', validar), null);
  assert.equal(await cache.ler(escopo(1, 'sessao-b'), 'home', validar), null);
  const cacheReaberto = criarCacheConsulta(
    {
      listar: async () => [...arquivos.keys()],
      ler: async (chave) => arquivos.get(chave)!,
      gravar: async () => {},
      remover: async () => {},
    },
    agora
  );
  assert.deepEqual(
    (await cacheReaberto.ler(escopo(1), 'home', validar))?.dados,
    [1]
  );
});

test('cache vencido, sessão expirada e arquivos quebrados não são usados', async () => {
  const estado = preparar();
  const sessao = estado.escopo();
  await estado.cache.gravar(sessao, 'home', [1]);
  assert.equal(
    await estado.cache.ler(
      { ...sessao, validoAte: estado.agora() - 1 },
      'home',
      validar
    ),
    null
  );
  estado.avancar(24 * 60 * 60_000);
  assert.equal(await estado.cache.ler(sessao, 'home', validar), null);
  assert.equal(estado.arquivos.size, 0);
  await estado.cache.gravar(estado.escopo(), 'home', [2]);
  for (const chave of estado.arquivos.keys())
    estado.arquivos.set(chave, '{quebrado');
  const reaberto = criarCacheConsulta(
    {
      listar: async () => [...estado.arquivos.keys()],
      ler: async (chave) => estado.arquivos.get(chave) ?? '',
      gravar: async () => {},
      remover: async (chave) => {
        estado.arquivos.delete(chave);
      },
    },
    estado.agora
  );
  assert.equal(await reaberto.ler(estado.escopo(), 'home', validar), null);
  assert.equal(estado.arquivos.size, 0);
});

test('cópia em memória evita disco na revisita e não compartilha objetos mutáveis', async () => {
  let leituras = 0;
  const cache = criarCacheConsulta({
    listar: async () => {
      leituras++;
      return [];
    },
    ler: async () => {
      throw new Error('Não deve ler o disco');
    },
    gravar: async () => {},
    remover: async () => {},
  });
  const escopo: EscopoCache = {
    sessao: 'sessao-a',
    clubeId: 1,
    geracao: 0,
    validoAte: Date.now() + 60_000,
  };
  await cache.gravar(escopo, 'home', [1]);
  const antes = leituras;
  const primeira = await cache.ler(escopo, 'home', validar);
  primeira!.dados.push(99);
  assert.deepEqual((await cache.ler(escopo, 'home', validar))?.dados, [1]);
  assert.equal(leituras, antes);
  await cache.limpar();
  assert.equal(
    await cache.ler({ ...escopo, geracao: cache.geracao() }, 'home', validar),
    null
  );
});

test('leitura quente não espera operações de disco de outro clube', async () => {
  let bloquear = false;
  let liberar!: () => void;
  const bloqueio = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  const cache = criarCacheConsulta({
    listar: async () => {
      if (bloquear) await bloqueio;
      return [];
    },
    ler: async () => '',
    gravar: async () => {},
    remover: async () => {},
  });
  const escopo: EscopoCache = {
    sessao: 'sessao-a',
    clubeId: 1,
    geracao: 0,
    validoAte: Date.now() + 60_000,
  };
  await cache.gravar(escopo, 'home', [1]);
  bloquear = true;
  const fria = cache.ler({ ...escopo, clubeId: 2 }, 'home', validar);
  try {
    assert.deepEqual((await cache.ler(escopo, 'home', validar))?.dados, [1]);
  } finally {
    liberar();
  }
  await fria;
});

test('limpeza invalida gravações antigas e dados grandes não são persistidos', async () => {
  const estado = preparar();
  const anterior = estado.escopo();
  await estado.cache.gravar(anterior, 'home', [1]);
  await estado.cache.limpar();
  assert.equal(await estado.cache.gravar(anterior, 'home', [9]), false);
  assert.equal(await estado.cache.ler(anterior, 'home', validar), null);
  assert.equal(estado.arquivos.size, 0);
  assert.equal(
    await estado.cache.gravar(estado.escopo(), 'home', ['a'.repeat(334_000)]),
    false
  );
  assert.equal(estado.arquivos.size, 0);
});

test('uma negativa de acesso invalida gravações que ainda usavam o contexto anterior', async () => {
  const estado = preparar();
  const anterior = estado.escopo();
  await estado.cache.gravar(anterior, 'scout', [1]);
  await estado.cache.remover(anterior, 'scout');
  assert.equal(await estado.cache.gravar(anterior, 'scout', [99]), false);
  assert.equal(await estado.cache.ler(estado.escopo(), 'scout', validar), null);
});

test('cache fica limitado a seis cópias e mantém apenas a última versão do mesmo recurso', async () => {
  const estado = preparar();
  for (let clube = 1; clube <= 8; clube++) {
    estado.avancar(1);
    await estado.cache.gravar(estado.escopo(clube), 'home', [clube]);
  }
  assert.equal(estado.arquivos.size, 6);
  assert.equal(await estado.cache.ler(estado.escopo(1), 'home', validar), null);
  estado.avancar(1);
  await estado.cache.gravar(estado.escopo(8), 'home', [88]);
  assert.deepEqual(
    (await estado.cache.ler(estado.escopo(8), 'home', validar))?.dados,
    [88]
  );
  assert.equal(
    [...estado.arquivos.keys()].filter((chave) => chave.includes('.8.home.'))
      .length,
    1
  );
});

test('falha no armazenamento não impede consulta e escopos inválidos são recusados', async () => {
  const estado = preparar();
  const cache = criarCacheConsulta(
    {
      listar: async () => {
        throw new Error('Sem disco');
      },
      ler: async () => '',
      gravar: async () => {
        throw new Error('Sem disco');
      },
      remover: async () => {},
    },
    estado.agora
  );
  assert.equal(await cache.ler(estado.escopo(), 'home', validar), null);
  assert.equal(await cache.gravar(estado.escopo(), 'home', [1]), false);
  assert.equal(
    await estado.cache.gravar(
      { ...estado.escopo(), sessao: '../fora' },
      'home',
      [1]
    ),
    false
  );
});

test('validade da sessão é lida sem persistir ou verificar o token como autenticação offline', () => {
  const token = (exp: unknown) =>
    `cabecalho.${Buffer.from(JSON.stringify({ id: 1, exp })).toString('base64url')}.assinatura`;
  assert.equal(expiracaoTokenCache(token(1_800_000_000)), 1_800_000_000_000);
  for (const valor of ['invalido', token(null), token('1800000000'), token(-1)])
    assert.equal(expiracaoTokenCache(valor), null);
});

test('a identidade do cache distingue contas, logins e versões de sessão sem armazenar o JWT', () => {
  const token = (id: number, iat: number, versao = 0) =>
    `cabecalho.${Buffer.from(JSON.stringify({ id, iat, exp: 1_900_000_000, versao_sessao: versao })).toString('base64url')}.assinatura`;
  const identidade = identidadeSessaoCache(token(1, 1_800_000_000));
  assert.ok(identidade);
  assert.notEqual(identidade, identidadeSessaoCache(token(2, 1_800_000_000)));
  assert.notEqual(identidade, identidadeSessaoCache(token(1, 1_800_000_001)));
  assert.notEqual(
    identidade,
    identidadeSessaoCache(token(1, 1_800_000_000, 1))
  );
  assert.doesNotMatch(identidade, /cabecalho|assinatura/);
  assert.equal(identidadeSessaoCache('invalido'), null);
});

test('cópias locais guardam apenas os campos previstos, sem CPF, e-mail, nascimento ou credenciais', () => {
  const jogadores = selecionarJogadoresLocais([
    {
      ...gerarJogadoresScout(1)[0],
      cpf: 'segredo-cpf',
      email: 'segredo-email',
      dtNasc: 'segredo-nascimento',
      token: 'segredo-token',
      senha: 'segredo-senha',
    },
  ]);
  assert.ok(jogadores);
  assert.doesNotMatch(JSON.stringify(jogadores), /segredo/);
  const partidas = selecionarPartidasLocais([
    {
      id: 1,
      mandante: { id: 1, nome: 'Clube', escudo: null, token: 'segredo' },
      visitante: { id: 2, nome: 'Visitante', escudo: null },
      gols_mandante: 2,
      gols_visitante: 1,
      data: '2026-10-20',
      horario: '18:00',
      local: 'Quadra',
      status: 'AO_VIVO',
      emCasa: true,
      categoria: { id: 1, nome: 'sub-7' },
      eventos: [{ segredo: 'segredo' }],
      token: 'segredo',
    },
  ]);
  assert.ok(partidas);
  assert.doesNotMatch(JSON.stringify(partidas), /segredo|eventos/);
  assert.equal(selecionarPartidasLocais([{}]), null);
  assert.equal(selecionarJogadoresLocais([{}]), null);
});

function operacao(
  carregar: () => Promise<number[]>,
  alteracoes: Partial<
    Parameters<typeof executarConsultaComCache<number[]>>[0]
  > = {}
) {
  return executarConsultaComCache<number[]>({
    carregar,
    lerLocal: async () => ({ dados: [1], salvoEm: 10 }),
    contextoAtual: async () => true,
    salvar: async () => {},
    descartar: async () => {},
    agora: () => 20,
    ...alteracoes,
  });
}

test('resposta remota pronta não espera uma leitura local lenta e cache atrasado não reaparece', async () => {
  let liberar!: (dados: { dados: number[]; salvoEm: number }) => void;
  const locais: number[][] = [];
  const resposta = await operacao(async () => [42], {
    lerLocal: () =>
      new Promise((resolve) => {
        liberar = resolve;
      }),
    onLocal: (local) => locais.push(local.dados),
  });
  assert.equal(resposta.origem, 'servidor');
  assert.deepEqual(resposta.dados, [42]);
  liberar({ dados: [1], salvoEm: 10 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(locais, []);
});

test('cache preserva clube de origem e restrição de edição sem guardar eventos', () => {
  const dados = selecionarPartidasLocais([
    {
      id: 1,
      mandante: { id: 1, nome: 'A', escudo: null },
      visitante: { id: 2, nome: 'B', escudo: null },
      gols_mandante: 1,
      gols_visitante: 1,
      data: '2026-10-20',
      status: 'AO_VIVO',
      emCasa: false,
      clube_origem_id: 2,
      somente_leitura: true,
      eventos: [{ tipo: 'GOL' }],
      categoria: { id: 1, nome: 'sub-7' },
    },
  ]);
  assert.equal(dados?.[0].clube_origem_id, 2);
  assert.equal(dados?.[0].somente_leitura, true);
  assert.equal('eventos' in dados![0], false);
});

test('consulta sem rede usa a cópia local e sucesso remoto inclusive vazio prevalece', async () => {
  assert.deepEqual(
    await operacao(async () => {
      throw new ErroConexao('Sem rede');
    }),
    { dados: [1], salvoEm: 10, origem: 'local' }
  );
  assert.deepEqual(await operacao(async () => []), {
    dados: [],
    salvoEm: 20,
    origem: 'servidor',
  });
  assert.deepEqual(
    (
      await operacao(async () => {
        throw new ErroConsulta(503, 'Indisponível');
      })
    ).dados,
    [1]
  );
});

test('negativa de acesso nunca vira sucesso offline e invalida a cópia', async () => {
  for (const status of [401, 403, 404]) {
    let descartou = false;
    await assert.rejects(
      operacao(
        async () => {
          throw new ErroConsulta(status, 'Acesso negado');
        },
        {
          descartar: async () => {
            descartou = true;
          },
        }
      ),
      /Acesso negado/
    );
    assert.equal(descartou, true);
  }
  await assert.rejects(
    operacao(
      async () => {
        throw new ErroConexao('Sem rede');
      },
      { contextoAtual: async () => false }
    ),
    /Sem rede/
  );
  await assert.rejects(
    operacao(async () => {
      throw new ErroConsulta(429, 'Limite');
    }),
    /Limite/
  );
});

test('carrega cópia durante a espera, mas nunca substitui resposta remota rápida por cache atrasado', async () => {
  let concluir!: (dados: number[]) => void;
  let exibir!: () => void;
  const exibiu = new Promise<void>((resolve) => {
    exibir = resolve;
  });
  const locais: number[][] = [];
  const resultado = operacao(
    () =>
      new Promise((resolve) => {
        concluir = resolve;
      }),
    {
      onLocal: (local) => {
        locais.push(local.dados);
        exibir();
      },
    }
  );
  await exibiu;
  concluir([2]);
  assert.equal((await resultado).origem, 'servidor');
  assert.deepEqual(locais, [[1]]);
  let liberarLocal!: (dados: { dados: number[]; salvoEm: number }) => void;
  const atraso = operacao(async () => [3], {
    lerLocal: () =>
      new Promise((resolve) => {
        liberarLocal = resolve;
      }),
    onLocal: (local) => locais.push(local.dados),
  });
  await Promise.resolve();
  liberarLocal({ dados: [9], salvoEm: 10 });
  assert.deepEqual((await atraso).dados, [3]);
  assert.deepEqual(locais, [[1]]);
});
