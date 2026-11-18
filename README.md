<p align="center">
  <img src="logo-final.png" alt="Ludora — gestão e acompanhamento esportivo" width="680" />
</p>

# Ludora

**Clubes, atletas, torneios e partidas conectados em uma plataforma web, mobile e desktop.**

O Ludora é um sistema de gestão e acompanhamento de clubes de futebol e futsal, desenvolvido como projeto acadêmico do curso de Desenvolvimento de Software Multiplataforma. Ele aproxima a rotina administrativa do clube do que acontece em quadra: organização dos elencos, propostas de confrontos, preparação de escalações, súmula ao vivo e análise dos registros esportivos.

Uma conta pode participar de vários clubes, com cargos e categorias diferentes em cada um. Web e aplicativo compartilham a mesma API e o mesmo banco; o desktop atende à operação interna da equipe Ludora.

[Acessar o web](https://ludora-nine.vercel.app/) · [Baixar APK — última release](https://github.com/OcianClub/Ludora/releases/latest) · [Release v1.1.0](https://github.com/OcianClub/Ludora/releases/tag/v1.1.0) · [Documentação técnica](docs/referencia-tecnica.md)

## Sumário

- [Acessar e instalar](#acessar-e-instalar)
- [Aplicações](#aplicações)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Papéis e permissões](#papéis-e-permissões)
- [Instalação e configuração local](#instalação-e-configuração-local)
- [Executar o projeto](#executar-o-projeto)
- [Mobile e APKs](#mobile-e-apks)
- [Desktop administrativo](#desktop-administrativo)
- [Publicação](#publicação)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Testes e qualidade](#testes-e-qualidade)
- [Rotina de desenvolvimento](#rotina-de-desenvolvimento)
- [Problemas frequentes](#problemas-frequentes)
- [Documentação complementar](#documentação-complementar)
- [Contexto acadêmico e licença](#contexto-acadêmico-e-licença)

## Acessar e instalar

| Recurso | Endereço | Finalidade |
|---|---|---|
| Web | [ludora-nine.vercel.app](https://ludora-nine.vercel.app/) | Acesso pelo navegador, incluindo celulares |
| APK Android | [Última release](https://github.com/OcianClub/Ludora/releases/latest) | Baixar o `.apk` na seção **Assets** |
| Demonstração v1.1.0 | [Ludora v1.1.0](https://github.com/OcianClub/Ludora/releases/tag/v1.1.0) | Versão de demonstração com backend no Render |
| API publicada | [ludora-pgho.onrender.com/health](https://ludora-pgho.onrender.com/health) | Verificar se o processo HTTP responde |
| Código-fonte | [OcianClub/Ludora](https://github.com/OcianClub/Ludora) | Monorepo das aplicações e serviços |

Para instalar no Android, baixe o APK, abra o arquivo e autorize a instalação pelo navegador ou gerenciador de arquivos, se solicitado. **Não é necessário extrair o APK nem instalar Expo Go para usar o preview distribuído.** O APK público acessa o Render e não depende de um computador com Metro ligado.

O link `/releases/latest` acompanha a release marcada no GitHub como mais recente. O nome do arquivo em **Assets** pode mudar entre versões; a v1.1.0 permanece acessível pelo link específico acima.

Os ambientes e dados de demonstração podem mudar durante o desenvolvimento. A `develop` pode conter alterações posteriores ao APK publicado. Atualizar web/API não substitui um APK já instalado nem modifica os arquivos de uma release.

## Aplicações

| Aplicação | Diretório | Uso |
|---|---|---|
| **Web** | `apps/web` | Gestão de clubes, jogadores, pessoas, partidas e torneios; acompanhamento público |
| **Mobile** | `apps/mobile` | Acompanhar clubes, notificações e torneios; preparar e operar partidas conforme as permissões |
| **Desktop — Ludora Admin** | `apps/desktop` | Atendimento, manutenção, administração e diagnóstico da plataforma |
| **API** | `services/api` | Identidade, permissões, regras esportivas, persistência, integrações e tempo real |
| **Scout IA** | `services/ml` | Processamento estatístico e busca de atletas com registros semelhantes |

O desktop é interno à equipe Ludora. Ser administrador de um clube não concede automaticamente acesso à administração da plataforma.

## Funcionalidades

### Descoberta, conta e clubes

- Consulta de clubes, agenda, partidas ao vivo e resultados, inclusive sem autenticação nos fluxos públicos.
- Seguir clubes com uma conta autenticada e alternar entre visão pública e gestão quando autorizado.
- Cadastro com confirmação de e-mail, login, recuperação de senha e perfil com preferências.
- Convites por e-mail, link ou código, com cargo e categorias definidos pelo administrador.
- Uma conta com vínculos independentes em vários clubes; autorização por clube, cargo e categoria.

### Atletas, categorias e times

- Cadastro e edição de atletas, posição em quadra, camisa e situação no elenco.
- **Iniciação:** SUB-7, SUB-8, SUB-9 e SUB-10. **Base:** SUB-12, SUB-14, SUB-16 e SUB-18.
- Categoria calculada pelo ano de nascimento e pela temporada, com atualização no backend.
- Controle de camisas e tratamento de conflitos de numeração no elenco.
- Ficha do atleta com participações, histórico de jogos e estatísticas.
- Consulta de times, adversários, categorias e vínculos com clubes cadastrados.

### Organização e solicitações de partidas

- Categoria, adversário, competição, mando, data, horário e local, com revisão antes da confirmação.
- Busca de adversários, destaque para clubes do Ludora, escolhas recentes e atalhos de datas/locais nos fluxos disponíveis.
- Bloqueio de novos agendamentos em horários que já passaram.
- Adversário externo: criação direta. Adversário do Ludora: proposta ao outro clube.
- Aceite, recusa, sugestão de alteração e cancelamento de propostas, sem duplicar o confronto nos dois clubes.

### Preparação, súmula e acompanhamento ao vivo

```text
Organizar / propor → Aceitar, quando necessário → Preparar equipes
→ Publicar escalações → Iniciar partida → Registrar súmula → Finalizar
```

- Cada clube prepara e publica sua própria escalação.
- O responsável pela súmula registra os acontecimentos das duas equipes; a responsabilidade pode ser transferida por proposta e aceite.
- Placar, períodos, gols, assistências, defesas, faltas e cartões amarelo, vermelho e azul.
- Substituições, linha de acontecimentos e histórico de alterações.
- Janela de revisão para conferir e cancelar novos lances antes da publicação.
- Atualização entre web e mobile, com reconexão e recuperação de dados nos fluxos implementados.
- Consulta dos tempos anteriores para quem acompanha, sem alterar o período oficial.
- Palpite da torcida: mandante, empate ou visitante. Quem tem a operação da súmula acompanha os resultados sem votar.
- Resumo pós-partida, estatísticas por tempo e compartilhamento do resultado.

Os estados persistidos são `AGENDADA`, `PREPARADA`, `AO_VIVO`, `FINALIZADA` e `CANCELADA`. **Atrasada** é uma condição derivada da data e do horário de uma partida agendada/preparada, não um resultado nem um novo estado esportivo.

Partidas atrasadas aparecem em filtros e pendências e geram avisos aos responsáveis. Não são excluídas automaticamente. Reagendar, iniciar, cancelar ou excluir depende da situação e das permissões; a exclusão é restrita a partidas locais sem início ou registros protegidos. Cancelar preserva o histórico.

### Torneios e Campeonato Paulista

- Cadastro de competições e consulta de participantes e jogos.
- Visão geral, classificação, jogos, trajetória e chaveamento, conforme o formato e os dados disponíveis.
- Acompanhamento dos campeonatos do Paulista vinculados ao clube e às categorias.
- Integração com publicações da Federação Paulista de Futebol de Salão, administrada pelo desktop.
- Descoberta de eventos, confirmação da identidade dos clubes, sincronização e revisão de divergências.

A publicação oficial é separada dos registros locais de súmula e Scout. A integração não deve inventar classificação, avanço ou desempate quando a fonte não oferece informação suficiente. O módulo depende de flags e migrations: consulte [operação do Paulista](docs/paulista-operacao.md).

### Estatísticas e Scout

- Totais e gráficos por atleta, temporada, campeonato e partida.
- Dados ao vivo identificados como provisórios; os perfis são processados a partir de partidas finalizadas.
- Perfis **Artilheiro**, **Armador**, **Paredão**, **Misto** e **Sem dados**.
- Até três atletas com registros semelhantes dentro da mesma categoria e posição.

A API reúne eventos e convocações e envia ao Python os dados necessários. As taxas de gols, assistências e defesas por convocação são ajustadas com `RobustScaler`. `NearestNeighbors`, com distância euclidiana e KD-tree, encontra registros próximos. **A implementação atual não usa K-means nem DBSCAN.**

Os perfis descritivos seguem regras explícitas: exigem cinco convocações e três eventos entre gols, assistências e defesas. A semelhança exige cinco atletas elegíveis no grupo, cada um com cinco convocações e algum evento nas métricas comparadas.

O Scout descreve registros disponíveis: **não atribui nota de habilidade nem prevê resultados**, e não estima minutos jogados, qualidade técnica ou dificuldade dos adversários. Consulte [Scout v2](docs/scout-v2.md) para os critérios, limites e interpretação.

### Notificações, atendimento e manutenção

- Notificações de acontecimentos, agendamentos, resultados e pendências, com preferências por usuário e clube.
- Sincronização das notificações da conta e registro de leitura; push Android quando permissões e credenciais estão configuradas.
- Chamados no web e mobile, com identidade do solicitante e contexto da aplicação.
- Chamados individuais: respostas ao solicitante não são mensagens públicas para todo o clube.
- Atendimento no desktop com responsável, status, prioridade, histórico, notas internas e respostas ao cliente.
- Respostas padronizadas e acompanhamento atualizado sem fechar e reabrir a tela.
- Manutenção por operação e escopo, com avisos na interface e bloqueios também na API.

### Administração e experiência de uso

O **Ludora Admin** reúne visão global, clubes e planos, contas e acessos, pendências de cadastro, chamados, manutenção, integração Paulista, diagnóstico de serviços, banco e logs. As abas e ações variam conforme o papel interno.

As aplicações compartilham identidade visual, ícones e regras de interface: filtros, selects, radios, toggles, cards, tabelas, skeletons e spinners. Há temas claro/escuro, rascunhos e preferências persistidas onde aplicável, retorno ao topo, reconexão e reaproveitamento de consultas para reduzir carregamentos repetidos.

## Arquitetura

```mermaid
flowchart LR
    WEB[Web · React e Vite] -->|HTTP| API[API · Node.js e Express]
    MOBILE[Mobile · React Native e Expo] -->|HTTP| API
    DESKTOP[Desktop · Electron] -->|HTTP via processo principal| API
    API -->|Prisma| DB[(PostgreSQL / Supabase)]
    API <-->|Socket.IO| WEB
    API <-->|Socket.IO| MOBILE
    API <-->|Socket.IO| DESKTOP
    API -->|HTTP interno autenticado| ML[Scout · Python e FastAPI]
    API --> EMAIL[Resend · e-mails]
    API --> FPFS[Publicações do Paulista]
```

As escritas passam pela API: ela verifica identidade e permissões, aplica as regras e grava no PostgreSQL. Depois, eventos de tempo real sinalizam mudanças aos clientes relevantes. As interfaces atualizam ou consultam novamente os dados, com recuperação periódica nos fluxos implementados.

As salas autenticadas do Socket.IO separam usuário, clube e operação interna. O acompanhamento público usa canais próprios, sem expor rascunhos de escalação, dados pessoais ou ações administrativas.

Transações, controle de versão e identificadores de requisição tratam concorrência e tentativas repetidas nos fluxos de partida. O banco continua sendo a fonte dos registros persistidos.

## Tecnologias

| Camada | Tecnologias principais | Uso |
|---|---|---|
| Web | React, TypeScript, Vite, React Router | Interface responsiva e navegação |
| Mobile | React Native 0.81, Expo SDK 54, Expo Router, TypeScript | Aplicativo e rotas mobile |
| Interface mobile | Reanimated, Worklets, Gesture Handler, SVG | Gestos, animações, controles e gráficos |
| Desktop | Electron, React, electron-vite, electron-builder | Painel interno e instaladores |
| API | Node.js 22, Express, TypeScript | Regras e endpoints HTTP |
| Banco | PostgreSQL, Prisma ORM, Supabase | Persistência, schema, migrations e banco gerenciado |
| Tempo real | Socket.IO | Partidas, notificações e operação |
| Scout | Python, FastAPI, NumPy, scikit-learn, Pydantic | Validação e comparação estatística |
| Autenticação | JWT, bcrypt, Expo SecureStore, Electron safeStorage | Sessão e proteção de credenciais conforme o cliente |
| Integrações | Resend, Cheerio, Expo Notifications, Google Places opcional | E-mails, publicações, push e sugestões de locais |
| Organização | pnpm workspaces | Monorepo e pacotes compartilhados |
| Testes | Node.js test runner, tsx, Playwright; Cypress na homologação acadêmica | Regras, contratos, regressão e interface |
| Publicação | Vercel, Render, Expo EAS | Web, serviços e builds Android |

As versões exatas estão nos `package.json` e no `pnpm-lock.yaml`. Web/desktop usam React 18; o mobile usa React 19. Preserve a resolução do workspace ao instalar dependências.

## Papéis e permissões

Há dois níveis independentes de autorização.

### Dentro de cada clube

| Papel | Finalidade |
|---|---|
| `ADMIN` | Administração do clube e acesso a todas as categorias |
| `TECNICO` | Gestão nas categorias atribuídas ou em todas, conforme configuração |
| `MESARIO` | Gestão e dia de jogo dentro do escopo autorizado |
| `OLHEIRO` | Conteúdo público, sem edição ou acesso privado adicional automático |
| `TORCEDOR` | Acompanhamento do clube e de seus conteúdos públicos |

A operação da súmula também considera qual clube é responsável pelo jogo. Ter cargo de gestão em um participante não transfere automaticamente essa responsabilidade.

### Na equipe Ludora

| Papel | Finalidade |
|---|---|
| `USUARIO` | Conta comum; não acessa o painel interno |
| `SUPORTE` | Atendimento, manutenção e ajustes permitidos ao suporte |
| `DESENVOLVEDOR` | Áreas técnicas e operacionais autorizadas |
| `SUPERADMIN` | Administração global da plataforma |

As ações são verificadas nos endpoints. Ocultar uma aba ou botão não substitui autorização na API. Um papel interno não concede automaticamente um vínculo de administrador nos clubes.

## Instalação e configuração local

Os exemplos usam **PowerShell**, na raiz do repositório, salvo indicação em contrário.

### 1. Requisitos

- Git e **Node.js 22.x**; os perfis EAS utilizam Node 22.14.0.
- **pnpm 11.20.0**, conforme `packageManager` do repositório.
- PostgreSQL local ou PostgreSQL no Supabase acessível pela API.
- **Python 3.11 ou superior** para executar o Scout.
- Para desenvolvimento Android: SDK/emulador ou celular com development build; Java 17 para compilação Android local.
- Dependências do Electron para executar o desktop.
- Para simulador iOS e builds nativas iOS locais: macOS e ferramentas da Apple.

Web/API podem ser usados sem Python. O comando conjunto `pnpm dev`, porém, inicia o ML e precisa do ambiente Python preparado.

### 2. Obter o projeto e instalar dependências

```powershell
git clone https://github.com/OcianClub/Ludora.git
cd Ludora
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
```

A `main` reúne o conteúdo integrado; `develop` é utilizada no desenvolvimento. Para trabalhar nela, execute `git switch develop` antes das suas alterações.

Instale as dependências do workspace pela raiz. O `npm` acima serve apenas para disponibilizar o pnpm globalmente, não para instalar os pacotes de cada aplicação. As permissões de scripts de instalação já estão em `pnpm-workspace.yaml`.

No Windows, prefira um caminho curto, sem espaços e fora do OneDrive, como `E:\Ludora`, especialmente para compilar Android. Não mova um projeto com build em execução: caches nativos registram caminhos locais.

### 3. Criar os arquivos de ambiente

Este bloco preserva os arquivos existentes:

```powershell
$projetos = @('services/api', 'services/ml', 'apps/web', 'apps/mobile', 'apps/desktop')
foreach ($projeto in $projetos) {
  $destino = Join-Path $projeto '.env'
  if (-not (Test-Path $destino)) {
    Copy-Item (Join-Path $projeto '.env.example') $destino
  }
}
```

| Arquivo | Configuração principal |
|---|---|
| `services/api/.env` | Banco, autenticação e integrações |
| `services/ml/.env` | Referência das opções Python; o Uvicorn não o carrega automaticamente |
| `apps/web/.env` | `VITE_API_URL=http://localhost:3000` |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` do ambiente desejado; o exemplo aponta para Render |
| `apps/desktop/.env` | `MAIN_VITE_API_URL=http://localhost:3000` como padrão |

### 4. Configurar banco e API

Exemplo para um PostgreSQL local **já criado**, substituindo usuário e senha:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/ludora?schema=public
DIRECT_URL=postgresql://postgres:SUA_SENHA@localhost:5432/ludora?schema=public
JWT_SECRET=SUBSTITUA_POR_UM_SEGREDO_ALEATORIO_COM_PELO_MENOS_32_CARACTERES
CORS_ORIGINS=http://localhost:5173,http://localhost:4173,http://localhost:8081
```

Crie o banco `ludora` no PostgreSQL antes das migrations. No Supabase, use as URLs fornecidas pelo projeto: conexão da aplicação em `DATABASE_URL` e conexão administrativa para migrations em `DIRECT_URL`. Caracteres especiais da senha precisam estar codificados na URL.

| Variável da API | Finalidade |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Conexão de dados e conexão para migrations |
| `JWT_SECRET` | Assinatura da sessão; exige pelo menos 32 caracteres em produção |
| `PORT` | HTTP e Socket.IO; padrão `3000` |
| `CORS_ORIGINS` | Origens web autorizadas, separadas por vírgula; obrigatória em produção |
| `TRUST_PROXY_HOPS` | Proxies confiáveis; `0` local e normalmente `1` atrás do proxy do Render |
| `JSON_BODY_LIMIT` | Limite do corpo JSON; padrão `256kb` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Chave e remetente dos e-mails |
| `INVITE_BASE_URL` | Base dos convites, como `http://localhost:5173/convite/token` |
| `LUDORA_WEB_URL` | URL da interface usada nas comunicações |
| `PYTHON_AI_URL` | Serviço Python; vazia desativa o processamento do Scout |
| `ML_API_KEY` | Chave compartilhada somente entre API e Python |
| `PAULISTA_ENABLED` | Habilita o módulo após configurar banco e integração |
| `PAULISTA_SYNC_DIARIA` | Descoberta/sincronização automática de eventos acompanhados |
| `ATUALIZACAO_TEMPORADA` | Atualização de categorias/camisas; `false` desativa |
| `GOOGLE_PLACES_API_KEY` | Opcional: sugestões externas de locais |
| `SUPERADMIN_EMAILS` | Compatibilidade com acessos internos legados por e-mail |

O [`.env.example` da API](services/api/.env.example) é a referência das opções. `SUPABASE_SERVICE_ROLE_KEY`, quando configurada para integrações do ambiente, também é privada e nunca deve ser enviada aos clientes.

A API inicia sem Resend, mas cadastro com confirmação, recuperação e envios de convite dependem do serviço configurado. Use remetente/domínio autorizado; o remetente de teste restringe os destinatários.

**Não versione `.env`, senhas, tokens ou chaves privadas.** `VITE_*` e `EXPO_PUBLIC_*` são incorporadas aos clientes e devem conter somente valores públicos, como a URL da API.

### 5. Aplicar as migrations

Com o banco de destino conferido e a API parada:

```powershell
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api exec prisma migrate deploy
```

Esses comandos geram o Prisma Client e aplicam as migrations existentes. Não criam contas, clubes ou dados de demonstração.

Não rode seeds para simplesmente iniciar o projeto: alguns scripts de demonstração alteram ou limpam dados. Para criar uma migration em banco de desenvolvimento próprio, use `prisma migrate dev`; para instalar migrations versionadas, use `migrate deploy`.

### 6. Preparar o serviço Python

```powershell
py -m venv services/ml/.venv
.\services\ml\.venv\Scripts\python.exe -m pip install -r services/ml/requirements.txt
```

`pnpm dev:ml` usa essa `.venv`, define o ambiente de desenvolvimento e reaproveita `ML_API_KEY` da API quando necessário. Para iniciar o Python manualmente, configure a chave no ambiente do processo; copiar o `.env.example` não faz o Python carregá-lo sozinho.

Para execução independente do serviço, configure `PYTHON_AI_URL=http://127.0.0.1:8000` na API. Em produção, API e Python devem ter a mesma `ML_API_KEY`; o aplicativo não recebe essa chave.

## Executar o projeto

### Pilha completa

Depois de preparar banco, dependências e Python:

```powershell
pnpm dev
```

Inicia **API, ML, Expo/Metro, web e desktop**. A pilha direciona web/desktop para a API local e seleciona um endereço de rede local para o mobile. Não é necessário alterar os perfis de APK Render para desenvolver dessa forma.

| Serviço | Endereço padrão |
|---|---|
| Web | `http://localhost:5173` |
| API e Socket.IO | `http://localhost:3000` |
| Health da API | `http://localhost:3000/health` |
| Python | `http://127.0.0.1:8000` |
| Health do Python | `http://127.0.0.1:8000/health` |
| Documentação FastAPI | `http://127.0.0.1:8000/docs` |
| Metro | Normalmente `8081`; o iniciador busca uma porta livre até `8091` |
| Desktop | Janela do Ludora Admin |

Mantenha o terminal aberto. `Ctrl+C` encerra a pilha; se um serviço falhar, o iniciador encerra os demais. Não abra novamente `pnpm dev:desktop` se ele já foi iniciado por `pnpm dev`.

Para apresentar usando um APK independente do Metro:

```powershell
pnpm dev:apresentacao
```

Esse comando mantém API, ML, web e desktop e **não inicia o Metro**. O APK Local precisa apontar para o IPv4 correto do notebook na rede de apresentação.

### Serviços separados

Abra um terminal por serviço necessário:

| Comando na raiz | Serviço |
|---|---|
| `pnpm dev:api` | API TypeScript em modo watch |
| `pnpm dev:web` | Vite do web |
| `pnpm dev:ml` | Python com Uvicorn e reload |
| `pnpm dev:mobile` | Expo/Metro para development build |
| `pnpm dev:desktop` | Electron em desenvolvimento |

Para usar somente web/API, execute `pnpm dev:api` e `pnpm dev:web` em terminais separados. Deixe `PYTHON_AI_URL` vazio se não quiser executar a análise Python; as estatísticas dos registros continuam disponíveis.

Mudanças de `.env` exigem reiniciar o serviço. HMR/reload atende alterações compatíveis de código, mas não substitui migrations nem recompilação de dependências nativas.

### Primeiro acesso em uma base nova

1. Configure o envio de e-mail e crie uma conta pelo web ou aplicativo.
2. Para administrar a plataforma, conceda o papel interno a uma conta existente, em um terminal autorizado:

   ```powershell
   pnpm superadmin:grant seu-email-cadastrado@exemplo.com
   ```

3. Entre no desktop, cadastre o clube e organize os acessos pelos fluxos disponíveis.
4. Convide as pessoas com os cargos e categorias adequados.
5. No web, cadastre os atletas e organize o elenco; depois prepare um confronto de teste.

A concessão altera a conta no banco configurado em `services/api/.env`. Não existem credenciais universais de administrador documentadas para a aplicação.

## Mobile e APKs

### Endereço da API

| Ambiente do cliente | Endereço da API |
|---|---|
| Navegador ou desktop no próprio computador | `http://localhost:3000` |
| Emulador Android Studio e API local | `http://10.0.2.2:3000` |
| Celular físico e API local | `http://IPV4_DO_NOTEBOOK:3000` |
| Simulador iOS no macOS e API local | `http://localhost:3000` |
| APK público Render | `https://ludora-pgho.onrender.com` |

No celular, `localhost` é o próprio aparelho. Se a API estiver no notebook, os aparelhos precisam se comunicar pela rede. Confira o IPv4 com `ipconfig` no Windows e teste `http://IPV4_DO_NOTEBOOK:3000/health` no navegador do celular. A API escuta em `0.0.0.0`; confira a liberação da porta no firewall da rede de teste quando necessário.

O iniciador de `pnpm dev` informa o destino escolhido. Ao abrir `pnpm dev:mobile` sozinho, revise o `.env` mobile: o exemplo usa Render, não a API local.

### Desenvolvimento com Metro

```powershell
pnpm dev:mobile
```

Abra um development build compatível no aparelho e use o endereço/QR code do Expo. Esse QR carrega o projeto de desenvolvimento; é diferente de um QR para baixar o APK público.

| Comando na raiz | Uso |
|---|---|
| `pnpm dev:mobile:android` | Abrir em Android conectado ou emulador |
| `pnpm dev:mobile:clean` | Limpar cache do Metro e iniciar development build |
| `pnpm dev:mobile:tunnel` | Expor o Metro por túnel |
| `pnpm dev:mobile:go` | Testes compatíveis com Expo Go |
| `pnpm dev:mobile:check` | Compatibilidade Expo e tipos |

Expo Go não substitui o development build com os módulos nativos do Ludora nem valida push Android. Um túnel do Metro também não publica a API do notebook.

### Builds com EAS

Execute dentro de `apps/mobile`, com acesso à conta Expo/EAS do projeto:

```powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview
```

| Perfil | Destino | Depende do Metro? |
|---|---|---|
| `development` | Aplicativo de desenvolvimento com dev client | Sim, no uso de desenvolvimento |
| `preview` | APK instalável com API no Render | Não |
| `preview-local` | APK **Ludora Local**, com API no notebook | Não |
| `production` | Distribuição; formato padrão de publicação Android | Não |

Para gerar o development build, use `--profile development`. O perfil `preview` é o utilizado para compartilhar o APK de testes com o público. Para um arquivo já pronto, consulte a última release.

Para o **APK Local**, volte à raiz, conecte o notebook à rede desejada e execute:

```powershell
node scripts/configure-local-apk.cjs
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview-local
```

Se houver várias interfaces, informe o IPv4 correto ao script: `node scripts/configure-local-apk.cjs 192.168.0.10`. Ele verifica se o endereço pertence ao computador e altera apenas a URL do perfil local em `apps/mobile/eas.json`.

A compilação ocorre na nuvem mesmo no perfil `preview-local`: **local** se refere à API. Os dois aplicativos podem coexistir, pois o Local usa nome e identificador Android próprios. Confira o IP salvo antes de gerar: o endereço muda ao trocar de Wi-Fi ou hotspot.

As URLs dos perfis são incorporadas ao APK. Mudar o IP exige gerar e instalar outro APK Local. Não há Expo Updates configurado para substituir automaticamente o código de um preview instalado.

O APK público referencia `google-services.json` para `com.ludora.app`. Push Android exige Firebase/FCM e as credenciais correspondentes no Expo. O Local tem outro identificador e não reutiliza automaticamente essa configuração. Nunca inclua a chave privada de conta de serviço Firebase no repositório ou no app.

Compilar Android diretamente no computador exige Java, SDK, NDK, CMake e Ninja compatíveis, além da configuração de assinatura. Esse caminho não equivale apenas a adicionar `--local` ao EAS no Windows. O fluxo documentado de distribuição é o EAS; veja [APKs de teste](docs/apk-testes-render.md).

## Desktop administrativo

```powershell
pnpm dev:desktop
```

Use uma conta com papel interno autorizado. Suporte, desenvolvimento e administração têm escopos distintos, revalidados pela API.

Quando aberto sozinho, o endereço da API pode ser alterado em **Ajustes**. São aceitas URLs HTTPS e HTTP de loopback para desenvolvimento. Na pilha `pnpm dev`, o desktop usa explicitamente a API local; para escolher outro servidor, abra-o separadamente.

O renderer não acessa diretamente o PostgreSQL. O processo principal faz as requisições autorizadas e persiste o token com `safeStorage` quando a criptografia do sistema está disponível; sem armazenamento seguro, a sessão pode ficar somente em memória.

Para compilar e gerar o instalador Windows:

```powershell
pnpm build:desktop
pnpm dist:desktop
```

A saída fica em `apps/desktop/release`. A configuração usa NSIS para Windows x64; existem alvos para macOS e Linux que dependem dos ambientes apropriados. Um instalador sem assinatura de código pode receber aviso do sistema operacional.

## Publicação

| Componente | Hospedagem / distribuição | Configuração |
|---|---|---|
| Web | Vercel | `vercel.json`, `VITE_API_URL` |
| API Node | Render | Build da API, banco, JWT, CORS e integrações |
| Scout Python | Render, serviço separado | `services/ml`, `ML_API_KEY` e porta do ambiente |
| Banco | PostgreSQL / Supabase | Conexões privadas e migrations |
| APK Android | Expo EAS e GitHub Releases | Perfis de `eas.json` e arquivo da release |
| Desktop | Instalador interno | `electron-builder.yml` |

### Web na Vercel

- Raiz: raiz do monorepo.
- `vercel.json` instala os pacotes necessários, compila `@ludora/web`, publica `apps/web/dist` e fornece fallback SPA para as rotas React.
- Variável de build: `VITE_API_URL=https://ludora-pgho.onrender.com`.
- Não acrescente `/api`: o backend expõe diretamente `/auth`, `/partidas`, `/clubes`, etc.

### API no Render

- Build: `corepack pnpm install --frozen-lockfile --prod=false --filter @ludora/api... && corepack pnpm run build:api`.
- Start: `node services/api/dist/src/server.js`.
- Health: `/health`.
- Configure `NODE_ENV=production`, banco, `JWT_SECRET`, `CORS_ORIGINS` e integrações.
- Autorize `https://ludora-nine.vercel.app` no CORS e ajuste os links de convite e comunicação.

O serviço usa `PORT` do ambiente. O health confirma que o processo HTTP responde, não que PostgreSQL, e-mail e Python estejam todos saudáveis.

### Python no Render

- Diretório: `services/ml`.
- Build: `pip install -r requirements.txt`.
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Configure `NODE_ENV=production` e a mesma `ML_API_KEY` na API e no Python.
- Na API, use `PYTHON_AI_URL` com a URL pública do Python, sem `/docs`, `/health` ou o caminho do endpoint.

Publique API/Python compatíveis e aplique as migrations revisadas no banco de destino. Build não executa automaticamente migrations, seeds ou reprocessamento do histórico.

O push pode acionar os serviços vinculados à branch de produção, conforme a configuração de cada plataforma. Alterações web/API não geram APK nem substituem os anexos de uma release. Consulte [deploy Render/Vercel](docs/deploy-render-vercel.md).

## Estrutura de pastas

```text
Ludora/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── pages/              Telas de gestão e acompanhamento
│   │   │   ├── components/         Interface e fluxos reutilizáveis
│   │   │   ├── contexts/           Autenticação, clube e estado
│   │   │   ├── hooks/              Consultas, eventos e comportamento
│   │   │   ├── services/           Comunicação com a API
│   │   │   └── styles/             Estilos globais
│   │   └── tests/                  Regras e cenários de navegador
│   ├── mobile/
│   │   ├── app/                    Rotas do Expo Router
│   │   ├── src/                    Componentes, contextos, hooks e serviços
│   │   ├── assets/                 Marca, imagens e recursos
│   │   ├── tests/                  Regras e interface mobile
│   │   ├── app.config.js           Variante Local e configuração nativa
│   │   ├── app.json                Identidade e plugins
│   │   └── eas.json                Perfis de build
│   └── desktop/
│       ├── src/main/               Processo principal, sessão, IPC e API
│       ├── src/preload/            Ponte entre main e renderer
│       ├── src/renderer/           Painel React e componentes
│       ├── src/shared/             Contratos e regras do desktop
│       ├── tests/                  Regras e interface
│       └── electron-builder.yml    Empacotamento e instaladores
├── services/
│   ├── api/
│   │   ├── prisma/                 Schema, migrations e scripts de dados
│   │   ├── src/
│   │   │   ├── app.ts              Express, middlewares e rotas
│   │   │   ├── server.ts           HTTP e tarefas periódicas
│   │   │   ├── modules/            Domínios esportivos e administrativos
│   │   │   ├── middlewares/        Autenticação, permissões e limites
│   │   │   ├── realtime/           Socket.IO autenticado e público
│   │   │   └── services/           E-mails, Scout e serviços comuns
│   │   ├── scripts/                Operações administrativas
│   │   └── tests/                  Regras, HTTP e integração
│   └── ml/
│       ├── main.py                 FastAPI, perfis e vizinhos semelhantes
│       ├── requirements.txt        Dependências Python
│       └── constraints.txt         Restrições de dependências
├── packages/
│   ├── design-tokens/              Cores, tipografia e identidade visual
│   ├── icons/                      Ícones e recursos compartilhados
│   └── shared-types/               Tipos e regras compartilhadas
├── scripts/                        Inicialização, rede e banco de testes
├── homologacao/                     Cypress, evidências e relatório
├── docs/                           Arquitetura, contratos e guias
├── pnpm-workspace.yaml             Pacotes e políticas de dependências
├── pnpm-lock.yaml                  Resolução das dependências
└── vercel.json                     Build e rotas na Vercel
```

`node_modules`, `.venv`, `.env`, `dist`, saídas de testes e diretórios nativos gerados pelo Expo não são fontes para copiar entre ambientes. Android/iOS podem ser gerados durante o prebuild.

## Testes e qualidade

A suíte principal usa o **test runner do Node.js**, com `tsx` para TypeScript. Há cenários de navegador com **Playwright** e homologação acadêmica com **Cypress**. A presença de um cenário não significa execução em toda release ou em todos os aparelhos.

| Comando na raiz | Verificação |
|---|---|
| `pnpm test:app` | Suítes principais de regras/API e utilitários mobile |
| `pnpm test:app:completo` | Compila a API e inclui as suítes configuradas de API, mobile e utilitários web |
| `pnpm test:desktop` | Regras e contratos do desktop |
| `pnpm --filter @ludora/web exec tsc --noEmit` | Tipos do web |
| `pnpm --filter @ludora/mobile exec tsc --noEmit` | Tipos do mobile |
| `pnpm --filter @ludora/desktop run typecheck` | Tipos do processo principal e renderer |
| `pnpm dev:mobile:check` | Compatibilidade Expo e tipos |
| `pnpm perf:scout` | Benchmark sintético do Scout |

`test:app:completo` não inicia todos os cenários Playwright, Cypress ou um aparelho Android. Os scripts de interface `.cjs` têm requisitos próprios de servidor, porta, navegador e fixtures. Os relatórios de auditoria explicam o que foi simulado e validado.

As suítes configuradas com `services/api/tests/setup.cjs` isolam variáveis e não usam as credenciais do `.env`. Integrações que gravam em PostgreSQL precisam de banco descartável; não aponte uma suíte genérica para produção.

### Banco isolado da integração da equipe

```powershell
pnpm db:test:start
pnpm test:integracao:api
pnpm db:test:status
pnpm db:test:stop
```

O iniciador fornece PostgreSQL portátil de testes no **Windows x64**, com dados em `.local-demo/equipe` e porta própria. Não é o banco de uso normal do app. Veja [banco de testes local](docs/banco-de-testes-local.md).

[homologacao](homologacao/) contém relatório acadêmico, evidências e cenário Cypress. Não é uma aplicação do workspace com instalação própria de dependências.

## Rotina de desenvolvimento

1. Atualize a branch e revise as alterações recebidas.
2. Se dependências mudaram, execute `pnpm install --frozen-lockfile` na raiz.
3. Se o schema mudou, confira o banco de destino, gere o client e aplique as migrations; pare a API quando necessário.
4. Execute os serviços e verificações apropriadas às aplicações alteradas.
5. Publique cada componente conforme seu ciclo: web, API, ML, APK e desktop têm distribuições independentes.

Builds na raiz:

```powershell
pnpm build:api
pnpm build:web
pnpm build:desktop
```

Para iniciar a API compilada, use `pnpm start:api`. Para visualizar o web compilado, use `pnpm --filter @ludora/web preview`, normalmente na porta `4173`, autorizada no CORS da API.

## Problemas frequentes

| Situação | O que conferir |
|---|---|
| API não inicia | `.env`, `JWT_SECRET`, dependências e porta `3000` |
| Banco indisponível | Projeto ativo, URLs, senha codificada e migrations |
| Cadastro/recuperação não envia e-mail | Chave Resend, remetente/domínio e restrições de teste |
| Web recebe erro CORS | Origem exata do navegador em `CORS_ORIGINS`; reinicie a API |
| APK Local não conecta | IPv4 atual do notebook, API ligada e `/health` acessível no celular |
| IP mudou após gerar APK | Atualize o perfil e gere outro APK Local; a URL foi incorporada |
| Túnel Expo abre, mas API não responde | O túnel serve o Metro; a API precisa ser acessível separadamente |
| App fecha ao iniciar | Capture o erro Android/Logcat; build bem-sucedido não comprova inicialização no aparelho |
| Erro CMake/Ninja no Windows | Caminho curto sem espaços, versões compatíveis e caches nativos coerentes |
| Development build não carrega | Metro ligado, porta informada, rede e versão nativa compatível |
| Scout não recalcula | `PYTHON_AI_URL`, Python acessível e `ML_API_KEY` igual nos dois serviços |
| Push não chega | Preferência do usuário, permissão Android, credenciais FCM/Expo e variante correta |
| Desktop recusa acesso | Papel interno e autorização na API; cargo de clube não basta |
| Desktop usa outra API | Confira **Ajustes** e `MAIN_VITE_API_URL` |
| Electron não foi baixado | Confira a instalação; tente `node apps/desktop/node_modules/electron/install.js` |
| Paulista não atualiza | Flags, migrations, vínculos de identidade e API em execução |
| Primeira consulta Render demora | Confira suspensão/inicialização do serviço e seus logs |

## Documentação complementar

- [Referência técnica e contratos](docs/referencia-tecnica.md)
- [Arquitetura do sistema](docs/arquitetura-ludora.md)
- [Acesso público no web](docs/acesso-publico-web.md)
- [Partidas compartilhadas](docs/partidas-compartilhadas.md)
- [Cadastro de atletas e temporada](docs/cadastro-alunos-temporada.md)
- [Scout v2: regras e interpretação](docs/scout-v2.md)
- [Operação da integração Paulista](docs/paulista-operacao.md)
- [Deploy API e web](docs/deploy-render-vercel.md)
- [APKs Render e Local](docs/apk-testes-render.md)
- [Componentes e menus do desktop](docs/desktop-componentes-menus.md)
- [Concessão de Super Admin](docs/papel-superadmin.md)
- [Banco de testes local](docs/banco-de-testes-local.md)
- [Validação em aparelho](docs/validacao-mobile.md)
- [Documentação técnica em PDF](docs/ludora-documentacao-tecnica.pdf)

Alguns relatórios em `docs/` registram etapas anteriores. Para executar o código atual, siga este README e a configuração da branch em uso; para regras específicas, confira também o módulo correspondente.

## Contexto acadêmico e licença

O Ludora aplica desenvolvimento multiplataforma, integração de serviços, gestão esportiva, testes e experiência de uso em um projeto acadêmico. A distribuição v1.1.0 é apresentada como versão de demonstração.

O repositório ainda não possui uma licença pública de uso definida. Disponibilizar o código, por si só, não estabelece uma licença de reutilização.
