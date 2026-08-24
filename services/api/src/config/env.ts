import 'dotenv/config';
import type cors from 'cors';
import type jwt from 'jsonwebtoken';

export const isProduction = process.env.NODE_ENV === 'production';
export const PYTHON_AI_URL = process.env.PYTHON_AI_URL;

if (!process.env.JWT_SECRET) {
  console.error('ERRO FATAL: A variável JWT_SECRET não foi encontrada no arquivo .env!');
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET as string;
export const JWT_ISSUER = 'ludora-api';
export const JWT_AUDIENCE = 'ludora-apps';
export const JWT_OPTIONS: jwt.SignOptions = {
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
  console.warn('PYTHON_AI_URL não definida — Scout IA desativado.');
}

const origensPermitidas = new Set(
  (process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://localhost:5173,http://localhost:8081')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

const validarOrigem: cors.CorsOptions['origin'] = (origin, callback) => {
  if (!origin || origensPermitidas.has(origin)) return callback(null, true);
  return callback(new Error('Origem não permitida pelo CORS'));
};

export const corsOptions: cors.CorsOptions = {
  origin: validarOrigem,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'x-clube-id', 'x-request-id'],
  maxAge: 86400,
};

export const PORT = Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT inválida');
}
