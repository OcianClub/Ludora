# Conferência do Paulista e apresentação — 09/11/2026

## Escopo e resultado da leitura

Foram consultados os 24 eventos conhecidos do Paulista 2026, divisões A1/A2/A3, oito categorias em cada divisão. Foram conferidos os catálogos de equipes, jogos e classificações. A leitura gerou 6.190 registros de jogos e 1.486 linhas de classificação. Os 17 eventos presentes no banco pertenciam a esse catálogo.

Nos 17 eventos salvos, identificação do evento/ano/categoria/divisão/fonte, equipes e todos os campos dos jogos coincidiram com a consulta realizada: participantes, fases, placares, datas, horários, locais, ocorrência e referência de súmula. Nenhuma escrita foi executada no banco, importação, migração ou sincronização de partidas.

Nove eventos apresentaram mudanças apenas no campo de posição em tabelas eliminatórias de duas equipes empatadas. Não houve diferença nas estatísticas. Uma segunda consulta diretamente ao HTML da federação mostrou novas inversões de posição entre requisições, com estatísticas idênticas. Portanto essa ordem não comprova vencedor ou avanço. As conexões existentes continuam exigindo uma participação posterior publicada, sem calcular desempates por conta própria.

Essa conferência é uma observação das publicações disponíveis nesse momento, não uma garantia sobre alterações futuras da fonte ou eventos de outras temporadas. Não houve auditoria linha a linha do conteúdo interno dos PDFs de súmula.

## Chaves confirmadas nas publicações

As chaves são lidas das fases e grupos dos registros da própria equipe. A posição na classificação não é convertida em Ouro, Prata ou Bronze.

| Categoria | Ocian | Santos |
| --- | --- | --- |
| SUB-7 | A2 · Prata · 12º | A1 · Ouro · 4º |
| SUB-8 | A2 · Bronze · 23º | A1 · Ouro · 6º |
| SUB-9 | A2 · Bronze · 22º | A1 · Ouro · 6º |
| SUB-10 | A2 · Prata · 11º | A1 · Ouro · 5º |
| SUB-12 | A3 · Prata · 4º no grupo C | A1 · Ouro · 3º |
| SUB-14 | A3 · Sem chave publicada · 6º no grupo C | A1 · Prata · 11º |
| SUB-16 | A3 · Sem chave publicada · 7º no grupo C | A1 · Ouro · 7º |
| SUB-18 | A3 · Prata · 5º no grupo C | A1 · Ouro · 6º |

As posições são da fase de classificação, não colocações finais do campeonato. As posições do grupo C não são comparáveis à classificação geral das divisões com grupo único.

Exemplos oficiais: [Santos SUB-8 A1](https://eventos.admfutsal.com.br/evento/909/jogos), [Santos SUB-14 A1](https://eventos.admfutsal.com.br/evento/905/jogos), [Ocian SUB-7 A2](https://eventos.admfutsal.com.br/evento/900/jogos), [Ocian SUB-8 A2](https://eventos.admfutsal.com.br/evento/901/jogos).

## Alterações

- Validação do evento, ano, divisão, categoria e identidade confirmada do clube antes de apresentar uma resposta. Uma resposta incompatível na primeira carga exibe erro; durante uma atualização mantém os últimos dados válidos com aviso.
- A resposta atrasada de uma categoria anterior não deve substituir a seleção atual. Não existe chave Ouro como fallback para uma chave ainda não publicada.
- Marcador de eliminação utiliza o mesmo vermelho `#E5485D` da derrota.
- Hover do confronto na trajetória altera o fundo apenas sutilmente.
- Hover da classificação resumida inclui o cabeçalho da linha da equipe e todas as células, preservando o destaque do clube.
- Em contêineres de até 600 px, o percurso do cartão principal é uma lista vertical conectada, na ordem das fases publicadas. O grid lateral permanece nas larguras maiores.
- Correção de apresentação de `Grupo Único`, preservando a publicação original.

## Verificações

- 20 testes de apresentação de dados e chaveamento; 6 testes do parser e regras da integração.
- Navegador com os snapshots reais coletados: oito categorias de cada clube, Ocian e Santos, perfis gestor e torcedor, em 320, 390, 820, 1024 e 1440 px. Valida chaves, divisão, posição, ausência de chave, progresso vertical, hovers completos e ausência de overflow horizontal.
- Resposta incompatível rejeitada, recuperação por tentar novamente, troca de categoria com resposta atrasada e atualização incompatível mantendo os dados anteriores.
- Verificações adicionais das quatro abas em 320, 600, 820, 1024 e 1440 px: filtros, ordem oficial, mapa, conexões, navegação por teclado e sidebar expandida/contraída; tema claro em 820 px.
- Build de produção do web.

## Repetir a conferência

Na raiz do repositório:

```powershell
pnpm --filter @ludora/api exec tsx scripts/auditar-paulista-leitura.ts
pnpm --filter @ludora/api exec tsx scripts/auditar-paulista-leitura.ts --reconferir-tabelas
```

O script realiza somente consultas e grava evidências locais em `test-results/paulista-source-audit`: relatório, snapshots coletados, cópia dos dados consultados e HTML das tabelas reconferidas. Não publica mutações. O teste `apps/web/tests/paulista-source-smoke.cjs` utiliza essas evidências interceptando as requisições do navegador, sem gravar na API ou na federação. Os valores esperados representam a conferência desta data; se a fonte mudar, a divergência exige revisão.
