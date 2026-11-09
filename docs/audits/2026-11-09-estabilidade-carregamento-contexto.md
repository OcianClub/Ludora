# Auditoria de estabilidade, carregamento e contexto — 09/11/2026

## Escopo e preservação

Auditoria no repositório `Ludora`, branch `develop`. O diretório indicado inicialmente em Downloads não existia; o checkout utilizado foi `E:\ESTUDO PROGRAMACAO\projetos\Ludora`.

As alterações que já estavam no checkout foram preservadas em um commit separado (`3afad36`), antes das correções desta auditoria. Não houve reset, force push, alteração de segredos, migração nem escrita em registros reais. As simulações de mutações usam fixtures e servidores locais de teste. Não executei importação ou sincronização da federação.

## Problemas e correções

### Carregamento e atualização

- O Suspense de rotas mostrava três linhas genéricas antes do skeleton próprio da página. Agora o fallback escolhe diretamente a estrutura da rota, inclusive perfis, históricos e URLs públicas de clubes. Competições públicas também usam o skeleton do Paulista.
- Skeletons de formulário, tabela, partida, perfil e Scout foram ajustados para a composição correspondente. O da Home respeita as diferenças de permissões e tamanhos de tela; as regras visuais necessárias ao fallback estão disponíveis antes do módulo da página.
- Times, jogadores, Scout e membros deixam de apagar conteúdo útil só por uma atualização estar em andamento. Erros de atualização preservam o que já foi carregado; o estado vazio não se sobrepõe ao erro.
- A agenda aguardava consultas opcionais de times e competições junto dos dados necessários. Agora partidas e categorias liberam a listagem; as opções de formulário chegam separadamente, com controle de versão.
- O painel do Paulista preserva o conteúdo numa atualização da mesma seleção. Ao trocar clube/categoria/divisão, a correspondência do painel continua sendo validada antes da exibição. Não alterei cálculos, regras das chaves, snapshots ou importador da federação.
- O carregamento inicial da preparação podia disputar com a consulta periódica. A sincronização periódica agora começa a aplicar atualizações depois da inicialização, com cancelamento ao sair e tentativa explícita em caso de erro inicial. Falha numa consulta auxiliar de times não impede abrir a partida.

### Conexão, sessão e integridade

- A espera pelo Render continua restrita a domínios `*.onrender.com`. Backend local não recebe o aviso de inicialização. Há estado de demora, prazo finito, erro e botão de reconexão; sem porcentagem ou previsão fictícia.
- Uma resposta real da API confirma a disponibilidade, mesmo se a sondagem de `/health` tiver falhado. Uma sondagem antiga não volta a colocar a conexão em erro depois dessa confirmação.
- A reconexão consulta a saúde do serviço; não repete gravações. O tratamento existente de timeout, rede, 401, 403, 429, resposta inválida e erro de servidor permanece distinto.
- A API web agora captura clube, sessão e modo de navegação **antes** de aguardar a conexão. Se mudarem durante a espera, a operação é cancelada antes do envio. A verificação posterior à resposta continua ativa.
- Rotas de trabalho são remontadas quando muda o clube, cargo ou conjunto de categorias permitidas, além da sessão/modo, para não reaproveitar formulários e estado do contexto anterior. O escopo do cache e a validação de respostas atrasadas também consideram essas permissões.
- Sessão expirada numa chamada autenticada preserva o destino para novo login e explica a expiração na tela de acesso.
- Listagens rejeitam resposta que não seja uma lista de objetos e removem esse resultado do cache, permitindo nova tentativa. Respostas 204/205 não tentam interpretar um JSON inexistente.
- Pendências preservam a última contagem válida em falhas transitórias. Uma alteração de jogador recebida enquanto a consulta está em andamento agenda nova leitura, em vez de se perder. Contagens inválidas de camisas são rejeitadas, sem virar totais falsos.

### Build e testes

- O build da API incluía um script diagnóstico independente que importa utilitários da interface. Esse script foi excluído do conjunto de compilação da API; continua disponível para execução separada. A aplicação de produção não precisa compilar código web nesse caminho.
- Um teste de competições tinha um mock de clube incompleto e tentava abrir conexão de banco. O mock foi completado.
- Roteiros afetados foram atualizados para os comportamentos atuais: acesso público após logout, exibição de e-mail dos membros, edição de camisa em linha, exigência de goleiro e bloqueio de rolagem no elemento raiz.

## Mapa de fluxos e cobertura

| Área | Verificação realizada |
| --- | --- |
| Login, cadastro, recuperação e convite | Validação, falha/repetição controlada, código inválido/expirado, normalização de e-mail, um envio e retomada de convite; 17 cenários de navegador. |
| Clube público, gestor e torcedor | Acesso sem conta, seguir exige login, retomada após login, seleção de clube, navegação pública/gerencial, sidebar expandida/recolhida e ausência de ações gerenciais para torcedor. |
| Navegação e sessão | URL direta, menu, reload, voltar/avançar, nova aba, logout e troca de conta entre abas; resposta antiga não substitui o perfil novo. |
| Visão geral | Skeleton responsivo, margens, redução de movimento, transição para conteúdo e estrutura do histórico em cinco larguras/perfis. Pendências e datas também cobertas por testes automatizados. |
| Times e jogadores | Seções próprias/vinculadas, acordeão externo por teclado, diretório e edição de camisas. Sincronização entre Jogadores e preparação em abas distintas com Socket.IO local simulado. |
| Pessoas e acessos | Filtros, ordenação, foco, cargos/ícones, modal de acesso e cancelamento de convite em oito combinações de largura e tema. Backend: escopo por clube, privilégios e acesso público nos testes HTTP. |
| Agenda e propostas | Criação/revisão, validações, falha e recuperação, resposta à proposta e disposição dos modais. Testes de API cobrem participantes, convite, aceite, recusa, sugestão, autorização e listagem compartilhada. |
| Preparação | Etapas, rascunho/retomada, número de titulares, goleiro, reservas, camisa, confirmação e início explícito em oito combinações de largura/tema. |
| Camisas entre páginas | Alteração propaga, titular/reserva sem camisa sai da convocação, rascunho é preservado, reconexão e número histórico de partida finalizada não muda. Testes de backend cobrem restrições de partida ao vivo e conflito de numeração. |
| Ao vivo e pós-jogo | Eventos rejeitados, confirmação perdida, fila, gol/assistência e desfazer, sincronização, autorização e estado finalizado; 360 e 1180 px. |
| Scout e ficha | Consulta contextual e testes de recortes, perfis e estatísticas. Não foi utilizado serviço real de ML nessas simulações. |
| Competições | Painel, filtros e modais com respostas controladas; seleção e regras de classificação/chaveamento cobertas pela suíte de testes. Nenhum dado oficial foi sobrescrito. |
| Perfil/conta | Modais e confirmação de saída/exclusão, permissões e navegação após encerramento de sessão em seis larguras/temas. |
| Mobile, desktop e ML | Compatibilidade por análise TypeScript/testes de regras, build do desktop e testes Python. Não representa teste manual nativo completo. |

## Resultados executados

- **575 testes** de API, web e utilitários mobile: **575 passaram, zero falhas ou testes ignorados** na rodada final. Incluem datas, autorização, eventos, propostas, camisas, isolamento, cache, validação e regras do Paulista.
- **4 testes** de regras desktop: passaram.
- **12 testes Python** do ML: passaram.
- TypeScript: web, API, mobile e ambos os projetos desktop passaram.
- Builds de produção: web, API e desktop passaram. Não foi gerado instalador nem APK.
- `git diff --check`: sem erros de whitespace.
- Navegador, respostas controladas: `loading-connection-audit`, `home-skeleton-smoke`, `auth-flow-smoke`, `session-isolation-smoke`, `public-access-smoke`, `account-actions-smoke`, `player-directory-smoke`, `members-refinements-smoke`, `schedule-create-smoke`, `proposal-response-smoke`, `match-preparation-smoke`, `shirt-cross-page-smoke`, `match-audit-smoke`, `scout-context-smoke`, `modal-scroll-regression` e `paulista-audit-smoke` passaram.

Os logs e capturas locais ficam em `test-results/` (ignorado pelo Git). Os cenários de navegador variam de 320 a 1920 px; não significa que todas as combinações possíveis de página, dispositivo e largura foram testadas.

### Evidências de comportamento e desempenho

- Com as respostas auxiliares de times e competições deliberadamente retidas, a agenda já ficou utilizável em 360 e 1366 px. Antes, sua conclusão era condição para liberar a listagem.
- Trocar de clube durante a conexão pendente produziu `AbortError` e **zero POSTs enviados** no cenário isolado.
- Lista malformada foi rejeitada; a segunda consulta fez nova leitura e retornou a lista correta, em vez de reutilizar o cache inválido.
- No Paulista, abrir/fechar modais manteve **uma leitura de painel** e **zero cálculos de resumo ao editar o rascunho de filtros**. Posição de rolagem permaneceu exatamente igual antes, durante e depois dos modais: 8282 px no cenário mobile e 2906 px no desktop.
- Na partida ao vivo, a contagem do aviso de cancelamento provocou **zero renderizações adicionais do quadro da partida durante três segundos**, nas duas larguras testadas. É confirmação de preservação desse comportamento, não ganho novo atribuído à auditoria.

## Limitações e atenção

- Sem medição de latência real no Render/Supabase, carga concorrente em produção ou cold start real. Não atribuo toda demora ao plano gratuito nem afirmo redução medida em milissegundos no ambiente publicado.
- Banco real, e-mail, notificações push do aparelho, instalação de APK/Electron e sincronização real da federação não foram acionados. Testes de integração que exigem banco real não foram executados.
- Os roteiros históricos `navigation-smoke.cjs` e `player-states-smoke.cjs` ainda contêm expectativas de interfaces removidas (card “Momento da categoria” e agrupamento inicial de todos os SUBs). Essas execuções não passaram e não são contabilizadas como validação. Navegação atual e diretório foram verificados pelos roteiros atuais citados acima; a manutenção completa dos roteiros históricos permanece pendente.
- O comando via Corepack deste computador falhou na verificação de assinatura. Não desativei essa proteção: executei as ferramentas já instaladas diretamente. A instalação limpa de dependências em CI não foi simulada.

## Integração

O remoto `origin/develop` foi buscado antes e depois das correções. A comparação não encontrou commits novos remotos naquele momento (`845a68e`). As alterações anteriores e a auditoria foram mantidas em commits separados. O resultado do pull e do push é confirmado na entrega da tarefa; não houve force push.
