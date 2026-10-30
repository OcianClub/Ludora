# Partidas entre clubes

## Fluxo

- Adversário externo: organizar cria uma partida **Agendada** e abre a preparação.
- Adversário cadastrado: organizar envia uma **proposta**. O outro clube aceita, recusa ou sugere data, horário e local. O remetente pode cancelar a proposta.
- O aceite cria uma única partida, visível nos dois clubes, identificando o organizador.
- Cada clube edita apenas sua equipe: Dados → Escalação → Revisão. Salvar mantém um rascunho privado; confirmar publica a escalação.
- A partida fica **Preparada** após todas as equipes confirmarem. O clube responsável pela súmula inicia explicitamente o jogo.
- O organizador começa responsável pela súmula. Pode propor transferi-la antes do início; o outro clube precisa aceitar.
- Alterações de data, horário e local em confrontos compartilhados precisam de novo aceite e invalidam as confirmações de preparação. Trocar os participantes exige cancelar e organizar outro confronto.

## Escalação e súmula

Administradores, técnicos e mesários respeitam o acesso às categorias do próprio clube. Cada equipe usa sua categoria local, inclusive quando o confronto foi organizado pelo adversário.

Camisas são únicas por equipe. O número exigido de titulares vem da competição (padrão: cinco). Uma competição pode exigir inscrição dos convocados. O regulamento fica fixo depois de organizar partidas.

Ao iniciar, a escalação inicial é preservada. Durante o jogo, cada clube faz suas próprias substituições. O responsável pela súmula registra placar, período e eventos das duas equipes. Um gol e sua alteração no placar são gravados na mesma transação. Gols de adversários externos dispensam a escolha de atleta.

Os dois clubes recebem atualizações em tempo real. Escalações confirmadas ficam públicas. Resultados e notificações usam a perspectiva de cada clube. Correções exigem justificativa; cancelamentos preservam o histórico. Classificações são recalculadas a partir dos resultados atuais.

As partidas anteriores à migration mantêm a preparação pelo clube original. A migration não adiciona aceites retroativos nem substitui escalações antigas.

## Arquivos principais

- `services/api/src/modules/partidas/compartilhadas.service.ts`: validação, transações e duplicidade.
- `services/api/src/modules/partidas/compartilhadas.routes.ts`: propostas, preparação, súmula, substituições e auditoria.
- `apps/web/src/pages/SolicitacoesPartidas.tsx`: solicitações recebidas e enviadas.
- `apps/web/src/pages/PartidaDetalhe.tsx`: preparação em etapas.
- `apps/web/src/components/MatchOperations.tsx`: operação e acompanhamento da partida.
- `apps/mobile/src/components/PartidaCompartilhada.tsx`: preparação e acompanhamento no aplicativo.
- `apps/mobile/app/solicitacoes-partidas.tsx`: solicitações no aplicativo.

## Executar após atualizar o projeto

Com a API parada, na raiz:

```powershell
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api exec prisma generate
pnpm --filter @ludora/api run build
pnpm dev:api
```

Validação automatizada:

```powershell
pnpm test:app:completo
pnpm --filter @ludora/web exec tsc --noEmit
pnpm --filter @ludora/mobile exec tsc --noEmit
```

O teste integrado abaixo usa o banco configurado em `services/api/.env`. Cria clubes e usuários temporários e remove apenas suas fixtures ao terminar. Execute no banco de desenvolvimento:

```powershell
pnpm --filter @ludora/api exec tsx tests/shared-matches.integration.ts
```

Os testes de navegador `shared-matches-smoke.cjs`, `shared-proposals-smoke.cjs` e `match-preparation-smoke.cjs` usam HTTP simulado e o Vite na porta 5187. Não alteram o banco.
