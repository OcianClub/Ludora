# Handover técnico — Paulista no web do clube

06/11/2026 · branch `develop` · sem branch nova, commit ou push.

## 1. Resultado e fluxo

O Paulista abre pelo cartão na lista normal de Competições, com filtro de organização. O atalho separado e o aviso intermediário foram removidos. O clube continua criando apenas suas competições locais.

Ao abrir, a visão geral mostra posição oficial do SUB, grupo, pontos, saldo, jogos e próxima partida ou último resultado. Iniciação/Base e SUBs ficam na mesma faixa, com divisão específica do evento. Só aparecem categorias confirmadas/importadas. O globo abre a fonte oficial com descrição no mouse/foco e nome acessível.

Jogos reutilizam cartões, linhas e filtros do Ludora. Inicialmente aparecem os jogos do clube; é possível ampliar para outros confrontos oficiais. Jogos locais acessíveis abrem o detalhe normal; jogos apenas oficiais têm leitura dos dados publicados, sem elenco ou eventos presumidos. A aba normal Partidas também identifica o Paulista.

Classificação usa números publicados. Chaveamento apresenta somente a chave publicada do clube, preservando sua trajetória após eliminação. Não há formulários administrativos no web do clube.

### Passo a passo dos dados

1. A API entrega o calendário e as tabelas já integrados. Abrir o web não importa nem replica jogos.
2. A interface encontra a equipe oficial vinculada ao clube atual e os SUBs disponíveis.
3. Filtros ficam na URL: atualizar e voltar pelo navegador preservam contexto.
4. Para partida local do clube, abre `/partidas/:id`, com retorno ao campeonato. Para jogo apenas oficial, abre leitura usando o parâmetro `jogo` na URL.
5. O detalhe separa resultado da Federação e placar anotado pelo clube. Data, adversário, mando e resultado oficial não são campos editáveis pelo clube.
6. Após resultado oficial numérico, gestor autorizado registra acontecimentos de seus atletas pelo formulário normal. Exige motivo, atleta da categoria e identificador da operação; registra auditoria e não soma novamente no placar.
7. Para partida futura sem resultado oficial, permanece o fluxo normal de operação.

`requestId` é o identificador enviado com o registro. Repetir a mesma operação retorna o registro anterior; reutilizar o identificador com conteúdo incompatível é rejeitado. Evita duplicação por repetição de envio.

## 2. Conferência com a Federação

Fontes primárias consultadas:

- https://eventos.admfutsal.com.br/evento/900
- https://eventos.admfutsal.com.br/evento/900/jogos
- https://eventos.admfutsal.com.br/evento/925 — consulta complementar da estrutura da Base; não importada nem vinculada nesta entrega.

### Piloto real: evento 900, Paulista 2026, Sub-7/A2

Ocian Praia Clube, equipe externa 12423, é o clube local 2, categoria local 9, conforme confirmação anterior do usuário. Classificação inicial: **12º, 33 pontos, 23 jogos, 10 vitórias, 3 empates, 10 derrotas, 74 gols pró, 59 contra, saldo 15**, Chave Única, fase 35845.

A Prata vem da publicação das fases, não da posição 12º:

| Etapa | Confronto publicado | Resultado | Data/hora |
| --- | --- | --- | --- |
| Quartas, fase 36500 | Ocian × A União Mauá | 3 × 0 | 06/09/2026, 08:30 |
| Semifinal, fase 36554 | AD Suzano × Ocian | 6 × 4 | 13/09/2026, 13:30 |
| Final, fase 36574 | AD Suzano × Clube Batalha | 4 × 3 | 20/09/2026 |

O quadro publicado da Prata tem quatro quartas, duas semifinais e uma final. Há **cinco conexões corroboradas**: Ocian das quartas à semifinal; Clube Batalha e Metalúrgicos às suas semifinais; AD Suzano e Clube Batalha à final. A quarta AD Suzano × ADC Marvel, fase 36492, empatada em 2×2, fica sem ligação: os dados usados não comprovam o desempate.

Esta integração não recebe campo oficial pai/filho entre jogos. As linhas interpretam conservadoramente a continuidade publicada, usando equipes, resultado decisivo, etapa e cronologia. Não homologam todos os critérios do regulamento. Em ambiguidade, os confrontos continuam visíveis sem linha.

### Grupos separados na Base

No evento 925, Sub-12/A3, grupos iniciais têm IDs de fase diferentes: A=35906, B=35910, C=35914. Ocian está no C: 4º, 24 pontos, 13 jogos, 8 vitórias, 0 empates, 5 derrotas, saldo 14. A interface começa pelo grupo do clube e mantém `faseId + grupo` na seleção. Não junta posições de grupos/fases posteriores num ranking geral.

## 3. Mapeamento dos arquivos

Caminhos relativos à raiz `C:/Users/CoquinhaGelada/Desktop/Ludora`. O checkout já continha alterações anteriores, inclusive Desktop, schema, migrations e scripts. Esta tabela delimita esta entrega; não atribui todo o `git status` a ela.

| Arquivo | Propósito |
| --- | --- |
| `apps/web/src/pages/Paulista.tsx` e `Paulista.css` | Reestruturação da página existente: visão inicial, categorias confirmadas, filtros na URL, jogos reutilizados, classificação, chaveamento e responsividade. Retira formulário paralelo de histórico. |
| `apps/web/src/utils/paulistaView.ts` — novo | Funções puras para nomes, estados, resumo, chave publicada, conexões conservadoras e adaptação aos cartões existentes. |
| `apps/web/src/components/PaulistaIcons.tsx` — novo | SVGs de globo e medalhas usando tokens visuais. |
| `apps/web/src/components/PaulistaStandings.tsx` — novo | Tabela oficial e seleção de fase/grupo preservando IDs diferentes. |
| `apps/web/src/components/PaulistaBracket.tsx` — novo | Cartões, conectores medidos na tela e interação por mouse, foco, teclado e toque. |
| `apps/web/src/pages/Competicoes.tsx` e `Competicoes.css` | Filtro de organização, status e abertura direta pelo cartão. |
| `apps/web/src/components/CompetitionPanel.tsx` | Encaminha diretamente ao campeonato oficial; preserva painel das competições locais. |
| `apps/web/src/pages/Partidas.tsx` | Associa evento aos cartões usando metadados da competição já carregados. |
| `apps/web/src/components/MatchCard.tsx`, `MatchCard.css`, `MatchListRow.tsx` | Marcador oficial, W.O./adiamento/placar ausente, clique reutilizável e apresentação neutra dos outros clubes. |
| `apps/web/src/utils/teamIdentity.ts` | Retira apenas sufixos reconhecíveis de categoria; evita cortar palavras legítimas. |
| `apps/web/src/services/api.ts` | Metadados opcionais de apresentação; não cria colunas no banco. |
| `apps/web/src/services/sharedMatches.ts` | Tipagem dos dados oficiais no detalhe e da permissão de anotação histórica. |
| `apps/web/src/pages/PartidaDetalhe.tsx` e `PartidaDetalhe.css` | Retorno ao campeonato, dados oficiais, atletas próprios e bloqueio visual de edição do calendário oficial. |
| `apps/web/src/components/PaulistaMatchNotice.tsx` | Aviso de resultado, divergência e anotação histórica, sem consulta paralela. |
| `apps/web/src/components/MatchLiveBoard.tsx` | Reutiliza formulário de acontecimentos para anotações próprias, com motivo e envio idempotente. |
| `apps/web/src/components/MatchResultSummary.tsx` | Distingue placar anotado pelo clube no resumo e texto compartilhado. |
| `services/api/src/modules/paulista/service.ts` | Consulta de metadados para detalhe e ampliação do serviço histórico auditado para tipos/período/minuto do formulário normal. |
| `services/api/src/modules/partidas/compartilhadas.routes.ts` | Metadados no GET normal e encaminhamento do POST normal ao serviço histórico quando aplicável. |
| `apps/web/tests/paulistaView.test.mjs` — novo | Cinco testes das regras de apresentação, estados, nomes e conexões. |
| `apps/web/tests/paulista-smoke.cjs` | Fluxo de navegador isolado, quatro combinações de tema/largura, teclado e toque emulado. |
| `services/api/tests/paulista.integration.ts` | Detalhe/anotação via rota normal, autorização, repetição segura e jogo futuro; restrição aos bancos descartáveis permitidos. |
| `services/api/scripts/verificar-paulista.ts` | Atualiza a verificação somente leitura para a navegação atual. |
| `docs/paulista-operacao.md` e este handover | Referência da etapa web e registro técnico. |

## 4. Antes e depois

Trechos reduzidos para explicar o fluxo. “Antes” é a implementação no início desta entrega, inclusive arquivos ainda não versionados; não necessariamente o último commit.

### Abrir partida e registrar acontecimentos

Antes, a página mantinha um formulário próprio de histórico além do detalhe normal:

```tsx
{own && local?.partidaId && <Link to={`/partidas/${local.partidaId}`}>Abrir partida</Link>}
{own && podeGerenciar && <Btn onClick={() => void abrirRetro(j)}>Complementar histórico</Btn>}
```

Depois, o clique usa o detalhe normal levando o retorno:

```tsx
if (localId && own) navigate(
  `/partidas/${localId}?${new URLSearchParams({ retorno: location.pathname + location.search })}`,
  { state: { fromPaulista: true } },
);
```

O formulário já existente em `MatchLiveBoard` registra acontecimentos. A rota normal delega ao serviço auditado quando há resultado oficial numérico; mantém o fluxo original para partida futura. Permissões são verificadas na API, não só no botão.

### Grupo da classificação

Antes:

```tsx
const faseClassificacao = fase || painel?.snapshot.classificacao.find(r => /CLASSIFICA/i.test(r.fase))?.faseId;
const tabela = painel?.snapshot.classificacao.filter(r => r.faseId === faseClassificacao) || [];
```

Começava pela primeira fase inicial, que poderia ser A mesmo com o clube no C. Depois:

```tsx
const faseDoClube = iniciais.find(r => minhas.has(r.equipeId))?.faseId || iniciais[0]?.faseId;
const selecionada = fases.some(([id]) => id === fase) ? fase : faseDoClube || fases[0]?.[0];
const opcoesGrupo = [...new Map((inicial ? iniciais : tabela)
  .map(r => [`${r.faseId}|${r.grupo}`, r.grupo]))];
```

O texto pode ser agrupado para leitura; o identificador que filtra a tabela continua específico.

### Classificação e medalha

Antes havia “Conferência calculada pelo Ludora · 3/1/0 e saldo” na interface. Foi retirada. O componente novo renderiza `snapshot.classificacao` sem recalcular posições ou desempates.

```ts
const chaves = normalizar(nome).match(/\b(OURO|PRATA|BRONZE)\b/g) || [];
return new Set(chaves).size === 1 ? chaves[0] : null;
```

A medalha vem de um único nome de chave explicitamente publicado para o clube. Não existe regra `posição => medalha`.

### Conectores

Antes não havia esse quadro visual com continuidade validada. `caminhoPublicado` agora agrupa colunas para apresentação, conservando `id` e `faseId` de cada jogo.

```ts
if (etapa < 0 || !temResultado(origem) || origem.golsMandante === origem.golsVisitante) continue;
if (par.length !== 1) continue; // Não adivinhar agregado de ida/volta.
if (presentes.length === 1) conexoes.push({ de: origem.id, para: presentes[0].jogo.id, equipeId: presentes[0].id });
```

Entre essas verificações, exige resultado decisivo, vencedor com presença única na etapa seguinte, ausência de destinos ambíguos e cronologia compatível. Títulos iguais não comprovam identidade.

## 5. Testes e resultados

| Verificação | Resultado |
| --- | --- |
| `pnpm test:app:completo` | **367 passaram, 0 falhas**; inclui compilação da API e cinco testes novos do web. |
| `pnpm build:web` | TypeScript e Vite concluídos. |
| PostgreSQL: `tsx --test tests/paulista.integration.ts` | **5 passaram, 0 falhas**, em banco descartável. Inclui importação repetida/concorrente, legado, autorização e rota normal de acontecimentos. |
| Smoke web em Edge headless/Playwright | **4 cenários completos passaram**: 390px/1366px × claro/escuro. |
| `verificar-paulista.ts --browser` | Leitura autenticada de Competições/evento e navegação real passaram, sem gravações. |
| Comparação com captura inicial do Supabase | Snapshot do evento 900 e referências locais idênticos: **297 jogos oficiais, 25 partidas operacionais**. |
| `git diff --check` | Sem erros de whitespace; avisos LF/CRLF do checkout Windows. |

O navegador cobre lista/filtro/abertura direta; visão geral; ausência de administração; divisão por evento; categoria sem vínculo; grupos e fases posteriores sem mistura; sete cartões/cinco linhas na Prata; links/voltar; foco/tooltip; teclado e gesto de toque emulado; detalhe normal/inclusão de defesa; preservação dos dois placares; marcador em Partidas; futuro, W.O., adiamento e placar ausente; erro 503 limpando dados antigos; ausência de overflow global e de erros JavaScript.

Problema encontrado e corrigido no toque: o chaveamento alargava toda a página em 390px. `minmax(0, 1fr)`, `min-width: 0` e contenção de largura deixam a rolagem dentro do quadro.

O teste concorrente registra conflito/deadlock esperado no Prisma e confirma a rejeição segura de uma operação. Termina aprovado; não é falha ignorada.

### Dados reais versus simulação

- Real: evento 900/Sub-7/A2, classificação, Prata e jogos; lidos sem alterar Supabase.
- Real somente consultado na fonte: evento 925/Sub-12/A3 e grupos A/B/C. Não virou participação no sistema nesta tarefa.
- Simulação exclusiva do navegador: Sub-8/A3 e Sub-12/A1, para alternar categoria/divisão, grupos distintos e estados excepcionais. São fixtures, **não declarações sobre participação real do Ocian**.
- Banco descartável: contas `@example.test`, atleta Taylor e registros de validação. Nenhum acontecimento de teste foi enviado ao Supabase.

Artefatos ignorados pelo Git em `test-results/paulista-web/`: capturas dos temas/larguras, logs e `supabase-readonly-proof.json`. A comparação foi registrada em 06/11/2026, 19:07:23 UTC. Artefatos ignorados não acompanham automaticamente um commit.

### Como conferir e reproduzir

Web normal: `http://localhost:5173`, entrar no clube Ocian → Competições → Paulista → Sub-7. Base sem participação confirmada mostra estado vazio. O guia de operação existente descreve a inicialização normal.

Integração: exige `PAULISTA_TEST_DATABASE_URL` em um dos dois bancos locais explicitamente permitidos pelo teste e o schema legado inicial. **Não usar Supabase**: essa suíte cria dados e aplica SQL somente na cópia descartável.

Smoke: exige API isolada na porta 3009, preparação por `paulista.ui-setup.ts`, contexto em `test-results/paulista/ui-context.json`, Vite em `localhost:5173` e Playwright disponível via `NODE_PATH` do runtime de ferramentas. Executar o arquivo sozinho sem isso não reproduz o cenário. Playwright não foi adicionado às dependências de produção. API/contêiner exclusivos desta validação foram encerrados ao concluir; serviços normais preservados.

## 6. Limites e preservação

- Nenhuma migration, alteração de schema ou importação no Supabase nesta etapa. Migrations no checkout pertencem à entrega anterior.
- Desktop/Electron, mobile, sincronizador, descoberta e regras de importação não foram desenvolvidos nesta tarefa. Alterações anteriores foram preservadas.
- Só Sub-7/A2 confirmado/importado para o piloto; outros SUBs não são preenchidos por aproximação.
- Sem continuidade única/resultado decisivo, não há ligação no quadro. Ida/volta, empate, W.O. e dados incompletos não autorizam deduzir classificados.
- Toque validado por emulação, não aparelho físico. Imagens externas dependem da origem; há fallback de escudo.
- Anotação histórica aceita sete tipos para atleta próprio autorizado, com camisa/categoria válidas. Assistência é evento separado; gol contra, autor pendente e assistência combinada com gol não foram ampliados nesse caminho.
- Sem editor completo de elenco histórico, ampliação de permissões para editar/remover eventos ou novo reprocessamento de ML. Placar anotado e acontecimentos podem exigir conferência; não há reconciliação automática com o resultado oficial.
- O adaptador visual preenche campos numéricos exigidos pelo DTO antigo de Partida. A renderização oficial usa os valores anuláveis originais: placar ausente não aparece como 0×0, nem é persistido como resultado novo.
- Nomes são formatados na apresentação; o texto original da Federação permanece armazenado.

## 7. Prompt para estudar em outro chat

> Estou aprendendo programação. Leia `docs/handovers/2026-11-06-paulista-web.md` e o código atual do Ludora. Ensine do zero, em blocos pequenos, sem implementar novas mudanças por conta própria. Comece pelo caminho Competições → Paulista → detalhes normais e pela diferença entre dados oficiais e anotações do clube. Depois explique props, funções puras, Set, Map, filter, find e some; filtros na URL e React Router; e por que minmax(0, 1fr) evita overflow. Use exemplos novos em inglês e preserve as convenções do projeto. Explique por que faseId não é o título da fase, medalha não vem da posição e empate não autoriza deduzir classificado. Por fim, explique autorização, idempotência e testes com banco isolado. Diferencie dados reais do Sub-7, consulta do Sub-12 e fixtures fictícias. Não presuma conhecimento de React, API ou Prisma; não interrompa com exercícios obrigatórios a cada passo.
