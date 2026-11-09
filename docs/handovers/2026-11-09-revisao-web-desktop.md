# Handover técnico · revisão do Web e do Desktop

Trabalho na `develop`. Os dados oficiais foram lidos do Supabase para a conferência visual. Os testes que criam chamados, suspendem contas ou alteram a rotina do Paulista usaram o PostgreSQL isolado.

## 1. O que mudou e como foi conferido

| Área | Entrega | Conferência |
| --- | --- | --- |
| Web · Competições | O Paulista ocupa a entrada principal. Competições anteriores têm uma consulta separada, com as ações legadas para os registros existentes. O fluxo de criação saiu do Web. | Abertura por Enter, clique em Ver jogos, foco na aba, Voltar e consulta de torneio anterior. |
| Web · Visão geral e Jogos | A prévia usa os mesmos confrontos e escudos do chaveamento. Lista inicial por data. Cards em grade contínua, usando os componentes de Partidas. | Clique na prévia, poucos/muitos/zero jogos, grade de três, duas e uma coluna e ambos os temas. |
| Web · Classificação | Cortes do regulamento por série e temporada. Iniciação A2 de 2026 tem três faixas. Base A3 de 2026 mantém A, B e C separados e indica as posições que dependem do índice técnico. | Grupo único com marcas nas posições 1, 9 e 17. Troca de grupo e Voltar na Base. |
| Web · Chaveamento | Quartas, semifinais e final com centros calculados. Empates podem usar as posições publicadas do confronto. Cada lado de um jogo tem até uma origem. Casos sem prova ficam com o estado Ligação não confirmada. | Oito SUBs do Ocian, 20 chaves, alinhamento das linhas e títulos, limite de duas entradas, detalhes da partida, ambos os temas e rolagem em largura móvel. |
| Web · Suporte e login | Suporte acima do clube com tooltip do Web. A confirmação excepcional sai da entrada normal e chega ao usuário pela mensagem enviada após aprovação. | Hover, foco, Enter, toque em viewport móvel e código inválido no Web. Aprovação independente, link no e-mail simulado, confirmação única e revogação da sessão na API. |
| Desktop · Chamados | Suporte cria relato com clube, plataforma, tela e descrição. Meus chamados inclui relatos abertos pela pessoa mesmo após troca de fila. Desenvolvimento consulta encaminhados e erros técnicos automáticos sem restrição, registra retorno e devolve ao atendimento. | Suporte criou e encaminhou, Desenvolvimento consultou e devolveu, Administração finalizou. API negou criação e operações de conta ao desenvolvedor. |
| Desktop · Usuários | A lista separa equipe Ludora de contas de clube. Mostra vínculos, cargos e estado. Encerrar sessões e mudar acesso abrem confirmação com nome, e-mail e efeito. | Cancelamento em uma conta e suspensão de outra. Antes de confirmar, a segunda conta entrou normalmente. Depois, o login e o token dela foram bloqueados, e o desenvolvedor continuou entrando. |
| Desktop · Paulista | Cards por clube, SUBs expansíveis, alertas com vínculo ao jogo e histórico. Atualizar painel, consultar a Federação e controlar o acompanhamento têm ações distintas. | Electron com Ocian Sandbox com dois alertas e Santos Sandbox com zero. Alerta abriu o jogo certo. A rotina mudou pelo interruptor e a consulta imediata abriu confirmação separada. Consulta somente leitura no Supabase confirmou Ocian e Santos com oito SUBs vinculados cada. |
| Desktop · Visual | Chamados, Clubes, Usuários e Paulista usam o `Toast` do Web. Os cards usam superfícies neutras e hover com os tokens do tema. | A ação que gera “Alteração registrada.” mostrou o mesmo `Toast` do Web. |

Os cortes seguem o art. 6º do regulamento de Iniciação A2 e o art. 4º do regulamento de Base A3 de 2026. A Base inclui critérios diferentes para terceiros e sextos colocados. A tela mantém as posições oficiais de cada grupo e apresenta o critério junto da tabela. [REC de Iniciação A2](https://falandolivesports.com.br/wp-content/uploads/2026/09/REGULAMENTO-PAULISTA-INICIACAO-A2.pdf#page=2) · [REC de Base A3](https://falandolivesports.com.br/wp-content/uploads/2026/09/REGULAMENTO-CAMPEONATO-PAULISTA-2026-BASE-A3.pdf#page=2) · [Súmula Online FPFS](https://eventos.admfutsal.com.br/)

## 2. Arquivos

| Arquivos | Propósito |
| --- | --- |
| `apps/web/src/pages/Competicoes.{tsx,css}` | Entrada do Paulista e arquivo de competições anteriores. |
| `apps/web/src/pages/Paulista.{tsx,css}` | Navegação por URL, prévia visual, grade e estilos dos módulos do Paulista. |
| `apps/web/src/components/PaulistaBracket.tsx`, `PaulistaStandings.tsx` e `apps/web/src/utils/paulistaView.ts` | Confrontos, geometria, validação de vínculos e cortes publicados. |
| `apps/web/src/components/{Layout,PublicLayout,SupportButton}.tsx`, `ClubWorkspace.css` e `apps/web/src/pages/Login.tsx` | Localização e acesso ao Suporte. A confirmação excepcional sai do login comum. |
| `services/api/src/modules/suporte/{routes,operational.routes}.ts`, `services/api/.env.example` e `scripts/dev-stack.cjs` | Permissões, chamado manual, acompanhamento e endereço confiável para a confirmação excepcional. |
| `apps/desktop/src/renderer/src/pages/{Chamados,Usuarios,Paulista,ClubeDetalhe}.tsx`, `components/{ChamadoManual,CadastroPendente,ClubeOperacoes}.tsx` e `styles/desktop.css` | Fluxos do painel e reaproveitamento dos controles e avisos do Web. |
| `services/api/src/modules/paulista/{operations,service,routes}.ts` | Alertas associados aos clubes do jogo e histórico filtrado da divergência. A mesma função compara os placares no resumo e no detalhe. |
| `apps/web/tests/paulistaView.test.mjs`, `services/api/tests/{suporte,suporte-operacoes,paulista-operacional}.integration.ts` e `apps/desktop/tests/{equipe,clubes,usuarios,paulista-operacional}-smoke.cjs` | Exercitam desempate publicado, permissões, recuperação após falha de banco, e-mail de confirmação, alertas, aviso visual e a conta selecionada. |

## 3. Antes e depois

`ClubeDetalhe.tsx` reutiliza o aviso que o Web já usa. O componente cuida da leitura por tecnologia assistiva, do fechamento e do tempo na tela.

```diff
- {aviso && <div className="notice-ok" role="status">{aviso}</div>}
+ <Toast message={aviso} onClose={() => setAviso('')}/>
```

`paulistaView.ts` considera empate sem classificação do confronto como inconclusivo. Se as duas posições oficiais identificam os participantes, usa a posição vencedora e só liga a um jogo posterior compatível.

```diff
- if (!temResultado(origem) || origem.golsMandante === origem.golsVisitante) continue;
+ const vencedor = vencedorPublicado(s, origem);
+ if (etapa < 0 || !vencedor) continue;
```

`Usuarios.tsx` guarda a conta e os dados da ação no momento em que abre a confirmação. O clique final usa esse registro.

```diff
- await revogarSessoes(selecionado.id);
+ const { conta, alteracao } = confirmacao;
+ if (alteracao) await requestJson(`/admin/usuarios/${conta.id}/controle`, { method: 'PATCH', body: alteracao });
+ else await revogarSessoes(conta.id);
```

`operations.ts` usa os vínculos oficiais das duas equipes e as participações do jogo no Ludora para atribuir um alerta. O link do alerta carrega o clube, o evento, o jogo e o tipo da pendência. Isso distingue duas divergências do mesmo confronto.

## 4. Comandos e evidências

```powershell
pnpm build:web
pnpm build:desktop
pnpm test:app:completo
pnpm test:desktop
git diff --check
```

A suíte geral passou com 529 casos e a suíte do Desktop passou com quatro. Os builds passaram. Os testes de integração usam a configuração isolada em `.local-demo/equipe`.

```powershell
# Com a API isolada da equipe rodando na porta 3018
pnpm --filter @ludora/api exec tsx tests/suporte.integration.ts
pnpm --filter @ludora/api exec tsx tests/paulista-operacional.integration.ts
node apps/desktop/tests/paulista-operacional-smoke.cjs
node apps/desktop/tests/clubes-smoke.cjs
node apps/desktop/tests/usuarios-smoke.cjs
node apps/desktop/tests/equipe-smoke.cjs
```

Os scripts Electron precisam do Playwright no `NODE_PATH`. Rode `equipe-smoke.cjs` separadamente, pois ele para e religa o banco isolado para conferir a recuperação. A sequência da API isolada e do Web em `5198` está no [handover do painel operacional](2026-11-08-painel-operacional.md). Para uso diário, a entrada continua sendo `pnpm dev`.

Capturas locais em `test-results/revisao-visual/` incluem `antes-competicoes.png`, `depois-competicoes.png`, `antes-chaveamento.png`, 56 capturas `chave-*.png`, `desktop-toast-web.png` e `desktop-usuarios-confirmacao-claro.png`. As capturas `paulista-carregando.png` e `paulista-erro.png` registram a falha simulada no Web. O botão Tentar novamente recuperou a mesma tela. O teste do Paulista no Desktop grava `test-results/paulista-operacional/clubes-com-e-sem-alertas.png` e `clubes-900.png`. O teste de Clubes grava `test-results/clubes/alteracao-toast-claro.png`.

## 5. Limites e configuração

- Alguns endereços de escudo publicados pela Federação retornam 404. O chaveamento mostra o fallback do `ClubBadge` nessas equipes.
- A confirmação excepcional usa `LUDORA_WEB_URL` como origem do link. Em desenvolvimento, o padrão é `http://localhost:5173`. No Render, configure a origem do Web ao publicar a API. O envio foi validado com provedor simulado.
- Encerrar sessões desconecta os dispositivos. Suspender conta também bloqueia novas entradas. A tela oferece essas duas operações.

## 6. Prompt para estudo

> Use este handover e o código do Ludora para me ensinar React, TypeScript e Express passo a passo. Comece pelo clique em Ver jogos e mostre como a URL guarda a aba. Depois pegue um empate oficial e explique como o código confirma a ligação com a fase seguinte e calcula os pontos da linha no SVG. No Desktop, siga um chamado de suporte até a devolução de desenvolvimento e uma confirmação de conta até a validação da API. Abra cada função relevante, explique os parâmetros, as condições, o retorno e a diferença entre estado da interface e dados persistidos. Use exemplos novos em inglês e preserve o código durante o estudo.
