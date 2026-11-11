# Ludora Desktop — administração de clubes e alterações locais desde a base remota

Data: 10/11/2026. Relatório consolidado da administração de clubes, auditoria e agrupamento de adversários por clube/SUB. Incorpora integralmente o complemento `2026-11-10-clubes-agrupamento-subs.md`; este é o documento principal para o repasse.

## 1. Referência da comparação e preservação do trabalho

| Item | Referência verificada |
| --- | --- |
| Repositório local | `E:\ESTUDO PROGRAMACAO\projetos\Ludora` |
| Branch | `develop` |
| Remoto | `origin` — `https://github.com/OcianClub/Ludora.git` |
| Base | `origin/develop`, atualizado por `git fetch origin develop` durante esta tarefa |
| Commit da base e de HEAD | `d82c3258a02a3576ba34f371c38fa18ee502d32c` |
| Commit | `(desktop): ajustes visuais`, 10/11/2026 08:08:52 -0300 |
| Commits locais acima da base | Nenhum: `git log origin/develop..HEAD` vazio |

O Git local não identifica com certeza o instante do último push de todas as pessoas. A base verificável utilizada é o estado de `origin/develop` após o fetch. Este relatório considera o diff dos arquivos rastreados e os arquivos novos não rastreados; não se limita a commits.

Antes de editar, foram guardados o inventário, o patch preexistente, as referências e os hashes dos arquivos em `test-results/clubes-audit-baseline/`. O inventário ao final deste documento compara os hashes atuais com esse registro. Não houve commit, push, merge, rebase nem descarte de alterações existentes nesta tarefa.

## 2. Alterações locais que já existiam ao iniciar esta tarefa

As mudanças desta seção já estavam no diretório de trabalho e ainda não faziam parte da base remota acima. Foram preservadas. Os testes finais exercitam partes delas, mas isso não significa que cada fluxo operacional anterior tenha sido executado novamente contra serviços reais.

### Visão global e revisão de partidas

- Visão global reorganizada por atenção operacional, atividade atual, saúde dos serviços, totais da plataforma e listagem de clubes.
- Componentes de clubes com tabela/cards, busca, ordenação, escudos sobre fundo cinza, plano Demo e estado do clube; componentes reutilizáveis também empregados em outras telas.
- Resumo operacional com chamados abertos/atrasados, manutenções, situação da integração e partidas que precisam de revisão. Falha de uma consulta não é tratada como contagem zero.
- O aviso de mais de 24 horas utiliza a última transição registrada para `AO_VIVO`, e não a data prevista da partida. Partidas sem registro de início são apresentadas separadamente como duração desconhecida. Não houve encerramento automático das partidas de teste.
- Registro de transições de status na rota legada de partidas, mantendo a auditoria necessária para a regra acima.
- Solicitação de revisão ao responsável do clube organizador, com controle de permissão e intervalo de 24 horas entre lembretes. A criação do aviso e a eventual entrega push são coisas distintas; a entrega real não foi validada nesta tarefa.

### Componentes e identidade visual

- `DesktopMenu`, `DesktopSelect`, `DesktopToggle`, `DesktopTabs`, `DesktopTable` e `DesktopAccordion`, com estilos e documentação de uso.
- Menus com seleção em formato de rádio azul com centro branco, opções toggle, foco e navegação; select com painel ancorado e largura do controle.
- `AccountIdentity`, `CargoClube`, `DesktopUserTable`, `PlatformClubCollection`, `PaulistaEventCollection` e componentes de status/motivos.
- Reutilização de cores, ícones e componentes do web, incluindo chips de cargo, busca, tabelas e superfícies dos modais. As mudanças de estilo estão no desktop; não houve edição global dos tokens do web/mobile nesta tarefa.

### Usuários, acessos e cadastro pendente

- Tabela de usuários com ordenação, conta atual em destaque e chip “Você”, identificação por nome/e-mail e chips de cargo/situação.
- Filtros, edição de acesso e associação a clubes com componentes compartilhados.
- Cadastro dos clubes com pendências reais, seleção de destinatários, acompanhamento dos avisos e motivos predefinidos; texto livre reservado a “Outro”.
- Estilos de checkbox, superfícies internas e formulários ajustados para a hierarquia visual do desktop.

### Chamados e manutenção

- Criação e detalhe dos chamados com formulários reorganizados, filtros e prioridade de atendimento; finalizados agrupados por período em acordeões sem card adicional.
- Estado vazio sem superfície de card e melhorias de leitura dos horários e situações.
- API de suporte com contagem/filtro `FINALIZADOS`, ordenação opcional por prioridade e `incluirEncerramento=1` para consultar a data real de encerramento registrada no histórico. A ausência do parâmetro preserva a resposta anterior.
- Tela de manutenção com componentes reutilizados, motivos com ícones/cores e confirmação das consequências da pausa.
- Script e documentação locais de chamados de teste. O script de semeadura não foi executado no banco habitual durante esta tarefa.

### Logs, banco e integrações

- Logs com filtros de nível/texto/período, opções de ordenação, quebra de linhas, exportação e cópia; limite de 1.000 registros em memória.
- Classes visuais por método/status HTTP e duração: padrão abaixo de 1.000 ms, atenção a partir de 1.000 ms, muito lenta a partir de 3.000 ms. Esses limites são convenções de apresentação, não um diagnóstico da causa da lentidão.
- Banco e integrações reorganizados por saúde do banco, serviços, servidor e contagens agrupadas por área.
- Distinção entre serviço consultado e configuração disponível: e-mail configurado não garante entrega; armazenamento configurado não equivale a upload testado.

### Paulista e clubes

- Painel administrativo Paulista com filtros, agrupamentos, cards reutilizados, estados de acompanhamento, detalhes de sincronização, vínculos e calendário; metadados de temporada/divisão com melhor contraste.
- As mudanças pendentes do Paulista são de apresentação e uso dos contratos administrativos. Não foram modificados importador, cálculo da classificação ou regras de avanço da Federação nesta tarefa.
- Clubes já tinham cadastro em três etapas, rascunho local por conta/servidor, retomada/descarte e retorno à listagem. Os testes verificam essas funcionalidades.
- O botão de reaproveitar time foi corrigido para não submeter o formulário involuntariamente.
- Testes e relatórios anteriores acompanham essas mudanças no inventário final.

## 3. Implementado nesta tarefa

### Operação e acesso / cabeçalho do clube

- Painel com disponibilidade, pendências cadastrais e estrutura usando rótulos/valores alinhados; ações junto às informações relacionadas.
- Administradores identificados por nome/e-mail e função, sem nova pilha de cards internos. Não foi inventado um responsável legal onde não há esse dado.
- “Voltar para clubes” com seta e destino preservado quando a origem é a listagem filtrada.
- Chip de plano com dimensões e tipografia estáveis ao entrar/sair da edição e contraste maior; teste mede suas dimensões nos dois estados.
- Identificação da pessoa com fundo escuro no modal de alteração de acesso.

### Pessoas disponíveis / associação

- Novo `AddClubPerson`: pesquisa por nome/e-mail no servidor, páginas de 20 pessoas e botão de carregar mais, deduplicação e tratamento de carregamento, erro, retry e lista vazia.
- A consulta exclui qualquer vínculo com o clube selecionado, inclusive torcedor/visitante, e contas suspensas. Uma pessoa vinculada a outro clube continua elegível quando não pertence ao clube aberto.
- Associação usa POST próprio, com revalidação dentro de transação serializável. Se outra operação criou o vínculo, retorna conflito em vez de sobrescrever o cargo existente.
- Mantidas as restrições de categoria e de último administrador. Cliques repetidos bloqueados enquanto a operação está em andamento.
- A listagem do clube é atualizada após salvar e a próxima abertura do seletor consulta as opções elegíveis novamente.

### Estrutura e atividade

- Filtros de categoria/SUB à esquerda e ações da categoria à direita quando há espaço; grupos reorganizados em janelas menores.
- Confirmações identificam clube e categoria, explicam desativação versus remoção e exigem checkbox antes de habilitar a ação.
- Remoção com dependências continua bloqueada pelo backend; a alternativa de desativar abre sua própria confirmação.
- Atividade usa cabeçalho e tabela diretamente, sem card dentro de card; preserva dados durante atualização e trata erro de consulta.

### Convites

- `ClubeConvites` extraído do antigo bloco de operações, mantendo reexportação para os consumidores existentes.
- Criação com forma de entrega explícita, e-mail obrigatório/opcional conforme a escolha, informação de acesso administrativo e validade de 72 horas.
- Formulário preserva o preenchimento em erro e impede submissão simultânea. Falha no envio do e-mail é diferenciada de falha ao criar o convite.
- Tabela com chips de cargo/situação, validade, atualização e paginação de 20 itens.
- Consulta de código somente para convite pendente e não expirado, autorizada no backend e com `Cache-Control: no-store`; código legível, copiável e mantido apenas no estado do componente.
- Reenvio com confirmação de substituição do código/link anteriores e renovação por 72 horas. Estados permitidos seguem a API existente: pendente, expirado ainda registrado como pendente e revogado com e-mail; aceito é bloqueado. Convite sem e-mail não pode ser reenviado por e-mail.
- Clube desativado bloqueia criação, consulta do código e reenvio. Revogação continua disponível para inutilizar um convite pendente.
- O estado visual acompanha a expiração; a autorização e validade são conferidas novamente no servidor.

## 4. Contratos e banco afetados

### Reaproveitamento de time existente: complemento incorporado

O modal consultava `Time` local e agrupava por nome exato **e clube de origem**, depois de limitar a consulta a 60 linhas. `Aurora FC`, `Aurora FC sub-7` e cópias em clubes diferentes apareciam separados. Aurora FC e Estrela Azul constam nas seeds locais (`services/api/prisma/seed.ts` e `seed-clubes.cjs`). O endpoint já excluía times com `FpfsTime`; os prints não demonstram erro de importação da Federação.

A fonte foi consultada em 10/11/2026: a Federação publica eventos por temporada/divisão/categoria. O mesmo clube pode ter IDs diferentes, como Ocian no [SUB-7/A2, equipe 12423](https://eventos.admfutsal.com.br/evento/900/equipe/12423) e no [SUB-12/A3, equipe 13041](https://eventos.admfutsal.com.br/evento/925/equipe/13041), com o mesmo endereço e telefone publicados. Esses IDs não foram substituídos por uma identidade baseada apenas no nome.

- Um card por nome-base do clube, reunindo SUBs e cópias locais de outras origens. Normalização de caixa, espaços e acentos; o sufixo `sub-N` só é removido se corresponde à categoria do registro. Nomes próximos, abreviações e equipes A/B não são fundidos automaticamente.
- Agrupamento no servidor **antes** da paginação: 30 clubes por página, teto 50, busca e carregar mais. Busca aceita sufixos SUB de rascunhos antigos.
- Confirmação permite escolher SUBs de Iniciação/Base, sem avançar com seleção vazia ou sem registros elegíveis. Conferência opcional de origem permite excluir um cadastro homônimo; checkboxes refletem os SUBs selecionados.
- A escolha segue para Configuração e fica no rascunho. O envio filtra novamente os vínculos pelos SUBs finais, caso a pessoa altere a seleção depois.
- Criação revalida nome-base, IDs, categorias e disponibilidade em transação serializável; rejeita registro de outro grupo, time oficial protegido, vínculo já realizado ou categoria de origem ausente nos SUBs finais.
- IDs, jogos, placares e categorias de origem preservados. Nenhuma fusão retroativa em produção nem confirmação automática de identidades oficiais. A revisão FPFS continua no painel Paulista. Criar/alterar uma categoria em Estrutura não confirma outros vínculos oficiais por si só.

O agrupamento é uma sugestão para conferência humana, não prova de identidade jurídica. A prévia mostra uma amostra dos cinco confrontos recentes, filtrada pelos cadastros selecionados. Este complemento não acrescenta biblioteca nem migração.

### Endpoints

Todos os novos endpoints abaixo ficam sob a proteção administrativa existente, com autorização de Superadmin e isolamento pelo clube da rota.

| Endpoint | Alteração |
| --- | --- |
| `GET /admin/clubes/:id/resumo` | Resumo apenas do clube aberto, sem carregar o overview de toda a plataforma |
| `GET /admin/clubes/:id/pessoas-disponiveis` | Busca `busca`, cursor numérico, limite padrão 20/teto 50; retorna `pessoas` e `proximo` |
| `POST /admin/clubes/:id/membros/:usuarioId` | Inclusão sem substituir vínculo existente; conflito 409 quando duplicado/simultâneo |
| `PUT /admin/clubes/:id/membros/:usuarioId` | Contrato de atualização anterior preservado |
| `GET /admin/clubes/:clubeId/convites/:id/codigo` | Consulta protegida, sem cache, com validação de clube/estado/expiração |
| `POST /admin/clubes/:clubeId/convites/:id/reenviar` | Expõe no desktop o reenvio existente, com limitação de frequência e auditoria sem código |
| Listagem de convites existente | Campos anteriores mantidos; acrescenta `proximo`, `codigo_disponivel` e cursor; filtro pendente exclui expirados |
| `GET /admin/clubes/cascas?agrupar=clube` | Retorna `{ grupos, proximo }`, agrupando antes da paginação; sem o parâmetro conserva a lista legada |
| `GET /admin/clubes/cascas/:id/previa?agrupar=clube` | Cadastros locais agrupados para conferência, SUBs disponíveis e amostra dos jogos recentes |
| `POST /admin/clubes` | `casca_agrupada` opcional; `casca_ids` limita os registros escolhidos e `subs` define as categorias finais. Contrato legado preservado |

O `total` da listagem de convites continua indicando o tamanho da página devolvida; não foi convertido em contagem global. O cursor permite carregar as páginas seguintes. Os campos novos são aditivos, sem obrigar web/mobile a enviar novos parâmetros.

### Código recuperável: alteração aditiva e limite do legado

Foi acrescentado `ConviteClube.codigo_cifrado`, opcional. O hash continua sendo usado no aceite; a nova coluna guarda uma cópia cifrada autenticada para a consulta autorizada. Cifra AES-256-GCM, nonce aleatório e vínculo ao clube, com chave derivada por finalidade a partir do `JWT_SECRET` existente. Nem chave nem conteúdo cifrado são devolvidos na listagem.

Convites antigos só tinham hash, que não permite recuperar o código. Nesses casos, a consulta informa a indisponibilidade; reenvio por e-mail ou revogação/criação de outro convite permite gerar um código recuperável. Não há backfill nem rotação silenciosa na consulta. Trocar o `JWT_SECRET` também impede recuperar os códigos cifrados com a chave anterior; o aceite pelo hash permanece independente da recuperação.

**Aplicação necessária antes de usar a API atualizada no banco habitual ou no Render:**

```powershell
pnpm --filter @ludora/api exec prisma migrate deploy
```

Migração: `services/api/prisma/migrations/20261110160000_convite_codigo_cifrado/migration.sql`.

Esta tarefa gerou o cliente Prisma e aplicou a migração **somente no PostgreSQL isolado de testes**. Não executou migrações no banco da configuração habitual. A coluna nullable é compatível com clientes anteriores; a API nova exige a coluna presente antes de iniciar suas consultas de convites.

## 5. Performance, concorrência e segurança

### Componentes criados, extraídos e reutilizados

Os caminhos abaixo são relativos a `apps/desktop/src/renderer/src/components/`. “Preexistente” significa que o arquivo já estava no trabalho local antes da auditoria de clubes; ainda podia estar sem commit. Assim, não atribuímos a essa auditoria a criação de componentes de etapas anteriores.

| Componente / arquivo | Finalidade | Origem |
| --- | --- | --- |
| `AddClubPerson.tsx` — `AddClubPerson` | Pesquisa paginada de pessoas elegíveis para associação ao clube | Criado na auditoria de clubes |
| `ClubeConvites.tsx` — `ClubeConvites` | Formulário, tabela, código, cópia, reenvio e revogação | Extraído de `ClubeOperacoes.tsx` e ampliado na auditoria |
| `ReaproveitarTime.tsx` — `ReaproveitarTime` | Lista agrupada, seleção de SUBs e conferência de origem | Componente existente reformulado no complemento; não criado do zero |
| `DesktopSelect.tsx` — `DesktopSelect` | Select ancorado, seleção visual em rádio e dimensões configuráveis | Criado em etapas locais anteriores |
| `DesktopToggle.tsx` — `DesktopToggle`, `DesktopToggleIndicator` | Toggle acessível e indicador reutilizável | Criados em etapas locais anteriores |
| `DesktopTabs.tsx` — `DesktopTabs` | Abas com indicador inferior e alinhamento consistente | Criado em etapas locais anteriores |
| `DesktopTable.tsx` — `DesktopTable`, `DesktopSortButton` | Superfície de tabela e cabeçalhos ordenáveis | Criados em etapas locais anteriores |
| `DesktopAccordion.tsx` — `DesktopAccordion` | Acordeão simples, sem superfície adicional | Criado em etapas locais anteriores |
| `DesktopUserTable.tsx` — `DesktopUserTable` | Tabela de contas, identidade/cargo e destaque da própria conta | Criado em etapas locais anteriores |
| `AccountIdentity.tsx` — `AccountIdentity` | Identificação por nome, e-mail e inicial | Criado anteriormente e reutilizado na auditoria |
| `PlatformClubCollection.tsx` — `PlatformSummaryCard`, `PlatformClubCard`, `PlatformClubCards`, `PlatformClubTable`, `PlatformClubOption` | Cards, tabela e opção compacta de clube com visual compartilhado | Criados em etapas locais anteriores |
| `LiveMatchesReview.tsx` — `LiveMatchesReview` | Revisão de partidas ainda ao vivo e solicitação de lembrete | Criado em etapas locais anteriores |
| `PaulistaEventCollection.tsx` — `PaulistaEventCollection`, `PaulistaRecentChanges` | Coleção de eventos e alterações oficiais recentes | Criados em etapas locais anteriores |
| `PaulistaStatus.tsx` — `PaulistaStatus` | Situação de acompanhamento da integração | Criado em etapas locais anteriores |
| `MaintenanceReasonIcon.tsx` — `MaintenanceReasonIcon` | Ícone e cor correspondentes ao motivo da manutenção | Criado em etapas locais anteriores |

`DesktopMenu.tsx` já existia na base e foi aprimorado para menus, opções de rádio/toggle, rótulos e separadores; não é um arquivo criado nesta auditoria. `CargoClube`, `ClubeAtividade`, `ClubeElenco`, `ClubeCadastroFields`, `CandidatosClube`, `UsuarioClubeEditor`, `CadastroPendente` e `ChamadoManual` também foram ajustados/reutilizados, sem apresentá-los como componentes novos.

Outros módulos reutilizáveis, que **não são componentes visuais**:

- `hooks/useClubRegistrationDraft.ts`: hook criado em etapa anterior para rascunho por conta/servidor; complementado para validar a seleção agrupada.
- `services/api/src/modules/admin/clubes-candidatos.ts`: helper criado no complemento para nome-base, categoria, chave de agrupamento e grupos pagináveis.
- `services/api/src/modules/convites/codigo-seguro.ts`: helper criado na auditoria para cifrar/recuperar códigos com autenticação e isolamento por clube.
- `admin/overview.ts`, `admin/partidas-revisao.ts` e `shared/ticket-periods.ts`: módulos locais de etapas anteriores para resumo operacional, revisão/lembretes e períodos.

Documentação de reutilização acompanha os componentes `DesktopSelect`, `DesktopToggle`, `DesktopTabs`, `DesktopTable`, `DesktopAccordion` e `PlatformClubCollection`, além de `docs/desktop-componentes-menus.md`.

### Melhorias e proteções

- Detalhe do clube passou de consulta ao overview global para resumo específico e membros em paralelo. O teste de interface verifica que o overview global não é chamado ao entrar no clube.
- Consulta de pessoas filtrada/paginada no servidor evita baixar todas as contas para depois excluir vínculos no cliente; pesquisa com debounce de 220 ms.
- Sequências de consulta e guardas de componente montado impedem respostas antigas de substituir dados recentes ou afetar outro clube após navegação.
- Listas de elenco, convites e atividade preservam conteúdo útil durante atualização, com indicação separada de atualização e erro. Removidos resets desnecessários para skeleton durante refresh do elenco.
- Guardas síncronas de operações impedem dois cliques no mesmo intervalo de renderização. Associação usa também restrição única/transação, e reenvio usa comparação do token anterior para rejeitar concorrência.
- Timer de expiração tem cleanup; respostas após sair da tela são ignoradas. Não foram adicionadas bibliotecas.
- Códigos não são enviados para a auditoria nem persistidos no rascunho; erros do provedor de e-mail usam mensagem genérica em vez de despejar a resposta do serviço.
- Não houve mudança nos limites de permissão da API nem na ponte Electron para permitir acesso irrestrito. O teste de Electron real verificou IPC/preload e isolamento com serviços simulados.

Esses são efeitos verificáveis da implementação. **Não foi medido ganho de latência no Render, FPS ou capacidade com milhares de usuários.** Os testes locais não sustentam uma porcentagem de aceleração; banco/rede/provedor continuam podendo determinar o tempo final.

## 6. Verificações executadas

| Verificação | Resultado e alcance |
| --- | --- |
| `pnpm test:app:completo` | Execução mais recente, após o agrupamento: **583 testes passaram**, zero falhas; inclui build TypeScript da API e testes API/web/mobile. Na auditoria anterior eram 581 |
| `pnpm --filter @ludora/desktop test` | **17 testes passaram** na etapa de auditoria de clubes |
| Build desktop | Typecheck de main/preload/renderer e build Electron/Vite concluídos |
| Build web | Build de produção concluído na auditoria de clubes, verificando consumidores/componentes reutilizados |
| `clubes-admin.integration.ts` | Passou com PostgreSQL isolado: criação/edição, permissões, paginação, associação concorrente, último administrador, categorias, convites; no complemento, agrupamento entre origens, seleção parcial, contrato legado, proteção de times oficiais, histórico/placar preservados e seleção desatualizada |
| `clubes-ui-smoke.cjs` | Execução mais recente passou em **1440×900 escuro, 900×700 claro e 640×480 escuro**; inclui clube único, seleção/exclusão por SUB/origem, rascunho reaberto e payload limitado ao SUB escolhido, além dos fluxos anteriores |
| `navigation-smoke.cjs` | **6 cenários passaram**, incluindo Superadmin, Suporte e Desenvolvedor, janelas e temas diferentes |
| `paulista-ui-smoke.cjs` | **3 cenários passaram**, verificando apresentação/filtros/detalhes com IPC simulado |
| `electron-isolated-smoke.cjs` | Electron real passou: login, isolamento, preload, IPC, permissões, configuração, copiar/exportar logs; serviços simulados |
| `git diff --check` | Sem erros de whitespace; Git avisa da política LF/CRLF em alguns arquivos |

Durante a regressão apareceu uma asserção antiga da listagem de convites que não incluía o novo `proximo: null`. O teste foi atualizado para o contrato aditivo. A execução final acima passou integralmente. No teste concorrente do banco isolado, o conflito serializável esperado é convertido em 409 e há apenas um vínculo criado.

Os testes de integração validaram ausência de autenticação (401), conta sem autorização (403), isolamento entre clubes (404), estado inválido/legado (409/410), clube inativo (423), e-mail inválido (400), rotação e invalidação do código anterior. Provedor de e-mail interceptado, chamadas externas bloqueadas, sincronização Paulista desabilitada. Foram criados e removidos somente registros identificados do teste, sem apagar os dados preexistentes do banco isolado.

Evidências locais: `test-results/clubes-audit-*.log`. Screenshots da interface: `test-results/desktop-clubes-ui/`, por tamanho e seção. Esses artefatos são locais/ignorados e não acompanham automaticamente o push.

O complemento acrescentou testes de normalização para acentos, A/B, nomes próximos, sufixo incompatível e ausência de categoria. Logs: `test-results/clubes-grupos-*.log`; screenshots: `reaproveitar-{1440,900,640}.png` na pasta acima. Navegação, Paulista e Electron real foram conferidos na etapa anterior; não se apresenta isso como uma nova execução desses três scripts após o complemento.

## 7. Pendências e limites

- Aplicar a migração no ambiente escolhido antes de executar/deployar a API nova. Não foi aplicada no banco habitual nesta tarefa.
- Envio/entrega de e-mails e push reais, sincronização operacional com a Federação e testes com contas de usuários reais não foram executados. A fonte pública foi consultada somente para leitura no complemento. Nenhuma notificação foi enviada a terceiros.
- Não foram gerados instaladores Windows/macOS/Linux nem APK; o teste Electron utilizou Windows e perfil temporário.
- Testes web/mobile do repositório e build web passaram, mas não houve validação manual de todo o app nativo em aparelho ou de todos os fluxos web. Não é uma auditoria integral de segurança de toda a plataforma.
- Não há medição de carga/latência em produção. O estado dos serviços reais e a disponibilidade de cada clube podem mudar após a consulta.
- Códigos legados não são recuperáveis; o usuário precisa reenviar/gerar outro conforme as regras descritas. Código válido copiado deve ser compartilhado apenas com quem receberá o cargo indicado.
- A atividade do clube mantém o contrato existente de registros recentes da auditoria disponível na sessão/servidor; não foi convertida em histórico permanente ilimitado.

## 8. Como aplicar depois do pull

Os comandos são executados **na raiz do repositório**, depois de receber os commits desta entrega:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api run build
pnpm --filter @ludora/desktop run build
```

Depois, reinicie a API e o desktop. Para desenvolvimento, execute `pnpm dev:api` e `pnpm dev:desktop` em terminais separados, ou mantenha a API no processo de desenvolvimento já usado pela equipe.

**Por que precisa de migrate:** o conjunto completo contém `20261110160000_convite_codigo_cifrado`, que acrescenta uma coluna opcional aos convites. O agrupamento de clubes/SUBs não criou outra migração. `prisma generate` atualiza o cliente local; não substitui a aplicação da migração no banco.

**Se os dois desenvolvedores apontam para o mesmo banco:** a migração precisa ser aplicada somente uma vez nesse banco. `migrate deploy` verifica o histórico e não reaplica a que já estiver registrada. Cada checkout deve instalar as dependências e gerar seu próprio cliente Prisma. Em bancos diferentes, aplique em cada banco utilizado pela API atualizada.

Confira qual banco o `.env` da API seleciona antes de executar. Não use `migrate reset`, não apague dados e não rode seed para esta entrega. O deploy não requer recriar contas nem importar os dados da Federação novamente.

**Render:** aplique a migração no banco desse ambiente antes de iniciar a API nova, usando o fluxo de migrações já adotado pela equipe; `prisma generate` também deve ocorrer no build. Fazer pull no computador do seu amigo não atualiza sozinho a API publicada. Não houve push/deploy nesta tarefa.

## 9. Inventário de arquivos pendentes

Classificação por comparação do arquivo atual com os hashes guardados antes da tarefa:

- **Preexistente:** já estava alterado/novo e não foi modificado nesta tarefa.
- **Preexistente + tarefa:** trabalho anterior preservado e complementado nesta tarefa.
- **Novo nesta tarefa:** não figurava no inventário inicial; inclui arquivos rastreados que estavam limpos e foram editados agora.

O inventário abaixo inclui arquivos não rastreados e o próprio relatório. Arquivos ignorados de testes, configurações locais e segredos não fazem parte dele.

<!-- inventario-gerado -->

Inventário atualizado após o complemento de agrupamento. 101 arquivos pendentes: 78 preexistente; 14 novo nesta tarefa; 9 preexistente + tarefa.

| Arquivo | Origem |
| --- | --- |
| `apps/desktop/src/renderer/src/components/AccountIdentity.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/AddClubPerson.tsx` | Novo nesta tarefa |
| `apps/desktop/src/renderer/src/components/AdminUI.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/CadastroPendente.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/CadastroPendente.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/CandidatosClube.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/CargoClube.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/CargoClube.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/ChamadoManual.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/ChamadoManual.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/ClubeCadastroFields.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/ClubeConvites.tsx` | Novo nesta tarefa |
| `apps/desktop/src/renderer/src/components/ClubeElenco.tsx` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/components/ClubeOperacoes.tsx` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/components/DesktopAccordion.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopAccordion.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopAccordion.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopMenu.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopMenu.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopSelect.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopSelect.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopSelect.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTable.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTable.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTable.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTabs.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTabs.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopTabs.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopToggle.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopToggle.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopToggle.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopUserTable.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/DesktopUserTable.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/LiveMatchesReview.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/LogPeriodPicker.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/MaintenanceReasonIcon.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/MaintenanceReasonIcon.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/PaulistaEventCollection.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/PaulistaStatus.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/PlatformClubCollection.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/PlatformClubCollection.md` | Preexistente |
| `apps/desktop/src/renderer/src/components/PlatformClubCollection.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/ReaproveitarTime.tsx` | Novo nesta tarefa |
| `apps/desktop/src/renderer/src/components/ServicesDiagnostic.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/components/UserAccountDialog.css` | Preexistente |
| `apps/desktop/src/renderer/src/components/UsuarioClubeEditor.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/hooks/useClubRegistrationDraft.ts` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/pages/Banco.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Banco.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Chamados.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Chamados.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/ClubeDetalhe.tsx` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/pages/Clubes.css` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/pages/Clubes.tsx` | Preexistente + tarefa |
| `apps/desktop/src/renderer/src/pages/Logs.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Manutencao.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Manutencao.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Paulista.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Paulista.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Usuarios.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Usuarios.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Visao.css` | Preexistente |
| `apps/desktop/src/renderer/src/pages/Visao.tsx` | Preexistente |
| `apps/desktop/src/renderer/src/styles/desktop-pages.css` | Preexistente |
| `apps/desktop/src/renderer/src/styles/desktop-ui.css` | Preexistente |
| `apps/desktop/src/renderer/src/styles/desktop.css` | Preexistente |
| `apps/desktop/src/shared/logs.ts` | Preexistente |
| `apps/desktop/src/shared/ticket-periods.ts` | Preexistente |
| `apps/desktop/tests/clubes-ui-smoke.cjs` | Preexistente + tarefa |
| `apps/desktop/tests/desktop-data.test.ts` | Preexistente |
| `apps/desktop/tests/navigation-smoke.cjs` | Preexistente |
| `apps/desktop/tests/operations-smoke.cjs` | Preexistente |
| `apps/desktop/tests/paulista-operacional-smoke.cjs` | Preexistente |
| `apps/desktop/tests/paulista-ui-smoke.cjs` | Preexistente |
| `apps/desktop/tests/ticket-periods.test.ts` | Preexistente |
| `apps/desktop/tests/usuarios-smoke.cjs` | Preexistente |
| `docs/chamados-de-teste-desktop.md` | Preexistente |
| `docs/desktop-componentes-menus.md` | Preexistente |
| `docs/handovers/2026-11-09-desktop-auditoria-interface.md` | Preexistente |
| `docs/handovers/2026-11-10-clubes-agrupamento-subs.md` | Novo nesta tarefa |
| `docs/handovers/2026-11-10-desktop-clubes-auditoria-e-relatorio.md` | Novo nesta tarefa |
| `docs/handovers/2026-11-10-desktop-visao-global.md` | Preexistente |
| `packages/shared-types/src/admin.ts` | Preexistente + tarefa |
| `services/api/prisma/migrations/20261110160000_convite_codigo_cifrado/migration.sql` | Novo nesta tarefa |
| `services/api/prisma/schema.prisma` | Novo nesta tarefa |
| `services/api/scripts/criar-chamados-teste.cjs` | Preexistente |
| `services/api/src/modules/admin/admin.routes.ts` | Preexistente + tarefa |
| `services/api/src/modules/admin/clubes-candidatos.ts` | Novo nesta tarefa |
| `services/api/src/modules/admin/overview.ts` | Preexistente |
| `services/api/src/modules/admin/partidas-revisao.ts` | Preexistente |
| `services/api/src/modules/convites/codigo-seguro.ts` | Novo nesta tarefa |
| `services/api/src/modules/convites/convite-admin.routes.ts` | Novo nesta tarefa |
| `services/api/src/modules/partidas/partida.routes.ts` | Preexistente |
| `services/api/src/modules/suporte/routes.ts` | Preexistente |
| `services/api/tests/admin.http.test.ts` | Novo nesta tarefa |
| `services/api/tests/clubes-admin.integration.ts` | Novo nesta tarefa |
| `services/api/tests/clubes-candidatos.test.ts` | Novo nesta tarefa |
| `services/api/tests/convite-codigo-seguro.test.ts` | Novo nesta tarefa |
| `services/api/tests/match-preparation.test.cjs` | Preexistente |
| `services/api/tests/overview.test.ts` | Preexistente |
| `services/api/tests/partidas-revisao.test.ts` | Preexistente |
