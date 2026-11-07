# Handover técnico — Paulista, web do clube e desktop

Data: 06/11/2026. Branch `develop`, sem nova branch, commit ou push. As alterações locais anteriores foram mantidas, incluindo `dev:paulista`; este documento descreve a correção da separação de responsabilidades e a ativação real. [Guia simples de operação](../paulista-operacao.md).

## Mapeamento e propósito

| Arquivo | Alteração nesta etapa |
|---|---|
| `apps/web/src/pages/Paulista.tsx` | Remove toda operação técnica, busca eventos do clube, seleção automática, jogos próprios inicialmente, Iniciação/Base, SUBs e classificação por chave/fase. Preserva retroativo autorizado. |
| `apps/web/tests/paulista-smoke.cjs` | Valida ausência de controles administrativos mesmo como SUPERADMIN, contexto próprio, todos os jogos, classificação, voltar, erro e futuro sintético. |
| `apps/desktop/src/renderer/src/pages/Paulista.tsx` | Nova área de catálogo, acompanhamento, sugestões, confirmação, divergências, decisões com motivo, pausa e auditoria. |
| `apps/desktop/src/renderer/src/components/CandidatosClube.tsx` | Candidatos com escudo, SUB e jogos conhecidos no cadastro de cliente; nenhuma associação automática. |
| `apps/desktop/src/renderer/src/pages/Clubes.tsx` | Preserva cadastro e encaminha candidato escolhido para confirmação no Paulista após criação. |
| `apps/desktop/src/renderer/src/App.tsx`, `components/AdminLayout.tsx` | Rota e item de navegação internos do Paulista. |
| `apps/desktop/src/renderer/src/styles/desktop.css` | Cards, filtros e painel com tokens existentes. |
| `apps/desktop/src/main/api-client.ts` | Prazo maior, limitado a POSTs administrativos do Paulista; mantém IPC, allowlist e autenticação. |
| `apps/desktop/tests/paulista-smoke.cjs` | Electron real com perfil separado: login, IPC, navegação, decisão, temas e candidatos no cadastro. |
| `services/api/src/modules/paulista/discovery.ts` | Descoberta limitada à publicação real de temporadas/divisões/categorias; gravação idempotente do catálogo. |
| `services/api/src/modules/paulista/operations.ts` | Estado operacional, lease, agendamento, candidatos, confirmação e decisões auditadas. |
| `services/api/src/modules/paulista/routes.ts` | Consulta por clube, operações administrativas, revisão de divergência recém-observada, rotina e erros; proteção de escritas oficiais preservada. |
| `services/api/src/modules/paulista/service.ts` | Decisões não somem numa repetição; registro da diferença atual e de alterações oficiais; comparação de confronto evita falso bloqueio só por data. |
| `services/api/src/modules/paulista/rules.ts` | Normaliza nome de time removendo sufixo SUB para detectar candidato a duplicação, sem fundir registros. |
| `services/api/prisma/schema.prisma` | Acrescenta `FpfsCatalogo` e `FpfsRotina`; mantém os sete modelos do piloto. |
| `services/api/prisma/migrations/20261106120000_paulista_operacao/migration.sql` | Cria duas tabelas novas, sem alterar colunas antigas. Migration do piloto preservada e também aplicada. |
| `services/api/scripts/backup-paulista.cjs` | Backup public via pg_dump 17, sem credenciais no log; impede sobrescrever a cópia existente. |
| `services/api/scripts/ativar-paulista.ts` | Execução técnica explícita do vínculo já confirmado pelo usuário; exige argumento e valida IDs do Ocian. Não é fluxo normal do produto. |
| `services/api/scripts/verificar-paulista.ts` | Leitura HTTP autenticada com conta administrativa existente, sem imprimir token nem criar usuário. |
| `services/api/tests/paulista-discovery.test.ts` | Temporada não publicada, título, limites de descoberta e falha de formato. |
| `services/api/tests/paulista.integration.ts`, `paulista.test.ts`, `paulista.ui-setup.ts` | Catálogo repetido, identidade sem união por nome, revisão persistente, falha com retry, ambiente isolado e fixtures de UI. |
| `scripts/dev-service.cjs` | API agora usa fonte TypeScript em watch, preservando ML e os quatro serviços do comando raiz. |
| `services/api/.env.example`, `README.md`, `docs/paulista-operacao.md` | Flags, uso normal e diferenças entre reload/reinício/build. |
| Documentação de 05/11 | Marcada como histórico para não ensinar ativação antiga como estado atual. |
| `services/api/.env` (ignorado) | Somente dois flags Paulista ativados localmente. Nenhuma credencial copiada para documentação. |

Os arquivos do piloto anterior ainda aparecem no `git status`, incluindo contratos, parser, aviso de partida e pontos de integração das telas antigas. Seu mapeamento original está no handover de 05/11; não foram descartados nem commitados nesta etapa.

## Fluxo e arquitetura

**Descobrir não é vincular.** O servidor encontra evento e equipes publicados, salva o catálogo e apresenta candidatos. Uma semelhança de nome não cria clube, usuário ou vínculo. A confirmação humana relaciona ID oficial a cliente/categoria, e só então inicia acompanhamento e distribuição operacional.

`FpfsCatalogo` guarda publicação, acompanhamento, tentativa/sucesso, próximo horário e erro. `FpfsRotina` guarda descoberta e lease compartilhado. O executor consulta agendamentos na inicialização e a cada minuto. Sucesso agenda 24h; falha, 1h. Uma fonte parcialmente inválida não substitui catálogo/snapshot por dados incompletos.

Web usa contexto `x-clube-id`; lista apenas eventos com identidade confirmada daquele clube. Dentro do evento, os demais jogos continuam consultáveis. Desktop usa as rotas `/admin/paulista`, autenticadas com SUPERADMIN pelo IPC existente. Botões técnicos não aparecem no web, mesmo com essa conta.

Resultado/classificação oficiais permanecem separados das contribuições locais. Alteração oficial produz pendência/auditoria. Manter oficial significa reconhecer essa autoridade e registrar motivo, preservando scout e placar local. Se os valores mudarem outra vez, a divergência reaparece para revisão.

## Antes × depois

### Desenvolvimento da API

Antes:

```js
args = ['dist/src/server.js'];
```

Depois:

```js
args = ['--import', 'tsx', '--watch', 'src/server.ts'];
```

Antes era necessário compilar para enxergar mudanças. Agora o backend reinicia com a fonte atual; `.env` ainda exige reinício manual. Isso não altera `start`, que continua executando a build de produção.

### Contexto de campeonato

Antes: `evento` começava fixo em 900, `/paulista/eventos` retornava todos os importados e o web consultava `/admin/me` para mostrar operações técnicas.

Depois, o backend parte dos vínculos do clube:

```ts
const links = await prisma.fpfsVinculo.findMany({
  where: { clubeId: req.clubeId }, // recorte: no projeto, req recebe extensão pelo middleware
  select: { equipeId: true },
});
// Busca eventos cujas equipes incluem esses IDs confirmados.
```

O React escolhe um evento disponível, sem ID fixo, e começa com `equipe=clube`. O componente de operação técnica foi removido do web, não apenas escondido por CSS.

### Descoberta sem presumir 2027

Antes: conferência dirigida ao Ocian/evento 900 e operação manual de importação.

Depois:

```ts
const anos = $('#select_temporada option')
  .map((_i, e) => Number($(e).attr('value'))).get()
  .filter(a => a === ano || a === ano + 1);
```

Só segue temporadas realmente presentes no seletor. Os IDs de eventos vêm das respostas do catálogo, não de incrementos ou palpites. O catálogo pode existir sem partidas operacionais e sem clientes vinculados.

### Duplicação e decisão preservada

Antes: qualquer partida legada do mesmo SUB/data bloqueava distribuição. Isso deu falso conflito real entre Festival Ludora e Paulista com adversários diferentes.

Depois: compara os IDs do confronto ou o nome normalizado do adversário naquela data. Nome correspondente exige revisão; nunca autoriza merge automático. Eventos de adversários diferentes podem coexistir.

Antes, a mesma divergência podia receber novamente `estado: ABERTA` na sincronização. Depois:

```ts
if (atual && isDeepStrictEqual(atual.dados, dados)) return atual;
```

Isso preserva a decisão enquanto os valores forem iguais. `isDeepStrictEqual` evita depender da ordem das propriedades JSON devolvidas pelo PostgreSQL. Valores diferentes reabrem a pendência. O desktop envia os valores que o operador viu (`esperado`); se mudarem durante a revisão, a API rejeita a decisão para exigir nova conferência. Uma divergência recém-observada pode ser registrada/revisada sem esperar o próximo job. Auditoria guarda decisão, motivo e operador.

## Banco real: execução comprovada

1. Conferidos banco `postgres/public`, pooler Supabase região sa-east-1, migrations e tabelas existentes. Nenhuma Fpfs existia.
2. Backup custom de public criado em `.local-demo/backups/2026-11-06/ludora-public.dump` e restaurado com pg_restore 17 em PostgreSQL separado. Três clubes recuperados. O arquivo contém dados privados, não está no Git e não é backup de Auth/Storage.
3. Duas migrations aplicadas primeiro na cópia. HTTP `/competicoes`: 200, quatro registros antigos preservados.
4. Aplicadas as migrations de 05/11 e 06/11 no Supabase: nove tabelas novas, sem remover dados nem acrescentar colunas ao legado. Status final: atualizado, 16 migrations.
5. Descobertos 24 eventos reais de 2026. 2027 não publicado na consulta. Nenhum evento 2027 criado.
6. Confirmado clube 2/Sub-7 local 9 → equipe 12423/evento 900, usando a autorização humana da conversa. Outras categorias continuam apenas candidatas.
7. Importados 297 jogos oficiais do evento, com União excluída. Criadas 25 partidas operacionais do Ocian; cascas de adversários, sem contas fictícias. A amostra é Ocian × ADC Marvel, 21/03/2026 09:30, oficial 1×1, súmula 139195.
8. Leitura HTTP autenticada no Supabase após implantação: `/competicoes` 200 com cinco competições (quatro antigas + Paulista), `/paulista/eventos` com um evento do Ocian e `/admin/paulista` com catálogo de 24 eventos.
9. Flags habilitadas somente no `.env` local. `pnpm dev` executado e confirmou API 3000, ML 8000, Metro 8081 e Vite 5173. O log confirmou rotina Paulista ativa e reinício automático da API após edição. `pnpm dev:desktop` também iniciou Electron/main/preload e renderer com HMR; uma instância antiga do Ludora foi reiniciada para essa conferência.
10. Um segundo ciclo real de sincronização preservou exatamente os mesmos 25 IDs de partidas, sem duplicação. Evidência local em `test-results/paulista/ciclo-real-20261106.json`. Browser com API normal/Supabase passou em Competições → Paulista, 25 jogos próprios e nenhum controle técnico, sem gravações fictícias.

O vínculo/primeira distribuição ocorreram pela execução explícita do script técnico de ativação. O executor de agendamentos foi exercitado e iniciado na API local; **não foi observado um período de 24h transcorrer**. Horário da próxima tentativa é persistido e mostrado no desktop. Redescoberta preserva pausa manual e não fabrica horário de tentativa ao pausar. Serviços Render/Vercel não foram publicados nesta tarefa; precisam receber o código/flags para operação contínua e proteção equivalente.

## Testes e evidências

| Comando | Resultado |
|---|---|
| `pnpm test:app:completo` | 362 testes passaram, zero falhas. |
| `tsx --test tests/paulista.integration.ts` no pacote API e destino isolado permitido | Cinco testes passaram: cenário PostgreSQL/HTTP integrado + quatro testes puros importados pela fixture. |
| `pnpm test:desktop` | Quatro testes de regras IPC/URL/métodos passaram. |
| `pnpm build:web`, `pnpm build:desktop`, build API e `prisma validate` | Compilação/validação executadas; conferir logs em `test-results/paulista`. |
| `node apps/web/tests/paulista-smoke.cjs` com Playwright | Quatro matrizes: 390/1366 × claro/escuro. Sem controles administrativos; contexto próprio inicial, consulta geral, classificação, fases, paginação, voltar, erro e futuro sintético. |
| `node apps/desktop/tests/paulista-smoke.cjs` com Playwright | Electron real, perfil separado, login pela API isolada, IPC, navegação, revisão auditada, claro/escuro e candidatos no cadastro. |
| `tsx scripts/verificar-paulista.ts` | Leitura autenticada real no Supabase, sem criar usuários/tokens persistidos ou imprimir credenciais. |

Fixtures de conta, placar 9×1 e jogo futuro existem somente em PostgreSQL local. O teste integrado rejeita destinos que não sejam os dois bancos locais explicitamente permitidos. O smoke do Electron usa perfil novo e remove seu wrapper; não altera sessão/configuração pessoal do aplicativo. Playwright veio do runtime de ferramentas via NODE_PATH; não foi adicionado como dependência de produção.

Logs/screenshots são locais e ignorados em `test-results/paulista/`. Aparência foi inspecionada; toque em aparelho físico e passagem real de 24h não foram testados. O teste visual do web bloqueia imagens externas para ser determinístico; não prova disponibilidade de todos os escudos remotos.

## Limites e operação segura

- Migrações/dados do piloto estão no Supabase; código remoto ainda não foi publicado. Instâncias antigas não ganham proteções por uma atualização de banco.
- Desligar `PAULISTA_SYNC_DIARIA` e reiniciar para parar consultas; desligar também `PAULISTA_ENABLED` para retirar o módulo. Não apaga histórico.
- Revisão assistida registra procedimento e conflito; transferência de dados com contribuições próprias não é automática e segue pendente de ferramenta dedicada.
- Fonte é HTML público, não contrato homologado. Futuras sem súmula usam chave composta de IDs externos; mudança de identidade/mando exige revisão.
- Classificação geral entre grupos, desempates e avanço automático não são inferidos. Confrontos mostram apenas fases publicadas.
- Lease com expiração reduz sobreposição, mas não é scheduler distribuído completo. A API precisa estar disponível para executar o job.
- `git pull` não é rollback de banco. Recuperação deve considerar gravações posteriores ao backup e ser ensaiada separadamente.

## Prompt para aprender em outro chat

> Sou estudante e preciso entender esta implementação sem jargão inicial. Leia `docs/handovers/2026-11-06-paulista-operacao.md`, `docs/paulista-operacao.md` e o código atual antes de explicar. Não crie branch, commit, migrations ou dados. Comece pelo exemplo Ocian × ADC Marvel e explique uma etapa por vez: catálogo encontrado, identidade candidata, confirmação humana, casca, partida e divergência. Depois mostre pequenos exemplos novos em inglês para parâmetros, retorno, arrays, async/await, React useEffect/state, rotas Express, middleware, Prisma relations/upsert, transação, JSON, lease e agendamento. Relacione cada exemplo ao arquivo real e explique sua sintaxe. Diferencie teste isolado, Supabase compartilhado e publicação no Render. Mostre como `pnpm dev` e `pnpm dev:desktop` atualizam a tela. Não diga que 2027 ou uma transferência automática de histórico estão implementados se o código não comprovar. Faça perguntas curtas de entendimento sem me travar com exercícios a cada linha.
