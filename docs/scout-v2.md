# Scout v2

O Scout descreve os eventos que foram registrados. Não atribui nota de habilidade,
não prevê resultados e não mede técnica, visão de jogo ou intensidade física.

## Consultas do atleta

`GET /jogadores/:id/scout-contexto`, com autenticação e `x-clube-id` do clube ativo.

| Recorte | Query | Base |
| --- | --- | --- |
| Geral | nenhuma; `ano=2026` opcional | Partidas finalizadas com convocação ou evento atribuído ao atleta |
| Campeonato | `competicao_id=123`; `ano` opcional | Mesma base, limitada à competição |
| Partida | `partida_id=123` | Partida finalizada ou ao vivo, com vínculo ao atleta |

Não combine campeonato e partida na mesma consulta. A autorização restringe
atleta e partidas ao clube e às categorias permitidas, inclusive em confrontos
compartilhados. Nenhuma consulta de Scout concede acesso de edição ao adversário.

Os totais são calculados sobre o recorte inteiro. O histórico detalhado traz até
10 registros; os seletores trazem até 100 partidas e competições mais recentes.
Uma partida ao vivo é identificada como provisória e não entra no histórico geral
nem no processamento do modelo. Gols contra são separados dos gols a favor.

Convocações contam registros de escalação, inclusive reservas. Titularidades usam
`titular_inicial`, nunca a situação atual após substituições. Dados antigos sem
esse campo são informados como desconhecidos. Não são estimados minutos jogados.

## Evolução e interpretação

As médias recentes usam as últimas cinco partidas com registro no recorte. A
comparação só aparece quando há dez registros, formando dois grupos de cinco.
O denominador é "partida com registro", que pode incluir um evento sem escalação.
Essas médias não são o mesmo que as taxas por convocação usadas pelo modelo.

Uma alteração nas médias é descrita como mudança nos registros. Não é conclusão
de evolução técnica: minutos, adversários e completude da coleta não são medidos.
Zero significa nenhum evento registrado, não ausência de ações em campo.

## Serviço Python

O endpoint interno continua `POST /internal/ml/treinar-perfis`. O payload contém
somente IDs, categoria, posição, convocações e contagens de eventos de partidas
finalizadas, sem nomes, nascimento, CPF ou e-mail. Gols contra são excluídos.

O resultado usa `versao: 2` e `metodo: v2-registros-por-convocacao`:

- O perfil descritivo depende de pelo menos cinco convocações e três eventos
  entre gols, assistências e defesas. O tipo com mais registros define o perfil;
  empate produz "Misto". Abaixo disso, "Sem dados". Esse perfil usa uma regra
  explícita e não pretende descobrir a posição ou a qualidade do jogador.
- A comparação exploratória usa `RobustScaler` e `NearestNeighbors` sobre gols,
  assistências e defesas por convocação. Só compara a mesma categoria e posição;
  Ala/Alas são normalizados. Exige pelo menos cinco atletas no grupo, cada um com
  cinco convocações e algum evento nessas métricas. Retorna até três semelhantes.
- A distância não é probabilidade, qualidade ou previsão. Semelhança refere-se
  apenas aos registros disponíveis; grupos sem base suficiente ficam vazios.
- `nota_geral` passa a ser `null` no banco. As interfaces escondem o índice e o
  radar antigos. Metadados e semelhantes ficam no JSON `scores_ml`, versionado.

Os limites de amostra são regras iniciais de produto, sem alegação de validação
estatística. Devem ser revisados com dados reais e avaliação dos técnicos.

## Atualização e implantação

Sem alteração de schema ou migration nesta versão. Atualize Python e API juntos:

```powershell
services/ml/.venv/Scripts/python.exe -m pip install -r services/ml/requirements.txt
pnpm run build:api
pnpm run build:web
```

Reinicie os serviços. Para o ambiente local, `pnpm dev` inicia os quatro serviços;
`PYTHON_AI_URL` deve apontar para o Python e `ML_API_KEY` deve ser a mesma nos dois
serviços. O script local já reutiliza a chave da API. Não coloque a chave no front.

Finalização e correções da súmula continuam acionando o processamento existente.
Para atualizar o histórico já cadastrado, um gestor com acesso a todas as
categorias pode executar `POST /admin/reprocessar-scout` com Bearer e `x-clube-id`.
O processamento é em background; a resposta HTTP não comprova que terminou.
Consulte novamente `/jogadores/perfis` e verifique `analise_scout.versao = 2` e
`calculado_em`. Chamadas simultâneas do mesmo clube são agrupadas numa fila local
ao processo da API; isso não é uma fila distribuída entre várias instâncias.

Se o Python estiver indisponível, os recortes e totais continuam funcionando. Os
perfis antigos não reaparecem como avaliações novas; o grupo semelhante fica
indisponível até existir um resultado v2. Resultados anteriores v2 mantêm a data
do último processamento, sem fingir que foram atualizados.

## Validação

```powershell
pnpm test:app:completo
pnpm dev:mobile:check
services/ml/.venv/Scripts/python.exe -m unittest discover -s services/ml/tests -v
```

`apps/web/tests/scout-context-smoke.cjs` exercita a ficha com API interceptada,
sem acesso ao banco, em 320/390/820/1440 px e nos dois temas. Execute com uma
instância web disponível em `LUDORA_WEB_TEST_URL` (padrão `http://127.0.0.1:5187`),
Playwright e Microsoft Edge. Não substitui teste em aparelho físico nem validação
estatística do modelo com os dados reais dos clubes.
