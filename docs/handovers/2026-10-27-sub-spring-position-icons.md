# Handover — spring dos SUBs e ícones de posições

Branch: `develop`. Sem criação de branch e sem commit. As alterações locais anteriores foram preservadas.

## Estado da entrega

**Ícones implementados e validados no navegador e no Android. Navegação mobile implementada e validada no laboratório nativo com os componentes reais.**

O teste usou Pixel_7, Android, Expo Go 54.0.8 e o laboratório de desenvolvimento sem conta real. Foram verificados swipe lento/rápido, retorno curto, cancelamento com deslocamento visível, limites, clique no SUB, botões e scroll vertical, nos dois temas. Há capturas durante o arraste e após o encaixe. Os fluxos de negócio de clubes reais não foram exercitados no laboratório; iOS e aparelho físico permanecem fora desta validação.

A inicialização do Expo Go falhou inicialmente. A verificação automática rejeitou comandos de reinício/interação sem justificativa específica; o reinício forçado não foi executado. O acesso foi recuperado ao servir o Metro pelo endereço Wi-Fi da máquina, em vez do endereço de localhost/VPN. Isso permitiu concluir os testes sem aquela ação.

## Decisão sobre o PagerView

A integração existente com `onPageScroll`/Reanimated foi inspecionada e mantida como comparação no laboratório de desenvolvimento. A API da versão instalada oferece `setPage`, `setPageWithoutAnimation` e habilitação de scroll. Ela não oferece uma posição fracionária controlável nem parâmetros para substituir a física nativa de soltura por nosso spring.

Por esse limite, a navegação dos SUBs passou a usar `CategoryPager`, um componente específico com Gesture Handler e Reanimated. O PagerView não foi removido das dependências: continua disponível no comparador nativo do laboratório. Primeiro foi verificado um swipe com PagerView/onPageScroll no emulador; depois foram executados os cenários completos do spring.

## Fluxo da animação

1. `Gesture.Pan` só assume o gesto depois de movimento horizontal claro e falha cedo quando o movimento é vertical.
2. `progress` é um `SharedValue` em unidades de página: 0, 0,5, 1 etc. Durante o arraste, ele é atualizado no thread de UI.
3. O track usa `translateX = -progress × largura`. Cada página usa esse mesmo sinal para escala e opacidade: saída até 0,92; entrada desde 0,86.
4. A soltura projeta o destino usando posição e velocidade. Um gesto curto/lento volta; distância ou velocidade suficientes avançam. O destino é limitado ao primeiro/último SUB.
5. `withSpring` finaliza o próprio progresso, com velocidade inicial e sem deixar o conteúdo entre páginas. Escala e opacidade acompanham o progresso; não recebem uma segunda animação atrasada.
6. Só ao terminar é comunicado o índice ao React. Cliques também pedem um spring. Repetir o mesmo destino após interromper uma animação cria uma nova solicitação, evitando uma posição fracionária presa.
7. A `Animated.FlatList` superior usa `scrollTo` e o mesmo progresso para centralização e destaque. Seu gesto também passou a usar Gesture Handler.

As quatro páginas permanecem montadas; as listas internas continuam virtualizadas. Isso preserva o scroll de cada SUB e evita lacunas em saltos ou gestos interrompidos, ao custo de manter até quatro páginas montadas. Movimento reduzido continua respeitado.

## Ícones

`packages/design-tokens/src/positions.ts` guarda os nomes, aliases, caminhos e tokens. Não contém React ou dependências de plataforma. Cada renderizador usa essa mesma definição.

| Posição | Desenho | Token |
|---|---|---|
| Goleiro | Gol, bola e linha de defesa | `amarelo` |
| Fixo | Escudo com marca tática | `primaria` |
| Ala/Alas | Setas curvas laterais | `ciano` |
| Pivô | Alvo, bola e indicação ofensiva | `laranja` |

Os SVGs têm área de 24 × 24, desenho interno próximo de 16 px, traço 1,6 e terminações arredondadas. Não há emoji, fundo ou borda no componente. Os botões de seleção existentes continuam sendo botões, com seus estilos próprios.

No web, hover e foco abrem tooltip. O tooltip também foi corrigido para continuar funcionando quando o navegador rola automaticamente até o elemento focado. No mobile, `PositionIcon` fornece descrição acessível; `PositionLabel` mantém o nome quando necessário.

Aplicado a lista, cadastro/edição, perfil, scout, escalação, preparação e seleção de jogadores em detalhes de partida. O antigo `PositionGlyph` com luvas foi retirado.

## Arquivos desta etapa

| Arquivo ou grupo | Responsabilidade |
|---|---|
| `packages/design-tokens/src/positions.ts`, `colors.ts`, `index.ts` | Definições compartilhadas e tokens ciano/laranja nos dois temas. |
| `apps/web/src/styles/theme.ts` | Disponibiliza os tokens como variáveis CSS. |
| `apps/web/src/components/PositionIcon.tsx` | Renderizador SVG do web com tooltip. |
| `apps/mobile/src/components/PositionIcon.tsx` | Renderizador com react-native-svg e rótulo acessível. |
| `apps/web/src/components/CollectionControls.tsx` | Posições usam o novo componente. |
| `apps/web/src/components/Tooltip.tsx`, `.css` | Acessibilidade por foco, reposicionamento após scroll e remoção do desenho antigo. |
| `apps/web/src/pages/Jogadores.tsx`, `.css`, `components/PlayerEditDialog.tsx` | Retira redução desigual do ícone e mantém tooltip nos seletores. |
| `apps/web/src/pages/Elenco.tsx`, `pages/PartidaDetalhe.tsx`, `components/ScoutPlayerDetail.tsx` | Ícones no scout e escalação. |
| `apps/mobile/src/components/CategoryPager.tsx` | Track, Pan Gesture, limites e spring do conteúdo. |
| `apps/mobile/src/components/CategoryPageMotion.tsx` | Escala/opacidade vinculadas diretamente ao progresso. |
| `apps/mobile/src/hooks/useCategoryPagerMotion.ts` | Pedidos por clique, velocidade e confirmação final. |
| `apps/mobile/src/components/CarrosselSubs.tsx` | FlatList e gesto superior sincronizados. |
| `apps/mobile/src/utils/categoryMotion.ts` | Regras puras de destino por posição/velocidade. |
| `apps/mobile/app/(tabs)/index.tsx`, `jogos/jogos.tsx`, `estatisticas/estatisticas.tsx` | Integração em Home, Jogos e Scout. |
| `apps/mobile/app/_layout.tsx` | GestureHandlerRootView na raiz. |
| `apps/mobile/src/components/EscalacaoPartida.tsx`, `DetalhesPartida.tsx`, `PrepararPartida.tsx` | Posições com a mesma família de ícones. |
| `apps/mobile/app/dev/category-lab.tsx` | Comparador com dados falsos e sem acesso ao banco; inacessível em produção. |
| `apps/mobile/package.json`, `pnpm-lock.yaml` | Gesture Handler 2.28, escolhido pelo instalador compatível com Expo SDK 54. |
| `apps/mobile/tests/categoryMotion.test.ts` | Distância, velocidade, retorno e limites. |
| `apps/mobile/tests/category-pager-device.py` | Teste nativo reproduzível no laboratório Pixel_7: gestos, cancelamento, navegação, botões e scroll. |
| `apps/web/tests/positionIcons.test.mjs` | Aliases, desenhos distintos e disponibilidade dos tokens. |
| `apps/web/tests/position-icons-smoke.cjs` | Dimensões reais, transparência, cores, tooltip e capturas no navegador. |

## Antes e depois

Antes, o conteúdo usava a translação do PagerView; `withSpring` atuava apenas nos efeitos visuais. Depois, o progresso do track também é animado por spring:

```ts
// Antes: acompanha o deslocamento nativo, sem controlar sua soltura.
progress.value = event.position + event.offset;

// Depois: dedo e soltura controlam o mesmo valor.
progress.value = start.value - event.translationX / width;
progress.value = withSpring(target, { velocity, damping: 25, stiffness: 220 });
```

O código real também limita o intervalo e trata cancelamento. A atualização do React acontece ao finalizar, não a cada frame.

Antes, cada posição era representada por um desenho genérico e o goleiro por luvas. Agora:

```tsx
<PositionIcon position="Goleiro" />
<PositionIcon position="Fixo" />
<PositionIcon position="Ala" />
<PositionIcon position="Pivô" />
```

O renderizador resolve a definição compartilhada; `Ala` e `Alas` retornam a mesma definição.

## Verificação

- 249 testes existentes/novos aprovados.
- Build web aprovado; verificação de tipos e dependências Expo aprovada.
- Exportação Android/Hermes aprovada.
- Navegador: 390 e 1366 px, temas claro/escuro; dimensão 24 × 24, extensão do desenho, transparência, quatro cores e tooltips de foco.
- Capturas: `test-results/positions/four-icons-*`, `players-*`, `positions-form-*`, `scout-*`.
- Android/Pixel_7: swipe lento/rápido, retorno curto, CANCEL, clique no SUB, primeiro/último, botões e rolagem vertical aprovados nos dois temas. Dados e interação são do laboratório, usando o mesmo paginador das telas de produção.
- O CANCEL com a página deslocada revelou um erro: `onEnd` também é chamado com `success=false`. Agora essa situação retorna por `onFinalize`, sem avançar como se o dedo tivesse sido solto normalmente. O teste foi reforçado com dois MOVEs e uma captura antes do CANCEL.
- Capturas nativas em `test-results/mobile-categories/`, comparação em `test-results/native-comparison.png` e gesto em andamento em `test-results/native-spring-during-drag.png`.
- iOS e aparelho físico: não testados.

Para reproduzir, abrir `/dev/category-lab` em desenvolvimento, testar primeiro `Motor: native`, trocar para `Motor: spring` e executar `python apps/mobile/tests/category-pager-device.py` com o Pixel_7 de 1080 × 2400 conectado ao ADB. Os dados do laboratório são de demonstração. Repetir em Home, Jogos e Scout com uma conta de teste é uma verificação adicional dos fluxos completos. Em cliente de desenvolvimento próprio, a adição do Gesture Handler requer recompilação do cliente; o Expo Go compatível já inclui o módulo.

## Prompt para estudar em outro chat

> Leia este handover e confira os arquivos atuais na branch develop, sem criar branch ou commit. Ensine em português, em etapas curtas: primeiro definição compartilhada de SVGs e tokens; depois renderizadores web/mobile, aliases e acessibilidade; por último SharedValue, Gesture.Pan, onUpdate/onEnd/onFinalize, success=false, projeção de velocidade, withSpring, runOnJS, FlatList e centralização. Explique parâmetros, retorno, callbacks e sintaxe usando exemplos novos em inglês. Diferencie testes de regras, build e gestos testados no laboratório Android. Não afirme que houve teste em iOS, S23 físico ou com dados reais de clubes. Ajude a reproduzir os testes e explicar por que o teste de CANCEL precisou de deslocamento visível.
