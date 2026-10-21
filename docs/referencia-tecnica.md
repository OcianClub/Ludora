# Referência técnica do Ludora

Detalhes de funcionamento, contratos da API e regras para consulta dos desenvolvedores.
Para instalar, configurar e executar o projeto, consulte o [README](../README.md).
Os comandos de ambiente do README são a referência de execução; os contratos devem
ser conferidos também nos módulos de `services/api/src/modules/`.

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

## Principais rotas da API

### Performance do mobile

Jogos solicita `GET /partidas?resumo=1`, sem carregar a lista de eventos de cada
partida. A Home usa a consulta específica `GET /partidas/home?hoje=AAAA-MM-DD`. A consulta sem esse parâmetro preserva a resposta anterior para
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

A Home usa `GET /partidas/home?hoje=AAAA-MM-DD`, com autenticação e
`x-clube-id`, em vez de baixar todo o histórico. Uma consulta seleciona, por
categoria, cinco finalizadas, uma ao vivo e até três partidas futuras. O app
mantém o destaque e a agenda curta; o histórico completo continua na tela Jogos.
A data enviada corresponde ao dia local do celular. Partidas compartilhadas
mantêm a perspectiva do clube visitado e a restrição de edição.

Ao trocar de clube dentro das abas, a navegação reutiliza a Home existente;
a entrada após o login continua substituindo a rota anterior. Para usar esta
versão do mobile, compile e reinicie a API também: o novo endpoint é necessário.
Não há migração de banco ou nova dependência nativa para essa alteração.

Para reduzir a espera ao revisitar Home e Scout, as seis cópias recentes também
ficam em memória, respeitando sessão, clube, expiração e limpeza do cache. A API
continua sendo consultada: a cópia local não representa um placar ao vivo nem
autoriza operações. Após carregar a Home de um gestor, o app prepara a consulta
do Scout em segundo plano, depois das interações de navegação.

GETs idênticos simultâneos compartilham uma única requisição, separada por
cabeçalhos de autenticação/clube. Escritas e requisições com cancelamento próprio
não são agrupadas. A API comprime consultas JSON bem-sucedidas maiores que 1 KB
quando o cliente aceita compressão; erros e respostas de login não são comprimidos.

Em desenvolvimento, etapas acima de um segundo geram logs `[desempenho]` com
tempo de rede, consulta, persistência do clube e estado pronto de Home/Scout.
Para registrar também as etapas rápidas, defina `EXPO_PUBLIC_DEBUG_PERF=1` no
ambiente do mobile e reinicie o Metro. Esses tempos não medem FPS nem a pintura
final da tela. Os logs não incluem tokens, e-mails ou URLs com códigos de convite.

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

Na listagem, `mes` e `ano` são opcionais: `GET /partidas?mes=10&ano=2025` filtra
outubro de 2025; somente `ano=2025` retorna o ano inteiro. O mês sem ano mantém
o comportamento anterior (ano atual); sem ambos, não há restrição de período.
Mês/ano inválidos retornam HTTP 400. Os limites são aplicados no PostgreSQL,
mantendo o escopo do clube e a resposta leve com `resumo=1`.

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

Em partidas compartilhadas (`somente_leitura`), o resultado permanece disponível,
mas os eventos do clube organizador não são atribuídos aos atletas do clube que
consulta. Até existir identificação de equipe por evento, esse resumo não exibe
nem compartilha destaques individuais pelo clube visitante.

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

