# Diagnóstico da API local e carregamento do mobile — 05/11/2026

## Destino confirmado

- `apps/mobile/.env`: API `http://192.168.15.2:3000`.
- A variável pública foi conferida também no JavaScript servido pelos dois Metro em execução, portas 8081 e 8082. Ambos continham essa URL local.
- API ouvindo em `0.0.0.0:3000`, processo Node com `--import tsx src/server.ts`.
- Python configurado em `http://localhost:8000`, serviço ouvindo em `127.0.0.1:8000`.
- O PostgreSQL continua remoto. Executar API e Python localmente não torna o banco local.
- O terminal anexado registra tentativas com porta Expo ocupada e encerramentos por SIGINT. A primeira tentativa falhou no Expo e o concurrently encerrou os demais serviços. Isso não comprova a causa de cada timeout do aparelho; pode haver requisições durante reinícios.

## Medições locais

Consultas somente de leitura, sem mudar dados. A medição HTTP usou uma sessão temporária para um administrador existente, mantida apenas em memória e nunca registrada. Três rodadas com as quatro rotas concorrentes, pelo IP LAN no próprio computador:

| Operação | Tempos, ms |
| --- | --- |
| `/health`, após primeira chamada | 3–6 |
| PostgreSQL `SELECT 1`, após conectar | 40–42 |
| Consulta SQL da Home | 74, 65, 67 |
| HTTP `/partidas/home` com corpo lido | 202, 154, 144 |
| HTTP `/jogadores/perfis` com corpo lido | 287, 234, 263 |
| HTTP `/notificacoes?limite=1` com corpo lido | 147, 117, 122 |
| HTTP `/usuarios/me` com corpo lido | 132, 130, 126 |

Não reproduzimos os 2–4 s da tela nem os 20 s de timeout nessa amostra. O teste não mede o enlace Wi-Fi do telefone, sua thread JS nem a renderização nativa. Nenhuma alteração no backend foi necessária a partir desses resultados.

`origem: servidor` nos logs distingue resposta remota da cópia offline; não significa Render. `consulta:scout` engloba também credenciais, cache e processamento no cliente; não é a duração isolada do SQL/ML.

## Esperas removidas no cliente

1. A preparação da identidade da cópia offline lia SecureStore e inicializava a sessão **antes** de iniciar `carregar`. Agora ocorre em paralelo com a consulta remota.
2. Após a resposta remota, uma nova leitura de sessão bloqueava sua entrega mesmo sendo usada somente para decidir se o cache poderia ser gravado. Essa validação e gravação agora ocorrem em segundo plano. A cópia local continua exigindo sessão válida, clube correto e geração atual; 401/403/404 continuam descartando a cópia, sem fallback offline.
3. Scout reaproveita o token já lido no escopo da própria consulta para os cabeçalhos HTTP. Continua relendo a sessão ao concluir para descartar resposta de uma conta anterior. Não foi criado cache persistente de tokens.

### Evidência controlada

Usando o serviço de cache real com SecureStore simulado lento (80 ms por leitura de token, 400 ms na inicialização da identidade) e resposta remota de 100 ms:

| Medida | Antes, 3 execuções | Depois, 3 execuções |
| --- | --- | --- |
| Início do pedido, ms após chamada | 491, 495, 510 | 1, 0, 0 |
| Entrega da resposta, ms | 695, 696, 710 | 120, 108, 109 |

Não são tempos do aparelho. Demonstram que espera da persistência deixou de ser somada à consulta. No serviço Scout real, com transporte e SecureStore simulados, uma consulta com clube explícito passou de 3 para 2 leituras de token e manteve 1 envio HTTP. Troca de sessão durante a resposta continuou abortando o resultado.

## Diagnóstico após recarregar

Em desenvolvimento, `api:destino` mostra apenas a origem pública e ambiente `local`, `render` ou `remoto`. Não registra token, usuário/senha ou query.

- `http:transporte`: agora identifica rota sem IDs numéricos, origem e motivo `timeout` ou `rede`; cancelamentos explícitos são separados das falhas.
- `cache:<recurso>:contexto`: custo da preparação da identidade offline.
- `consulta:<recurso>:dados-servidor`: retorno do carregador, incluindo transporte, credenciais e parse; não é tempo puro do backend.
- `scout:credenciais` e `json:scout-perfis`/`json:scout-contexto`: separam armazenamento e leitura do corpo.

Use `EXPO_PUBLIC_DEBUG_PERF=1` para ver também etapas abaixo de um segundo. Recarregue o app no Metro desejado. Fechar sessões Expo antigas evita acompanhar logs de uma sessão diferente, embora os dois bundles inspecionados apontassem para a mesma API.

## Verificações

TypeScript, 182 testes unitários, interface Home em 320/360/412/768 px e Scout com troca de categoria sem nova consulta. Incluídos testes para validação lenta em segundo plano, falha no armazenamento, sessão invalidada, diagnóstico sem credenciais e classificação de timeout. Export Android validado. Sem telefone/emulador conectado; o ganho real e a origem dos timeouts do aparelho ainda precisam ser confirmados com os novos logs.
