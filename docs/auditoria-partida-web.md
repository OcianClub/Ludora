# Auditoria de partida ao vivo e pós-jogo — 08/11/2026

Escopo: aplicação web, controles da súmula e contratos compartilhados da API. Não houve migration, alteração no formato dos comandos ou gravação de partidas no banco real. Os testes interativos interceptam a rede; os testes da API executam os handlers reais com persistência transacional simulada e integrações externas desabilitadas.

## Problemas corrigidos

- **Gol e assistência:** “Desfazer último” resolve a assistência vinculada para seu gol de origem e remove o lance completo pela mesma operação já atômica da API. A assistência ainda pode ser removida isoladamente pelo seu próprio menu.
- **Fila bloqueada:** respostas definitivas de rejeição (400/403/404/409 etc.) permitem dispensar o envio recusado. Erros de rede, timeout, resposta inválida, 408/429 e erros de servidor continuam exigindo conferência/reenvio com o mesmo identificador; não são tratados como certeza de que nada foi salvo.
- **Armazenamento indisponível:** falha de sessionStorage não derruba a fila em memória nem impede cancelar um lance.
- **Autoria no pós-jogo:** identificar um gol pendente também mostra e exige justificativa. Uma autoria já preenchida não pode ser salva novamente sem alteração.
- **Permissão de correção:** a tela usa a autorização temporária `podeCorrigir`, que já existia na API. O outro clube pode solicitar edição pelo fluxo existente, sem ganhar controle de tempo, início, encerramento ou substituição no pós-jogo. A API continua validando a autorização em cada comando.
- **Responsabilidade pela súmula:** o gestor do clube que não está operando também consegue enviar a solicitação de responsabilidade durante o jogo. O pedido não transfere permissões antes do aceite. Partida encerrada mostra apenas a informação do responsável, sem oferecer transferência inválida.
- **Seleção desatualizada:** jogador/assistente retirado de campo enquanto o modal está aberto não pode ser confirmado. Uma substituição exige que quem sai ainda seja titular e quem entra ainda seja reserva.
- **Substituição na API:** valida as camisas da súmula e limita as duas atualizações à equipe atual. Versão da partida, vínculo e situação continuam sendo verificados.
- **Pendências:** faltas, cartões, assistências e defesas sem autoria também entram no aviso quando pertencem a equipe Ludora. Equipes externas não ganham pendência fictícia.
- **Limites:** período zero é rejeitado; minuto zero é preservado; novo gol não ultrapassa o limite de 99 já adotado na correção de placar. A assinatura de reenvio distingue minuto zero de minuto omitido.
- **Histórico:** os registros exibem o tipo do lance e a autoria disponível, além da ação realizada.

## Otimização verificada

O contador estava no hook da fila e atualizava o estado do quadro inteiro a cada segundo. Agora o tempo restante é estado de um componente pequeno do popup; a animação da barra continua em CSS. A fila só atualiza o quadro quando muda de estado ou recebe uma alteração.

Com instrumentação de commits do React no navegador de desenvolvimento, a contagem de três segundos produziu **zero novas renderizações de MatchLiveSession**, tanto em 360 quanto em 1180 px. Isso mede o trabalho evitado no contador; não é um benchmark de FPS nem de latência do Render/banco.

## Verificação reproduzível

```powershell
pnpm --filter @ludora/api exec tsx --require ./tests/setup.cjs --test tests/shared-events.test.ts tests/shared-live.test.ts tests/partidas.test.ts ../../apps/web/tests/matchEvents.test.mjs ../../apps/web/tests/match-insights.test.ts ../../apps/web/tests/match-share.test.ts
pnpm --filter @ludora/api run build
pnpm --filter @ludora/web run build
```

Com Playwright disponível e `LUDORA_WEB_TEST_URL` apontando para o servidor web de teste:

```powershell
node apps/web/tests/match-live-smoke.cjs
node apps/web/tests/match-post-game-smoke.cjs
node apps/web/tests/match-audit-smoke.cjs
```

- **36 testes de regras/contratos:** sete tipos de evento, gol contra, assistência vinculada, autores/equipes inválidos, reserva ao vivo, minuto/período inválidos, versão concorrente, placar, permissões, reenvio, transação/rollback, justificativas, camisas e substituição. Incluem comparação, destaques e privacidade do compartilhamento.
- **8 cenários ao vivo:** 320/360/820/1440 px, claro/escuro. Cancelamento antes de publicar, publicação e resposta perdida, reenvio, autoria pendente, gols contra, remoção e cancelamento de remoção, períodos, substituição, encerramento, compartilhamento e visitante sem controles.
- **8 cenários pós-jogo:** 320/390/820/1440 px, claro/escuro. Filtros somente de consulta, sem alteração do placar final; PNG com/sem nomes, download e falhas de escudos/compartilhamento.
- **2 cenários adicionais de auditoria:** 360/1180 px. Rejeições 400/409 dispensáveis, resposta perdida sem duplicação, gol+assistência desfeitos juntos, falha de armazenamento, arraste, clique duplo, seleção invalidada por sincronização, identificação finalizada e autorização temporária para incluir/remover eventos.

## Limites e implantação

- Os testes não medem a latência da infraestrutura publicada nem substituem um teste com múltiplos dispositivos conectados ao Render.
- A concorrência foi simulada por versão/atualização de elenco; esta rodada não executou carga ou transações concorrentes em PostgreSQL real.
- O compartilhamento nativo foi simulado. A escolha de aplicativo e o envio efetivo dependem do navegador/aparelho.
- Se a página for fechada com envios pendentes, a fila recuperada pede conferência ao retornar; ela não é um serviço de envio em segundo plano fora da página. Sem armazenamento disponível, essa recuperação não persiste após fechar.
- Para levar as correções à produção, publicar **web e API**. Não há alteração de variáveis de ambiente nem migration nesta auditoria.
