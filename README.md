# Ludora

Sistema de gestão de clubes de futsal/futebol — App, Web e Desktop, com backend compartilhado.

## Estrutura do repositório

Este é um **monorepo** gerenciado com [pnpm workspaces](https://pnpm.io/workspaces):

```
ludora/
├── apps/
│   ├── mobile/       React Native / Expo — dia de jogo, acompanhamento ao vivo
│   ├── web/            React — institucional, cadastro de clubes, resultados públicos
│   └── desktop/          Electron + React — gestão do clube (em construção)
├── services/
│   ├── api/               Express + Prisma — API principal
│   └── ml/                 FastAPI (Python) — geração de perfil dos jogadores
├── packages/
│   ├── shared-types/      Tipos TypeScript compartilhados entre os apps
│   └── ui/                  Componentes React compartilhados (web + desktop)
├── docs/                       Documentação técnica, diagramas, decisões
├── pnpm-workspace.yaml
└── .npmrc
```

> `apps/web` e `apps/desktop` ainda estão em construção — as pastas já existem, prontas para receber código.

---

## Setup inicial (uma vez só)

Pré-requisitos: [Node.js](https://nodejs.org/) 18+, [pnpm](https://pnpm.io/), Python 3.11+.

```bash
npm install -g pnpm
```

> **Evite rodar o projeto dentro de uma pasta sincronizada por OneDrive/Google Drive.** O processo de sincronização trava arquivos binários (engine do Prisma, `bcrypt.node`) e causa erro de permissão ao instalar/reinstalar dependências.

Na raiz do repositório:

```bash
pnpm install
pnpm approve-builds   # libera build scripts de pacotes nativos (Prisma, bcrypt, esbuild) — apenas na primeira vez
```

Isso instala as dependências de todos os apps e serviços Node de uma vez.

Para o serviço de ML (Python), que não faz parte do workspace pnpm:

```bash
cd services/ml
pip install -r requirements.txt
```

---

## Deploy em produção (Render)

Os backends estão hospedados no Render e sobem automaticamente a cada push na `main`:

| Serviço | URL |
|---|---|
| API (Node) | https://ocianclub-node.onrender.com |
| ML (Python) | https://ocianclub-ml.onrender.com |

O app mobile já está configurado, por padrão, para apontar para a URL de produção.

---

## Rodando localmente

### 1. Backend de ML (Python)

Responsável por processar dados e gerar o perfil dos jogadores.

```bash
cd services/ml
uvicorn main:app --reload
```

Roda em `http://localhost:8000`.

### 2. API principal (Node)

Antes de iniciar, crie um arquivo `.env` em `services/api/` com:

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
PYTHON_AI_URL=http://localhost:8000   # ou a URL do Render, em produção
GEMINI_API_KEY=...
JWT_SECRET=...
```

```bash
cd services/api
npx prisma generate
npx tsx src/server.ts
```

Roda em `http://localhost:3000`.

### 3. App mobile (Expo)

```bash
cd apps/mobile
npx expo start -c
```

Abra no celular com o Expo Go, ou use um emulador Android.

> Por padrão o app aponta para o backend de produção no Render. Para apontar para o backend local durante o desenvolvimento, altere `BASE_URL` em `apps/mobile/src/services/api.ts` para o **IP local (LAN) da sua máquina** — não `localhost`, pois o Expo Go roda no celular e precisa alcançar o computador pela rede Wi-Fi. Descubra o IP com `ipconfig` (Windows) e confirme que celular e computador estão na mesma rede.

### Atalho: subir tudo de uma vez

O script `iniciar-os-terminais.bat` (Windows) abre os três serviços de uma vez, já com os caminhos corretos:

```bash
./iniciar-os-terminais.bat
```

---

## Banco de dados (Prisma)

**Não alterar o schema diretamente no Supabase.** Toda alteração de estrutura deve ser feita via código, através do Prisma.

### Após um `git pull`

Sempre que o `schema.prisma` puder ter mudado, regenere o client:

```bash
cd services/api
npx prisma generate
```

### Criar ou alterar tabelas

1. Edite `services/api/prisma/schema.prisma`
2. Rode a migration:
   ```bash
   npx prisma migrate dev --name nome_da_alteracao
   ```
3. Commit e push das alterações (incluindo a pasta `prisma/migrations` gerada)

---

## Observações

- Cada app/serviço tem suas próprias dependências, mas `pnpm install` na raiz resolve todas de uma vez — não é necessário rodar `pnpm install` dentro de cada pasta individualmente.
- O serviço de ML (Python) é a exceção: gerencia dependências com `pip`, fora do workspace pnpm.
- A API depende do `.env` em `services/api/` — sem ele, não sobe.
- Em produção, as variáveis de ambiente são configuradas diretamente no painel do Render — nunca commitar `.env` (já está no `.gitignore`).
- Documentação técnica detalhada (arquitetura, modelo de dados, decisões) está em [`docs/`](./docs).
