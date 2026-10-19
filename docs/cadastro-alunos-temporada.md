# Cadastro de alunos e atualização de temporada

## Fluxo implementado

A tela Jogadores agora organiza os alunos em blocos de Iniciação (Sub-7, 8, 9 e 10)
e Base (Sub-12, 14, 16 e 18). Cada bloco é o elenco da categoria no clube; isso não
funde as entidades Categoria e Time usadas nos confrontos.

O cadastro pede nome completo, CPF, nascimento, posição e camisa opcional.
A API calcula a categoria pelo ano da temporada em America/Sao_Paulo menos o ano
de nascimento, sem esperar o aniversário. O frontend consulta essa regra antes de
habilitar a camisa. Nascimentos inválidos/futuros e idades fora de 4 a 18 anos na temporada são recusados.
O CPF é normalizado para dígitos e deve ter 11 dígitos; esta etapa não verifica os
dígitos verificadores. O CPF já cadastrado não é editado neste formulário.

## Camisas

- Número entre 1 e 99, ou null para ficar sem camisa.
- A ocupação considera alunos ativos da mesma categoria e do mesmo clube.
- Sem conflito, salva diretamente.
- Com conflito, a API retorna HTTP 409 com conflito_camisa, incluindo nome e ID do
  ocupante. O web mostra confirmação e bloqueia alterações do formulário enquanto
  ela estiver aberta. Cancelar não altera os registros.
- Confirmar envia confirmar_camisa com jogador_id e camisa_anterior. O servidor
  confere novamente o ocupante e o número anterior antes de alterar ambos.
- No cadastro, o antigo ocupante fica sem camisa. Na edição dentro do mesmo sub,
  recebe a camisa anterior do aluno editado; se não existia, recebe null.
- Ao editar o nascimento e mudar de sub, não se transfere a antiga camisa para
  outra categoria: o ocupante do destino fica sem número após confirmação.
- A transação SERIALIZABLE salva as duas alterações juntas e repete até duas vezes
  em conflito concorrente. Os testes simulam esse conflito e rollback; não são um
  teste de concorrência contra PostgreSQL real.
- A troca manual já existente no mobile usa agora uma chamada com confirmação,
  em vez de duas atualizações separadas. O backend continua sendo a autoridade.

## Atualização automática

Ao iniciar o servidor e a cada hora, a API recalcula os alunos ativos de cada clube.
Não depende do navegador aberto. Se o servidor ficar desligado, recupera a mudança
na próxima inicialização. Não promete execução à meia-noite em hospedagem suspensa.

Quem permanece na categoria tem prioridade sobre quem chega. O transferido mantém
sua camisa se estiver livre; caso contrário, fica sem número. Entre transferidos
com o mesmo número, o menor ID tem prioridade. Duplicatas antigas entre residentes
são resolvidas pelo menor ID, deixando os demais sem número.

Fora da faixa de 4 a 18 anos, o aluno fica inativo, preservando seu registro. Inativos não são
reativados. Uma categoria de destino ausente aborta a atualização daquele clube,
sem alterações parciais; haverá nova tentativa na próxima execução.

Partidas, eventos e escalações anteriores não são reescritos. Esta etapa não cria
um histórico de vínculos por temporada: altera a categoria atual do cadastro.

ATUALIZACAO_TEMPORADA=false desativa o agendador, por exemplo em testes manuais que
não devem atualizar um banco compartilhado. NODE_ENV=test também o desativa.
A rota PATCH /admin/atualizar-idades continua disponível, com as permissões atuais,
e usa a mesma regra. Não executamos essa rotina no Supabase durante o desenvolvimento.
Nenhuma migration foi criada ou aplicada nesta etapa.

## Mapa para estudar

- services/api/src/modules/jogadores/elenco.rules.ts: cálculo de categoria e plano
  de mudança; funções puras, que recebem valores e retornam resultados sem gravar.
- elenco.service.ts: valida autorização de origem/destino, resolve conflito, grava
  em transação e executa a rotina periódica.
- jogador.routes.ts: recebe HTTP e traduz sucesso/erros para respostas JSON.
- services/api/src/server.ts: inicia e encerra a rotina junto com o servidor.
- apps/web/src/services/api.ts: envia cadastro/edição e mantém os detalhes de 409
  no objeto ErroJogador para o formulário mostrar a confirmação.
- apps/web/src/pages/Jogadores.tsx: estados do formulário, consulta da categoria,
  blocos de alunos, carregamento/erro e confirmação. Uma resposta de previsão antiga
  é descartada quando a data muda.
- Jogadores.css: layout responsivo usando as cores compartilhadas; prefixo alunos-
  evita interferência com a tela Elenco, destinada à consulta de scout.
- apps/web/src/styles/theme.ts e components/Layout.tsx: seleção de tema do sistema,
  claro ou escuro; reutilizam darkColors/lightColors adicionadas pelo mobile.
- apps/mobile/src/components/EscalacaoPartida.tsx: adapta a confirmação de troca
  existente ao salvamento atômico da API, incluindo alunos não convocados.

## Verificação

Compilação da API e do web e verificação TypeScript do mobile passaram. Doze testes
em services/api/tests/elenco.test.cjs passaram sem acessar o banco. Após compilar:

```powershell
node --test services/api/tests/elenco.test.cjs
```

No navegador, com API temporária em memória e clube marcado DEMONSTRAÇÃO, foram
verificados: camisa desabilitada antes do cálculo; identificação do Sub-14;
conflito de camisa; cancelamento; confirmação com novo aluno usando a 10 e antigo
ocupante sem número; tema claro; layout desktop e ausência de overflow em 390 px.
Isso não comprova o funcionamento end-to-end com o banco real ou com o Expo.

Cargos personalizados, olheiros, permissões comerciais, importação da federação e
empacotamento Electron não foram implementados nesta etapa.

Atualização visual de 19/10: consulte docs/handover-visual-2026-10-19.md para filtros,
modos de visualização, máscara, seletor de nascimento, posições e Scout.
