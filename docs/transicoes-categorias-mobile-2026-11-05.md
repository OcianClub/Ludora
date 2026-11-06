# Fluidez de categorias e subs no mobile — 05/11/2026

## Componente e configuração

A troca nas telas Home, Jogos e Scout é implementada em `apps/mobile/src/components/CategoryPager.tsx`. Usa `react-native-gesture-handler ~2.28.0` para o gesto e `react-native-reanimated ~4.1.7` para o progresso compartilhado e a mola. `CarrosselSubs` acompanha esse mesmo progresso. `react-native-pager-view 6.9.1` está instalado e é usado como alternativa no laboratório `/dev/category-lab`; não controla essas três telas em produção.

Foram mantidos reconhecimento horizontal/vertical, distância de ativação, velocidade, cancelamento, mola e limite de um sub por gesto. Nenhuma biblioteca, configuração nativa, endpoint, permissão ou contrato compartilhado foi alterado.

## Custos encontrados e mudanças

- O hook `useCategoryPagerMotion` gravava o destino em estado React e só começava a mola num efeito após a renderização da tela. Agora inicia diretamente pelo ref do pager, com trabalho da animação na UI.
- O seletor tinha apenas quatro itens, mas usava uma FlatList desabilitada para toque e `scrollTo` em cada atualização do progresso. Agora uma View animada desloca esses quatro itens, com a mesma geometria, sincronização e gestos. Não há eventos de scroll ou lista virtualizada nesse controle.
- `CategoryPageMotion` aplicava escala e opacidade à árvore de cada página. O slide ficou a cargo de uma única transformação do pager, sem os efeitos extras de zoom sobre listas inteiras.
- Objetos de gesto e callbacks do pager agora são estáveis. O callback mais recente é consultado ao concluir, sem reinstalar o gesto por mudança de seleção.
- Home, Jogos e Scout preservam os elementos das páginas quando só o índice selecionado muda. Dados, filtros, permissões e atualizações continuam invalidando essa memoização. Em Jogos, as contagens dos cabeçalhos pertencem ao sub de cada página.
- Mudar Iniciação/Base reinicia a janela de páginas no grupo novo e cancela a mola anterior. Callbacks de um pager desmontado não alteram a seleção nova. As páginas já visitadas preservam estado/rolagem dentro do grupo.
- Toques que pulam para um sub distante preparam as páginas do caminho antes de animar; os vizinhos continuam preparados para o arraste. Isso evita um slide por conteúdo ainda não montado.

As três telas já carregam os dados das categorias no conjunto da consulta. Trocar categoria/sub não exige uma nova chamada à API; modificar o backend não era necessário para esses custos de transição.

As decisões de usar transformações, memoizar gestos e evitar trabalho desnecessário por frame acompanham as [orientações oficiais do Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/). Não foram ativadas flags experimentais que alteram detecção de toque nem atualizadas versões nativas fora do conjunto atual do Expo.

## Comparação e testes

Baseline: arquivos presentes no começo desta tarefa, preservados em `%TEMP%/ludora-category-fluidity-before`. O comparador usa React Native Web/Chrome com worklets/gestos simulados; mede chamadas/renderizações, não FPS nativo.

| Custo no teste controlado | Antes | Depois |
| --- | ---: | ---: |
| Renderizações extras da tela antes de começar a mola para o vizinho | 1 | 0 |
| Comandos de scroll do filtro para 60 mudanças de progresso | 60 | 0 |
| Renderizações extras do conteúdo do Scout após selecionar outro índice | 1 | 0 |
| Novas consultas ao alternar Iniciação/Base na fixture do Scout | 0 | 0 |

Também foram verificados gesto curto, velocidade, cancelamento, arraste do seletor, salto distante com destino montado, conservação de estado ao retornar e troca de grupo durante uma mola pendente. Home e Jogos passaram em 320, 360, 412 e 768 px; em Jogos, contagens por sub, filtros e mudança de fase; em Home, navegação e ausência de pendências para visitante. Scout passou nos fluxos de filtros, ordenação, empate e ficha.

TypeScript, os 178 testes automatizados do mobile e a exportação Android de produção passaram. Scripts locais: `%TEMP%/ludora-category-fluidity.cjs`, `%TEMP%/ludora-sumula-qa/verify-category-scout.cjs`, `verify-category-games.cjs` e `verify-category-home.cjs`. Resultados: `%TEMP%/ludora-category-fluidity/results.json`. Export: `%TEMP%/ludora-category-fluid-export-20261105`.

## Medição no telefone

Não havia aparelho conectado ao ADB. Não foi possível medir FPS ou confirmar a cadência no dispositivo do usuário. O export valida empacotamento, não a execução nativa dos gestos.

Com `EXPO_PUBLIC_DEBUG_PERF=1` no `.env` do mobile e Metro reiniciado, o pager registra `[desempenho]` com etapa `categorias:cadencia-ui` após transições. O registro contém quantidade de callbacks de frame, intervalo médio/máximo e quantidade acima de 33,4 ms. Mede a cadência dos callbacks da UI, não frames efetivamente apresentados pela GPU. A coleta fica inativa sem a flag e em produção. Os logs HTTP existentes ajudam a separar esse custo da rede ao abrir/revalidar uma tela.

Ainda é necessária a comparação em aparelho real, incluindo build de produção, onde as otimizações de compilação diferem do development client. Não há promessa de 60 FPS baseada nestes testes.
