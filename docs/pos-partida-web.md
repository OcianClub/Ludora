# Pós-partida no web

O resultado final permanece visível ao consultar qualquer tempo. Um filtro único muda os acontecimentos, o comparativo, os destaques e os números individuais da escalação; não envia comandos à API. A escalação exibida é a última publicada, e não uma reconstrução de quem estava em campo em cada tempo.

Os destaques reutilizam os critérios explicados no Raio-X: participação em gols (gols + 0,6 × assistências), defesas separadas e empates preservados. Não há nota geral nem eleição automática de melhor jogador. As correções confirmadas na súmula atualizam a análise. A votação de resultado é encerrada pela API quando a partida termina.

Após encerrar, não há “Desfazer último” nem atalho de edição dos dados bloqueados do confronto. As ações de correção dos acontecimentos continuam submetidas às permissões e justificativas existentes. Ao adicionar um evento após o encerramento, é possível selecionar o tempo correspondente.

## Compartilhar imagem

- O diálogo gera um PNG de 1080 px de largura com placar, vencedor, categoria, data, competição, local (se informado) e contagens da partida inteira. O filtro de consulta por tempo não altera a imagem do resultado final.
- Os nomes ficam desligados por padrão. Ao ativar, entram os autores dos gols da escalação publicada, agrupados por atleta; gols contra aparecem no time beneficiado. Não são exportados rascunhos de escalação. Sem autoria, o arquivo informa a ausência; sem elenco cadastrado, não inventa um jogador.
- A imagem mostra até oito grupos de autores por equipe e indica quantos outros grupos constam na súmula. O placar segue a súmula, mesmo quando há correções sem evento de gol correspondente.
- Partidas da federação mantêm a identificação de “Placar anotado pelo clube”, sem apresentar o registro como resultado oficial da federação.
- O navegador oferece compartilhamento de arquivo quando `navigator.canShare` permite PNG. Nos demais casos, há download. “Copiar link” e a versão em texto continuam disponíveis. Cancelar o compartilhamento nativo não gera erro.
- O renderizador é carregado apenas ao abrir o diálogo, sem biblioteca adicional. Escudos são carregados com CORS e limite de espera; falha usa a inicial. URLs de prévia são revogadas na substituição/saída, e renderizações antigas não podem exportar nomes depois de desligar a opção.

O compartilhamento inclui a opção independente **Incluir destaques**: participação em gols e defesas, preservando empates. Com nomes desligados, os destaques são identificados pela camisa. São os registros da partida inteira, mesmo ao consultar um tempo específico. Não há votação de jogador nem bloco de torcida no PNG.

A geração da imagem é local no navegador e não exige novas chaves ou migration. A votação existente de qual equipe vence é independente dos destaques de atletas.

## Verificação

```powershell
pnpm --filter @ludora/web run build
pnpm --filter @ludora/api exec tsx --require ./tests/setup.cjs --test ../../apps/web/tests/match-share.test.ts ../../apps/web/tests/matchResult.test.mjs ../../apps/web/tests/match-insights.test.ts
```

Com Playwright disponível no ambiente e `LUDORA_WEB_TEST_URL` apontando para o Vite de teste:

```powershell
node apps/web/tests/match-post-game-smoke.cjs
node apps/web/tests/match-live-smoke.cjs
node apps/web/tests/match-insights-smoke.cjs
```

Os testes usam dados simulados, sem escrever no banco compartilhado. Cobrem visitante e gestor, 320/390/820/1440 px (ao vivo também 360 px), claro/escuro, navegação e filtros, arquivo PNG baixado, autoria/privacidade, gol contra, escudo indisponível, troca rápida da opção de nomes, cancelamento do compartilhamento, falha de cópia e regressão dos comandos da súmula. As capturas e imagens exportadas ficam em `test-results/match-post-game`, `test-results/match-live` e `test-results/match-insights`.

O seletor nativo de compartilhamento é simulado nos testes automatizados; a abertura do WhatsApp/galeria deve ser conferida em aparelho real. Se um provedor de escudos bloquear CORS, a inicial será utilizada na imagem exportada.
