# Propostas e disponibilidade das partidas nos dois clubes

## Falhas corrigidas

- A resposta autenticada trocava `categoria` pela categoria do participante atual, mas conservava `categoria_id` do organizador. Os filtros recebiam duas referências incompatíveis para a mesma partida. Agora ambos apontam para a categoria local; o ID da partida e o organizador continuam os mesmos.
- O filtro por categoria comparava apenas a faixa etária do organizador. Agora utiliza o vínculo `ParticipantePartida` e a categoria do clube que consulta. Partidas antigas sem esse vínculo mantêm uma alternativa por nome/faixa e tipo, sempre dentro do escopo do clube.
- O vínculo de participante passou a fazer parte explícita do escopo de leitura, inclusive na Home e na agenda compartilhada com o aplicativo. A Home também devolve a categoria local. O mando considera o time do participante.
- A página escolhia automaticamente “Ao vivo” quando existia um jogo em andamento, escondendo partidas recém-aceitas em “Próximas”. O padrão passa a ser “Todos”; escolhas explícitas de situação, sub, período, mando e organizador continuam sendo respeitadas.
- A agenda gerencial não acompanhava o aviso privado de aceite/atualização. Agora invalida o cache e consulta novamente nesses avisos, na reconexão, ao voltar à janela e ao recuperar a rede. Avisos durante uma consulta geram uma reconciliação posterior; falhas temporárias não apagam a lista já carregada.
- Recusar/cancelar uma proposta de alteração podia anunciar o confronto como confirmado. Apenas o aceite publica essa confirmação. A transmissão do jogo aceito ocorre antes do processamento dos avisos da proposta; uma falha posterior de transmissão não devolve erro de criação após o commit.
- Solicitações eram limitadas a 100 antes de aplicar o escopo do técnico. O filtro de categorias passou para a consulta, antes do limite.
- Uma resposta com versão desatualizada fecha a confirmação e atualiza a solicitação, exigindo nova revisão. Os textos distinguem aceite de confronto, transferência de súmula e autorização de correção.
- IDs/situações inválidos nos filtros autenticados são rejeitados de forma controlada; a ordenação inclui data, horário e ID para desempate estável.

## Comportamento preservado

O convite entre clubes Ludora fica pendente até o aceite. O aceite cria **uma única partida**, com os dois participantes e suas respectivas categorias, sem criar uma cópia por clube. Recusa e cancelamento da criação não geram jogo. Sugestões alternam o respondente e incrementam a versão da proposta.

A visibilidade na agenda não concede controle da súmula. Técnico/mesário precisam de acesso à categoria local; cada clube prepara sua equipe; os controles da súmula continuam exclusivos do responsável. Visitantes continuam sem escrita e sem acesso aos rascunhos adversários. Contra adversário sem cadastro, a criação continua direta e só existe um participante Ludora.

## Validação

Testes executam os handlers e consultas com persistência em memória, conexões Socket.IO locais e HTTP simulado no navegador. Não alteram partidas de usuários nem conectam ao banco de produção.

- `services/api/tests/shared-schedule.test.ts`: convite, duplicidade pendente, sugestão, aceite, versão antiga, recusa, cancelamento, adversário externo, categorias com IDs/faixas diferentes, cinco estados, escopo dos técnicos e filtros inválidos.
- Regressões de preparação, eventos ao vivo/pós-jogo, leitura pública, filtros, Home e permissões.
- `services/api/tests/web-realtime.test.mjs`: conexão real Socket.IO, atualização da agenda por proposta/partida, isolamento de sala e encerramento da assinatura.
- `apps/web/tests/shared-schedule-smoke.cjs`: duas sessões Ocian/Santos, 360 e 1180 px; aceite seguido das duas agendas, invalidação do cache, situações, mando e filtro de organizador.
- `apps/web/tests/proposal-response-smoke.cjs`: apresentação e respostas, incluindo conflito de versão, em cinco larguras/temas.
- `apps/web/tests/schedule-create-smoke.cjs`: criação/revisão/validação em celular e desktop, claro/escuro.

Para repetir as suítes da API, usar sempre `tsx --require ./tests/setup.cjs --test ...` em `services/api`. O setup substitui credenciais e desativa integrações externas.

Resultado desta execução: **65 testes da API passaram**, verificações de navegador passaram nas **13 combinações de largura/tema** das três suítes citadas (duas delas com duas sessões simultâneas), e os builds da API e do web concluíram sem erros.

## Aplicação e limites

Estas correções não precisam de migração ou recriação dos jogos. Reiniciar a API e atualizar o web localmente; nos serviços publicados, fazer deploy da API e do web. A correção de leitura vale para partidas já gravadas com participantes.

Os testes não medem a latência do Render/Supabase nem substituem a conferência de uma partida real após o deploy. Se um registro antigo estiver sem o vínculo do adversário e sem identificação do clube no time, será necessário diagnosticar esse registro separadamente; esta auditoria não reescreve vínculos históricos por suposição.
