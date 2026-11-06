# Acesso público no web

## Comportamento

- A entrada do site abre a descoberta de clubes sem exigir login.
- `/clubes/:clubeId`, `/clubes/:clubeId/partidas` e `/clubes/:clubeId/competicoes` são consultas públicas.
- Links existentes `/partidas/:id` também abrem sem sessão, inclusive quando nenhum clube foi selecionado antes.
- Visitantes e torcedores usam o cabeçalho superior no desktop e a navegação inferior no celular.
- O menu de usuário mantém o ícone, os tokens do Ludora e o seletor de tema. Sem sessão, apresenta benefícios, Entrar e Criar conta.
- Seguir exige login. A intenção é guardada por até 15 minutos, consumida uma única vez e retomada após autenticar. O endereço de retorno é restrito à própria aplicação. Convites têm prioridade.
- Um gestor pode entrar em **Gerenciar clube** e voltar por **Ver como visitante**. A permissão real permanece na API; o modo de navegação só controla a apresentação e quais consultas são utilizadas.

## Dados e compatibilidade

O cabeçalho da descoberta mostra somente a marca e o menu da conta, mesmo com um clube antigo salvo. Ao abrir um clube, sua identidade e a troca de clube ficam dentro do cabeçalho. Os links públicos aparecem na ordem Visão geral, Partidas, Campeonatos e Clubes, centralizados e sem sublinhado azul. No celular, a identidade do clube ocupa a linha superior e os links continuam na navegação inferior. Sino e perfil usam controles de 44 px e ícones de 24 px. A partida ao vivo ocupa a largura útil do mesmo container, respeitando os espaços laterais e a sidebar de gestão.

As novas rotas `/publico/...` têm seleções explícitas de dados. Não retornam CPF, nascimento, e-mail, cadastro completo de jogadores, rascunhos de escalação, propostas ou auditoria interna. Escalações só aparecem após publicação; eventos são exibidos em jogos ao vivo ou encerrados. Nenhuma escrita foi liberada a visitantes.

O socket público usa o namespace `/publico` e salas `publico:clube:ID`. Ele transmite apenas a indicação `{ partida_id }` para atualizar as consultas; não replica payloads dos canais privados. Os canais existentes de usuário, clube e superadmin continuam autenticados. Há consulta periódica como recuperação se o tempo real ficar indisponível.

Os contratos autenticados usados pelo mobile e desktop foram mantidos. Não há migração nem nova variável de ambiente. Para publicar, atualizar **API e web**; publicar apenas o web não disponibiliza as novas rotas do backend.

## Verificação realizada

- Builds da API e do web.
- Testes HTTP com Express real e persistência substituída: leitura sem token, identificadores inválidos, ocultação de rascunhos e cadastro pessoal, perspectiva do clube, classificação e bloqueio de escrita.
- Testes com servidor e clientes Socket.IO reais: visitante recebe somente invalidação no namespace público, não recebe payload privado e não consegue conectar anonimamente ao namespace autenticado. Testes existentes de revogação e expiração de sessão também passaram.
- Regressão de preparação, permissões de clube, eventos compartilhados e interações HTTP: 35 verificações passaram no conjunto selecionado, além de 4 testes de preparação legada e sockets.
- Navegador Edge/Playwright com HTTP interceptado: 320, 390, 768, 1024, 1200, 1440 e 1920 px; clubes, menu/tema, seguir com login, home, campeonatos e links de partidas agendadas/ao vivo/finalizadas; ausência de chamadas a endpoints privados e de overflow horizontal. Gestor alternando modos e torcedor autenticado também verificados.
- Regressão do histórico: 23 combinações de largura e sidebar, de 320 a 1920 px, incluindo nomes extensos.

Capturas em `test-results/public-access/`. Os testes não alteraram dados de produção nem publicaram serviços. O comportamento com o banco e a infraestrutura reais de produção ainda depende do deploy e de verificação nesse ambiente.

## Falhas anteriores identificadas

`services/api/tests/shared-events.test.ts` já tinha duas verificações falhando: identificação posterior sem o mock da consulta de autorização e uma expectativa antiga sobre correção de gol contra. As mesmas falhas foram reproduzidas com a versão do arquivo de rotas obtida de `HEAD`, sem as novas alterações públicas. As regras desses eventos não foram alteradas nesta entrega. O teste mais recente `shared-live.test.ts` passou, incluindo autorização pós-jogo e gol contra.
