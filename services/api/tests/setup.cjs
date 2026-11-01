// Os testes nunca devem herdar credenciais ou integrações do .env local.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://ludora_test:ludora_test@127.0.0.1:1/ludora_test',
  DIRECT_URL: 'postgresql://ludora_test:ludora_test@127.0.0.1:1/ludora_test',
  JWT_SECRET: 'segredo-exclusivo-da-suite-local-ludora',
  CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  PYTHON_AI_URL: '',
  ML_API_KEY: 'chave-exclusiva-da-suite-local',
  SUPERADMIN_EMAILS: '',
  RESEND_API_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  GOOGLE_PLACES_API_KEY: '',
  ATUALIZACAO_TEMPORADA: 'false',
});
