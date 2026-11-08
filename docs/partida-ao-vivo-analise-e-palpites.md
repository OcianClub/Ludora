# Raio-X e palpite da torcida

No web: comparativo dos registros, destaques e votações do público. O mobile e o desktop mantêm seus contratos e funcionalidades atuais; não foi adicionado um componente nativo de votação nesta etapa. O compartilhamento por imagem inclui destaques opcionais, conforme `pos-partida-web.md`.

## Leitura dos registros

- O comparativo usa os eventos já carregados na gestão/consulta pública da partida. Não faz consultas adicionais de Scout ou de ML.
- Em **Todos**, gols são o placar oficial. No filtro de tempo, são contados os eventos de gol daquele período. Uma correção direta de placar pode explicar diferenças.
- Assistências, defesas, faltas cometidas e cartões são contagens, sem estimativas de posse, minutos, eficiência ou probabilidade de vitória.
- Destaque de ataque: `gols + 0,6 × assistências`, calculado internamente como `5 × gols + 3 × assistências` para evitar diferenças de arredondamento em empates. O resultado não é exibido como nota de desempenho.
- Defesas têm um destaque separado. Todos os líderes empatados podem ser consultados. Zero não elege um líder.
- Gols contra pontuam o placar beneficiado, mas não o destaque individual. Eventos sem jogador não pontuam atletas. São elegíveis apenas atletas de escalações publicadas; rascunhos não são revelados.
- A fórmula é um critério Ludora, não uma fórmula oficial de federação. O botão de informação explica os limites e referencia um exemplo de ponderação configurável: https://sportslabtools.com/en/futsal/stats/.
- Durante a partida os destaques são provisórios. O componente só recebe os eventos publicados, depois da janela existente de cinco segundos e da confirmação do servidor. Correções posteriores recalculam a análise.

## Votação

- `GET /publico/partidas/:id/palpite`: resultado agregado, sem identificação ou escolha de quem votou.
- `GET /partidas/:id/palpite`: resultado e escolha da conta autenticada. Não exige vínculo/cargo no clube.
- `PUT /partidas/:id/palpite`: `{ "escolha": "MANDANTE" | "EMPATE" | "VISITANTE" }`.
- A chave composta `(partida_id, usuario_id)` assegura um voto por conta. Trocar a escolha atualiza o mesmo registro. Repetir a escolha é idempotente.
- A escrita bloqueia a linha de Partida na transação e verifica o status antes de salvar. FINALIZADA e CANCELADA não aceitam votos. O voto não altera a versão dos comandos da súmula.
- A revisão própria `palpites_versao` impede respostas atrasadas de fazer os percentuais voltarem a um estado antigo. A consulta usa um snapshot consistente para contagens e revisão.
- Percentuais são arredondados pelo maior resto e somam 100 quando há votos. Sem votos, todos são zero e a interface mostra um traço.
- `palpite_atualizado` usa os sockets existentes nos canais dos clubes participantes (privado e público), com contagens e revisão; nunca envia `meuVoto` ou a identidade de quem votou. Votar não dispara recarregamento da partida nem invalida o cache de outras consultas.
- Como fallback, a votação atualiza a cada 30 segundos enquanto a aba está visível e a votação aberta, ao reconectar ou retomar a janela. Após encerramento não faz consultas periódicas. Falha de resposta de escrita provoca uma consulta de conferência, sem reenvio automático de voto.
- O palpite é opinião do público, separado do Scout e dos destaques. Usuários sem conta veem resultados e podem entrar para votar; o destino da partida é preservado.

## Ativação

### Destaques e acontecimentos

- Os destaques são calculados somente pelos registros do Ludora. Não há eleição de atleta pelo público, consultas de votos de atletas ou transmissão desses votos.
- Participação em gols e defesas ficam separadas, considerando o recorte selecionado e preservando os empates. Na imagem compartilhada, a opção de destaques inclui apenas esses registros.
- Acontecimentos são agrupados por tempo, mandante à esquerda e visitante à direita. O menu de cada lance fica na borda externa, antes do ícone no mandante e depois dele no visitante. A altura é limitada, com rolagem interna; não são inventados minutos.
- O histórico de alterações permanece recolhido no fim da página e exclusivo dos gestores.
- No desktop, o espaço usa a proporção 60/40: placar e controles têm prioridade. Acontecimentos compartilham a linha do placar com o seletor de tempo; votação e registro de evento compartilham a segunda linha e a mesma altura. O conteúdo dos acontecimentos rola dentro da altura disponível, sem aumentar com novos eventos.
- Sem controles de súmula, a votação mantém seu formato normal abaixo dos acontecimentos na coluna direita. As colunas têm alturas independentes: preserva-se o espaço vazio sob o placar, sem comprimir acontecimentos ou votação para encaixá-los. No mobile, os blocos voltam a uma coluna. Os destaques mostram atleta, clube e contagens lado a lado, sem repetir títulos nem esticar o card à altura do comparativo.
- A votação de qual equipe vence permanece disponível. As tabelas/migration da antiga votação de atletas foram preservadas como histórico para instalações que já as aplicaram; não são mais usadas pela aplicação e nenhum dado existente foi apagado.

A migration é aditiva. Não foi aplicada automaticamente ao banco compartilhado e nenhum deploy/push foi executado.

Pare a API antes de gerar o cliente Prisma (no Windows, o processo em execução pode manter o arquivo do cliente bloqueado). Na raiz do repositório, com as variáveis apontando para o banco que será utilizado:

```powershell
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api exec prisma generate
```

Reinicie a API local. Para publicar, aplique a migration e atualize a API antes de publicar o web. Não há novas chaves ou variáveis de ambiente. A API precisa ter a migration antes de executar a nova versão, pois o Prisma também lê a nova coluna de Partida nas consultas existentes.

## Verificação

- `pnpm --filter @ludora/api run build`
- `pnpm --filter @ludora/web run build`
- `pnpm --filter @ludora/api exec prisma validate`
- `pnpm --filter @ludora/api exec tsx --require ./tests/setup.cjs --test tests/palpites.test.ts tests/web-realtime.test.mjs tests/publico-realtime.test.cjs ../../apps/web/tests/match-insights.test.ts`
- Browser: `apps/web/tests/match-insights-smoke.cjs` e `apps/web/tests/match-live-smoke.cjs`, apontando `LUDORA_WEB_TEST_URL` para o Vite de teste.

Os testes de API usam persistência simulada e sockets reais; os testes de navegador interceptam o HTTP e não tocam dados de usuários. A execução da migration e concorrência em PostgreSQL real devem ser verificadas no ambiente de homologação. Capturas visuais ficam em `test-results/match-insights` (320, 390, 820 e 1440 px; claro e escuro).

Para destaques, menus e compartilhamento, execute também `apps/web/tests/match-share.test.ts` e `apps/web/tests/player-highlights-smoke.cjs`. O último cobre gestor, torcedor e anônimo em 390/1440 px, ausência de votação de atletas/consultas correspondentes, posição externa dos menus, privacidade de nomes na imagem e destaques calculados pelo Ludora. Capturas ficam em `test-results/player-highlights`.
