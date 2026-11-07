# Acesso público no web

## Comportamento

- A entrada do site abre a descoberta de clubes sem exigir login.
- `/clubes/:clubeId`, `/clubes/:clubeId/partidas` e `/clubes/:clubeId/competicoes` são consultas públicas.
- Links existentes `/partidas/:id` também abrem sem sessão, inclusive quando nenhum clube foi selecionado antes.
- Visitantes e torcedores usam o cabeçalho superior no desktop e a navegação inferior no celular.
- O menu de usuário mantém o ícone, os tokens do Ludora e o seletor de tema. Sem sessão, apresenta benefícios, Entrar e Criar conta.
- Seguir exige login. A intenção é guardada por até 15 minutos, consumida uma única vez e retomada após autenticar. O endereço de retorno é restrito à própria aplicação. Convites têm prioridade.
- ADMIN, TECNICO e MESARIO entram na visão gerencial por padrão ao acessar um clube em que têm esse cargo. **Ver como visitante** continua disponível; essa escolha vale para aquele usuário e clube na sessão da aba e pode ser revertida em **Gerenciar clube**. Uma preferência antiga global de visitante não impõe esse modo a novos acessos. A permissão real permanece na API; o modo de navegação só controla a apresentação e quais consultas são utilizadas.

## Dados e compatibilidade

O cabeçalho da descoberta mostra somente a marca e o menu da conta, mesmo com um clube antigo salvo. Ao abrir um clube, sua identidade fica dentro do cabeçalho; a aba Clubes permite trocar, sem seta redundante no header público. Os links públicos aparecem na ordem Visão geral, Partidas, Campeonatos e Clubes, centralizados e sem sublinhado azul. No celular, a identidade do clube ocupa a linha superior e os links continuam na navegação inferior. Sino, perfil e Gerenciar clube usam controles de 44 px. A partida ao vivo ocupa a largura útil do mesmo container, respeitando os espaços laterais e a sidebar de gestão.

## Atualização das solicitações

A tela mantém os cards durante atualizações e oferece o botão Atualizar. Consulta novamente ao receber `solicitacao_partida`, reconectar, retornar à aba ou recuperar a conexão, com reconciliação a cada 15 segundos enquanto visível. Leituras não se sobrepõem e eventos recebidos durante uma consulta agendam outra leitura. Ao sair ou trocar de clube, a consulta anterior é cancelada. No backend, o mesmo evento é enviado aos dois clubes após a transação, antes de gravar as notificações individuais; contratos do mobile e desktop permanecem iguais.

Regressões: `apps/web/tests/request-updates-smoke.cjs` (320, 820 e 1366 px, transporte Socket.IO e HTTP simulados) e `services/api/tests/proposal-updates.test.cjs` (persistência simulada, emissão antes da gravação dos avisos). Esses testes não medem o tempo de resposta da infraestrutura publicada.

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

## Carrossel ao vivo e visão geral

- A seleção de clubes apresenta um carrossel de jogos ao vivo, após os clubes com cargo (quando houver) e antes dos seguidos. Prioriza partidas de clubes com cargo ou seguidos. Não aparece quando a lista está vazia, nem durante uma busca de clubes.
- `GET /publico/partidas/ao-vivo` consulta até 200 partidas oficiais em uma única lista, com status `AO_VIVO` e pelo menos um clube representado ou participante Ludora. Uma partida entre dois clubes não é repetida por participante. Equipes externas mantêm seu nome e escudo, quando disponível.
- O feed retorna apenas identificação da partida, times, escudos, categoria, data, horário, placar e IDs públicos dos clubes participantes. Não inclui jogadores, rascunhos ou auditoria.
- O namespace público aceita `{ descoberta: true }` e entra apenas em `publico:ao-vivo`. O evento `ao_vivo_alterado` contém somente `{ partida_id }` e provoca nova leitura. Há recuperação a cada 30 segundos com a aba visível, ao retornar à aba, reconectar o socket ou recuperar a rede. Isso não altera os canais autenticados de web, mobile e desktop.
- Cada card abre `/partidas/:id?clube_id=ID`: o clube participante é resolvido antes de carregar a página, preservando a permissão do usuário naquele clube. As setas aparecem apenas quando há overflow; no celular, a faixa usa rolagem horizontal nativa. Não há rotação automática.
- A visão geral mantém os resultados com adversário, placar e data; remove textos repetidos de agenda/destaques e deixa o histórico mais compacto. No desktop, os times e o placar ficam no mesmo grupo; no celular, os nomes ficam empilhados ao lado do placar. O mando permanece disponível junto do resultado quando a coluna própria é ocultada.
- Verificação adicional: builds API/web; `live-discovery.test.cjs`, `publico-realtime.test.cjs`, `publico.http.test.ts`; `live-discovery-smoke.cjs` (320, 390, 820 e 1366 px, overflow, teclado, atualização, vazio e navegação entre clubes); regressões `home-history-layout-smoke.cjs` e `public-access-smoke.cjs`. HTTP de navegador e persistência dos testes são simulados, sem alterar o banco. Capturas em `test-results/live-discovery/`, `test-results/public-access/` e `test-results/web-home/`.

Não exige migração nem variáveis novas. Publicar API e web para disponibilizar o carrossel em produção.
