import { PrismaClient } from '@prisma/client';

// Um único pool de conexões para todos os routers e serviços da API.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
