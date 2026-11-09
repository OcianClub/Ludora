# Paulista: chaveamento de consulta com React Flow

## Escopo

O web substitui React Archer por `@xyflow/react`, carregado apenas ao abrir o mapa. A visualização é de consulta: zoom, pan, ajuste à tela, localização do clube, detalhes existentes e alternativa por fase. Em áreas estreitas a lista por fase é a visualização inicial. O tamanho disponível considera a sidebar expandida ou recolhida.

Não houve alteração no schema, sincronizador, importador, resultados oficiais, agenda operacional, permissões ou Scout. Nenhuma migration ou importação foi executada nesta etapa. O editor administrativo persistido continua fora desta primeira entrega; não há handles editáveis ou correções locais que pareçam oficiais.

## Refinamento da navegação

O mapa abre em tamanho real (100%), sem reduzir automaticamente os cards para caber na altura da janela. Sua altura acompanha as colunas publicadas. Em áreas amplas a movimentação começa desativada; o botão “Mover mapa” libera ou bloqueia arraste, scroll para zoom e pinça. Com o mapa bloqueado, o scroll continua percorrendo a página. Em telas de até 760 px ou áreas menores que 700 px, o mapa já está liberado e o botão de movimentação não aparece. A escolha inicial nessas telas continua sendo “Por fase”, com opção de abrir o mapa.

Os controles flutuam agrupados dentro do canvas, no canto inferior esquerdo: movimentação, menos/mais zoom, percentual clicável para restaurar 100%, ajustar tudo à tela e localizar clube. O último permite centralizar a participação mais recente do clube sem encolher o card. Em telas estreitas, a opção “Por fase” continua inicial; o mapa completo é opcional e os controles de ajuste permitem visualizar as fases fora da área disponível.

Vitória pelo placar e classificação são informações distintas: a vitória numérica recebe destaque tipográfico; a seta e o rodapé identificam quem avançou, inclusive após empate. O detalhe explica que o avanço foi corroborado pela publicação seguinte. Jogos e conexões do próprio clube mantêm o destaque azul; os demais são neutros. Em “Por fase” não há mais instrução sobre linhas inexistentes.

As verificações de navegador incluem abrir em 100%, alternar movimentação por mouse e teclado no desktop, impedir arraste/zoom acidental quando bloqueado, ativar automaticamente o mapa compacto, verificar os controles flutuantes, restaurar o tamanho real e preservar o mapa após recarregamento e redimensionamento.

## Leitura das conexões

- IDs oficiais continuam sendo a identidade dos jogos; não são criadas partidas ou equipes futuras.
- A fase seguinte publicada precisa conter exatamente um participante do jogo anterior. Empates podem ter conexão se esse avanço estiver comprovado pela publicação; não se calcula desempate.
- Se os placares não empatam, o participante seguinte também precisa corresponder ao vencedor pelo placar.
- W.O., adiamento, ausência de resultado, fases desconhecidas, jogos repetidos na mesma etapa e resultados divergentes não geram setas presumidas.
- Quartas no singular e as variantes reais de escrita são reconhecidas. Rubi é reconhecida. O erro literal `BRONE` é exibido como Bronze com aviso, preservando o título original.
- Registros sem placar publicados para 31/12 às 00:00 são sinalizados como agenda a confirmar. Finais conflitantes permanecem visíveis para conferência, sem escolher silenciosamente uma delas.
- Fases futuras são avisos genéricos de publicação pendente. Não se presume quantidade de vagas, pareamento, bye, ranking acumulado ou regulamento aplicável.

As regras ficam em `apps/web/src/utils/paulistaBracket.ts`, independentes do React Flow. O layout usa IDs e conexões; alterações comuns de placar não reposicionam os cards. Setas indicam continuidade comprovada, não um cruzamento futuro calculado; regulamentos podem reordenar classificados entre fases.

## Atualização

O web escuta o evento existente `paulista_atualizado` para o campeonato selecionado, reconexão e retorno à janela. As leituras são agrupadas e serializadas, sem recarregar toda a página. O botão de recarregar preserva o mapa quando já há um painel válido. Falhas mantêm os últimos dados visíveis e oferecem nova tentativa. Zoom, pan e modo escolhido são preservados nessas atualizações. A frequência de consulta à federação continua sendo responsabilidade do sincronizador existente.

## Verificações

- 19 testes unitários web: fases, Rubi, empate, W.O., agenda provisória, duplicidade, conflito, byes, layout estável, assinatura do evento existente, apresentação da campanha e recorte da classificação próxima.
- 6 testes do parser/contratos Paulista da API, sem banco.
- Teste visual isolado em 320, 390, 600, 820, 1024, 1280, 1440 e 1920 px, ADMIN/TORCEDOR, incluindo tema claro, sidebar, teclado, filtros e conexões ancoradas aos cards. Dados e rede simulados, sem gravações.
- Comparação somente em memória com os 24 snapshots públicos coletados na auditoria: 6.190 jogos, 417 eliminatórias, 320 conexões comprovadas (49 após empate) e 8 avisos. Snapshots originais permaneceram iguais. Não é prova de que futuras publicações usarão o mesmo formato.
- Build web de produção aprovado; mapa em arquivo separado (~64 kB gzip de JavaScript nesta compilação).

Execução dos testes puros, na raiz:

```powershell
node --import ./services/api/node_modules/tsx/dist/loader.mjs --test apps/web/tests/paulistaView.test.mjs apps/web/tests/paulistaBracket.test.mjs apps/web/tests/paulistaOverview.test.mjs
pnpm --filter @ludora/api exec tsx --test tests/paulista.test.ts
pnpm --filter @ludora/web run build
```

O teste de navegador `apps/web/tests/paulista-presentation-smoke.cjs` usa Playwright/Edge, um Vite já aberto e `LUDORA_WEB_TEST_URL`. `PAULISTA_WIDTHS` permite selecionar larguras. As capturas ficam em `test-results/paulista-*.png`. Não usar os testes antigos que dependem da API local de piloto para testar dados reais em produção.

## Refinamento visual das páginas

- Categorias usam os tamanhos e a separação do componente compartilhado `CategoryFilter`, sem a borda horizontal adicional. A fonte oficial está junto de temporada e atualização; divisão fica ao lado do título quando cabe.
- `MatchCard` aceita `competitionContext` opcional, usado apenas no Paulista: data e badges na primeira linha, dia/horário abaixo, competição/categoria em linha própria e etapa publicada na sequência. Os demais consumidores mantêm a apresentação anterior.
- Visão geral (`PaulistaOverview`) prioriza a situação da campanha e separa a colocação inicial das eliminatórias. Ouro/Prata/Bronze aparecem apenas no chip da chave, com fundo neutro no restante do cartão.
- Percurso por fases distingue avanço confirmado, eliminação confirmada, publicação pendente e fase não alcançada. Reutiliza exclusivamente as conexões corroboradas do chaveamento; uma derrota isolada não implica eliminação. Não presume campeão nem cria pareamentos futuros.
- Faixa de números exclusiva da classificação: pontos, jogos, V/E/D com barra proporcional e saldo. Trajetória absorve o último jogo, com data/local e acesso aos detalhes; classificação resumida mostra até cinco equipes do mesmo ID de fase e grupo em ordem oficial. Só apresenta total de equipes quando a tabela publicada contém posições contíguas desde o primeiro lugar.
- Aviso de próxima partida ausente é omitido após eliminação confirmada. Sem calendário ou classificação, mantém estados vazios explícitos e valores ausentes como travessões.
- Layout usa a largura disponível do contêiner Paulista (incluindo expansão da sidebar), com colunas empilhadas e faixa de números em duas colunas no celular. Temporada tem nome no seletor; atualizar dados e site da federação ganham texto onde há espaço e preservam rótulos acessíveis no formato compacto.
- Jogos mantêm filtros e ações existentes, com chips para remover cada filtro individualmente e meses com capitalização normal.
- Classificação preserva ordem e números. Posição/equipe permanecem visíveis ao rolar horizontalmente em telas estreitas; nomes longos truncam e estatísticas compartilham alinhamento com o cabeçalho. Siglas têm explicação ao focar com teclado ou passar o mouse.
- Sem alterações no backend, nos snapshots, na sincronização ou nas regras de avanço do chaveamento.
