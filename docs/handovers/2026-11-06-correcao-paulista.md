# Correção da experiência Paulista — aceite e handover

Branch `develop`; sem branch nova, commit ou push. As alterações locais anteriores foram preservadas. Não foi encontrado AGENTS.md físico no checkout; foram seguidas as instruções fornecidas pelo usuário no chat.

## Diagnóstico

A entrega anterior confundia a representação técnica com a navegação: cada evento oficial de categoria aparecia como competição independente; o seletor tinha CSS próprio alinhado à direita; Jogos ainda permitia consultar outros clubes; e a visão geral não relacionava o último resultado ao caminho eliminatório. No quadro, `space-around` posicionava cartões sem relação geométrica com as origens. No desktop faltavam rejeição persistente de candidato, fila de divergências e conclusão explícita da análise.

As primeiras capturas desta execução tiveram problemas de sessão expirada e carregamento. Não devem ser usadas como prova de uma tela pronta. Sessões foram renovadas; a validação final usa seletores de conteúdo renderizado e as imagens `depois-*`. Para comparação anterior, existem também as capturas válidas da entrega anterior em `test-results/paulista-multiclube/`. Não alego uma matriz completa de screenshots válidos imediatamente anteriores a cada edição.

## Aceite por requisito

| Item | Situação | Evidência e limite |
| --- | --- | --- |
| 1. Um Campeonato Paulista | **Implementado e testado** | Exatamente um cartão por clube nas três sessões reais, nos dois temas/larguras. Eventos de todos os SUBs continuam acessíveis internamente; filtros de ano/tipo restringem os eventos elegíveis antes do agrupamento. Nenhuma competição física foi excluída. |
| 2. Cabeçalho | **Implementado e testado** | SUBs à esquerda pelo CategoryFilter compartilhado, divisão acima, globo à direita e recarregamento discreto no topo. Recarregar faz GET do Ludora; não dispara sincronização externa. |
| 3. Visão geral | **Implementado com limite** | Posição/pontos/grupo, calendário e pequena prévia lateral com ação acessível. Estado de classificação/eliminatória; eliminação só quando o vencedor do confronto aparece inequivocamente na etapa seguinte. Não afirma encerramento geral sem publicação. Teste puro cobre classificação, eliminação corroborada e empate ambíguo. |
| 4. Jogos do clube | **Implementado e testado** | Removido seletor de outros clubes. Consulta da tela sempre filtra participantes do clube; etapa classificação/eliminatórias e grupos por data. Cards/linhas e destaque da próxima/ao vivo são os componentes normais. Marcador “Campeonato Paulista” em Partidas. Testes de sessão verificam que todos os cartões contêm o clube logado. Partidas compartilhadas preservam IDs; nenhuma foi recriada. |
| 5. Classificação/cortes | **Implementado com limite** | Títulos simplificados e números oficiais mantidos. **Cortes pendentes de verificação**: não foi validado REC específico de 2026 para cada divisão/faixa; não desenha faixas ou distância a um corte presumido. Medalhas representam apenas chave efetivamente publicada. |
| 6. Chaveamento | **Implementado com limite** | Rodadas com cabeçalhos alinhados, posições calculadas a partir das ligações verificadas e cartões sem sobreposição; Final destacada. Cinco ligações do Sub-7/Prata mantidas. A quarta empatada AD Suzano–ADC Marvel continua sem linha: não foi confirmado o desempate. Não é defeito a corrigir com uma ligação inventada. |
| 7. Desktop operacional | **Implementado e testado nas ações indicadas** | Resumo de saúde, fila de divergências, comparação, consequência da decisão e auditoria com responsável. Electron real + API isolada exercitaram rejeitar sugestão, solicitar revisão e registrar resolução, com motivo/confirmação. Responsável e dados oficiais/locais analisados aparecem no histórico expansível. Leitura da base do projeto também foi aberta no Electron. Confirmação de vínculo, manter oficial e tentar sincronizar continuam os fluxos anteriores; não foram reexecutados contra a Federação/base real nesta correção. Transferências ambíguas com histórico continuam bloqueadas para análise assistida. |
| 8. Provas/testes | **Implementado com limites de cobertura** | 371 testes gerais, sete de integração PostgreSQL, matriz web de três clubes × dois temas × duas larguras e Electron em dois temas. Toque por emulação, não aparelho físico. Não há matriz inicial completa válida de “antes”; ver diagnóstico. Cenários de ano sem participação, categoria sem vínculo, fonte indisponível e ausência de chave têm estados seguros e cobertura anterior/pura/integração; não se alega nova execução visual completa de cada um nesta rodada. |

### Cortes não verificados

A pesquisa encontrou uma [errata oficial de Iniciação A2 de 2025](https://www.federacaopaulistadefutsal.com.br/novo/wp-content/uploads/2018/01/100_2025-ERRATA-Regulamento-Espec%C3%ADfico-de-Competi%C3%A7%C3%A3o-Inicia%C3%A7%C3%A3o-A2.pdf), que não valida os cortes de 2026 para os eventos atuais. Também apareceu o [requerimento oficial de participação de 2026](https://www.federacaopaulistadefutsal.com.br/novo/wp-content/uploads/2026/01/REQUERIMENTO-PARA-PARTICIPACAO-NAS-COMPETICOES-DA-FPFS-2026.pdf), que não estabelece esses cortes. Falta verificar os artigos/tabelas do regulamento específico de Iniciação A1/A2 e Base A1/A3 de 2026, incluindo critérios por grupo e eventuais exceções. Não foi utilizado regulamento de futebol de campo nem inferido “18º = Bronze”.

## Arquivos e propósito

- `apps/web/src/pages/Competicoes.tsx` e `.css`: agrupamento visual único, filtro pelo nome canônico, distinção do cartão oficial. Não muda os IDs das âncoras.
- `apps/web/src/pages/Paulista.tsx` e `.css`: faixa comum à esquerda, divisão acima, refresh GET, visão geral com prévia, agenda própria por data e filtros de etapa.
- `apps/web/src/components/PaulistaStandings.tsx`: título simplificado e limite explícito dos cortes.
- `apps/web/src/components/PaulistaBracket.tsx`: posições por rodada/continuidade e destaque da Final. IDs e conexões continuam separados do título apresentado.
- `apps/web/src/components/MatchCard.tsx` e `MatchListRow.tsx`: marcador pequeno “Campeonato Paulista”.
- `apps/web/src/utils/paulistaView.ts` e `apps/web/tests/paulistaView.test.mjs`: estado da campanha sem presumir eliminação por placar isolado.
- `services/api/src/modules/paulista/operations.ts`: fila administrativa, rejeições filtradas nas sugestões e ação de conclusão da análise.
- `services/api/src/modules/paulista/routes.ts`: rejeição autenticada/auditada e nome do responsável no histórico. Sem nova migration.
- `apps/desktop/src/renderer/src/pages/Paulista.tsx`: resumo de saúde, fila, rejeição de candidato, revisão ao clube e resolução.
- `apps/desktop/src/renderer/src/components/PaulistaReview.tsx`: responsável e rótulo da rejeição na auditoria.
- `services/api/tests/paulista.integration.ts`: rejeição persistente, bloqueio de rejeitar vínculo confirmado e resolução pela API.
- `services/api/tests/paulista.ui-setup.ts`: reinicializa somente a rejeição da fixture 99000003 no banco descartável, protegido pelo guard de destino.
- `apps/web/tests/paulista-correcao-smoke.cjs`: prova do único cartão, agenda própria, alinhamento e ausência de sobreposição/overflow nos temas e larguras, interação e retorno do detalhe.
- `apps/desktop/tests/paulista-correcao-smoke.cjs`: três novas ações reais via Electron/IPC/API sobre fixtures isoladas.

## Antes/depois e regras

### Um item visual, vários eventos oficiais

Antes: `visible = competicoes.filter(...).sort(...)`; todos os eventos viravam cartões.

Depois, em resumo:

```ts
const oficiais = filtradas.filter(c => c.paulista_evento_id);
const visible = [
  ...(oficiais.length ? [{ ...oficiais[0], nome: 'Campeonato Paulista', somente_leitura: true }] : []),
  ...filtradas.filter(c => !c.paulista_evento_id),
];
```

As competições físicas por evento não eram duplicação de partida: são âncoras distintas usadas por categoria/divisão. Fundi-las ou apagá-las seria outra operação de dados. Nesta correção a navegação agrupa a apresentação, preservando todos os IDs e históricos.

### Agenda própria

Antes: `scope === 'todos' || ...` permitia consultar confrontos sem o clube.

Depois: `own && filtroDeEtapa && outrosFiltros`. Mesmo um parâmetro antigo de equipe na URL não amplia o escopo. O filtro de etapa separa classificação/eliminatórias; a data continua ordenando os confrontos dentro do resultado.

### Geometria do quadro

Antes: cartões distribuídos por `space-around`.

Depois: cada jogo tem posição vertical estável. Um destino usa a média das posições das origens comprovadas; posições próximas são afastadas para evitar sobreposição. O SVG mede as bordas reais dos cartões. Nenhum ponto cria relações novas: o algoritmo só posiciona as conexões já admitidas por `caminhoPublicado`.

### Rejeição e revisão

`POST /admin/paulista/eventos/:id/rejeitar-sugestao` exige SUPERADMIN, clube/equipe válidos e motivo. Uma identidade já vinculada é recusada, preservando histórico. Registra `SUGESTAO_REJEITADA`; a sugestão deixa de aparecer nas consultas seguintes. Se o evento só estiver no catálogo, precisa obter seu snapshot antes de gravar auditoria vinculada; falha da fonte interrompe a operação.

`REGISTRAR_RESOLUCAO` registra o encerramento humano da análise como CONFERIDA. **Não corrige automaticamente o placar local nem apaga eventos**. A revisão solicitada fica EM_REVISAO, aparece para o clube nos avisos e registra motivo/responsável. Não envia email ou push nesta implementação.

## Testes, dados e reprodução

```powershell
pnpm test:app:completo
pnpm build:web
pnpm --filter @ludora/desktop build
```

Resultado: **371/371**, build web e build Electron aprovados; compilação da API incluída. `git diff --check` sem erros, somente avisos LF/CRLF.

Integração: `tsx --test tests/paulista.integration.ts` com `PAULISTA_TEST_DATABASE_URL` protegido, schema legado inicial e PostgreSQL descartável: **7/7**. Inclui cenário HTTP novo de rejeição e resolução, além das proteções anteriores de calendário, placar, autorização e importação.

Web: `node apps/web/tests/paulista-correcao-smoke.cjs`, com Playwright do runtime via NODE_PATH e sessões locais renovadas. Os 12 cenários estão nos logs `browser.log`/`browser-aceite.log` e `browser-maua-final.log`; a repetição de Ocian com capturas completas está em `browser-final.log`. Na repetição com navegação, a espera do teste foi ajustada para o link oficial do detalhe: uma partida em preparação não tem o componente de resultado de uma partida encerrada. Também houve timeout transitório de carregamento; a repetição final da União Mauá passou nos quatro cenários. O script precisa de sessões locais válidas em `.local-demo/paulista-multiclube-20261106/sessoes-web.json` e dos serviços normais em 3000/5173.

Electron: `node apps/desktop/tests/paulista-correcao-smoke.cjs`, com build pronto e API de testes na porta 3009. Rejeição, solicitação de revisão e resolução passaram via UI, não apenas por chamada direta. A conta é `pilot@example.test` do banco descartável; a fixture e a divergência 9×1 versus 1×1 não são dados reais do Ocian.

Não foram apagados, fundidos ou recriados dados oficiais na base do projeto. A conferência autenticada reutilizou os 24 vínculos e nove jogos oficiais compartilhados já documentados no [manifesto anterior](../dados/paulista-multiclube-20261106.json). Nesta rodada a escrita dos testes de operação ocorreu somente no banco local descartável. Scripts de verificação renovaram arquivos locais de sessão/relatório; não publicar tokens.

### Evidências visuais

Pasta: `test-results/correcao-paulista/`, ignorada pelo Git. Cada arquivo `depois-CLUBE-LARGURA-TEMA-TELA.png` identifica sessão, largura e tema.

- [Item único e lista](../../test-results/correcao-paulista/depois-ocian-1366-dark-competicoes.png)
- [Visão geral e prévia](../../test-results/correcao-paulista/depois-ocian-1366-dark-visao.png)
- [Agenda do clube](../../test-results/correcao-paulista/depois-santos-1366-dark-jogos.png)
- [Chaveamento completo](../../test-results/correcao-paulista/depois-ocian-1366-dark-chaveamento.png)
- [Classificação em celular](../../test-results/correcao-paulista/depois-santos-390-dark-classificacao.png)
- [Operações no Electron](../../test-results/correcao-paulista/desktop-operacoes-dark.png)

As capturas foram abertas e inspecionadas. Verificações automatizadas medem o alinhamento dos títulos, a separação dos cartões e o overflow global. Os escudos oficiais que retornam 404 continuam com fallback; os de Ocian e Santos reutilizam os cadastros do Ludora.

## Riscos e pendências explícitos

1. Cortes Ouro/Prata/Bronze dependem de regulamento específico validado; sem isso não há projeção nem distância ao corte.
2. Ligação da quarta empatada e vitória por agregado/desempate não comprovado continuam ausentes. Avanço não é inferido pelo nome da rodada.
3. Transferência/fusão de histórico com identidade ambígua não foi automatizada. A ação registra revisão assistida, não executa uma transferência invisível.
4. Registrar resolução conclui análise; não equivale a reconciliar automaticamente scout/placares. A consequência é apresentada no modal.
5. Solicitação ao clube é estado persistido nos avisos, sem envio de notificações externas.
6. Toque emulado, sem teste em telefone físico. Screenshots iniciais parcialmente inválidos; não há alegação de antes/depois completo de toda a matriz.
7. As mudanças continuam locais. Serviços remotos não recebem código novo por alteração no Supabase.

## Prompt para estudo

> Leia `docs/handovers/2026-11-06-correcao-paulista.md` e os arquivos atuais. Ensine passo a passo sem alterar código: por que um item visual pode agrupar eventos sem fundir registros; como filter/map e a cópia por spread preservam IDs; como o filtro own restringe a agenda; como URL e navegação voltar funcionam; como posições e medidas do DOM desenham um quadro sem inventar relações; e como rejeição, revisão e resolução usam autenticação, motivo, auditoria e estados distintos. Explique a diferença entre classificar, projetar cortes e confirmar uma chave publicada. Mostre antes/depois e explique cada sintaxe de React, TypeScript e Prisma com exemplos novos em inglês. Não presuma que domino esses frameworks. Diferencie testes isolados, dados oficiais e as limitações de validação visual registradas no relatório.
