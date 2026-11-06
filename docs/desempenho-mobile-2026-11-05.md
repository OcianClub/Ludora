# Auditoria de desempenho do mobile — 05/11/2026

Base comparada: commit `58d3d54`. Alterações restritas a `apps/mobile`; nenhuma biblioteca nova, alteração de banco, contrato HTTP, regra de permissão ou arquivo compartilhado com web/desktop.

## Achados e correções

- **Pacote de fontes:** os imports dos índices de Inter e Oswald faziam o Metro incluir 24 arquivos de fonte, embora a interface use seis. Imports diretos preservam as seis variantes e a aparência.
- **Carrossel de categorias:** montava as quatro árvores de conteúdo na abertura (cada uma com sua lista/cartões/imagens). Agora monta a página inicial e a vizinha; prepara os vizinhos das próximas páginas e conserva as páginas visitadas, inclusive estado e rolagem. A animação continua na thread de UI via Reanimated; não foram alterados mola, distância entre páginas ou reconhecimento do gesto.
- **Clubes:** ScrollView com todos os clubes mapeados virou SectionList com janela de renderização. Mantidos ordem das seções, busca local, escudos/iniciais, seguir/deixar de seguir, permissões e estados vazios/erro. Cartões e escudos foram memoizados com callbacks estáveis. Não foi imposto getItemLayout porque as alturas variam com os dados e a escala de fonte.
- **Súmula:** cada jogador filtrava todos os eventos e depois cada tipo de evento em todo render. Agora há um índice calculado uma vez quando eventos/recorte mudam. Descrições da auditoria também usam índices compartilhados e são calculadas uma vez, em vez de até três vezes por linha. Mensagem de compartilhamento e pendências deixam de ser recalculadas por interações sem relação com os dados. Preservados gols contra, recorte por tempo, ausência de autor e privacidade do compartilhamento.
- **Armazenamento seguro:** a API consultava token e clube mesmo quando os cabeçalhos já os informavam. Agora só lê os valores ausentes. Não há novo cache de credenciais; trocar a conta/clube continua produzindo cabeçalhos novos.
- **Segundo plano:** polling de Jogos/resumo de solicitações, relógio da lista e atualizações de avisos não provocam consultas/renderizações em segundo plano. Retomar o app mantém a revalidação existente. Não foram removidos eventos de socket nem notificações push.
- **Loadings:** a pulsação dos skeletons continua nativa e visualmente igual, mas deixa de registrar uma interação contínua que pode adiar trabalho agendado após interações.

Também foram revisados os mecanismos já existentes: paginação de Jogos, limite de montagem do elenco na preparação, FlatList no Scout/notificações, memoização dos gráficos, cache curto com invalidação após escritas/socket, cópia local com escopo de conta/clube e descarte de respostas antigas. Foram preservados. A rota de gestão já limita auditoria a 40 registros e protege rascunhos da outra equipe.

## Evidência antes/depois

Medições em Windows/Node 22. As comparações de interface usaram os componentes reais em React Native Web/Chrome, com API e integrações nativas simuladas. **Não são medidas de FPS/Hermes num telefone.**

| Verificação | Antes | Depois |
| --- | ---: | ---: |
| Fontes no export Android de produção | 24 | 6 |
| Bytes dos arquivos de fonte | 6.742.324 | 1.291.728 |
| Bytes de todos os assets do export | 6.802.436 | 1.351.840 |
| Bytes do bundle Hermes exportado | 5.539.773 | 5.523.123 |
| Páginas montadas na abertura do carrossel de quatro subs | 4 | 2 |
| Cartões montados após estabilização inicial, fixture de 250 clubes/360 px | 250 | 23 |
| Leituras SecureStore em dez GETs simultâneos com clube explícito | 20 | 10 |
| Leituras SecureStore em dez GETs com autorização e clube explícitos | 20 | 0 |
| Envios HTTP para os dez GETs idênticos simultâneos | 1 | 1 |

Redução de assets de fonte: 5.450.596 bytes (aproximadamente 80,8%). Isso mede tamanho do export, **não** tempo de abertura/instalação nem RAM. A quantidade de cartões virtualizados varia com altura da tela e conteúdo. Todas as 250 opções continuaram disponíveis pela busca; seguir funcionou sem nova consulta de catálogo.

Benchmark local do cálculo das estatísticas para 20 atletas, mediana de nove rodadas de 500 execuções após aquecimento, com igualdade dos resultados verificada em todos os tempos:

| Eventos | Antes, ms/execução | Depois, ms/execução |
| --- | ---: | ---: |
| 80 | 0,01636 | 0,00515 |
| 400 | 0,02841 | 0,01525 |
| 1.600 | 0,06458 | 0,04914 |

São valores pequenos de CPU em Node; não explicam sozinhos uma espera de vários segundos e não devem ser extrapolados para o celular. A memoização adicional evita até esse cálculo quando apenas um diálogo/busca muda.

Para repetir o benchmark na raiz:

```powershell
pnpm --filter @ludora/api exec tsx ../../apps/mobile/tests/mobilePerformance.bench.ts
```

## Testes realizados

- 178 testes automatizados do mobile passaram, incluindo consultas/cache, troca de sessão/clube, paginação, filtros, preparação, conflito de camisas, gestos, fila de publicação/cancelamento, gols contra, estatísticas e resumo pós-jogo.
- TypeScript do mobile e export Android de produção passaram.
- Interface em 320, 360, 412 e 768 px: Home, notificações com filtros locais, Clubes/busca/seguir e cartão de jogo; sem overflow horizontal nas verificações.
- Súmula: histórico com evento nomeado, adversário externo com nome, metadados, visitante sem operação; substituição por arraste e encerramento com alturas de 560 e 850 px; cenários pós-jogo e outro clube/tema claro.
- Scout: reutilização do JSON, cancelamento isolado, escopo da sessão, descarte ao trocar conta e retorno ao contexto em cache sem nova consulta.
- Carrossel com worklets simulados: abertura monta duas páginas; navegação pelos quatro índices e retorno conservam estado da primeira página sem remontá-la. Isso valida o ciclo de montagem, não o gesto nativo.
- Harness da API com SecureStore/transporte simulados: as contagens acima, uma resposta independente por consumidor e novos cabeçalhos após troca da sessão/clube.

Os harnesses locais e imagens estão em `%TEMP%/ludora-sumula-qa`, `%TEMP%/ludora-pager-audit` e `%TEMP%/ludora-mobile-network-audit`. Exports comparados: `%TEMP%/ludora-mobile-audit-before` e `...-final` (também preservado `...-after`). O benchmark e os novos testes unitários estão no repositório.

## Rede, servidor e diagnóstico

Tentativas anônimas de `/health` de API e ML publicados expiraram após 25 s, sem corpo/código HTTP. Não houve consulta autenticada nem acesso ao banco de produção. Esse resultado não separa bloqueio de rede, indisponibilidade e despertar do serviço; não atribuí a demora ao backend sem medição.

Para diagnosticar no aparelho, adicionar temporariamente a `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_DEBUG_PERF=1
```

Reiniciar Metro. Em desenvolvimento, os logs `[desempenho]` passam a distinguir:

- `http:transporte`: apenas envios físicos, exclui acertos do cache e espera por leitura de credenciais. Inclui rede e servidor até a resposta do fetch; não é tempo puro de rede.
- `servidor:<métrica>`: duração enviada em Server-Timing, quando a rota a fornece (o Scout já fornece métricas). Não inclui descrições desse cabeçalho.
- `http:<recurso>` com `credenciaisMs`: custo total do cliente até obter a resposta e parcela de leitura de credenciais. Pode representar cache ou compartilhamento de consulta.
- `json:home`, `json:agenda`, `json:partida`: leitura do corpo e parse do JSON, podendo incluir bytes ainda pendentes do transporte. Não deve ser confundida com renderização.
- marcadores de tela já existentes: dados prontos no cliente; também não equivalem ao frame desenhado no aparelho.

Os logs não registram token, cabeçalhos de autenticação, corpo ou URL completa e ficam desativados em produção. Remover a flag após medir para evitar ruído no console.

## Limites e próxima medição

Nenhum dispositivo estava conectado ao ADB. Ainda precisa de validação nativa em build release no aparelho do usuário: FPS/frames longos, memória após alternar subs/telas, teclado e arraste durante rolagem. As mudanças reduzem trabalho verificável, mas **não há medição que permita prometer uma redução de latência total ou afirmar ausência de travamentos no celular**.

A API de clubes ainda devolve o catálogo inteiro; virtualização reduz montagem, não os bytes recebidos. Se o catálogo crescer muito, paginação de servidor exige contrato compatível com os outros clientes. A súmula ainda recebe o conjunto dos eventos necessário ao placar/estatísticas, e conexões de socket por contexto/tela continuam separadas. Não foram consolidadas por envolver autorização, inscrição em salas e sincronização entre clubes; medir antes de uma mudança mais invasiva. Esperas do servidor/ML permanecem dependentes da infraestrutura e das consultas reais.
