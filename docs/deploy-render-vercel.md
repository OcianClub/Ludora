# Backend no Render e web na Vercel

Use o mesmo commit do repositório para os dois serviços. As configurações abaixo partem da raiz do monorepo, pois o web importa arquivos de `packages/` e `apps/mobile/`.

## 1. Atualizar o serviço existente no Render

Em Settings → Build & Deploy, mantenha o runtime **Node** e configure:

| Campo | Valor |
|---|---|
| Branch | A branch que contém as mudanças que serão publicadas |
| Root Directory | Vazio (raiz do repositório) |
| Build Command | `corepack pnpm install --frozen-lockfile --prod=false --filter @ludora/api... && corepack pnpm run build:api` |
| Start Command | `node services/api/dist/src/server.js` |
| Health Check Path | `/health` |

Não utilize `pnpm dev`, `dev:api` ou `dev:ml` em produção. O servidor já utiliza `PORT` fornecida pelo Render e escuta em `0.0.0.0`.

Em Environment, revise as variáveis existentes sem compartilhar seus valores privados:

| Variável | Configuração |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.x` |
| `DATABASE_URL` | Conexão PostgreSQL de produção, conforme configuração do Supabase |
| `DIRECT_URL` | Conexão para migrations fornecida pelo Supabase, acessível pelo ambiente de deploy |
| `JWT_SECRET` | Segredo aleatório com pelo menos 32 caracteres; preserve o existente se já for adequado |
| `CORS_ORIGINS` | URL HTTPS exata e estável do site Vercel, sem caminho ou barra final; várias origens separadas por vírgula |
| `TRUST_PROXY_HOPS` | `1` quando o Render for o único proxy na frente da API |
| `RESEND_API_KEY` | Chave Resend do backend |
| `EMAIL_FROM` | Remetente autorizado no Resend |
| `INVITE_BASE_URL` | `https://SEU-SITE.vercel.app/convite/token` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada usada no upload de escudos |
| `SUPERADMIN_EMAILS` | Apenas os e-mails autorizados a usar o painel administrativo global; opcional |
| `PYTHON_AI_URL` | Deixe vazio enquanto não houver serviço Python publicado |
| `ML_API_KEY` | Necessária se habilitar Scout IA; mesma chave privada nos dois serviços |

Não use `localhost:8000` para `PYTHON_AI_URL`: o Python do seu computador não estará disponível para o Render. Sem esse serviço, as estatísticas registradas continuam disponíveis, mas a classificação por IA não será recalculada.

Preserve outras variáveis já configuradas para integrações que utiliza. Uma URL de preview diferente da URL estável da Vercel também precisará estar explicitamente autorizada no CORS para acessar a API.

### Banco existente

O build gera o Prisma Client, mas **não executa migrations nem seed automaticamente**. Antes de usar a nova versão, confira backup e migrations pendentes no banco de destino:

```sh
corepack pnpm --filter @ludora/api exec prisma migrate status
```

Depois da revisão, aplique as migrations aprovadas com `prisma migrate deploy` usando uma conexão administrativa segura, por exemplo em uma etapa de pré-deploy quando disponível no plano. Não use `migrate dev`, `db push`, `reset` ou seed no banco de produção para resolver erros de deploy.

## 2. Criar o projeto na Vercel

Importe o repositório Git e configure:

| Campo | Valor |
|---|---|
| Root Directory | `.` (raiz) |
| Framework Preset | Vite |
| Node.js Version | 22.x |
| Production Branch | A branch escolhida para publicar |

O `vercel.json` da raiz contém os comandos de instalação/build, a saída `apps/web/dist` e o fallback SPA. Esse fallback permite abrir ou atualizar diretamente `/partidas`, `/perfil`, `/convites/...` e outras rotas React.

Em Environment Variables, configure:

```text
VITE_API_URL=https://SUA-API.onrender.com
```

Use a URL pública real do seu serviço Render, sem `/api` no final. A API atual expõe `/auth/login`, `/partidas`, `/socket.io`, etc. O Socket.IO usa essa mesma base HTTPS. Os comandos chamam Corepack explicitamente para respeitar a versão de pnpm declarada no repositório.

Escolha os ambientes Production/Preview desejados. `VITE_API_URL` é incorporada no build: mudar seu valor exige novo deploy do web. Nunca coloque credenciais de banco, JWT, Resend, Supabase service role ou `ML_API_KEY` em variáveis `VITE_*`.

Depois de obter a URL estável da Vercel, atualize `CORS_ORIGINS` e `INVITE_BASE_URL` no Render e reinicie/republique a API. Se o serviço Render antigo ainda estiver publicado com código antigo, faça o deploy da branch/commit atualizado.

## 3. Verificação após publicar

1. Abra `https://SUA-API.onrender.com/health`: deve retornar `{"status":"ok"}`. É uma verificação de processo HTTP, não de conexão com PostgreSQL.
2. Abra o site e teste login, consulta de clubes e upload, usando um clube de testes.
3. Atualize a página em uma rota interna; não deve ocorrer 404 da Vercel.
4. Verifique as requisições no navegador: devem apontar para HTTPS no Render, sem `localhost` ou erro CORS.
5. Valide uma partida em duas sessões para conferir Socket.IO, usando dados de teste.
6. Teste convite e recuperação por e-mail apenas para destinatários controlados.

No Render Free, a suspensão por inatividade pode atrasar o primeiro acesso. Para operação contínua de partidas e tarefas em segundo plano, avalie uma instância que permaneça ativa; não houve alteração de plano por esta configuração.

## Referências oficiais

- [Monorepos no Render](https://render.com/docs/monorepo-support)
- [Versão do Node no Render](https://render.com/docs/node-version)
- [Limitações do Render Free](https://render.com/docs/free)
- [Monorepos na Vercel](https://vercel.com/docs/monorepos)
- [Vite e fallback SPA na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Package managers na Vercel](https://vercel.com/docs/package-managers)
