# Relatório de otimização do Ludora

## O que mudou

| Etapa | Gargalo | Mudança |
| --- | --- | --- |
| 1. Torneios no app | A tela baixava publicações completas de várias categorias para abrir uma delas. | O primeiro acesso traz o catálogo e a publicação inicial em uma resposta. As demais categorias são carregadas sob demanda e até três publicações ficam em cache por clube. As abas da categoria reutilizam a mesma publicação e os dados já calculados. |
| 2. Início no app | A atualização das notificações disparava consultas da Home mesmo sem mudanças relevantes. | A Home agrupa eventos próximos e reconsulta apenas os dados afetados. Reconexão, retorno ao app e atualização manual continuam acionando a conferência dos dados. |
| 3. Agenda web | O histórico inteiro e as opções de criação eram consultados na abertura. | A API filtra, conta e entrega páginas de até 12 partidas por grupo da categoria exibida. A busca ignora acentos e sinaliza resultados nos outros SUBs. Times e competições são buscados quando necessários para organizar a partida. Uma revisão por grupo invalida páginas anteriores quando os jogos do grupo mudam. |
| 4. Partida ao vivo no web e app | Lances confirmados disparavam outra leitura completa. As notificações de gol e resultado entravam no caminho da resposta. | A confirmação aplica os dados do lance quando a versão da súmula confere. Conflitos, correções e alterações mais complexas continuam usando uma leitura completa. A API persiste o aviso junto com a operação e distribui depois. O reenvio e os trabalhadores concorrentes foram verificados no banco. |
| 5. Desktop e backend | Seções aguardavam a resposta mais lenta. O console montava todo o histórico. Consultas e recálculos faziam trabalho repetido. | Visão global, Banco e Paulista carregam trechos em paralelo. O desktop agrupa a entrega dos Logs e renderiza a área visível. A seleção de clubes usa uma resposta enxuta e cada requisição administrativa valida a identidade em uma consulta. O Scout recalcula as categorias afetadas no encerramento, evita regravar resultados idênticos e mantém o recálculo completo para correções. A classificação Paulista reaproveita resultados por versão e o banco ganhou três índices de estatísticas. |

## Ganhos verificados

| Cenário | Antes → depois | Como interpretar |
| --- | --- | --- |
| Primeira abertura de Torneios | 814.428 → 97.441 bytes estimados, **−88,0%** | O volume novo foi calculado com o catálogo e a primeira publicação de uma amostra real de um clube, com oito publicações e 2.449 jogos. Tamanho do JSON descomprimido. As outras publicações são baixadas ao selecionar a categoria. |
| Partida ao vivo com conexão estável | Consulta completa periódica a cada 12 s no app ou 15 s no web → a cada 60 s | **−80%** no app e **−75%** no web nas consultas periódicas. Atualizações por evento continuam acontecendo. |
| Publicação de lance compatível | Três chamadas → duas, **−33%** | Contagem de chamadas no fluxo com confirmação incremental, mantendo a conferência anterior ao envio. |
| Console de Logs | 1.000 registros no histórico, **16 a 26 linhas montadas** | Medição no navegador em 640, 900 e 1.440 px, no modo de linha única. Os 1.000 registros foram mantidos na exportação. A opção de quebrar linhas mantém a renderização integral para acomodar alturas variáveis. |
| Consultas de estatísticas no PostgreSQL | Eventos 6,830 → 0,185 ms. Escalações 3,617 → 0,088 ms. Participantes 1,089 → 0,080 ms. | Consultas isoladas com dados sintéticos e análise do plano de execução. O tempo da aplicação completa depende do volume real, da rede e dos serviços. |

## Validação

- **657 testes automatizados** do app, web e API passaram, além de **17 testes do desktop**. Os builds de web e desktop foram aprovados, assim como a checagem TypeScript do mobile.
- A integração com PostgreSQL local isolado aplicou as duas migrações e cobriu permissões administrativas, busca sem acento, contagem e paginação da agenda, mudança de revisão, reenvio de lances e distribuição concorrente de avisos. O teste de ocorrências do suporte identificou perda sob concorrência. As transações passaram a espaçar as tentativas de gravação em caso de conflito e o teste passou na repetição.
- Os testes de interface web cobriram a agenda em quatro larguras, a organização de partida em duas larguras nos dois temas e os fluxos de súmula em duas larguras. Os testes mobile renderizaram os componentes reais em React Native Web, com rede e módulos do aparelho simulados. Foram 12 cenários de Torneios e dois tamanhos de tela na sincronização da partida.
- No desktop, a suíte de operações administrativas passou em 1.440 px. Filtros, pausa, exportação e preservação da rolagem dos Logs foram conferidos em três larguras.

## Publicação e limites

A versão nova deve entrar na ordem **migrações do banco → API → web, desktop e APK**. A fila precisa da tabela nova e a agenda web e o catálogo do app dependem dos formatos novos da API. O aviso fica persistido no sistema. O envio de push continua dependente do provedor e do aparelho.

As medições são locais. O tempo de resposta em produção, o push físico e a sensação de uso em aparelhos Android ainda precisam de verificação em execução real. O trabalho ficou na cópia local de `develop`.
