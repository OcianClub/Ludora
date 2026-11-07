# Handover técnico — piloto Paulista, 05/11/2026

> Histórico. Consulte [o handover de 06/11](2026-11-06-paulista-operacao.md) para a separação web/desktop, migrations aplicadas no Supabase e comandos atuais.

## Estado entregue

Branch `develop`, preservada; sem commit/push. Backend e página web implementados. Supabase compartilhado recebeu somente leituras de verificação, **sem migration, vínculo ou partidas novas**. Confirmação humana registrada: clube 2 = Ocian Praia Clube de Praia Grande, Sub-7 local 9, equipe externa 12423/evento 900. Cidade divergente no cadastro não foi alterada.

Operação/ativação/limites: [paulista-piloto.md](../paulista-piloto.md). Desktop administrativo específico fica para a etapa seguinte; seus testes e build existentes passaram. Mobile não foi alterado.

## 1. Mapeamento de arquivos

| Arquivo | Propósito |
|---|---|
| `services/api/prisma/schema.prisma` | Sete modelos novos e relações inversas virtuais no legado; nenhuma coluna escalar nova nas tabelas existentes. |
| `services/api/prisma/migrations/20261105120000_paulista_piloto/migration.sql` | Criação de tabelas, índices e FKs do módulo isolado. |
| `packages/shared-types/src/paulista.d.ts` | Contratos compartilhados de equipe, jogo, snapshot e painel, sem código executável. |
| `services/api/src/modules/paulista/provider.ts` | Leitura limitada da fonte, parser estrito, exclusão União e conferência separada por SUB/divisão. |
| `services/api/src/modules/paulista/rules.ts` | Normalização/sugestões, comparação, continuidade de identidade e cálculo provisório por fase. |
| `services/api/src/modules/paulista/service.ts` | Transações, idempotência, cascas, distribuição, vínculo/reversão, pendência, retroativo e auditoria. |
| `services/api/src/modules/paulista/routes.ts` | Rotas autenticadas, controles SUPERADMIN/gestor, proteção do calendário e executor diário opt-in. |
| `services/api/src/app.ts` | Registro do módulo e proteção das escritas oficiais sem substituir rotas legadas. |
| `services/api/src/server.ts` | Inicialização/parada do job opcional. |
| `services/api/src/modules/cadastros/cadastro.routes.ts` | Referência oficial calculada no DTO de competições e visibilidade da casca para novo cliente, respeitando categorias autorizadas. |
| `services/api/.env.example` | Flags desligados por padrão. `.env` real preservado. |
| `services/api/package.json`, `pnpm-lock.yaml` | Dependência Cheerio 1.1.2 para leitura de HTML. |
| `services/api/tests/setup.cjs` | Flags desligados na suíte legada. |
| `services/api/tests/paulista.test.ts` | Quatro testes puros e fixtures de fonte. |
| `services/api/tests/paulista.integration.ts` | HTTP + PostgreSQL descartável + leitura real do evento 900, com proteção do destino. |
| `services/api/tests/paulista.ui-setup.ts` | Dados explicitamente fictícios para validar UI, acessos e divergência. |
| `apps/web/src/pages/Paulista.tsx`, `Paulista.css` | Página global, abas/filtros na URL, jogos, classificação oficial, cálculo, confrontos e pendências; operações SUPERADMIN e retroativo autorizado. |
| `apps/web/src/components/PaulistaMatchNotice.tsx` | Origem oficial, divergência e marcador retroativo nos detalhes normais da partida. |
| `apps/web/src/App.tsx`, `routePages.tsx` | Rota lazy `/competicoes/paulista`. |
| `apps/web/src/pages/Competicoes.tsx` | Acesso ao painel global preservando a lista existente. |
| `apps/web/src/components/CompetitionPanel.tsx` | Encaminha competição oficial à classificação global, evitando ranking local parcial. |
| `apps/web/src/pages/Partidas.tsx` | Retira competições oficiais do cadastro manual de partida. |
| `apps/web/src/pages/PartidaDetalhe.tsx` | Insere aviso oficial e atualiza ao mudar placar/status local. |
| `apps/web/src/services/api.ts` | Campo opcional `paulista_evento_id` do DTO. |
| `apps/web/tests/paulista-smoke.cjs` | Navegação e operações no browser contra API/DB isolados em quatro matrizes. |
| `README.md`, `docs/paulista-piloto.md`, este arquivo | Entrada, instruções de operação e handover. |

## 2. Resumo do fluxo e decisões

Identidade de equipe na fonte (`FpfsEquipe`) não é cliente (`Clube`) nem time operacional (`Time`). `FpfsVinculo` registra a decisão humana; `FpfsTime` mantém a ponte que permite reaproveitar cascas. Um clube pode ter vários IDs oficiais por SUB. O ID de time pode aparecer em várias edições sem duplicação.

Snapshot e jogos oficiais entram primeiro. Só jogos com cliente confirmado são projetados para o legado. A agenda tem participantes separados por clube/categoria; virar cliente acrescenta participação sem recriar partida. Transação Serializable desfaz toda a operação se surgir ambiguidade.

Calendário e resultado oficiais têm autoridade na página da competição. Placar e scout locais continuam próprios. Alteração de agenda recebe auditoria; diferença de placar finalizado recebe pendência visível. Retroativos exigem próprio atleta e categoria, com requestId estável para repetição segura.

Reversão simples preserva dados; não promete apagar vínculos com contribuição do cliente. Nesse caso bloqueia para revisão. Não implementado nesta entrega: transferência manual assistida da âncora, fusão de partidas legadas ou editor completo de histórico.

## 3. Antes × depois explicativo

Trechos abaixo são recortes simplificados; as funções completas estão nos arquivos mapeados.

### Compatibilidade do banco

Antes: `Competicao` não tinha dados de federação. Acrescentar coluna e publicar o Prisma Client antes de migrar faria consultas legadas buscarem uma coluna inexistente.

Depois: nenhuma coluna nova nessa tabela; a referência está no modelo novo:

```prisma
model FpfsEvento {
  // demais campos omitidos neste recorte
  competicaoId Int? @unique
  competicao Competicao? @relation(fields: [competicaoId], references: [id])
}
```

O DTO obtém a referência separadamente, com fallback quando desligado ou sem tabelas:

```ts
if (!ativo() || !ids.length) return new Map<number, number>();
try {
  // Consulta FpfsEvento; não muda a seleção de colunas de Competicao.
} catch (e: any) {
  if (e.code === 'P2021') return new Map<number, number>();
  throw e;
}
```

### Identidade de jogo e repetição

Antes: não existia ponte externa; repetir criação manual produzia outra partida.

Depois, no provider:

```ts
const key = `${id}:${faseId}:${ids[0]}:${ids[1]}`;
if (keys.has(key)) throw new Error('Identidade ambígua: par repetido na mesma fase.');
```

No serviço, `upsert` atualiza o mesmo registro; `partidaId` existente é reutilizado. A chave não contém placar, data ou horário. Quando a fonte não publica súmula futura, a composição tem limite explícito: mudança de identidade exige revisão.

### Nomes e casca

Antes: nenhuma confirmação de identidade federativa.

Depois:

```ts
const atual = await tx.fpfsTime.findUnique({
  where: { eventoId_equipeId: { eventoId: s.id, equipeId } },
  include: { time: true },
});
if (atual?.time) return atual.time;
```

Somente na ausência de ponte é criado/reaproveitado um time sob identidade confirmada. Homônimo preexistente gera conflito; não há merge por nome. Vínculo muda `clube_representado_id`, preserva o time e acrescenta a participação após sincronização.

### Oficial versus anotação do clube

Antes: resultado e eventos do clube não tinham referência oficial independente.

Depois:

```ts
const diverge = local.status === 'FINALIZADA' &&
  (local.gols_mandante !== oficial.golsMandante ||
   local.gols_visitante !== oficial.golsVisitante);
// Divergência abre FpfsPendencia; não apaga Evento nem altera autores.
```

O retroativo grava um `Evento` e auditoria `CLUBE_RETROATIVO`; não incrementa o placar. Seu marcador é agregado por jogo/clube sem desaparecer após 30 operações. Já o histórico administrativo de operações tem limite de 30 itens.

### Navegação e interface

Antes: painel de competição local, sem calendário completo da federação.

Depois: página própria com filtros/aba na query string. Links operacionais continuam usando os IDs das partidas existentes. Rankings por IDs de fases, sem unir duas “SEMIFINAL OURO”. Oficial e cálculo 3/1/0 aparecem separados.

## 4. Evidências executadas

| Validação | Comando / resultado |
|---|---|
| Regressão API/mobile/web | `pnpm test:app:completo` — **360 passaram, 0 falhas**. |
| Desktop existente | `pnpm test:desktop` — **4 passaram**. |
| Integração PostgreSQL | `pnpm --filter @ludora/api exec tsx --test tests/paulista.integration.ts` — **5 passaram**: um cenário integrado e quatro testes puros registrados pela fixture importada. |
| Compilação | API, web e desktop compilaram; `prisma validate` passou. |
| Migrations completas | Todas as 15 migrations aplicadas do zero em outro banco descartável, `ludora_migration_check`. |
| Compatibilidade real | Consulta legada no Supabase com novo client, sem nova migration: sucesso. `migrate status`: somente esta migration pendente. Sem escrita. |
| Browser | `node apps/web/tests/paulista-smoke.cjs` — 390px/1366px × claro/escuro: **4 matrizes passaram** com API real isolada. |
| Qualidade do diff | `git diff --check` passou. |

O teste integrado cobre ausência de tabelas novas, Competições antes/depois, repetição, atualização, concorrência, casca/cliente/IDs, reversão, bloqueio com dados próprios, autorização por categoria, retroativo idempotente, placar preservado, proteção de agenda inclusive maiúsculas/barra final, jogos futuros e amostra real. O teste puro também verifica que painéis auxiliares `ID-chave`, agregado `total` e fases União não entram duplicados na classificação oficial.

Browser: carregamento, paginação 25→50, filtro próprio, ranking oficial/calculado, fases, pendência local 9×1/oficial 1×1, complemento DEFESA, manutenção de marcador, futuro sintético, voltar e erro 503 sem lista antiga. Screenshots inspecionados. Imagens externas foram bloqueadas no teste. Não houve teste visual de nova tela Electron nem teste de toque em aparelho físico; viewport touch é simulação.

### Reprodução do ambiente de teste

O teste destrutivo é restrito por código ao destino **127.0.0.1:55441/ludora_paulista**. Precisa começar com schema legado, sem as sete tabelas novas; rodar novamente sobre o banco já preparado falhará na checagem inicial, por projeto.

1. Criar PostgreSQL descartável nessa porta/banco; nunca usar Supabase para essa suíte.
2. Construir schema legado de `103f332:services/api/prisma/schema.prisma` e aplicá-lo ao banco descartável. Na execução foram gerados `schema-before.prisma` e `legado.sql` em `test-results/paulista/` usando `prisma migrate diff --from-empty --to-schema-datamodel ... --script`.
3. Definir `PAULISTA_TEST_DATABASE_URL` para o banco descartável e executar a integração. Ela aplica a migration nova e consulta a fonte oficial, portanto requer internet.
4. Executar `tsx tests/paulista.ui-setup.ts` no pacote API com a mesma variável. Iniciar a API na porta 3009 com DATABASE_URL/DIRECT_URL apontando ao descartável, JWT_SECRET de teste, PAULISTA_ENABLED=true e job diário false. Iniciar Vite na 5193.
5. O smoke requer Playwright e Microsoft Edge. Nesta máquina usou o Playwright do runtime de ferramentas via NODE_PATH (não é dependência de produção). Em outra máquina instalar Playwright num ambiente de ferramentas e disponibilizá-lo para `require('playwright')` antes de executar o script. O teste redireciona chamadas para API 3009; não precisa mudar `.env` real.

Artefatos ignorados: `test-results/paulista/amostra.json`, `conferencia-categorias.json`, `compatibilidade-banco-atual.json`, `status-banco-atual.log`, `integracao.log`, `regressao.log`, `migrations-completas.log`, builds e screenshots `web-*.png`. Fixtures de usuários e placar divergente ficaram somente no container local.

## 5. Próximos passos e riscos

Revisar migration e plano de ativação em ambiente compartilhado; só então aplicar e vincular o piloto real. A evidência local não significa que o piloto esteja ativo no Supabase. Não habilitar todas as categorias por semelhança de nome.

Scheduler distribuído, resolução assistida de vínculos com dados, ligação individual garantida para jogos futuros sem súmula, regulamento/desempates e painel Electron de monitoramento seguem pendentes. Copa União está fora do escopo. Sem criação de jogadores ou usuários a partir de placares.

## 6. Prompt para novo chat

> Estou aprendendo programação. Trabalhe com os arquivos atuais do Ludora, sem criar branch ou commit. Leia `docs/handovers/2026-11-05-paulista-piloto.md` e `docs/paulista-piloto.md`, confira o código antes de explicar e não aplique migrations no Supabase. Ensine do zero, uma etapa de cada vez, como a fonte vira SnapshotPaulista, como TypeScript tipa os dados, como funcionam async/await, arrays, Map, JSON, Prisma relations/upsert, transação Serializable, hash, idempotência, permissões e o fluxo React com filtros na URL. Use exemplos pequenos novos em inglês antes de mostrar os trechos reais. Diferencie dado oficial, anotação local e fixture. Explique por que não unimos clubes por nome, não copiamos jogos entre SUBs e não somamos retroativo ao placar. Mostre o antes/depois e como reproduzir cada teste com banco descartável. Não avance para implantação nem diga que algo está ativo no Supabase sem verificar. Faça perguntas pontuais para confirmar meu entendimento, sem me travar com exercícios a cada linha.
