# Ludora

Plataforma de gestão e estatísticas para clubes de futebol e futsal.

O Ludora nasceu como um projeto de extensão acadêmica e está sendo construído
como uma solução multiplataforma. O aplicativo mobile atende o acompanhamento
do clube e o dia de jogo; a API concentra autenticação, permissões, dados,
convites e tempo real; e um serviço Python processa os perfis estatísticos dos
jogadores.

## Estado atual

| Componente | Situação |
|---|---|
| Aplicativo mobile | Em desenvolvimento ativo |
| API Node.js | Funcional |
| Serviço de Scout IA | Funcional |
| Aplicação web | Planejada |
| Aplicação desktop | Planejada |

A API publicada atualmente está disponível em
[ludora-pgho.onrender.com](https://ludora-pgho.onrender.com).

## Funcionalidades

- Autenticação com JWT e armazenamento seguro do token no mobile.
- Vínculos entre usuários e múltiplos clubes.
- Papéis de administrador, técnico, mesário e torcedor.
- Técnicos com acesso a todas as categorias ou apenas a categorias específicas.
- Cadastro e gestão de categorias, times, jogadores e competições.
- Partidas, escalações, placar e eventos em tempo real com Socket.IO.
- Estatísticas de jogadores e perfis processados pelo serviço de Scout IA.
- Descoberta e acompanhamento de clubes.
- Convites para gestores com expiração, revogação e reenvio.
- Aceite de convite por link seguro ou código curto, como 5KU2-BYK7.
- Envio de convites por e-mail com Resend.
- Design tokens e pacote de ícones compartilhados.

## Papéis e permissões

O papel do usuário pertence ao vínculo com o clube, não ao usuário globalmente.
Uma mesma pessoa pode, por exemplo, ser técnica em um clube e torcedora em outro.

| Papel | Acesso |
|---|---|
| ADMIN | Administração do clube e acesso a todas as categorias |
| TECNICO | Gestão de todas as categorias ou somente das categorias atribuídas |
| MESARIO | Operações de gestão e dia de jogo dentro do clube |
| TORCEDOR | Acompanhamento e dados públicos, sem operações administrativas |

As permissões são validadas na API. Ocultar um botão no aplicativo não é
considerado uma barreira de segurança.

## Fluxo de convites

~~~text
Administrador cria o convite
        ↓
API gera token longo e código curto
        ↓
Somente os hashes são armazenados no banco
        ↓
Resend envia o e-mail
        ↓
Convidado abre o link ou cola o código no aplicativo
        ↓
API mostra clube, papel e categorias
        ↓
Conta nova ou conta existente aceita o convite
        ↓
Vínculo e permissões são criados
        ↓
Convite não pode ser reutilizado
~~~

O código curto contém oito caracteres, ignora diferenças entre maiúsculas,
espaços e hífen e possui limite de tentativas. Um reenvio gera novas
credenciais e invalida as anteriores.

## Tecnologias

| Área | Tecnologias |
|---|---|
| Monorepo | pnpm workspaces |
| Mobile | React 19, React Native 0.81, Expo 54 e Expo Router |
| API | Node.js, TypeScript, Express 5, Prisma e PostgreSQL |
| Autenticação | JWT, bcrypt e Expo SecureStore |
| Tempo real | Socket.IO |
| Banco e arquivos | PostgreSQL e Supabase |
| Scout IA | Python, FastAPI, pandas e scikit-learn |
| E-mail | Resend |
| Build mobile | EAS Build |

## Estrutura do monorepo

~~~text
Ludora/
├── apps/
│   ├── mobile/                 Aplicativo React Native e Expo
│   ├── web/                    Reservado para a aplicação web
│   └── desktop/                Reservado para Electron e React
│
├── services/
│   ├── api/                    API principal
│   └── ml/                     Microsserviço Python de Scout IA
│
├── packages/
│   ├── design-tokens/          Cores e tipografia compartilhadas
│   ├── icons/                  Ícones SVG para React Native
│   └── shared-types/           Tipos TypeScript compartilhados
│
├── docs/
│   └── ludora-documentacao-tecnica.pdf
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
~~~

## Arquitetura da API

~~~text
Requisição HTTP
      ↓
app.ts
      ↓
router do módulo
      ↓
middlewares de autenticação e permissão
      ↓
service ou Prisma
      ↓
resposta HTTP
~~~

A API está organizada por responsabilidade:

~~~text
services/api/src/
├── app.ts                       Configuração do Express e montagem das rotas
├── server.ts                    HTTP, Socket.IO, jobs e encerramento
├── auth/                        Leitura e validação de JWT
├── config/                      Ambiente, CORS, JWT e porta
├── controllers/                 Controllers já separados
├── jobs/                        Tarefas agendadas
├── lib/                         Instância compartilhada do Prisma
├── middlewares/                 Autenticação, permissões e rate limit
├── modules/
│   ├── auth/
│   ├── cadastros/
│   ├── clubes/
│   ├── convites/
│   ├── escalacoes/
│   ├── jogadores/
│   ├── partidas/
│   └── scout/
├── realtime/                    Autenticação e salas do Socket.IO
├── routes/                      Rotas legadas já separadas
├── services/                    E-mail, IA, importação e campeonatos
└── utils/                       Funções puras reutilizáveis
~~~

O arquivo server.ts contém apenas a inicialização da aplicação. As regras de
negócio ficam nos módulos, middlewares e services.

## Pré-requisitos

- Node.js com suporte ao Corepack.
- pnpm.
- Python 3.11 ou superior para o serviço de Scout IA.
- Banco PostgreSQL.
- Conta do Supabase para o ambiente utilizado pelo projeto.
- Conta do Resend para testar o envio de e-mails.
- Expo Go, development build ou emulador Android para o mobile.

Evite instalar o projeto dentro de pastas sincronizadas por OneDrive ou Google
Drive. Esses programas podem bloquear binários do Prisma, bcrypt e outras
dependências nativas.

## Instalação

Na raiz do repositório:

~~~powershell
pnpm install
pnpm approve-builds
~~~

O workspace instala as dependências dos aplicativos, serviços e pacotes Node
em uma única operação.

### Serviço de Scout IA

~~~powershell
cd services/ml
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
~~~

O serviço inicia em:

~~~text
http://localhost:8000
~~~

Endpoint interno utilizado pela API:

~~~http
POST /internal/ml/treinar-perfis
~~~

## Configuração da API

Crie services/api/.env usando services/api/.env.example como base:

~~~env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

JWT_SECRET=use-ao-menos-32-caracteres-aleatorios
PYTHON_AI_URL=http://localhost:8000
GEMINI_API_KEY=

CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8081
TRUST_PROXY_HOPS=0
JSON_BODY_LIMIT=256kb

RESEND_API_KEY=re_...
EMAIL_FROM="Ludora <onboarding@resend.dev>"
INVITE_BASE_URL=http://localhost:3000/convites
~~~

Nunca envie o arquivo .env para o Git.

O remetente onboarding@resend.dev serve apenas para testes e envia somente
para o endereço associado à conta do Resend. Para usuários reais, será
necessário verificar um domínio próprio no serviço.

### Preparar o Prisma

~~~powershell
cd services/api
pnpm exec prisma generate
pnpm exec prisma migrate deploy
~~~

Para desenvolvimento de uma alteração nova no schema:

~~~powershell
pnpm exec prisma migrate dev --name nome_da_alteracao
~~~

As migrations geradas em services/api/prisma/migrations devem ser commitadas.
Não altere manualmente a estrutura das tabelas pelo painel do Supabase.

### Compilar e iniciar a API

~~~powershell
cd services/api
pnpm run build
pnpm start
~~~

A API local inicia em:

~~~text
http://localhost:3000
~~~

Para executar diretamente o TypeScript com reinício automático:

~~~powershell
pnpm exec tsx watch src/server.ts
~~~

## Aplicativo mobile

O aplicativo usa Expo Router e consome os pacotes compartilhados de design e
ícones.

~~~powershell
cd apps/mobile
pnpm start
~~~

Também é possível iniciar pela raiz:

~~~powershell
pnpm dev:mobile
~~~

Atualmente a URL da API é configurada em:

~~~text
apps/mobile/src/services/api.ts
~~~

Para testar em um celular físico, não use localhost. Utilize o IP da máquina na
rede local:

~~~ts
export const BASE_URL = 'http://192.168.0.10:3000';
~~~

O computador e o celular devem estar na mesma rede.

### Gerar APK de preview

~~~powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview
~~~

O identificador Android atual é:

~~~text
com.ludora.app
~~~

## Pacotes compartilhados

### Design tokens

O pacote @ludora/design-tokens centraliza cores e tipografia:

~~~ts
import { colors, typography } from '@ludora/design-tokens';
~~~

### Ícones

O pacote @ludora/icons contém componentes SVG compatíveis com React Native:

~~~tsx
import { Icon } from '@ludora/icons';

<Icon name="home" size={24} color={colors.primaria} />
~~~

Para regenerar o índice de ícones:

~~~powershell
pnpm --filter @ludora/icons run generate
~~~

Para validar seus tipos:

~~~powershell
pnpm --filter @ludora/icons run typecheck
~~~

## Principais rotas da API

### Autenticação e usuário

| Método | Rota | Proteção |
|---|---|---|
| POST | /auth/registrar | Rate limit |
| POST | /auth/login | Rate limit |
| PATCH | /usuarios/me | JWT |
| DELETE | /usuarios/me | JWT |

### Clubes e cadastros

| Método | Rota | Proteção |
|---|---|---|
| GET | /clubes | Pública, com JWT opcional |
| POST | /clubes/:id/seguir | JWT |
| DELETE | /clubes/:id/seguir | JWT |
| GET | /categorias | Gestor do clube |
| GET | /times | Gestor do clube |
| GET | /competicoes | Gestor do clube |
| GET | /jogadores | Gestor do clube |

As rotas vinculadas a um clube recebem:

~~~http
Authorization: Bearer JWT
x-clube-id: 2
~~~

### Partidas

| Método | Rota | Descrição |
|---|---|---|
| GET | /partidas | Lista partidas do clube |
| POST | /partidas | Cria partida |
| PATCH | /partidas/:id | Atualiza partida |
| DELETE | /partidas/:id | Exclui partida |
| GET | /partidas/:id/eventos | Lista eventos |
| POST | /partidas/:id/eventos | Registra evento |
| GET | /partidas/:id/escalacao | Consulta escalação |
| PUT | /partidas/:id/escalacao | Salva escalação |

Eventos em tempo real são emitidos em salas com o formato clube:ID.

### Convites

| Método | Rota | Proteção |
|---|---|---|
| GET | /convites | Administrador do clube |
| POST | /convites | Administrador do clube |
| POST | /convites/:id/revogar | Administrador do clube |
| POST | /convites/:id/reenviar | Administrador do clube |
| GET | /convites/:token | Pública com rate limit |
| GET | /convites/codigo/:codigo | Pública com rate limit |
| POST | /convites/:token/aceitar | Pública com rate limit |
| POST | /convites/codigo/:codigo/aceitar | Pública com rate limit |
| POST | /convites/:token/aceitar-existente | JWT da conta convidada |
| POST | /convites/codigo/:codigo/aceitar-existente | JWT da conta convidada |

## Banco de dados

O schema está em:

~~~text
services/api/prisma/schema.prisma
~~~

Principais entidades:

~~~text
Usuario
Clube
UsuarioClube
UsuarioClubeCategoria
Categoria
Time
Jogador
Competicao
Partida
Evento
EscalacaoPartida
ConviteClube
ConviteCategoria
~~~

O vínculo UsuarioClubeCategoria limita as categorias administradas por um
gestor. ConviteCategoria aplica o mesmo escopo durante o fluxo de convite.

## Segurança

- Senhas armazenadas com bcrypt.
- JWT com algoritmo, emissor, destinatário e expiração definidos.
- CORS configurável por ambiente.
- Headers HTTP de segurança.
- Limite de tamanho do JSON.
- Rate limit em autenticação, convites e operações pesadas.
- Verificação de vínculo e categoria na API.
- Token e código de convite armazenados apenas como hash.
- Tokens de convite rotacionados no reenvio.
- Segredos mantidos fora do repositório.

## Deploy

A API pode ser publicada no Render apontando para services/api. Em produção,
configure as variáveis do .env diretamente no painel do serviço e execute as
migrations com prisma migrate deploy.

O web service deve escutar a variável PORT e aceitar conexões em 0.0.0.0; a
implementação atual já faz isso.

## Documentação

A documentação técnica complementar está em
[docs/ludora-documentacao-tecnica.pdf](./docs/ludora-documentacao-tecnica.pdf).

## Próximos passos

- Criar as telas mobile de entrada e aceite de convite.
- Criar a aplicação web para gestão administrativa e links de convite.
- Criar a aplicação desktop com Electron.
- Verificar um domínio próprio para envio de e-mails.
- Mover as rotas restantes para controllers e services menores.
- Adicionar testes automatizados de integração e permissões.

## Licença

O projeto ainda não possui uma licença pública definida.
