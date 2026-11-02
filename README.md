<img width="827" height="302" alt="logo-final" src="https://github.com/user-attachments/assets/83f20ad2-5511-4a4a-9a99-4972ad143699" />


Sistema de gestão e acompanhamento de clubes de futebol e
futsal, desenvolvida como projeto acadêmico do curso de Desenvolvimento de
Software Multiplataforma.

O Ludora reúne clubes, categorias, atletas, competições, partidas e estatísticas
em um só sistema. Uma conta pode participar de vários clubes, com permissões
diferentes em cada um. As aplicações compartilham uma API com autenticação,
controle de acesso e atualizações em tempo real.

## Aplicações

| Componente | Uso | Situação |
|---|---|---|
| Mobile | Acompanhar clubes, consultar estatísticas e operar partidas | Em desenvolvimento |
| Web | Gestão de clubes, atletas, times, competições, partidas e acessos | Em desenvolvimento |
| Desktop | Painel interno da equipe Ludora (Super Admin): clubes, permissões, banco e logs | Em desenvolvimento |
| API | Autenticação, regras de negócio, dados e tempo real | Implementada |
| Scout IA | Processamento dos perfis estatísticos dos atletas | Implementado; execução opcional |

**Tecnologias:** React Native + Expo, React + Vite, Electron, Node.js +
Express + TypeScript, Prisma + PostgreSQL/Supabase, Socket.IO e Python +
FastAPI. O projeto usa pnpm workspaces, com cores, ícones e tipos compartilhados.

## 1. Requisitos e instalação

- Git, Node.js 22 e pnpm **11.20.0** (versão definida no projeto).
- PostgreSQL local ou acesso a um ambiente Supabase para executar a API.
- Para mobile: development build do Ludora instalado ou emulador Android.
  O simulador iOS exige macOS.
- Python 3.11+ somente para executar o serviço de Scout IA.

```powershell
git clone https://github.com/OcianClub/Ludora.git
cd Ludora
npm install --global pnpm@11.20.0
pnpm install
```

Execute a instalação na raiz do monorepo. Não misture npm/yarn para instalar
dependências dos pacotes. Evite pastas sincronizadas por OneDrive, que podem
bloquear arquivos nativos.

## 2. Configurar o ambiente

Crie os arquivos de ambiente com os comandos abaixo, em PowerShell e na raiz.
Eles preservam os arquivos que já existirem:

```powershell
if (-not (Test-Path services/api/.env)) {
  Copy-Item services/api/.env.example services/api/.env
}
if (-not (Test-Path apps/web/.env)) {
  Copy-Item apps/web/.env.example apps/web/.env
}
if (-not (Test-Path apps/mobile/.env)) {
  Copy-Item apps/mobile/.env.example apps/mobile/.env
}
```

Edite os arquivos antes de iniciar:

| Arquivo | Configuração |
|---|---|
| `services/api/.env` | Conexões do banco, JWT, CORS e integrações |
| `apps/web/.env` | `VITE_API_URL=http://localhost:3000` |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` conforme aparelho/emulador |
| `apps/desktop/.env` | Opcional: `MAIN_VITE_API_URL` (padrão `http://localhost:3000`) |

### API

Preencha as variáveis no exemplo:

| Variável | Uso |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | URLs do PostgreSQL para a aplicação e migrations |
| `JWT_SECRET` | Segredo aleatório próprio do ambiente, com pelo menos 32 caracteres |
| `PORT` | Porta da API; padrão `3000` |
| `CORS_ORIGINS` | Origens web permitidas, separadas por vírgula |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envio de códigos, recuperação de senha e convites |
| `INVITE_BASE_URL` | URL da interface que receberá links de convite |
| `PYTHON_AI_URL` | Endereço do Scout IA; deixe vazio se não for executá-lo |
| `ML_API_KEY` | Mesma chave privada no backend e no processo Python; obrigatória em produção com Scout IA habilitado |
| `SUPERADMIN_EMAILS` | Compatibilidade com superadmins por e-mail; prefira o papel de plataforma `SUPERADMIN` |

Sem configuração do Resend, a API inicia, mas as operações de envio de e-mail
ficam indisponíveis. O remetente de teste `onboarding@resend.dev` restringe os destinatários; para envios gerais,
configure um domínio verificado. O link de convite exige uma interface acessível:
a API sozinha não serve a página de aceite.

Obtenha acessos de desenvolvimento com o responsável pelo projeto.
**Não versione `.env`, senhas ou chaves privadas.**
Variáveis `VITE_*` e `EXPO_PUBLIC_*` são públicas: nunca coloque segredos nelas.
As demais opções do backend estão comentadas no [.env.example](services/api/.env.example).

### Endereço da API no mobile

| Onde o app roda | `EXPO_PUBLIC_API_URL` |
|---|---|
| Emulador do Android Studio | `http://10.0.2.2:3000` |
| Celular físico | `http://IP_DO_COMPUTADOR:3000` |
| Simulador iOS no macOS | `http://localhost:3000` |

No celular físico, use o IPv4 do computador conectado à mesma rede (`ipconfig`
no Windows). Reinicie o Metro após alterar o ambiente.

### Iniciar os quatro serviços com um comando

Depois de preparar a API (seção 3) e o ambiente Python do Scout IA (seção 7),
execute na raiz:

```powershell
pnpm dev
```

Inicia **API, Scout IA, mobile e web** no mesmo terminal, com os logs identificados
por serviço. Use `Ctrl+C` para encerrar todos. Se um serviço encerrar, os demais
iniciados pelo comando também serão encerrados, evitando processos esquecidos.
Pare as instâncias anteriores antes de executar, para não disputar as mesmas portas.

`dev:api` e `dev:ml` iniciam os processos com `NODE_ENV=development`, mesmo que
o `.env` local contenha `production`. O ML reutiliza a `ML_API_KEY` da API quando
ela estiver configurada, sem exibir a chave. O comando `start` da API continua
respeitando a configuração de produção.

Os comandos individuais continuam disponíveis: `pnpm dev:api`, `pnpm dev:ml`,
`pnpm dev:mobile` e `pnpm dev:web`. A API usa a build existente; após alterar seu
código, compile novamente conforme a seção abaixo.

Se a porta `8081` estiver ocupada, `dev:mobile` escolhe uma porta livre até `8091`
e informa a mudança no terminal, inclusive dentro de `pnpm dev`. No development
build, conecte-se pelo novo endereço/QR code. A URL da API (`3000`) não muda.

## 3. Preparar e iniciar a API

Com o banco configurado, execute **na raiz**:

```powershell
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api run build
pnpm dev:api
```

A API atende em `http://localhost:3000`. Mantenha esse terminal aberto.
`pnpm dev:api` executa o JavaScript compilado: após alterar o backend, compile
novamente e reinicie. Não há script `dev` dentro de `services/api`.

Para desenvolvimento com reinício automático, use **no lugar de** `pnpm dev:api`:

```powershell
pnpm --filter @ludora/api exec tsx watch src/server.ts
```

Não inicie duas APIs na mesma porta. No Windows, pare a API antes de regenerar
o Prisma Client se houver bloqueio de DLL.

**Não execute seeds para simplesmente iniciar o projeto:** existem scripts de
demonstração que renomeiam clubes ou limpam dados. Use banco de teste e confira
o script antes de aplicá-lo.

## 4. Iniciar o web

Com a API rodando, abra **outro terminal na raiz**:

```powershell
pnpm dev:web
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`.
Se ele usar outra porta, inclua essa origem em `CORS_ORIGINS` e reinicie a API.

Use uma conta existente ou conclua o cadastro pelo mobile. O formulário de
cadastro web ainda precisa ser adaptado à confirmação de e-mail exigida pela API.

Para compilar e visualizar a build:

```powershell
pnpm --filter @ludora/web build
pnpm --filter @ludora/web preview
```

Inclua também a origem do preview em `CORS_ORIGINS` se for utilizá-lo.

## 5. Iniciar o mobile

Com a API acessível, abra **outro terminal na raiz**:

```powershell
pnpm dev:mobile
```

Abra o development build do Ludora no aparelho e conecte-o ao Metro pelo QR Code.
O APK de desenvolvimento depende desse servidor para carregar o JavaScript.

| Comando na raiz | Uso |
|---|---|
| `pnpm dev:mobile` | Development build pela rede local |
| `pnpm dev:mobile:android` | Abrir em Android conectado ou emulador já iniciado |
| `pnpm dev:mobile:go` | Expo Go; não serve para validar push Android |
| `pnpm dev:mobile:clean` | Development build com limpeza do cache do Metro |
| `pnpm dev:mobile:tunnel` | Túnel para acessar o Metro |
| `pnpm dev:mobile:check` | Conferir dependências Expo e tipos TypeScript |

### Gerar APK

Execute **dentro de `apps/mobile`**, não na raiz:

```powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
```

Para APK independente do Metro, use o perfil `preview` no mesmo comando.
É necessário acesso ao projeto Expo/EAS e às credenciais Android.
A configuração referencia `apps/mobile/google-services.json` para
`com.ludora.app`; obtenha o arquivo e a configuração FCM com o responsável.
A chave privada de conta de serviço não deve ficar no app nem no Git.

Mudanças em dependências nativas exigem outro APK. Alterações comuns em
TypeScript, telas e estilos são carregadas pelo Metro.

## 6. Desktop (Super Admin)

O desktop é o painel interno da equipe Ludora: cadastra e administra os
clubes-clientes, ajusta permissões, consulta usuários e acompanha o banco e os logs
da API em tempo real. Não é distribuído aos clubes. Detalhes, rotas e limitações em
[docs/desktop-super-admin.md](docs/desktop-super-admin.md).

O acesso é decidido **no servidor** pelo papel de plataforma `SUPERADMIN`.
A conta precisa já existir. Após aplicar a migration, conceda o papel com
`pnpm superadmin:grant email-da-conta`. O guia de [SUPERADMIN](docs/papel-superadmin.md)
explica a ativação. `SUPERADMIN_EMAILS` continua funcionando para acessos legados.

Com a API em execução (seção 3), abra **outro terminal na raiz**:

```powershell
pnpm dev:desktop
```

Entre com uma conta autorizada como SUPERADMIN. A URL da API pode ser trocada em
**Ajustes** dentro do app. O painel nunca acessa o banco diretamente (só a API) e
guarda o token cifrado pelo sistema.

Se a API estiver ligada a um banco compartilhado, criar clube, alterar cargo e
encerrar sessões alteram dados reais. Use um clube de teste.

## 7. Scout IA (opcional)

O Scout v2 oferece recortes por campeonato e partida e comparação exploratória
de registros. Regras, limites de amostra e reprocessamento: [Scout v2](docs/scout-v2.md).

A API inicia sem Python; o aviso de Scout IA desativado
é esperado quando `PYTHON_AI_URL` está vazio. Para habilitá-lo, execute no Windows:

```powershell
cd services/ml
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Defina `PYTHON_AI_URL=http://localhost:8000` na API e reinicie o backend.
O serviço Python também precisa permanecer aberto em seu próprio terminal.

Para autenticar a comunicação, configure a mesma `ML_API_KEY` em
`services/api/.env` e no ambiente do terminal Python, antes de iniciar o Uvicorn
(PowerShell: `$env:ML_API_KEY = 'sua-chave-privada'`). O serviço Python não carrega
arquivos `.env` automaticamente. Sem chave, em desenvolvimento, aceita apenas
conexões locais; em produção, a chave é obrigatória nos dois serviços.

## Estrutura de pastas

```text
Ludora/
├── apps/
│   ├── mobile/
│   │   ├── app/                  Telas e rotas do Expo Router
│   │   └── src/                  Componentes, contextos, hooks, serviços e estilos
│   ├── web/
│   │   └── src/                  Páginas, componentes, contextos, serviços e estilos
│   └── desktop/                  Painel Super Admin (Electron + React)
├── services/
│   ├── api/
│   │   ├── prisma/               Schema, migrations e seeds
│   │   ├── src/
│   │   │   ├── app.ts            Configuração do Express e rotas
│   │   │   ├── server.ts         Inicialização HTTP e Socket.IO
│   │   │   ├── modules/          Funcionalidades e regras por domínio
│   │   │   ├── middlewares/      Autenticação, permissões e limites
│   │   │   ├── services/         Integrações e serviços compartilhados
│   │   │   └── realtime/         Conexões e salas do Socket.IO
│   │   └── tests/                Testes da API
│   └── ml/                       Serviço Python de Scout IA
├── packages/
│   ├── design-tokens/            Cores e tipografia
│   ├── icons/                    Ícones compartilhados
│   └── shared-types/             Tipos compartilhados
└── docs/                         Arquitetura, referências e validações
```

## Rotina de desenvolvimento

Após um pull com mudanças de dependências, execute `pnpm install` na raiz.
Com mudanças de banco, pare a API, aplique as migrations versionadas e regenere
o Prisma Client. Para criar uma migration nova, use
`pnpm exec prisma migrate dev --name nome_da_alteracao` dentro de `services/api`,
**em banco de desenvolvimento**.
Não use esse comando para preparar uma base compartilhada ou de produção.

| Comando na raiz | Finalidade |
|---|---|
| `pnpm test:app` | Suíte principal da API (inclui o módulo `/admin`) e mobile |
| `pnpm test:app:completo` | Compila a API e executa todas as suítes incluídas de API, mobile e utilitários web |
| `pnpm --filter @ludora/mobile exec tsc --noEmit` | Tipos do mobile |
| `pnpm --filter @ludora/web exec tsc --noEmit` | Tipos do web |
| `pnpm test:desktop` | Regras de segurança do desktop (URL da API e caminhos permitidos) |
| `pnpm build:desktop` | Tipos e build do desktop |
| `pnpm dist:desktop` | Instalador do desktop para Windows, em `apps/desktop/release` |
| `pnpm perf:scout` | Benchmark sintético do processamento do Scout |

Os testes automatizados não substituem testes de interface, entrega de push
ou comportamento do aparelho sem internet.

As suítes `test:app` e `test:app:completo` usam configuração isolada, sem herdar
as credenciais do `.env`. Testes de integração que gravam em PostgreSQL devem
usar um banco descartável separado.

## Problemas frequentes

| Problema | Verificação |
|---|---|
| App não conecta na API | URL correta no mobile, API aberta e porta `3000` acessível |
| Não conecta ao Metro | Porta `8081`, IP/rede e firewall; reinicie o Metro após trocar o ambiente |
| Túnel funciona, mas login não | O túnel expõe o Metro, não a API; a URL do backend precisa estar acessível |
| Web bloqueado por CORS | Origem exata do Vite/preview em `CORS_ORIGINS`; reinicie a API |
| Erro do PostgreSQL/Supabase | Confira se o projeto está ativo e se as URLs de conexão estão corretas |
| Erro de módulo nativo | Instale um development build compatível com as dependências atuais |
| Scout IA retorna acesso não autorizado | Confira a mesma `ML_API_KEY` na API e no ambiente do processo Python |
| Falha ao enviar código por e-mail | Confira chave, remetente e restrições de destinatários do Resend |
| Desktop diz que a conta não tem acesso | Confira se a conta possui o papel de plataforma `SUPERADMIN`; veja o guia abaixo |
| Desktop não conecta | URL em **Ajustes** e API em execução; no Render gratuito a primeira chamada pode demorar |
| Electron não abre ou não foi instalado | Rode `node apps\desktop\node_modules\electron\install.js` e repita `pnpm dev:desktop` |

## Documentação complementar

- [Papel SUPERADMIN e concessão de acesso ao desktop](docs/papel-superadmin.md)
- [Deploy da API no Render e web na Vercel](docs/deploy-render-vercel.md)
- [Auditoria de segurança, performance e interface — 01/11/2026](docs/auditoria-2026-11-01.md)
- [Fluxo de partidas compartilhadas e validação](docs/partidas-compartilhadas.md)

- [Referência técnica e contratos da API](docs/referencia-tecnica.md)
- [Arquitetura do sistema](docs/arquitetura-ludora.md)
- [Painel Super Admin do desktop](docs/desktop-super-admin.md)
- [Checklist de validação no aparelho](docs/validacao-mobile.md)
- [Relatório de testes de 21/10/2026](docs/validacao-mobile-2026-10-21.md)
- [Documentação técnica em PDF](docs/ludora-documentacao-tecnica.pdf)

## Licença

O projeto ainda não possui uma licença pública definida.
