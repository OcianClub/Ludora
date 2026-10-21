# Ludora

Plataforma de gestão e estatísticas para clubes de futebol e futsal.

O Ludora nasceu como um projeto de extensão acadêmica e está sendo construído
como uma solução multiplataforma. O aplicativo mobile atende o acompanhamento
do clube e as operações do dia de jogo. A gestão administrativa de categorias,
times, jogadores e competições já possui uma aplicação web; o desktop continua
planejado. A API centraliza autenticação, permissões, dados, convites e tempo
real, enquanto um serviço Python processa os perfis estatísticos dos jogadores.

## Estado atual

| Componente | Situação |
|---|---|
| Aplicativo mobile | Em desenvolvimento ativo |
| API Node.js | Funcional |
| Serviço de Scout IA | Funcional |
| Aplicação web | Funcional em desenvolvimento: gestão do clube, partidas, scout, pessoas e acessos |
| Aplicação desktop | Planejada para gestão administrativa |

A API publicada atualmente está disponível em
[ludora-pgho.onrender.com](https://ludora-pgho.onrender.com).

## Funcionalidades

- Autenticação com JWT e armazenamento seguro do token no mobile.
- Vínculos entre usuários e múltiplos clubes.
- Papéis por clube: administrador, técnico, mesário, visitante (TORCEDOR) e olheiro.
- Técnicos com acesso a todas as categorias ou apenas a categorias específicas.
- API preparada para cadastro e gestão de categorias, times, jogadores e competições.
- Partidas, escalações, placar e eventos em tempo real com Socket.IO.
- Estatísticas de jogadores e perfis processados pelo serviço de Scout IA.
- Descoberta e acompanhamento de clubes.
- Convites para gestores com expiração, revogação e reenvio.
- Aceite de convite por link seguro ou código curto, como 5KU2-BYK7.
- Envio de convites por e-mail com Resend.
- Design tokens e pacote de ícones compartilhados.

## Responsabilidades por aplicação

O mobile e os futuros clientes administrativos consomem a mesma API, mas possuem
responsabilidades diferentes:

| Aplicação | Responsabilidade |
|---|---|
| Mobile | Login, seleção de clube, Home, jogos, preparação, escalação, placar, eventos, estatísticas e entrada por convite |
| Web/Desktop | Cadastro e manutenção de categorias, times, jogadores, competições, elencos e convites |
| API | Regras de negócio, autenticação, autorização por clube/categoria, persistência e tempo real |
| Scout IA | Processamento dos dados estatísticos dos jogadores |

As rotas administrativas permanecem na API para serem consumidas pelo web e
desktop. Os formulários antigos de cadastro foram retirados do aplicativo mobile.
O mobile ainda permite organizar partidas e executar as operações necessárias
durante o jogo.

## Papéis e permissões

O papel do usuário pertence ao vínculo com o clube, não ao usuário globalmente.
Uma mesma pessoa pode, por exemplo, ser técnica em um clube e torcedora em outro.

| Papel | Acesso |
|---|---|
| ADMIN | Administração do clube e acesso a todas as categorias |
| TECNICO | Gestão de todas as categorias ou somente das categorias atribuídas |
| MESARIO | Operações de gestão e dia de jogo dentro do clube |
| TORCEDOR | Acompanhamento e dados públicos, sem operações administrativas |
| OLHEIRO | Consulta de conteúdo público; identificação de função, sem edição ou relatórios privados adicionais |

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
│   ├── web/                    Aplicação React/Vite para gestão do clube
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
├── server.ts                    HTTP, Socket.IO e encerramento
├── auth/                        Leitura e validação de JWT
├── config/                      Ambiente, CORS, JWT e porta
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
├── services/                    E-mail e integrações externas
└── utils/                       Funções puras reutilizáveis
~~~

O arquivo server.ts contém apenas a inicialização da aplicação. As regras de
negócio ficam nos módulos, middlewares e services.

## Pré-requisitos

- Node.js 22 (o development build está configurado com 22.14.0).
- pnpm 11.20.0, conforme o campo `packageManager` da raiz.
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

Execute a instalação na raiz, onde ficam `pnpm-lock.yaml` e
`pnpm-workspace.yaml`. Evite misturar `npm install` ou `yarn` com o pnpm.
Depois de um `git pull` que altere dependências, execute `pnpm install` novamente.
Se `pnpm` não for reconhecido, instale a versão usada pelo projeto:

~~~powershell
npm install --global pnpm@11.20.0
~~~

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
ícones. Cadastros administrativos de times, jogadores, categorias, competições
e elencos não fazem parte da interface mobile atual.

### Primeira execução ou outra máquina

Na raiz do repositório, instale as dependências e copie o exemplo de ambiente
(se ainda não houver um `.env` do mobile):

~~~powershell
pnpm install
Copy-Item apps/mobile/.env.example apps/mobile/.env
~~~

Edite `apps/mobile/.env` e mantenha apenas uma `EXPO_PUBLIC_API_URL` ativa:

| Onde o aplicativo roda | URL da API local |
|---|---|
| Emulador do Android Studio | `http://10.0.2.2:3000` |
| Celular físico | `http://IP_DO_COMPUTADOR:3000` |
| Simulador iOS no macOS | `http://localhost:3000` |

No Windows, use `ipconfig` para descobrir o IPv4 da interface conectada à rede.
Não copie o IP de outro desenvolvedor nem use o IP de adaptadores virtuais.
Para celular físico, computador e celular precisam se comunicar na rede local.
O `.env` não é versionado: cada pessoa configura sua própria máquina.
Variáveis `EXPO_PUBLIC_*` ficam visíveis no aplicativo; não inclua segredos.

Também é possível configurar a URL publicada indicada neste README, dispensando
a API e o banco locais para testar o aplicativo. Para usar a API local, prepare
o ambiente e inicie o backend conforme a seção anterior, em outro terminal.
Depois de mudar a URL, encerre o Metro e inicie-o novamente.

### Comandos de desenvolvimento

Execute os comandos abaixo **na raiz do repositório**:

| Comando | Uso |
|---|---|
| `pnpm dev:mobile` | Development build instalado no aparelho, pela rede local |
| `pnpm dev:mobile:go` | Abrir pelo Expo Go, para funcionalidades compatíveis |
| `pnpm dev:mobile:android` | Iniciar e abrir no Android conectado ou emulador já iniciado |
| `pnpm dev:mobile:clean` | Development build com limpeza do cache do Metro |
| `pnpm dev:mobile:tunnel` | Development build com túnel para o Metro |
| `pnpm dev:mobile:check` | Conferir versões das dependências Expo e tipos TypeScript |

Dentro de `apps/mobile`, os equivalentes são `pnpm start`, `pnpm start:go`,
`pnpm android`, `pnpm start:clean`, `pnpm start:tunnel` e `pnpm check`.
Para limpar o cache no Expo Go, use `pnpm dev:mobile:go --clear`.

O modo padrão é development build porque o aplicativo utiliza módulos nativos
e notificações push. Instale primeiro o APK de desenvolvimento do projeto no
aparelho. O Expo Go não substitui esse APK para testar notificações push Android.
O simulador iOS exige macOS.

Para gerar um novo development build, execute na pasta do mobile:

~~~powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
~~~

A configuração Android referencia `apps/mobile/google-services.json`, do app
Firebase com pacote `com.ludora.app`. Para compilar, obtenha esse arquivo com o
responsável pelo projeto. A chave privada de conta de serviço usada pelo EAS
para FCM é outro arquivo e não deve ser colocada no app ou no Git.
Mudanças em módulos nativos exigem recompilar e reinstalar o development build;
alterações comuns em telas e estilos podem ser carregadas pelo Metro.

### Problemas frequentes

| Sintoma | O que conferir |
|---|---|
| O QR Code abre no cliente errado | Use explicitamente `dev:mobile` para development build ou `dev:mobile:go` para Expo Go |
| Não conecta na porta 8081 | Metro aberto, IP correto, rede acessível e permissão de firewall para o Node na rede privada |
| App abre, mas login dá erro de conexão | `EXPO_PUBLIC_API_URL`, API rodando na porta 3000 e acesso à rede; reinicie o Metro após mudar o `.env` |
| Túnel abre o app, mas a API não funciona | O túnel do Expo expõe o Metro, não a API local; a URL da API ainda precisa ser acessível pelo aparelho |
| Módulo nativo ausente | Instale o development build compatível com as dependências atuais |
| Erros após o pull | Execute `pnpm install`, confira `pnpm dev:mobile:check` e, se necessário, limpe o cache |

A porta 8081 entrega o JavaScript pelo Metro; a porta 3000 atende as requisições
da API. São conexões independentes. O túnel pode solicitar a instalação do
suporte ao ngrok na primeira execução.

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

### Performance do mobile

Home e Jogos solicitam `GET /partidas?resumo=1`, sem carregar a lista de eventos
de cada partida. A consulta sem esse parâmetro preserva a resposta anterior para
web/desktop; os detalhes continuam consultando os eventos completos.

O Scout agrega estatísticas no PostgreSQL e usa contagem de escalações, sem trazer
cada evento e escalação para a memória da API. Os campos retornados e as regras de
escopo por clube/categoria foram preservados. No mobile, o catálogo de categorias,
resumos e quantidades por perfil é preparado quando os jogadores mudam, sem repetir
esse trabalho a cada letra na busca. Os cards usam memoização e a filtragem tem
prioridade menor que a atualização do campo de texto. A aparência do carrossel não mudou.

Benchmark reproduzível, executado na raiz com as dependências instaladas:

~~~powershell
pnpm perf:scout
~~~

Compara os cálculos anteriores e atuais em Node usando 1600 atletas fictícios,
oito categorias e buscas repetidas, verificando igualdade dos resultados.
Não utiliza o banco real, não envia dados e não mede FPS, rede ou renderização
no Android. Para essa validação, use um aparelho conectado e compare o mesmo fluxo
em uma build de release: abrir Home/Scout, trocar Iniciação/Base, deslizar entre subs
e digitar na busca. Não compare fluidez de release com o modo de desenvolvimento.

### Consultas sem conexão no mobile

Home e Scout guardam cópias das consultas bem-sucedidas para leitura enquanto
o servidor não estiver acessível. A tela mostra a data da consulta, informa que
os dados podem estar antigos e oferece atualização manual. Ao voltar ao app ou
enquanto houver cópia local em uma tela aberta, tenta consultar novamente o
servidor; a tentativa periódica é feita a cada 30 segundos, somente em primeiro plano.

Na Home, ações de gestão ficam indisponíveis ao exibir dados locais. Um placar
salvo não é apresentado como atualização ao vivo. Gols e outras alterações nunca
são enfileirados para envio posterior. O cache não inclui eventos completos de
partidas, escalações, imagens baixadas, nem todas as demais telas.

O cache é separado por sessão, clube e recurso, não permite login offline e
exige que a sessão salva ainda esteja dentro da validade. São mantidas até seis
cópias de até aproximadamente 1 MB cada, com validade máxima de 24 horas
(limitada também pela expiração da sessão). Consultas maiores não são persistidas.
Uma resposta 401, 403 ou 404 não é substituída por dados locais. O 401 limpa as
cópias e bloqueia o cache daquela sessão até um novo login; o 403/404 descarta a
cópia afetada. Login, criação de conta por convite, saída e exclusão de conta limpam o cache.

Somente campos necessários à consulta são gravados: não são incluídos senhas,
JWT, e-mail, CPF ou data de nascimento. Os arquivos ficam no diretório privado de
cache do aplicativo, sem criptografia adicional; o sistema operacional pode
removê-los. O Expo FileSystem, já dependência do Expo SDK 54, foi declarado no mobile.
Se o módulo nativo não estiver disponível no APK instalado, a consulta funciona
com cache em memória, sem persistência ao fechar o app.

Para testar: carregue Home e Scout conectado; ative o modo avião e reabra essas
telas; confira o aviso e os dados; restaure a conexão e use Atualizar. Depois saia
da conta e confira que outra sessão não recupera as cópias da sessão anterior.

### Autenticação e usuário

| Método | Rota | Proteção |
|---|---|---|
| POST | /auth/cadastro/solicitar-codigo | Pública, limite por IP e intervalo por e-mail |
| POST | /auth/registrar | Código de confirmação, uso único e limite por IP |
| POST | /auth/login | Rate limit |
| POST | /auth/recuperar-senha | Pública, com limite por IP |
| POST | /auth/redefinir-senha | Pública, código de uso único e limite por IP |
| PATCH | /usuarios/me | JWT |
| DELETE | /usuarios/me | JWT |

### Recuperação de senha no mobile

No login, use **Esqueci minha senha**. Informe o e-mail da conta e copie o
código de oito caracteres recebido por e-mail. O código expira em 15 minutos,
permite até cinco tentativas incorretas e pode ser reenviado após 60 segundos.
Um novo envio invalida o código anterior. A redefinição encerra as sessões antigas.

Para habilitar o fluxo, pare a API e execute na raiz:

~~~powershell
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api run build
pnpm dev:api
~~~

O envio utiliza `RESEND_API_KEY` e `EMAIL_FROM` do backend. A restrição do remetente
de testes do Resend também se aplica à recuperação. A resposta da solicitação
não revela se existe uma conta com o e-mail informado; códigos não são retornados
pela API nem registrados em logs.

Exemplos para testar a API:

~~~http
POST /auth/recuperar-senha
Content-Type: application/json

{"email":"seu-email@exemplo.com"}
~~~

~~~http
POST /auth/redefinir-senha
Content-Type: application/json

{"email":"seu-email@exemplo.com","codigo":"ABCD-2345","senha":"sua-nova-senha"}
~~~

### Confirmação de e-mail no cadastro

O cadastro mobile possui três etapas: dados pessoais, senha e confirmação de
e-mail. A conta só é criada após confirmar o código recebido. Senhas ficam apenas
na memória da tela até a conclusão; o registro temporário no banco guarda o e-mail,
o hash do código e os controles de validade/tentativas, nunca a senha.

O código tem oito caracteres, vale por 15 minutos, permite cinco erros e pode
ser reenviado após 60 segundos. Um reenvio invalida o desafio/código anterior.
Os códigos de cadastro, recuperação e convite não são intercambiáveis.
Contas existentes continuam acessando normalmente e o fluxo por convite não mudou.
Solicitações temporárias expiradas não dão acesso e são substituídas no próximo envio.

Para ativar, pare a API e execute os comandos de geração, migração, build e início
descritos na recuperação de senha. O envio usa as mesmas variáveis do Resend e
as mesmas restrições de destinatários do remetente de testes.

~~~http
POST /auth/cadastro/solicitar-codigo
Content-Type: application/json

{"email":"seu-email@exemplo.com"}
~~~

A resposta retorna `cadastro_id` e `expira_em`, mas nunca o código. Após receber o e-mail:

~~~http
POST /auth/registrar
Content-Type: application/json

{"nome":"Seu nome","email":"seu-email@exemplo.com","senha":"sua-senha-segura","cadastro_id":"valor-retornado-na-solicitacao","codigo":"ABCD-2345"}
~~~

**Compatibilidade:** `/auth/registrar` agora exige `cadastro_id` e `codigo`.
As telas web/desktop não foram alteradas e seu cadastro precisa ser adaptado a
esse contrato antes de ser utilizado. Login e contas já existentes não mudam.

### Clubes e cadastros

| Método | Rota | Proteção |
|---|---|---|
| GET | /clubes | Pública, com JWT opcional |
| POST | /clubes/:id/seguir | JWT |
| DELETE | /clubes/:id/seguir | JWT |
| GET | /categorias | Gestor do clube |
| GET/POST | /times | Gestor do clube e escopo de categoria |
| PATCH/DELETE | /times/:id | Gestor do clube e escopo de categoria |
| GET/POST | /competicoes | Gestor; criação exige acesso total |
| PATCH/DELETE | /competicoes/:id | Gestor com acesso total |
| GET/POST | /jogadores | Gestor do clube e escopo de categoria |
| PATCH/DELETE | /jogadores/:id | Gestor do clube e escopo de categoria |
| GET/PUT | /competicoes/:id/jogadores | Consulta e manutenção do elenco inscrito |

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
| GET | /partidas/:id | Consulta partida e eventos em uma leitura consistente |
| POST | /partidas/:id/eventos | Registra evento |
| GET | /partidas/:id/escalacao | Consulta escalação |
| PUT | /partidas/:id/escalacao | Salva escalação |

Eventos em tempo real são emitidos em salas com o formato clube:ID.

Nos detalhes da partida, placar, status e eventos são atualizados pelo Socket.IO.
Ao reconectar ou voltar do segundo plano, o mobile consulta novamente o servidor.
Uma consulta a cada 30 segundos, enquanto o app está ativo, também cobre eventos
perdidos. A tela informa quando está salvando, atualizando ou sem conseguir atualizar;
uma falha mantém os últimos dados visíveis e bloqueia novas alterações até a consulta funcionar.

O cadastro de gol pelo mobile envia evento e mudança de placar em uma única
transação. A remoção pelo painel de gols também remove o evento e ajusta o placar
juntos. O campo opcional `placar` nas operações de eventos contém `anterior` e `novo`,
ambos com `gols_mandante` e `gols_visitante`; a diferença deve ser exatamente um gol.
Correções diretas de placar podem enviar `anterior`; alterações de status podem
enviar `status_anterior`. Uma divergência retorna HTTP 409 para evitar sobrescrever
uma mudança de outro dispositivo. Esses campos são opcionais para preservar os
clientes existentes, mas a proteção contra dados desatualizados exige que o cliente os envie.

Operações de escrita não são repetidas automaticamente em caso de falha de rede.
Se a resposta se perder, o app consulta o estado salvo antes de orientar uma nova
tentativa. Isso não substitui uma chave de idempotência persistida para cada operação.
O botão de gol contra do adversário soma o gol ao clube selecionado, sem atribuí-lo
a um jogador. O acompanhamento público em tempo real não exige seguir o clube;
editar partidas e receber notificações de clube continuam seguindo suas permissões.

### Resumo pós-partida e compartilhamento

Nos detalhes de uma partida finalizada, o mobile exibe resultado pela perspectiva
do clube, contagem dos eventos registrados e destaques de gols, assistências e
defesas, preservando empates. O placar salvo é a fonte do resultado: se os gols
dos eventos divergirem dele, a interface avisa e não divulga destaques de autoria
dos gols. Ausência de eventos não é apresentada como ausência de ações.

O botão **Compartilhar resultado** abre o menu nativo com um texto, sem publicar
automaticamente. Por padrão, compartilha somente times, placar, data, categoria
e competição. Incluir nomes dos atletas é uma escolha explícita, acompanhada de
aviso de autorização. O compartilhamento fica indisponível até a confirmação
dos dados pela API e durante a edição da partida. Não depende do Scout IA,
não gera imagens e não requer migration ou nova build nativa.

### Scout: contexto e histórico do atleta

Ao abrir uma ficha no mobile, o bloco **Momento do atleta** consulta
`GET /jogadores/:id/scout-contexto` com JWT e o cabeçalho `x-clube-id`.
A leitura respeita o mesmo escopo de clube e categorias da listagem de perfis.

O recorte reúne até dez partidas finalizadas em que o atleta tenha uma escalação
ou algum evento atribuído. Mostra gols, assistências e defesas registrados por
partida, além das médias dos cinco registros mais recentes. Com dez registros,
mostra também as médias dos cinco anteriores. Não inclui agendadas, canceladas
ou partidas em andamento e não cria um histórico retroativo de notas da IA.

Menos de cinco registros recebe um aviso de amostra inicial; esse limite é uma
orientação da interface, não uma medida estatística de confiança. Escalação não
comprova minutos jogados e zero eventos não comprova ausência de ações.
Os totais acumulados continuam separados do recorte recente. O histórico por
partida exige conexão, não integra a cópia offline e só é buscado ao abrir a ficha.
Essa melhoria não requer migration nem outra build nativa do aplicativo.

### Preferências de notificações por clube

No mobile, acesse **Perfil → Avisos por clube** para escolher os avisos externos
de gols, partidas agendadas e resultados em cada clube acompanhado ou gerenciado.
As preferências pertencem à conta e são aplicadas a todos os seus dispositivos.
O controle geral **Receber notificações** pausa todos os pushes sem apagar as
escolhas individuais. A permissão do sistema operacional também é necessária.
O histórico e o indicador de não lidas dentro do app continuam funcionando.

| Método | Rota | Proteção |
|---|---|---|
| GET | /notificacoes/preferencias | JWT; somente vínculos da própria conta |
| PATCH | /notificacoes/preferencias/:clubeId | JWT; vínculo com o clube informado |

O PATCH aceita um ou mais campos booleanos: `push_gols`, `push_agendamentos` e
`push_resultados`. Campos desconhecidos ou valores que não sejam booleanos são
recusados. Todos começam ativados para preservar o comportamento anterior.

Antes de iniciar a API atualizada, aplique a migration
`20261020120000_preferencias_push_por_clube` com `pnpm exec prisma migrate deploy`
e execute `pnpm exec prisma generate` em `services/api`. No Windows, pare a API
antes de regenerar o cliente para evitar o bloqueio da DLL do Prisma.

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

O model `CampeonatoClassificacao` permanece temporariamente no schema por
compatibilidade com bancos já migrados. O scraper e o job de sincronização que
alimentavam essa tabela foram removidos e nenhuma tela atual depende dela.

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

O roteiro de validação no aparelho está em
[docs/validacao-mobile.md](./docs/validacao-mobile.md). Execute `pnpm test:app`
para a suíte automatizada; entrega real de push e cenários de app encerrado
precisam ser verificados separadamente no Android.

- Evoluir e validar os fluxos mobile de entrada e aceite de convite.
- Evoluir o web existente, incluindo adaptação do cadastro ao código de verificação
  e gestão de convites; o cadastro público web ainda exige essa adaptação.
- Criar a aplicação desktop com Electron reutilizando o fluxo administrativo.
- Verificar um domínio próprio para envio de e-mails.
- Mover as rotas restantes para controllers e services menores.
- Adicionar testes automatizados de integração e permissões.

## Web e demonstração de clubes — 20/10/2026

O web existente usa React/Vite. Com as dependências instaladas e a API configurada:

~~~powershell
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api build
pnpm --filter @ludora/api start
~~~

Em outro terminal: `pnpm --filter @ludora/web dev`. URL padrão:
`http://localhost:5173`; API local padrão: `http://localhost:3000`.
Se usar outro backend, configurar `VITE_API_URL` no ambiente do web.
Não iniciar uma segunda API na mesma porta. Fechar a API antes de regenerar
o Prisma Client se o Windows informar que o arquivo está em uso.

As contas demo já geradas nesta máquina ficam em `.local-demo/contas.json`,
ignorado pelo Git. Os clubes de demonstração estão identificados na interface.
Não é necessário executar a seed novamente para entrar.

A nova seed incremental fica em `services/api/prisma/seed-clubes.cjs`.
Executada na pasta `services/api`, `node prisma/seed-clubes.cjs` apenas mostra
a prévia; acrescentar `--apply` modifica o banco configurado. Ela foi feita
para esta demonstração acadêmica, renomeia clubes identificados pelo nome e
adiciona cenários. A seed antiga não é equivalente: contém limpeza de dados
esportivos e não deve ser usada para atualizar uma base compartilhada.

O vínculo time → clube e os cargos são validados na API. Vincular um time
permite consultar o histórico no clube representado, sem conceder edição
das partidas de outro organizador. O painel global Electron ainda não existe.

Mapeamento, antes/depois, contas, testes e limitações:
[Handover técnico desta entrega](docs/handover-clubes-interface-2026-10-20.md).

## Licença

O projeto ainda não possui uma licença pública definida.
