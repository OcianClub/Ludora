# Handover técnico · painel operacional do Ludora

Atualizado em 09/11/2026. Trabalho local na `develop`. As sete migrations operacionais foram ensaiadas em uma restauração do backup e aplicadas no Supabase compartilhado. A API local usa o banco configurado em `services/api/.env`. As contas internas de suporte e desenvolvimento foram criadas e validadas no Electron contra esse banco.

## 1. O que existia

| Área | Estado anterior | Mudança entregue |
| --- | --- | --- |
| Acesso interno | Electron validava todo mundo como superadmin | Administrador Ludora, suporte e desenvolvimento, com autorização da API por operação. |
| Chamados | Logs em memória | Relato do cliente e ocorrência técnica persistem. Erros repetidos entram no mesmo chamado e incrementam a contagem. |
| Convites e senha | Fluxos do clube e do usuário existentes | Diagnóstico e reenvio guiado no chamado. Recuperação excepcional exige revisão independente e confirmação do endereço novo. |
| Manutenção | Configurações da instância | Pausas por função e alcance, verificadas pela API e acompanhadas por protocolo. |
| Clubes | Cadastro simples e oito categorias fixas | CNPJ, CEP, endereço, escudo de arquivo, seleção de SUBs e estados de consulta. |
| Usuários | Lista, vínculos e encerramento de sessões | Filtros, alteração de papel interno, suspensão e avisos de cadastro dirigidos. |
| Paulista | Descoberta, sincronização, vínculos e pendências | Saúde e filtros, comparação visual, pausa e abertura de chamado técnico a partir de uma divergência. |

O Electron reaproveita `Brand`, `Modal`, `FilterSelect`, `CollectionSearch`, `CollectionFilterDialog`, `CollectionViewToggle`, `SchedulePeriodDialog`, os estilos da agenda e os temas do web. A fila de Chamados mostra busca, período, atalhos com contagem e cartões agrupados por dia. Os filtros restantes abrem no mesmo componente de Partidas. O detalhe tem áreas para problema, diagnóstico, ação e histórico.

## 2. Mapa dos arquivos

Os caminhos a seguir são relativos à raiz do Ludora.

| Onde | Finalidade |
| --- | --- |
| `services/api/prisma/schema.prisma` e migrations `20261108120000_papeis_internos` até `20261109140000_vinculo_manutencao` | Modelos operacionais, vínculo opcional de pausa com chamado e acesso às novas tabelas pela API Express. O cadastro antigo aceita CNPJ e endereço ausentes. |
| `package.json`, `scripts/dev-stack.cjs`, `scripts/start-mobile.cjs`, `apps/desktop/electron.vite.config.ts` e `apps/desktop/src/main/config.ts` | `pnpm dev` coordena os cinco processos. O web e o Electron usam a API local. O APK recebe o endereço da mesma API na rede, e a API usa o ML local. O Electron em modo integrado ignora um endereço de teste previamente salvo. |
| `services/api/src/app.ts`, `auth/jwt.ts`, `middlewares/http-errors.middleware.ts`, `middlewares/permissoes.middleware.ts` | Ordem de registro dos routers, identidade e sessão, correlação de falhas, resposta de manutenção e bloqueio de escrita no clube desativado. |
| `services/api/src/modules/admin/equipe.ts`, `admin.rules.ts`, `admin.routes.ts` | Diagnóstico e acesso de equipe. CRUD administrativo, categorias, CEP, busca e controle de contas. |
| `services/api/src/modules/admin/cadastro-clube.ts`, `tarefas-cadastro.ts` | Validam CNPJ, sede, escudo e dependências de SUB. Criam tarefas e notificações de forma atômica. |
| `services/api/src/modules/suporte/{rules,service,routes,operations,operational.routes}.ts` | Sanitização, triagem, agrupamento, fila, histórico, localização de convite, limite de reenvio e fluxo de troca de endereço. |
| `services/api/src/modules/auth/{auth.routes,recuperacao.routes}.ts`, `services/api/src/services/iniciar-recuperacao.ts` | Login respeita suspensão. Site e suporte usam a mesma função para emitir e enviar a recuperação de senha. |
| `services/api/src/modules/manutencao/{routes,service}.ts` | Regras de alcance, bloqueios, auditoria e reativação. |
| `services/api/src/modules/{cadastros,clubes,convites,jogadores,partidas}` | As rotas tocadas aplicam pausas, verificação de clube ativo e regras de SUB sem descartar histórico. A temporada preserva o SUB atual quando o destino está desativado. |
| `services/api/src/modules/paulista/{routes,service,operations,chamados}.ts` | Controle de importação oficial, saúde, manutenção, conferência e criação idempotente de chamado vinculado. |
| `apps/desktop/src/main/ipc.ts`, `src/shared/rules.ts` | Sessão interna via API, transporte permitido pelo Electron e validação das rotas solicitadas pelo renderer. |
| `apps/desktop/src/renderer/src/{main.tsx,App.tsx,components/AdminLayout.tsx,styles/desktop.css}` e `apps/web/src/components/ClubWorkspace.css` | Rotas por papel e identidade visual. O router de dados permite bloquear Voltar com cadastro sujo. |
| `apps/desktop/src/renderer/src/pages/{Login,Equipe,Chamados,Manutencao,Clubes,ClubeDetalhe,Usuarios,Paulista}.tsx` | Entrada da equipe, filas, telas e decisões em operação. |
| `apps/desktop/src/renderer/src/components/{SupportOperations,ClubeCadastroFields,CadastroPendente,PaulistaReview}.tsx` | Partes reutilizáveis do atendimento, do cadastro e da revisão. |
| `apps/desktop/src/renderer/src/services/api.ts`, `packages/shared-types/src/admin.ts` | Cliente IPC e formatos dos dados do painel. |
| `apps/web/src/{App.tsx,main.tsx,components/Layout.tsx,components/PublicLayout.tsx,components/SupportButton.tsx,pages/Login.tsx,pages/ConfirmarEmail.tsx,pages/Paulista.tsx}` | Entrada e acompanhamento do suporte, confirmação pública de e-mail e avisos de consulta/manutenção. |
| `apps/web/src/services/{api,supportErrors,requestId}.ts`, `apps/web/src/utils/notifications.ts` | ID de requisição, captura de falhas do web e tipo de aviso de cadastro. |
| `apps/mobile/src/services/api.ts`, `apps/mobile/app/(tabs)/perfil/notificacoes.tsx` | O app reconhece o aviso de cadastro na lista existente. Os erros da API são usados nos fluxos de escrita. |
| `services/api/tests/{equipe,suporte}.test.ts`, `*.integration.ts` operacionais e `apps/desktop/tests/*-smoke.cjs` | Regras, banco isolado, chamadas diretas e fluxos nas telas reais. Os testes existentes que simulam o Prisma receberam os novos campos e consultas esperados. |

## 3. Fluxo e decisões

1. O cliente envia o relato pelo ícone Suporte no web ou a API registra uma falha com código de ocorrência. O servidor persiste o chamado e o histórico. A triagem é determinística. Uma falha incerta vai para suporte. Um caso de segurança fica restrito ao suporte e à administração.
2. O suporte localiza o convite pelo e-mail no clube do chamado. A tela mostra o destinatário mascarado, o estado e o histórico de envios. O limite vale por destino mesmo após reiniciar a API. A mesma solicitação reaproveita o resultado gravado. Um reenvio gera novos hashes para o convite existente e invalida o código anterior.
3. Na recuperação de senha, o código vai para a conta do cliente. Para troca de e-mail, o suporte abre o pedido, outro administrador registra a verificação por canal independente e o cliente confirma no endereço novo. A confirmação consome o código, invalida a senha antiga, encerra sessões e tenta avisar o e-mail anterior. O cliente define a nova senha pelo fluxo Recuperar senha.
4. Uma pausa recebe função, alcance, motivo público e revisão prevista. `423` vem com protocolo. Suporte tem pausa de criação de partidas e convites por clube. Administrador controla os demais alcances. A revisão prevista orienta a equipe. A pausa permanece até reativação explícita.
5. Um clube desativado continua consultável. As contas entram normalmente no Ludora. Novos confrontos, convites e alterações do clube são bloqueados. A desativação é recusada se houver partida ao vivo. Um SUB desativado preserva histórico e impede novos jogadores, times e confrontos. A exclusão consulta dependências antes de gravar.
6. Na aba Usuários, cargos internos e cargos por clube são independentes. Suspensão e troca de cargo encerram sessões. Um aviso cadastral só vai à central dos administradores escolhidos. O servidor refaz a conferência dos destinatários e da prévia, grava a tarefa e as notificações na mesma transação. A tarefa conclui quando o campo é salvo ou pode ser dispensada com motivo.
7. O Paulista compara a publicação oficial com a súmula local ou a versão anterior. Encaminhar ao desenvolvimento vincula um chamado e deixa a divergência em revisão. Conferir o dado oficial preserva scout, acontecimentos e placar local. A pausa por evento bloqueia a consulta de sincronização antes da rede e é revalidada durante a importação.

## 4. Antes e depois

### Decisão de atendimento e manutenção

Antes, encaminhar usava o texto genérico do comentário. Depois, cada decisão tem um formulário próprio. O comentário pode ser salvo separadamente.

```diff
- agir('ENCAMINHAR')
+ agir('ENCAMINHAR', { motivo: notaDecisao, publico: false })
+ agir('FINALIZAR', { motivo: notaDecisao, publico: compartilharResumo })
```

Antes, a pausa só tinha o próprio histórico. Depois, a API grava também no chamado vinculado, dentro da mesma transação. O vínculo exige chamado aberto do mesmo clube. Finalizar o atendimento e reativar a função são decisões independentes.

```diff
  await tx.manutencaoHistorico.create({ data: ... })
+ await registrarNoChamado(tx, depois, operador.id, dados.motivo)
```

O horário de revisão ajuda a equipe a identificar uma pausa vencida. O bloqueio depende de `ativa`. Reativar encerra o bloqueio e pede o registro do que foi conferido.

**Permissão interna.** Antes, o Electron consultava `/admin/me`, reservado a superadmin. Agora consulta `/admin/equipe/me`. As ações administrativas seguem em routers separados.

```ts
// Depois, o pedido de equipe reconsulta a sessão e o papel persistido.
const id = await getUsuarioId(req, true);
// Papel do clube e papel da plataforma são campos diferentes.
```

**Conflito de suporte.** Antes, ocorrências saíam do processo quando a API reiniciava. Agora o banco mantém a contagem e a trilha de cada repetição.

```ts
const chave = fingerprint(input.servico, rota, String(input.status));
const anterior = await tx.suporteChamado.findUnique({ where: { fingerprint: chave } });
const ocorrencias = (anterior?.ocorrencias || 0) + 1;
```

**Manutenção.** Antes, criar partida começava pela validação do formulário. Agora, após autorizar o gestor, a API verifica se a criação está pausada para o clube. Também verifica a proposta no aceite.

```ts
await exigirOperacao(['CRIAR_PARTIDAS'], { clubes: [ctx.clubeId] });
```

**Cadastro.** Antes, o botão de criar adicionava o conjunto padrão inteiro ou nenhuma categoria. Agora o servidor lê uma lista validada e persiste a escolha.

```ts
const subs = validar(() => lerSubs(req.body?.subs ?? [...SUBS_PADRAO]));
// A lista escolhida passa por validação antes de criar as categorias.
```

**Paulista.** Antes, a interface podia registrar uma resolução sem abrir um caso para desenvolvimento. Agora a ação encaminha uma pendência específica, guarda o vínculo e mostra seu estado real.

```ts
const fingerprint = chaveChamadoPaulista(pendenciaId);
const anterior = await tx.suporteChamado.findUnique({ where: { fingerprint } });
if (anterior && anterior.status !== 'RESOLVIDO') return { chamadoId: anterior.id, criado: false };
```

## 5. Validação observada

| Fluxo | Resultado | Evidência local |
| --- | --- | --- |
| Equipe | Três cargos no Electron, conta de clube recusada. Falha de banco e retomada testadas. | `test-results/equipe/` |
| Chamados | Envio no web isolado, encaminhamento por administrador no Electron, devolução por desenvolvimento e finalização pelo suporte. API também conferiu finalização por administrador, retorno público opcional e restrição do desenvolvedor. | `test-results/suporte/fila-dark.png`, `filtros-light.png` |
| Convites e recuperação | Reenvio real pela tela com provedor simulado, limite e idempotência. API confirmou troca de e-mail, uso único, invalidação de sessão e aviso ao anterior. | `test-results/suporte/convite-reenviado.png` |
| Manutenção | Pausa vinculada no Electron bloqueou a criação no web com protocolo. Outro clube criou durante a pausa. Prazo vencido e chamado finalizado preservaram o bloqueio. Após reativar, o mesmo formulário salvou e as duas ações apareceram no histórico. | `test-results/manutencao/web-bloqueio.png`, `pausa-claro.png` |
| Banco compartilhado | Backup restaurado em PostgreSQL local, migrations aplicadas e Prisma atualizado. RLS e permissões conferidos nas oito tabelas operacionais. Os dois novos logins passaram no Electron com a API local e o Supabase. | `.local-demo/backups/operacional-20261109-085106/ludora-public.dump` |
| Clubes | CEP preenchido pelo ViaCEP, escudo persistido, SUBs escolhidos, CNPJ duplicado recusado, descarte com Escape/Voltar e dependência impedindo exclusão. | `test-results/clubes/novo-escuro.png`, `estrutura-claro.png` |
| Usuários | Filtro aplicado, suspensão revogou token. Aviso apareceu na central web do destinatário. Duplicação e destinatário sem permissão recusados. | `test-results/usuarios/previa-escuro.png`, `web-aviso.png` |
| Paulista | Partida sintética, placares 1 × 2 e 4 × 2 comparados, chamado visível para desenvolvimento, repetição reutilizou o vínculo e pausa devolveu 423. | `test-results/paulista-operacional/comparacao-escuro.png`, `chamado-vinculado-claro.png` |

`pnpm test:app:completo` verificou 529 casos. `pnpm test:desktop` verificou quatro casos de IPC. As capturas foram produzidas em Electron/Edge locais, com registros de teste e dois temas. TypeScript e builds conferidos separadamente.

## 6. Rodar no dia a dia

Na raiz do Ludora, rode `pnpm dev`. O Electron abre sozinho e o web fica em [localhost:5173/login](http://localhost:5173/login). A API normalmente fica na porta 3000, o ML na 8000 e o Expo mostra a porta e o QR code do APK de desenvolvimento. Deixe esse terminal aberto. O Vite recarrega a interface quando você salva alterações. Para mudanças no processo principal do Electron ou na configuração da pilha, reinicie o comando.

O comando usa a configuração existente do Supabase. As migrations foram aplicadas uma vez no banco compartilhado. Os demais computadores que usam esse mesmo banco precisam do código atualizado. As instâncias do Render precisam receber a nova API para expor as rotas e os cargos internos. As contas criadas foram `suporte@suporte.com` e `dev@dev.com`. As senhas ficam no banco como hashes.

### Reproduzir os testes com dados isolados

A API de teste usa `127.0.0.1:3018`, com PostgreSQL isolado em `127.0.0.1:55448`. A configuração já preparada nesta máquina fica em `.local-demo/equipe/config.json`. O script confirma host, porta e nome do banco antes de aplicar migrations. A pasta `.local-demo` é ignorada pelo Git.

1. Abra o Docker Desktop. Se o contêiner estiver parado, rode `docker start ludora-equipe-tests`.
2. Abra um terminal na raiz do Ludora e rode `pnpm --filter @ludora/api exec tsx tests/equipe.integration.ts --serve --paulista-isolado --email-isolado`. Ele gera senhas fortes novas para as contas de teste e coloca as credenciais em `.local-demo/equipe/contas.json`. Abra esse arquivo em um editor local. `--email-isolado` intercepta o envio em memória para endereços de teste.
3. Em outro terminal, rode `pnpm dev:desktop`. Na tela de login, clique em Configurar servidor e aponte a API para `http://127.0.0.1:3018`. Entre com uma conta da pasta local. A edição do renderer recarrega pelo Vite. Alterações no processo principal reiniciam o Electron.
4. Para abrir o web no mesmo ambiente, em outro PowerShell rode `$env:VITE_API_URL='http://127.0.0.1:3018'` e depois `pnpm --filter @ludora/web dev --host localhost --port 5198`. Acesse `http://localhost:5198`. A conta de cliente já tem clube de teste.
5. Para gerar o confronto de comparação, rode `pnpm --filter @ludora/api exec tsx tests/paulista-operacional.integration.ts`. Na aba Paulista, busque `North Harbor`. É uma fixture sintética, sem consulta externa.

Para futuras migrations compartilhadas, confira o destino de `DATABASE_URL` e `DIRECT_URL`, revise o SQL e teste o backup. Aplique com `pnpm --filter @ludora/api exec prisma migrate deploy`. Se precisar regenerar o Prisma Client no Windows, pare primeiro as APIs que carregam a DLL. Aplique a migration e publique a versão correspondente da API para cada instância que usa esse banco.

## 7. Limites

- A prova de e-mail usou provedor simulado. Aceite de um provedor não equivale a entrega na caixa de entrada. As notificações cadastrais desta versão são avisos internos, gravados e sincronizados pela central.
- A captura técnica usa pistas de arquivo e linha quando presentes. O caminho e a mensagem bruta da stack ficam fora do relatório. Não há upload de anexos de suporte nesta entrega. A fila tem limite de 200 resultados por consulta e permite refinar filtros.
- O upload de escudo é redimensionado e reencodado no Electron, limitado e validado na API, e fica no campo de imagem do clube. O cadastro valida CNPJ numérico. O ViaCEP localiza o endereço pelo CEP e deixa o número para preenchimento manual. [Documentação do ViaCEP](https://viacep.com.br/)
- A comparação do Paulista foi testada com dados sintéticos. O painel de manutenção usa o catálogo existente e o comando de sincronização já integrado. `PAULISTA_ENABLED` controla a disponibilidade da integração. As pausas persistidas controlam as operações autorizadas.
- O Metro e a API responderam pelo endereço Wi-Fi do computador. A abertura do APK em um celular ou emulador ficou sem teste nesta rodada.

## 8. Prompt para estudo

> Leia este handover e abra os arquivos no meu Ludora. Estou aprendendo React, Express, Prisma e Electron. Ensine o fluxo em ordem, começando pelo clique do cliente em Suporte e terminando na resposta do operador. Para cada trecho, mostre a função, os parâmetros, o retorno, as condições, a chamada HTTP e a tabela afetada. Use exemplos novos em inglês. Explique a diferença entre esconder um botão e autorizar uma escrita, entre repetir um clique e duplicar uma ação, e entre testar com uma base isolada e aplicar uma migration real. Passe depois por manutenção, cadastro, notificações e Paulista. Use trechos curtos e peça que eu explique o raciocínio apenas no fim de cada fluxo. Preserve o código durante o estudo.

> Inclua o comando `pnpm dev` e mostre como cada interface encontra a mesma API. Depois trace um chamado de um clube até a pausa de criação de partidas, a finalização do chamado e a reativação da função. Explique por que a revisão é um prazo de conferência e como a transação mantém os dois históricos consistentes.
