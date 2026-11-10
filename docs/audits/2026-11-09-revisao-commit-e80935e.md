# Revisão do commit e80935e — integração da operação Ludora

Data: 09/11/2026. Comparação: `6878af9..e80935e`.

## Conclusão

O commit é descendente direto do nosso último commit. Não houve perda dos nossos commits nem substituição integral da aplicação. A revisão encontrou duas falhas reproduzíveis nos novos fluxos: envio de suporte durante visita a clube sem vínculo e importação do Paulista com adversário desativado sem time local associado.

Esta rodada não corrige código: registra o que mudou, onde aparece e os impactos. Não foram executadas migrações, sincronizações reais, alterações de contas nem gravações no Supabase. Os testes de navegador interceptam as APIs e as reproduções adicionais substituem a persistência por objetos em memória.

## Escopo real do commit

140 arquivos: 60 adicionados e 80 modificados; 6.906 linhas adicionadas e 800 removidas. Distribuição: desktop 37, web 29, mobile 3, API 62, documentação 5, tipos compartilhados 1, scripts 2 e package.json 1. Não há alteração no lockfile.

O inventário integral está ao final. A análise concentra a leitura de fluxos e os testes nos cruzamentos com a auditoria anterior e nas novas regras de acesso, suporte, cadastro e importação. Não se trata de uma certificação de todos os caminhos possíveis em produção.

## Por que aparece pouca diferença no Web

| Entrega | Onde e quando aparece | Efeito |
| --- | --- | --- |
| Suporte | Ícone na lateral, área Mais no mobile e cabeçalho público para usuário autenticado | Novo chamado, lista dos próprios chamados, respostas e reabertura. |
| Captura de falhas | Bastidores do Web e da API | Erros não tratados do navegador e respostas 5xx de certas rotas podem gerar ocorrências correlacionadas. Não significa capturar todo erro tratado pela interface. |
| Competições anteriores | Menu de opções do Paulista, rota `/competicoes?arquivo=1` | Consulta de competições locais existentes, filtros e ações legadas de edição/arquivamento conforme permissão. Não há botão de criar nova competição nesse catálogo. O Paulista permanece na entrada principal. |
| Avisos do Paulista | Aba de avisos quando há pendências e cargo operacional | Distingue placar divergente, calendário, identidade e ocorrência; mostra o confronto e o estado da revisão. |
| Jogadores | Lista, perfil e formulário de edição | Componentes extraídos para compartilhamento com o desktop; visual principal do Web preservado. O formulário envia só os campos alterados e desabilita salvar sem alterações. |
| Clubes indisponíveis | Clube desativado pelo painel interno | Seleção bloqueada no Web/mobile, aviso de indisponibilidade e bloqueio de certas consultas públicas. |
| Confirmação de e-mail | `/confirmar-email`, após procedimento excepcional de suporte | Recebe novo e-mail e código. O fluxo envolve aprovação independente e revogação das sessões; não é uma nova opção normal no login. |
| Avisos cadastrais | Notificações dos administradores escolhidos no desktop | Pendências de CNPJ, endereço e escudo, com acompanhamento interno. |

Logo, abrir um clube ativo sem pendências não demonstra as mudanças de operação: grande parte depende de um estado específico ou do desktop.

## Desktop e backend: mudanças além do resumo enviado

- Novos papéis de plataforma `SUPORTE` e `DESENVOLVEDOR`, independentes de administrador/técnico de um clube. O servidor reconsulta o cargo; não se limita a esconder itens do menu.
- Equipe interna e diagnóstico de serviços; chamados com filas, histórico, encaminhamento, devolução e resolução.
- Manutenção por função e alcance, com protocolo e histórico: criação de partidas, competições locais, convites, sincronização do Paulista e agenda oficial. A data de revisão NÃO reativa automaticamente a função.
- Gestão de usuários: filtros, suspensão, mudança de cargo e encerramento de sessões. A mudança de cargo/suspensão revoga sessões e a autenticação passa a consultar `suspenso`.
- Cadastro de clube com CNPJ, endereço/CEP, escudo e seleção de SUBs; reaproveitamento de times existentes elegíveis por ID, preservando os IDs esportivos.
- Gestão de categorias e elenco no desktop; reutiliza regras de camisa do backend. Exclusão de atleta com histórico vira desativação; atleta vinculado a partida ao vivo é bloqueado para essa operação.
- Tarefas cadastrais destinadas a administradores escolhidos, com prévia, prevenção de duplicação e encerramento quando o cadastro é completado.
- Recuperação de acesso, localização/reenvio de convites e troca excepcional de e-mail, com controles de permissão, limites e trilha de atendimento.

Foram adicionadas sete migrações, incluindo oito novos modelos operacionais: SuporteChamado, SuporteHistorico, SuporteAcao, RecuperacaoExcepcional, Manutencao, ManutencaoHistorico, TarefaCadastroClube e AuditoriaContaInterna. Também entram os estados de clube/categoria e suspensão de usuário. O usuário já confirmou `migrate status` atualizado; esta rodada não alterou o banco.

## O que mudou no Paulista de fato

Não foi somente uma alteração de textos. O importador agora separa alterações de calendário, resultado, identidade e ocorrência. Introduziu registro de projeção local para decidir se uma partida pode receber uma atualização oficial sem sobrescrever contribuição do clube.

- Partida importada sem contribuição local pode receber novo placar, finalização e alterações de agenda. A operação é auditada no ID existente.
- Eventos, escalações, auditoria local e confirmação/publicação de equipe impedem a atualização automática daquela partida; divergências seguem para conferência.
- Mudanças de participantes/fase e vínculos ambíguos são tratadas separadamente. Há pausa de operação e revisão administrativa.
- O resumo administrativo cruza os vínculos dos dois clubes e as participações para atribuir os alertas.
- `provider.ts`, os componentes de classificação/chaveamento e `paulistaView.ts` não mudaram neste commit. Não houve alteração neste diff do parser da fonte nem da lógica visual de cortes e conexões que já existia.

Isso não comprova que cada dado atualmente salvo equivale à Federação: nenhuma nova consulta à fonte foi feita. A revisão é do comportamento da integração e de sua proteção aos registros locais.

## Cruzamento com nossas mudanças

Dos 43 arquivos alterados na auditoria entre `3afad36` e `6878af9`, 36 ficaram byte a byte iguais. Os sete cruzamentos são:

| Arquivo | Alteração do amigo | Avaliação |
| --- | --- | --- |
| App.tsx | Rota ConfirmarEmail | Adição; controles anteriores de sessão preservados. |
| PublicAccess.tsx | Bloqueio de clube inativo | Muda deliberadamente a disponibilidade do clube; não remove o isolamento de conta/aba. |
| ClubePerfil.tsx | Usa ClubSettingsSection | Extração de estrutura visual; restrições de identidade do clube mantidas. |
| JogadorPerfil.tsx | Usa PlayerProfileHeader | Mantém as abas atuais, histórico e Scout contextual. |
| Jogadores.tsx | Usa PlayerRosterCells | Mantém InlinePlayerShirt, filtros, listagem e acesso à ficha. |
| Paulista.tsx | Textos e composição de pendências | Navegação, filtros, carregamento e visão principal preservados. |
| services/api.ts do Web | Cabeçalho x-request-id e tipo Clube.ativo | Cache e verificações de contexto anteriores preservados. O CORS já permite esse cabeçalho. |

Partidas.tsx, PartidaDetalhe.tsx, Scout, componentes de skeleton/conexão/cache, o serviço de sincronização das camisas e o parser do Paulista não foram substituídos por esse commit. Os testes abaixo confirmam parte dessas interações na versão integrada. Não encontrei interferência comprovada das nossas alterações sobre as funcionalidades novas; a cobertura descrita abaixo tem limites.

## Falhas confirmadas e decisões que precisam ficar claras

### P2 — suporte disponível na interface, mas recusado para visitante sem vínculo

O SupportButton exige somente token. requestJson envia o clube atualmente consultado; POST `/suporte` exige vínculo UsuarioClube quando recebe x-clube-id.

Reprodução com HTTP e autenticação reais, persistência substituída: usuário logado visitando clube sem vínculo envia formulário válido; retorna 403 `Você não participa deste clube.` e nenhum chamado é criado. O mesmo relato sem clube retorna 201; com vínculo TORCEDOR também retorna 201.

Referências: `apps/web/src/components/SupportButton.tsx:28`, `services/api/src/modules/suporte/routes.ts:35`. O registro automático de ocorrências possui restrição equivalente.

Correção sugerida: aceitar suporte de uma conta autenticada mesmo sem vínculo, separando o clube visitado do clube operacional autorizado; nunca conceder acesso gerencial em razão desse contexto.

### P2 — adversário inativo pode abortar a importação do Paulista

O importador filtra os vínculos operacionais ativos. Entretanto, ao precisar materializar o time adversário ainda inexistente localmente, `casca()` encontra seu vínculo de clube e chama `categoria()`, que exige clube e categoria ativos.

Reprodução com o importador real e persistência em memória: Harbor ativo contra River vinculado a clube inativo, sem time local projetado para River; a importação lança 409 `Clube 3 sem categoria Sub-7; conferir cadastro antes de distribuir.`. Como a operação real está numa transação única, esse caminho pode impedir a atualização do evento inteiro. O mesmo problema de pré-condição merece cobertura para categoria inativa.

Referências: `services/api/src/modules/paulista/service.ts:35`, `:46`, `:107`, `:166`.

Correção sugerida: separar a representação esportiva do adversário da permissão de operar pelo clube desativado. Preservar identidades e histórico; não inferir novo vínculo pelo nome. Testar o cenário antes de alterar essa parte da integração.

### Política de clube desativado: consulta histórica não é uniforme

O texto da gestão diz que consulta e histórico ficam disponíveis. Entretanto, WorkspaceAccess bloqueia a maioria das páginas desse clube; a lista pública de partidas retorna 423, embora o perfil público do clube retorne 200. A reprodução HTTP confirmou os dois status. Acesso direto a certas partidas tem tratamento próprio.

Isso combina com a declaração do amigo de bloquear a entrada no clube, mas diverge da mensagem de histórico disponível. Precisa de uma definição de produto/texto consistente; não é evidência de exclusão de dados.

### pnpm dev passou a impor uma pilha local com desktop

Inicia API, ML, mobile, Web e desktop. Força VITE_API_URL local no Web, PYTHON_AI_URL local na API e endereço LAN local no mobile; o desktop utiliza o endereço local da pilha. O banco continua dependendo do .env da API e pode ser Supabase remoto. `killOthersOn: 'failure'` significa que falha de um serviço pode encerrar o conjunto.

Isso não é uma migração de banco nem afeta o build preview por si só, mas muda o comportamento cotidiano. Para selecionar outro backend no desktop, o próprio código orienta `pnpm dev:desktop` separado. Configurações de Render precisam continuar coerentes no deploy.

## Testes executados nesta revisão

| Verificação | Resultado e limite |
| --- | --- |
| test:app:completo | 569 testes, 569 aprovados, zero falhas/pulados. Inclui build TypeScript da API; configuração dos testes impede herdar credenciais reais. |
| TypeScript do Web e desktop | Aprovado. |
| build:web e build:desktop | Ambos aprovados, incluindo empacotamento de produção das interfaces. Build não equivale a instalar/executar um APK ou testar as operações no Electron. |
| test:desktop | 4 testes aprovados; regras de URL/IPC. Não equivale aos novos fluxos visuais completos do Electron. |
| competition-overview-smoke | 8 combinações: 320, 390, 820 e 1440 px, ADMIN/TORCEDOR. Abas, filtros, retorno, estados vazios/indisponíveis e catálogo anterior; sem escritas oficiais. |
| session-isolation-smoke | 3 cenários aprovados: inicialização lenta, logout em outra aba e troca de conta. |
| shirt-cross-page-smoke | 390 e 1366 px aprovados: Jogadores/preparação, Socket.IO, reconexão, rascunho e remoção de titular/reserva sem camisa, preservação do snapshot finalizado. |
| player-profile-smoke | 320, 390, 820, 1024 e 1440 px aprovados; abas, resultados, Scout contextual, edição/foto/camisa/histórico. Visitante em 320 e 1440 px sem edição/dados restritos. Executado com a URL adaptada em memória para a porta 5193, sem editar o teste do projeto. |
| Reprodução adicional de suporte | 403 sem vínculo versus 201 sem contexto de clube/com vínculo; recusou token suspenso; clube inativo 200 no perfil versus 423 na lista pública de partidas. |
| Reprodução adicional do importador | Atualiza placar sem contribuição; preserva com evento, escalação ou equipe pronta e abre pendência; reproduziu 409 com adversário inativo sem time projetado. Persistência em memória, não PostgreSQL. |
| git diff --check | Sem erros no commit. |

Os novos arquivos `*.integration.ts` e `*-smoke.cjs` não são todos executados pelo comando geral. Os testes operacionais novos dependem de uma configuração e PostgreSQL isolados que não existem nesta cópia (`.local-demo/equipe/config.json` ausente). Não executei esses scripts contra o Supabase para compensar essa ausência. As alegações de testes e capturas nos handovers do amigo são relatos dele, não resultados reexecutados aqui.

Scripts temporários locais de reprodução: `.git/audit-friend-repro.cjs` e `.git/audit-friend-paulista.cjs`. Saída da suíte geral: `.git/audit-friend-tests.log`. Não contêm credenciais reais.

## Pendências recomendadas

1. Corrigir os dois casos reproduzidos, com testes de regressão dedicados.
2. Definir claramente a política de histórico para clubes desativados e alinhar a mensagem.
3. Preparar um PostgreSQL descartável para reexecutar as integrações de suporte, manutenção, contas e Paulista; não usar a base compartilhada para esses testes.
4. Validar e-mails com provedor configurado no ambiente de publicação; configurar LUDORA_WEB_URL para o domínio do Web. Nenhum e-mail real foi enviado nesta revisão.
5. Validar APK em dispositivo e fluxos completos no Electron; não foram exercitados nesta rodada.

## Inventário integral do commit

`A`: adicionado; `M`: modificado. Caminhos relativos à raiz do Ludora.

```text
M	apps/desktop/electron.vite.config.ts
M	apps/desktop/src/main/config.ts
M	apps/desktop/src/main/ipc.ts
M	apps/desktop/src/renderer/src/App.tsx
M	apps/desktop/src/renderer/src/components/AdminLayout.tsx
A	apps/desktop/src/renderer/src/components/CadastroPendente.tsx
A	apps/desktop/src/renderer/src/components/CargoClube.tsx
A	apps/desktop/src/renderer/src/components/ChamadoManual.tsx
A	apps/desktop/src/renderer/src/components/ClubeCadastroFields.tsx
A	apps/desktop/src/renderer/src/components/ClubeElenco.tsx
M	apps/desktop/src/renderer/src/components/ClubeOperacoes.tsx
A	apps/desktop/src/renderer/src/components/ExcluirIcone.tsx
A	apps/desktop/src/renderer/src/components/MotivoTiles.tsx
A	apps/desktop/src/renderer/src/components/OptionTiles.tsx
M	apps/desktop/src/renderer/src/components/PaulistaReview.tsx
A	apps/desktop/src/renderer/src/components/ReaproveitarTime.tsx
A	apps/desktop/src/renderer/src/components/SupportOperations.tsx
A	apps/desktop/src/renderer/src/components/UsuarioClubeEditor.tsx
M	apps/desktop/src/renderer/src/main.tsx
A	apps/desktop/src/renderer/src/pages/Chamados.tsx
M	apps/desktop/src/renderer/src/pages/ClubeDetalhe.tsx
M	apps/desktop/src/renderer/src/pages/Clubes.tsx
A	apps/desktop/src/renderer/src/pages/Equipe.tsx
M	apps/desktop/src/renderer/src/pages/Login.tsx
A	apps/desktop/src/renderer/src/pages/Manutencao.tsx
M	apps/desktop/src/renderer/src/pages/Paulista.tsx
M	apps/desktop/src/renderer/src/pages/Usuarios.tsx
M	apps/desktop/src/renderer/src/pages/Visao.tsx
M	apps/desktop/src/renderer/src/services/api.ts
M	apps/desktop/src/renderer/src/styles/desktop.css
M	apps/desktop/src/shared/rules.ts
A	apps/desktop/tests/clubes-smoke.cjs
A	apps/desktop/tests/equipe-smoke.cjs
A	apps/desktop/tests/manutencao-smoke.cjs
A	apps/desktop/tests/paulista-operacional-smoke.cjs
A	apps/desktop/tests/suporte-smoke.cjs
A	apps/desktop/tests/usuarios-smoke.cjs
M	apps/mobile/app/(tabs)/perfil/notificacoes.tsx
M	apps/mobile/src/screens/ClubesExplorer.tsx
M	apps/mobile/src/services/api.ts
M	apps/web/src/App.tsx
A	apps/web/src/components/ClubSettingsSection.tsx
M	apps/web/src/components/ClubWorkspace.css
M	apps/web/src/components/Layout.tsx
M	apps/web/src/components/PaulistaHeader.tsx
M	apps/web/src/components/PlayerEditDialog.tsx
A	apps/web/src/components/PlayerProfileContent.tsx
A	apps/web/src/components/PlayerRosterCells.tsx
M	apps/web/src/components/PlayerShirtDialog.tsx
M	apps/web/src/components/PublicAccess.tsx
M	apps/web/src/components/PublicLayout.tsx
A	apps/web/src/components/SupportButton.tsx
M	apps/web/src/main.tsx
M	apps/web/src/pages/ClubePerfil.tsx
M	apps/web/src/pages/Competicoes.css
M	apps/web/src/pages/Competicoes.tsx
A	apps/web/src/pages/CompeticoesAnteriores.tsx
A	apps/web/src/pages/ConfirmarEmail.tsx
M	apps/web/src/pages/JogadorPerfil.css
M	apps/web/src/pages/JogadorPerfil.tsx
M	apps/web/src/pages/Jogadores.tsx
M	apps/web/src/pages/Paulista.css
M	apps/web/src/pages/Paulista.tsx
M	apps/web/src/pages/SelecionarClube.tsx
M	apps/web/src/services/api.ts
A	apps/web/src/services/requestId.ts
A	apps/web/src/services/supportErrors.ts
M	apps/web/src/utils/notifications.ts
M	apps/web/tests/competition-overview-smoke.cjs
A	docs/competicoes-paulista.md
A	docs/handovers/2026-11-08-painel-operacional.md
A	docs/handovers/2026-11-09-ajustes-operacao.md
A	docs/handovers/2026-11-09-clubes-interface-desktop.md
A	docs/handovers/2026-11-09-revisao-web-desktop.md
M	package.json
M	packages/shared-types/src/admin.ts
A	scripts/dev-stack.cjs
M	scripts/start-mobile.cjs
M	services/api/.env.example
A	services/api/prisma/migrations/20261108120000_papeis_internos/migration.sql
A	services/api/prisma/migrations/20261108130000_chamados/migration.sql
A	services/api/prisma/migrations/20261108140000_acoes_suporte/migration.sql
A	services/api/prisma/migrations/20261109100000_manutencao_operacional/migration.sql
A	services/api/prisma/migrations/20261109110000_cadastro_operacional/migration.sql
A	services/api/prisma/migrations/20261109120000_usuarios_e_tarefas/migration.sql
A	services/api/prisma/migrations/20261109140000_vinculo_manutencao/migration.sql
M	services/api/prisma/schema.prisma
M	services/api/src/app.ts
M	services/api/src/auth/jwt.ts
M	services/api/src/middlewares/http-errors.middleware.ts
M	services/api/src/middlewares/permissoes.middleware.ts
M	services/api/src/modules/admin/admin.routes.ts
M	services/api/src/modules/admin/admin.rules.ts
A	services/api/src/modules/admin/cadastro-clube.ts
A	services/api/src/modules/admin/equipe.ts
A	services/api/src/modules/admin/tarefas-cadastro.ts
M	services/api/src/modules/auth/auth.routes.ts
M	services/api/src/modules/auth/recuperacao.routes.ts
M	services/api/src/modules/cadastros/cadastro.routes.ts
M	services/api/src/modules/clubes/clube.routes.ts
M	services/api/src/modules/clubes/perfil-clube.routes.ts
M	services/api/src/modules/convites/convite-admin.routes.ts
M	services/api/src/modules/convites/convite-publico.routes.ts
M	services/api/src/modules/jogadores/elenco.rules.ts
M	services/api/src/modules/jogadores/elenco.service.ts
M	services/api/src/modules/jogadores/jogador.routes.ts
M	services/api/src/modules/jogadores/perfil.routes.ts
A	services/api/src/modules/manutencao/routes.ts
A	services/api/src/modules/manutencao/service.ts
M	services/api/src/modules/partidas/compartilhadas.routes.ts
M	services/api/src/modules/partidas/compartilhadas.service.ts
M	services/api/src/modules/partidas/partida.routes.ts
A	services/api/src/modules/paulista/chamados.ts
M	services/api/src/modules/paulista/operations.ts
M	services/api/src/modules/paulista/routes.ts
M	services/api/src/modules/paulista/rules.ts
M	services/api/src/modules/paulista/service.ts
M	services/api/src/modules/publico/publico.routes.ts
A	services/api/src/modules/suporte/operational.routes.ts
A	services/api/src/modules/suporte/operations.ts
A	services/api/src/modules/suporte/routes.ts
A	services/api/src/modules/suporte/rules.ts
A	services/api/src/modules/suporte/service.ts
A	services/api/src/services/iniciar-recuperacao.ts
M	services/api/tests/admin.http.test.ts
M	services/api/tests/convite-aberto.http.test.ts
M	services/api/tests/convite-codigo.http.test.ts
M	services/api/tests/elenco.test.cjs
A	services/api/tests/equipe.integration.ts
A	services/api/tests/equipe.test.ts
M	services/api/tests/identidade-privilegiada.http.test.ts
A	services/api/tests/manutencao.integration.ts
A	services/api/tests/paulista-operacional.integration.ts
M	services/api/tests/paulista.integration.ts
M	services/api/tests/shared-schedule.test.ts
A	services/api/tests/suporte-operacoes.integration.ts
A	services/api/tests/suporte.integration.ts
A	services/api/tests/suporte.test.ts
M	services/api/tests/times.test.cjs
M	services/api/tests/webInteractions.http.test.ts
```
