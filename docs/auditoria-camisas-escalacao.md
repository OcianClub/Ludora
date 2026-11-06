# Auditoria de camisas e escalações — 06/11/2026

## Regras verificadas

| Situação | Alterar no cadastro | Efeito na escalação existente |
|---|---|---|
| Agendada ou preparada, titular ou reserva | Permitido, com confirmação se a camisa estiver ocupada | Atualiza o número; quem ficar sem camisa sai da escalação. Não promove reservas nem reconvoca automaticamente. Invalida a confirmação da equipe. |
| Elenco ainda não convocado | Permitido | Só afeta outro convocado se houver transferência de sua camisa. |
| Em campo em qualquer partida ao vivo | Bloqueado no servidor | Também bloqueia transferência indireta de sua camisa. Reenviar o mesmo número é permitido. |
| Reserva em partida ao vivo | Permitido no cadastro | Preserva o número registrado na súmula em andamento. |
| Finalizada ou cancelada | Permitido no cadastro | Preserva os números da súmula, inclusive ao recarregar a página. |

Números são inteiros de 1 a 99, exibidos com dois dígitos. `1` e `01` representam a mesma camisa. O jogador sem número não pode ser convocado. A confirmação e o início exigem exatamente um goleiro titular; goleiros reservas não têm esse limite.

## Correções

- Bloqueio de mudanças de camisa dos dois envolvidos na troca quando algum estiver em campo ao vivo, dentro da mesma transação serializável da gravação.
- Reconciliação das camisas atuais de toda a equipe em preparação, inclusive snapshots antigos que ocupavam um número já livre no cadastro.
- Troca e sincronização das escalações atômicas; falhas revertem as alterações. Conflitos serializáveis têm tentativas limitadas.
- Evento Socket.IO `elenco_atualizado` após o commit, sem CPF, nomes ou escalações privadas. A atualização da prontidão também é sinalizada aos clubes participantes.
- Jogadores e preparação sincronizam números entre abas. O rascunho local é preservado; convocados que ficam sem camisa são retirados com aviso.
- Reconexão e retorno à aba recuperam as camisas atuais e invalidam o cache. A preparação usa a consulta leve `convocacao=true`, sem consultar perfis de Scout.

## Testes reproduzíveis

Na raiz, gerar os builds antes dos testes de backend:

```powershell
pnpm run build:api
pnpm --filter @ludora/web run build
$env:NODE_ENV = 'test'
pnpm --filter @ludora/api exec node --test tests/shirt-lifecycle.test.cjs tests/camisas-escalacao.test.cjs tests/elenco.test.cjs tests/match-preparation.test.cjs
pnpm --filter @ludora/api exec node --import tsx --test tests/shared-preparation.test.ts ../../apps/web/tests/lineup-shirts.test.ts
```

Os testes de navegador usam Playwright/Edge e um Vite local. Configurar `LUDORA_WEB_TEST_URL` com a URL desse Vite e executar, em `apps/web`:

```powershell
node tests/match-shirt-actions-smoke.cjs
node tests/shirt-cross-page-smoke.cjs
```

- Matriz de 5 estados × 3 posições no elenco × atribuição livre/transferência.
- Titulares e reservas sem camisa, troca de dois números, número antigo na escalação, atribuição posterior à remoção e partidas em paralelo.
- Entrada inválida, nomes legados, confirmação vencida, permissões, isolamento de clube, idempotência, rollback e repetição serializável simulada.
- Navegador em 320/820/1366 px: edição, validação, conflito, troca por teclado/arraste e revisão.
- Navegador em 390/1366 px com Socket.IO real: Jogadores ↔ preparação, rascunho local, retirada de titular/reserva, reconexão e súmula finalizada preservada após recarregamento.

## Limites da validação

HTTP e banco são simulados nos testes; o teste entre abas usa transporte Socket.IO real. Nenhuma partida ou jogador do banco real é alterado. A recuperação de conflito serializável é testada com falhas injetadas; não foi feito ensaio de concorrência contra o banco de produção.

É necessário reiniciar/publicar a API e atualizar o web para disponibilizar as correções. Não há migração de banco. O bloqueio no servidor também se aplica a mobile e desktop; os novos consumidores de sincronização foram adicionados ao web.
