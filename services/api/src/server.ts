import http from 'http';

import { criarApp } from './app';
import { PORT } from './config/env';
import { prisma } from './lib/prisma';
import { criarSocketServer } from './realtime/socket';

const io = criarSocketServer();
const app = criarApp(io);
const server = http.createServer(app);

io.attach(server);

server.requestTimeout = 130_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Core Service rodando na porta ${PORT}`);
});

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
