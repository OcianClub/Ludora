# Auditoria de responsividade do web

Auditoria executada em 02/11/2026, preservando os tokens, a navegação e as funcionalidades existentes. O alvo é `apps/web`, incluindo seu uso pelo Electron; o aplicativo React Native não foi alterado nesta auditoria.

## Problemas encontrados e corrigidos

| Área | Problema observado | Correção |
| --- | --- | --- |
| Sidebar em tablets | A barra expandida tinha 238 px, mas o conteúdo mantinha a margem de 80 px. | A margem acompanha a largura real da sidebar. |
| Primeiro clique em tablets | Um toque no conteúdo recolhia a sidebar no `pointerdown`, deslocando o botão antes do clique. Modais não abriam no primeiro toque. | A barra com espaço reservado permanece aberta até recolhimento explícito ou navegação. |
| Grids com sidebar expandida | A janela ainda comportava o breakpoint desktop, embora os cards tivessem pouco espaço real. | Container queries no conteúdo: Visão geral e skeletons em uma coluna quando necessário; filtros, Perfil e Times também respondem ao espaço disponível. |
| Dropdowns compartilhados | As opções ultrapassavam a parte inferior da tela; nomes sem espaços criavam rolagem horizontal. | `Choice` e `FilterSelect` usam o mesmo cálculo de posição e altura disponível, abrem para cima quando necessário e permitem quebra de opções longas. Dentro de modais continuam no fluxo com rolagem interna. |
| Avisos de rodapé | Uma mensagem longa disputava espaço com o botão de ação, podendo ultrapassar a tela verticalmente. | Grid com área flexível para a mensagem; no celular a ação ocupa uma segunda linha. |
| Painel lateral de Times | A largura em `100vw` ignorava o espaço reservado à barra de rolagem e deslocava o painel 4 px para fora da tela. | Largura relativa à área disponível. O mesmo ajuste foi aplicado às folhas de convite e eventos. |
| Nomes de times extensos | Alongavam excessivamente o placar e o cabeçalho do painel. | Limite visual de duas linhas, mantendo o nome completo acessível e tooltip apenas quando truncado. |
| Formulários e modais | Grids com largura mínima implícita e textos extensos podiam disputar espaço com os campos. | Colunas com `minmax(0, 1fr)`, quebra de textos e altura máxima com `dvh`. |
| Competições no celular | Busca, dois filtros e seletor de visualização consumiam várias linhas. | Busca e botão quadrado de filtros na mesma linha; filtros no modal compartilhado; contador e visualização alinhados abaixo. |
| Perfil do jogador | Colunas de prévias e paginação tinham restrições desnecessárias. | Colunas com mínimo zero, paginação com quebra e espaçamento e tratamento de textos longos. |
| Campos em dispositivos touch | Fontes pequenas podem disparar zoom automático ao focar no Safari. | Texto de entrada com 16 px em telas touch pequenas, mantendo alturas e placeholders compactos. É uma medida preventiva; Safari físico não foi testado. |

Não foi aplicado `overflow: hidden` à página para mascarar problemas. Tabelas que precisam de mais largura mantêm sua rolagem horizontal local. O conteúdo continua limitado a uma largura de leitura em monitores ultrawide.

## Cobertura

Foram percorridas 19 rotas: login, cadastro, recuperação de senha, convite, selecionar clube, Visão geral, Partidas, Solicitações, detalhes da partida, Jogadores, perfil do jogador, histórico do jogador, campeonatos do jogador, Scout, Times, Competições, Pessoas e acessos, Perfil e Configurações do clube.

Componentes inspecionados incluem sidebar expandida/contraída, navegação inferior e menu Mais, conta, notificações, filtros, inputs, controles de visualização, cards, tabelas, skeletons, avisos, modais e dropdowns. Na preparação foram verificados Dados, Escalação e Revisão. No jogo foram verificados placar, seleção do autor do gol, substituição, encerramento, resultado e compartilhamento.

### Resoluções e estados

- Matriz principal, tema escuro: **320×740, 360×780, 390×844, 480×800, 600×900, 768×1024, 820×900, 1024×768, 1180×720, 1366×768, 1440×900, 1920×1080, 2560×1080 e 844×390**.
- Tema claro, nomes longos e sidebar expandida: larguras **320, 390, 600, 820, 1024, 1440 e 2560 px**, altura de 900 px.
- Modais e menus: **320×740, 390×480, 600×900, 820×600, 1024×768, 1366×620 e 844×390**.
- Dropdowns próximos à borda inferior, mensagens longas e títulos extensos: **320×480, 600×360 e 820×600**; escolha de opções também por teclado.
- Carregando, vazio e erro de consulta em Competições; Visão geral como visitante; placar e modais do jogo em **320, 820 e 1440 px**.
- Reflow equivalente a **200% de zoom em uma tela de 1366×768**: viewport CSS **683×384** com DPR 2, nas principais áreas autenticadas.
- Regressões existentes: login e três etapas do cadastro com teclado simulado (overlay e redimensionamento), Scout com filtros e gráficos, controles compartilhados e auditoria geral da interface nos temas claro e escuro.

## Testes reproduzíveis

Com o Vite em execução, os testes de navegador usam Playwright e Microsoft Edge. Eles interceptam a API com dados controlados, sem escrever no banco nem enviar convites ou notificações reais.

```powershell
$env:LUDORA_WEB_TEST_URL = 'http://127.0.0.1:5188'
node apps/web/tests/responsive-audit.cjs
node apps/web/tests/responsive-states.cjs
node apps/web/tests/responsive-components.cjs
node apps/web/tests/responsive-content-states.cjs
```

É necessário que o módulo `playwright` esteja disponível para o Node e que o Edge esteja instalado. Na sessão de auditoria foi utilizado o runtime de testes fornecido pelo Codex, sem adicionar dependências de produção.

O teste principal aceita `AUDIT_WIDTHS`, `AUDIT_THEME`, `AUDIT_LONG=1`, `AUDIT_EXPANDED=1`, `AUDIT_STRICT=1` e `AUDIT_SCREENSHOTS=all`. Resultados e screenshots são gerados em `test-results/responsive-audit/`, fora do código de produção. Para reprovar o processo por qualquer problema geométrico detectado, use `AUDIT_STRICT=1`.

O teste legado `collection-toolbar-smoke.cjs` foi atualizado para os componentes atuais: abas com ARIA de tablist, categoria compartilhada entre páginas e ausência intencional do seletor de visualização em alguns layouts de celular.

## Limites da validação

Os testes foram realizados no Edge/Chromium em ambiente local, com inspeção de screenshots. Não equivalem a testes físicos de Safari/iOS, Chrome/Android ou Electron instalado. O teclado foi simulado; zoom foi validado por reflow e DPR, não pelo comando nativo do navegador.

Solicitações reais ao backend, qualidade da conexão, permissões do sistema operacional e envio real de e-mails/push ficam fora desta auditoria visual. A validação de produção após o deploy e uma conferência em celulares físicos continuam recomendadas. Nenhum defeito geométrico permaneceu nos cenários aprovados; isso não garante todas as combinações possíveis de dados, navegador e tamanho de fonte do dispositivo.
