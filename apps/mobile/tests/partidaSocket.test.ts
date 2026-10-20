import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { io as conectar, type Socket } from 'socket.io-client';

function aguardarEvento(socket: Socket, evento: string) {
  return new Promise<any[]>((resolve, reject) => {
    const receber = (...dados: any[]) => {
      clearTimeout(timer);
      resolve(dados);
    };
    const timer = setTimeout(() => {
      socket.off(evento, receber);
      reject(new Error(`Tempo limite aguardando ${evento}`));
    }, 5_000);
    socket.once(evento, receber);
  });
}

test('tempo real permite clube público, rejeita sessão inválida e isola salas de clubes', async (t) => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'segredo-exclusivo-dos-testes-de-tempo-real';
  const { criarSocketServer } = await import(
    '../../../services/api/src/realtime/socket'
  );
  const consultas: number[] = [];
  const banco = {
    clube: {
      async findUnique({ where }: any) {
        consultas.push(where.id);
        return where.id === 2 || where.id === 3 ? { id: where.id } : null;
      },
    },
  } as unknown as NonNullable<Parameters<typeof criarSocketServer>[1]>;
  const io = criarSocketServer(
    async (token) => (token === 'sessao-valida' ? 42 : null),
    banco
  );
  const http = createServer();
  io.attach(http);
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const endereco = http.address();
  assert.ok(endereco && typeof endereco !== 'string');
  const clientes: Socket[] = [];
  t.after(async () => {
    clientes.forEach((cliente) => cliente.disconnect());
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
  const cliente = (token: string, clubeId: number) => {
    const socket = conectar(`http://127.0.0.1:${endereco.port}`, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      auth: { token, clubeId },
    });
    clientes.push(socket);
    return socket;
  };
  for (const [token, clubeId] of [
    ['invalido', 2],
    ['sessao-valida', 999],
  ] as const) {
    const socket = cliente(token, clubeId);
    const erro = aguardarEvento(socket, 'connect_error');
    socket.connect();
    const [detalhe] = await erro;
    assert.equal(detalhe.message, 'Não autorizado');
    assert.equal(socket.connected, false);
  }
  const publico = cliente('sessao-valida', 2);
  const conexao = aguardarEvento(publico, 'connect');
  publico.connect();
  await conexao;
  assert.ok(io.sockets.sockets.get(publico.id!)?.rooms.has('clube:2'));
  assert.equal(
    io.sockets.sockets.get(publico.id!)?.rooms.has('clube:3'),
    false
  );
  assert.ok(io.sockets.sockets.get(publico.id!)?.rooms.has('usuario:42'));
  const recebidos: number[] = [];
  publico.on('placar_atualizado', (dados) => recebidos.push(dados.id));
  io.to('clube:3').emit('placar_atualizado', { id: 333 });
  const atualizacao = aguardarEvento(publico, 'placar_atualizado');
  io.to('clube:2').emit('placar_atualizado', { id: 222 });
  await atualizacao;
  assert.deepEqual(recebidos, [222]);
  assert.deepEqual(consultas, [999, 2]);
});
