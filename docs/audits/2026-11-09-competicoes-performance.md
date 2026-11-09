# Competições: rolagem, carregamento e regressões

## Escopo

Auditoria da interface web: Visão geral, Jogos, Classificação e Chaveamento. Sem alterações no backend, banco, importador, snapshots, regras de classificação ou inferência das chaves da federação. Testes de navegador usam respostas simuladas ou publicações previamente salvas; não efetuam escritas na API real.

## Causas e correções

- **Salto ao abrir modal:** o bloqueio aplicava `overflow: hidden` ao documento e ao body, que tem altura de 100%. Isso criava outro contêiner de rolagem e mostrava o início da página atrás do modal. Agora o bloqueio fica no documento, preservando a posição visível. Mantidos contador de modais sobrepostos, restauração do foco e liberação da rolagem ao desmontar.
- **Retorno ao ponto errado:** abrir detalhes também redefinia o limite dos jogos para 25. A página encurtava enquanto o modal estava aberto. O limite agora muda somente quando há alteração dos filtros que afetam a coleção.
- **Dropdown movendo ancestrais:** `scrollIntoView` podia rolar o modal ou a página ao navegar nas opções. Agora apenas a lista de opções rola.
- **Trabalho repetido nos filtros:** resumo, índices, períodos e coleção eram reconstruídos nas alterações provisórias do modal. Cálculos e elementos dos jogos agora são reutilizados enquanto suas entradas permanecem iguais. Jogos são agrupados por mês em uma passagem, e o JSX da coleção só é preparado na aba Jogos.
- **Consultas obsoletas:** a saída da página ou mudança de clube/evento cancela as consultas pendentes. Mantida a conferência de clube, evento, categoria, ano e divisão antes de aceitar uma resposta.
- **Histórico da busca:** digitação atualiza a URL sem gerar uma entrada do histórico por caractere.
- **Skeletons genéricos:** substituídos por estruturas de resumo, jogos, tabela e chaveamento. Incluído o carregamento inicial do módulo da rota. Respeitam largura disponível, margens e redução de colunas em telas pequenas. A atualização de dados já visíveis continua sem desmontar a tela nem exibir skeleton.
- A divisão do cabeçalho usa a identificação do evento selecionado durante o carregamento, evitando remover e reinserir essa linha ao buscar o painel.

## Evidências

Reprodução inicial no Chromium/Edge, viewport de 390 px, coleção de 60 jogos simulados:

| Verificação | Antes | Depois |
| --- | --- | --- |
| Posição ao abrir detalhes | 8.282 px → 0 px | 8.282 px → 8.282 px |
| Jogos carregados após abrir/fechar detalhes | 50 → 25 | 50 → 50 |
| Execuções do resumo em três mudanças provisórias de filtro | 6 | 0 |
| Consultas extras ao abrir/fechar modais | 0 | 0 |

As seis execuções são as observadas no ambiente de desenvolvimento com React StrictMode. A medição é contagem de trabalho executado, não tempo de resposta da API. O salto era de layout/rolagem, não recarregamento da página ou nova consulta.

## Validação

- Build web de produção e TypeScript aprovados.
- 32 testes das regras de apresentação, chaves, trajetória e classificação aprovados.
- Auditoria de interação em 320, 390, 820 e 1440 px: posição do fundo, rolagem bloqueada, filtros provisórios/aplicados, paginação, fechamento por Esc, opções pelo teclado, falha e nova tentativa, resposta atrasada de outra categoria e skeletons sem overflow.
- Apresentação das quatro abas em 320, 820 e 1440 px, ADMIN e TORCEDOR: navegação, filtros, sidebar expansível, conexões comprovadas, atualização sem perder zoom e manutenção dos dados após falha.
- Classificação com publicações salvas dos eventos 900, 901, 907 e 925, em 390 e 1440 px, ADMIN e TORCEDOR: preservados pontos, ordem, grupos e faixas publicadas.
- Modal compartilhado isolado em 320, 390, 760 e 1366 px: modais sobrepostos, Esc, foco, desmontagem, wheel e toque simulados.

Testes adicionados: `paulista-audit-smoke.cjs` e `modal-scroll-regression.cjs`. Evidências locais em `test-results/paulista-audit-after.json`, `paulista-audit-browser.log`, `paulista-audit-presentation.log`, `paulista-audit-source-regression.log` e capturas `paulista-skeleton-*`.

## Limites

Não foi medida a latência real do Render ou do banco; não há promessa de redução desse tempo. Os testes foram feitos no Chromium/Edge com viewports responsivos e toque simulado, sem validação em aparelho físico ou Safari/Firefox. A suíte legada `scroll-smoke.cjs` tem fixtures/assertivas anteriores à interface atual (incluindo endpoint de preferências ausente); o teste isolado novo verifica o comportamento compartilhado sem depender dessas fixtures.
