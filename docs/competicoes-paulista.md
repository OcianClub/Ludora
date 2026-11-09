# Competições do Ludora e integração com o Campeonato Paulista

Referência para desenvolvimento e operação. Consolida o piloto de 5 de novembro de 2026 e a expansão e as correções de 6 de novembro de 2026, registradas no commit `243a438` da `develop`. Os números de importação abaixo descrevem essas operações e podem mudar com novas sincronizações.

## 1. De onde veio a integração

O sistema anterior atendia apenas o Ocian. O clube fornecia uma tabela em PDF ou Excel, e um script identificava adversários, grupos, datas, horários e mando para montar a agenda do Ocian. Quando havia só um horário de referência, a lógica antiga estimava o restante da sequência por categoria.

No Ludora, a equipe da plataforma administra a integração com a **Federação Paulista de Futsal (FPFS)**. A API busca os jogos publicados e distribui cada partida à agenda dos clubes Ludora que têm vínculo confirmado. O clube acompanha o calendário e registra o que aconteceu com sua equipe, como escalação e eventos de scout. Competições locais, como o Festival Ludora, continuam no fluxo próprio.

## 2. O que a Federação publica e o que o Ludora decide

A fonte é o [portal de súmulas da FPFS](https://eventos.admfutsal.com.br/). No portal, cada **evento** identifica uma combinação de temporada, divisão e SUB. Por exemplo, o evento `900` é o Paulista de 2026, A2, Sub-7. Nesse contexto, “evento da Federação” significa uma edição por categoria. No scout, “evento da partida” é uma ação como gol, defesa ou cartão. [Evento 900 e classificação](https://eventos.admfutsal.com.br/evento/900)

| Assunto | Regra aplicada no Ludora |
| --- | --- |
| Categorias e divisões | Descoberta restrita ao título Campeonato Paulista e aos SUBs 7, 8, 9, 10, 12, 14, 16 e 18. A divisão vem da publicação de cada evento. |
| Calendário | Importa data, hora, local, fase e mandante/visitante de cada confronto publicado. A agenda de cada clube mostra o mando conforme sua participação. |
| Grupos | Exibe a chave ou o grupo publicado em cada fase. O Sub-7/A2 de 2026 tem chave única na classificação. O Sub-12/A3 publica grupos. A organização vem do evento consultado. |
| Pontuação | A classificação exibida usa os números publicados, inclusive notas de pontuação quando presentes. A conferência interna é separada, por fase classificatória, com 3 pontos por vitória, 1 por empate e 0 por derrota. Ordena por pontos, saldo e ID como critério técnico final. |
| Placar, adiamento e W.O. | Placar ainda ausente permanece vazio. O cálculo de conferência ignora partidas sem resultado numérico e jogos com ocorrência. A classificação oficial continua sendo a referência inclusive para penalidades e W.O. |
| Eliminatórias | Mostra os confrontos e as rodadas publicadas. Liga rodadas somente quando há evidência suficiente de continuidade. Ouro, Prata e Bronze aparecem quando identificáveis na publicação. |

Exemplos para comparar formatos. [Iniciação A2, Sub-7](https://eventos.admfutsal.com.br/evento/900) · [Base A3, Sub-12](https://eventos.admfutsal.com.br/evento/925)

### Ordem de jogos e hipóteses do planejamento

A proposta inicial era replicar um confronto entre SUBs com intervalos aproximados e considerar uma sequência mista na Base. A implementação usa **o jogo publicado de cada SUB**, com seu próprio horário. Sem uma linha oficial para determinada categoria, a API espera a publicação. Isso vale mesmo quando outro SUB já tem o mesmo adversário no mesmo dia.

O art. 88 do Regulamento Geral de Competições de 2026 define a ordem de referência das rodadas de Iniciação como Sub-7 → Sub-8 → Sub-9 → Sub-10 e da Base masculina como Sub-18 → Sub-16 → Sub-14 → Sub-12. Para oitavas, quartas, semifinais e finais, a definição cabe ao departamento técnico da FPFS. O art. 89 remete as formas de disputa e adaptações às regras específicas de cada competição e categoria. [RGC 2026 da FPFS, arts. 88 e 89](https://www.federacaopaulistadefutsal.com.br/novo/wp-content/uploads/2026/02/001_2026-RGC-REGULAMENTO-GERAL-DE-COMPETICOES-2026-2.pdf)

Intervalos fixos, todos contra todos em toda a Iniciação, cruzamento `1º × 16º`, vantagem de mando ou empate, duração de 13 ou 15 minutos, troca de quartetos e arbitragem pedagógica foram hipóteses ou requisitos levantados na conversa. Permanecem fora das regras automatizadas. Aplicar qualquer um deles exige conferir o regulamento específico da temporada, divisão, categoria e fase. O mesmo vale para cortes de classificação e desempates. A conferência `3/1/0` serve para revisar placares, com alcance menor que a classificação oficial.

## 3. Como um jogo chega ao clube

1. **Descobrir.** A API lê o seletor de temporadas, aceita o ano atual e o próximo se publicado, consulta divisões e SUBs elegíveis e guarda o catálogo. O coletor limita o volume e a concorrência. A descoberta conhece as equipes, mas ainda não as associa a contas de clubes.
2. **Conferir a identidade.** O desktop sugere possíveis correspondências por nome e categoria. Um operador `SUPERADMIN` verifica a equipe oficial, o clube Ludora e o SUB, confirma com motivo ou rejeita o candidato. Nome parecido é evidência para investigar. Criar o cadastro do clube pode encaminhar para essa revisão.
3. **Importar o evento.** A API lê equipes, jogos e classificação. Guarda um *snapshot*, uma cópia dos dados daquela consulta, com versão, hash, origem e data de consulta. Se a página incluir partidas de fases do Torneio União junto com o Paulista, o parser as exclui da importação do Paulista.
4. **Distribuir.** Com ao menos um clube vinculado e data e hora publicadas, um confronto elegível ganha uma `Partida` na agenda. Se os dois clubes estão vinculados, existe uma `Partida` e duas participações. Cada participação aponta ao SUB próprio daquele clube. Jogos entre equipes sem vínculo continuam no conjunto oficial consultável, fora da agenda operacional do clube.
5. **Representar o adversário.** Se o clube vinculado enfrenta uma equipe ainda sem cadastro de cliente, a API cria um time de referência, chamado de “casca” nos handovers. Ele permite exibir nome, escudo e confronto por SUB, sem inventar elenco ou acessos. Se o adversário entrar no Ludora mais tarde, o vínculo confirmado reaproveita o mesmo time e acrescenta a participação aos jogos existentes. Um conflito de identidade exige revisão.
6. **Atualizar.** Importar a mesma publicação preserva os IDs. Se data, hora ou local forem corrigidos, a API atualiza a agenda aplicável e registra o que mudou. Se um jogo desaparecer ou mudar de identidade, a sincronização bloqueia a substituição e preserva a versão anterior para análise. Uma partida antiga que pareça o mesmo confronto também exige revisão antes da distribuição.

### Exemplo do piloto

O cadastro `Clube 2` foi confirmado pelo usuário como o **Ocian Praia Clube de Praia Grande**. O Sub-7 local é `Categoria 9`. Na Federação, a equipe do Ocian nesse SUB é `12423`. O cadastro local ainda informava São Paulo/SP quando a identidade foi conferida. A implantação preservou esse campo para tratar a correção cadastral à parte.

Em 21 de março de 2026, às 09:30, o Ocian recebeu o ADC Marvel (`12241`) no Ginásio Ocian Praia Clube. O resultado publicado foi **1 × 1**. Esse jogo serviu para conferir calendário, mando, placar oficial e representação de um adversário sem cliente. [Equipe oficial do Ocian](https://eventos.admfutsal.com.br/evento/900/equipe/12423) · [Jogos oficiais do evento 900](https://eventos.admfutsal.com.br/evento/900/jogos)

## 4. Autoridade sobre os dados e divergências

| Dado | Quem define | O que acontece quando muda |
| --- | --- | --- |
| Calendário, confrontos, placar e classificação oficiais | Federação | O painel reflete a publicação reconhecida. A API registra alterações e atualiza a agenda operacional quando aplicável. |
| Placar local, escalação e scout | Clube Ludora, conforme a autorização | Ficam preservados. Quando o placar local finalizado diverge do oficial, a API abre uma pendência com os dois valores. Um novo resultado oficial por si só não encerra uma partida em andamento no clube. |
| Identidades, acompanhamento e revisão | Operador da plataforma | Confirma, rejeita, pausa ou decide a pendência com motivo. O histórico registra responsável, decisão e dados comparados. |

- **Manter oficial** registra que a versão da Federação segue como referência. **Solicitar revisão** coloca o caso em análise e pode aparecer nos avisos do clube, sem envio de e-mail ou push. **Registrar resolução** encerra a análise. Essas ações preservam os dados locais. Uma nova diferença pode reabrir uma pendência.
- **Anotação retroativa** complementa um jogo com resultado oficial numérico. O usuário precisa de cargo autorizado, acesso ao SUB, participação do clube e um atleta ativo do próprio SUB com camisa. Aceita gol, assistência, defesa, falta e cartões amarelo, vermelho e azul. Guarda autor e motivo, insere o atleta na escalação se necessário e mantém o placar. Um identificador do envio protege contra duplicação em caso de repetição da mesma solicitação.
- **Desfazer vínculo** pode ser seguro quando o clube associado por engano ainda não tem contribuição própria e não é a âncora técnica. Quando já existem eventos ou escalações próprios, ou o clube é a âncora, o desktop encaminha para revisão assistida. A transferência ou fusão automática de histórico continua pendente.

## 5. O que aparece em cada aplicativo

- **Web do clube.** Em `Competições`, um cartão **Campeonato Paulista** reúne as categorias elegíveis. A pessoa alterna entre Iniciação e Base e seleciona o SUB. A tela mostra a divisão oficial, o resumo da campanha, os jogos do próprio clube, a classificação e o chaveamento publicado. O ícone de globo abre o portal da Federação para consultar o calendário completo, inclusive confrontos de outras equipes. Quando há `Partida` operacional do clube, o detalhe reaproveita a tela normal. Recarregar no web consulta a API Ludora. A sincronização com a Federação é operada no backend.
- **Desktop da plataforma.** Em **Campeonato Paulista**, o `SUPERADMIN` acompanha o catálogo, erros de fonte, candidatos, vínculos e a fila de divergências. Ali pode confirmar ou rejeitar candidatos, acompanhar ou pausar campeonatos, disparar nova sincronização e consultar a auditoria.
- **Mobile.** A API e as partidas distribuídas reaproveitam o fluxo operacional existente. O painel global e o fluxo de administração da integração descritos aqui foram entregues no web e no Electron, respectivamente.

## 6. Como a integração foi construída

| Parte do código | Responsabilidade |
| --- | --- |
| [Coleta e parser](../services/api/src/modules/paulista/provider.ts) | Lê páginas oficiais com origem fixa e valida o formato antes de interpretar equipes, jogos, ocorrências e classificação. A descoberta usa também endpoints públicos do portal. A estrutura publicada pode mudar. |
| [Descoberta](../services/api/src/modules/paulista/discovery.ts) e [operações](../services/api/src/modules/paulista/operations.ts) | Mantêm catálogo e rotina, administram vínculos candidatos e tratam decisões da fila. |
| [Importação](../services/api/src/modules/paulista/service.ts) e [regras](../services/api/src/modules/paulista/rules.ts) | Preservam identidade e IDs, distribuem partidas, registram auditoria e comparam placares. Uma transação faz a importação valer como conjunto ou ser desfeita quando há conflito. |
| [Rotas da API](../services/api/src/modules/paulista/routes.ts) | Aplicam permissões de clube, categoria e plataforma. Com o módulo ligado, protegem registros oficiais de alterações manuais de agenda, competição e vínculo pelas rotas legadas. |
| [Schema Prisma](../services/api/prisma/schema.prisma) | `FpfsCatalogo` e `FpfsRotina` guardam descoberta e agendamento. `FpfsEvento`, `FpfsEquipe` e `FpfsJogo` guardam a parte oficial. `FpfsVinculo` confirma equipe → clube. `FpfsTime` liga a equipe externa ao time usado na agenda. `FpfsPendencia` e `FpfsAuditoria` guardam revisão e histórico. |
| [Web do clube](../apps/web/src/pages/Paulista.tsx) e [Electron](../apps/desktop/src/renderer/src/pages/Paulista.tsx) | Apresentam dados para públicos diferentes. O web é a visão esportiva e o Electron é o console operacional. |

`Competicao` continua sendo usada pelas telas existentes. Cada evento importado com cliente vinculado pode ter sua própria competição técnica, embora o web mostre um cartão agrupado. O clube registrado como âncora dessa competição permite integrá-la à estrutura anterior. A âncora não dá autoridade sobre o calendário da Federação.

A identidade de um jogo usa evento, fase e IDs das equipes na ordem do mando. Quando o portal publica uma súmula, seu ID é guardado. Se o mesmo par se repetir na fase de modo ambíguo ou o mando mudar e alterar a identidade, a fonte exige revisão. Essa proteção evita anexar scout ao confronto errado.

## 7. Histórico das ações executadas

| Etapa | Resultado registrado |
| --- | --- |
| Piloto de 05/11 | Validou em PostgreSQL descartável o Sub-7/A2, o jogo Ocian × ADC Marvel, a preservação das competições legadas e a repetição da importação sem duplicar. O Supabase compartilhado ainda estava sem a ativação nessa etapa. |
| Ativação de 06/11 | Foi feito backup do schema da aplicação e teste de restauração em PostgreSQL separado. Aplicadas no Supabase compartilhado as migrations `20261105120000_paulista_piloto` e `20261106120000_paulista_operacao`, que criam nove tabelas da integração sem acrescentar colunas às tabelas antigas. A descoberta registrou 24 eventos de 2026. O evento 900 importou 297 jogos reconhecidos e distribuiu 25 partidas para o Ocian. |
| Expansão multiclube | Conferidos oito SUBs de cada um de três clubes, totalizando 24 vínculos em 16 eventos oficiais. O inventário da operação registrou 4.429 jogos oficiais e 474 partidas operacionais, incluindo nove partidas compartilhadas Ocian–União Mauá. O Santos disputava A1, enquanto Ocian e União Mauá estavam em A2 na Iniciação e A3 na Base. A importação manteve essas divisões separadas. |
| Ajustes de experiência | O web passou a agrupar o Paulista em um cartão, separar a agenda do clube da consulta global e mostrar classificação e chaveamento sem presumir cortes. O Electron ganhou rejeição persistente de candidato, fila de divergências e conclusão auditada da revisão. Essa etapa reutilizou o schema existente. |
| Verificação registrada | O handover final registra 371 testes gerais, sete de integração em PostgreSQL descartável, builds web e Electron, navegação web em três sessões de clube, dois temas e duas larguras, e ações administrativas no Electron com banco isolado. Toque foi emulado. Esses resultados são da entrega registrada. |

**Dados oficiais e dados de demonstração coexistem no banco do projeto.** O calendário importado é oficial. O Ocian (`2`) é o cadastro real reutilizado. O Santos (`3`) é um cadastro de demonstração já existente. União Mauá (`30`) é um cadastro temporário para teste, associado a equipes oficiais para exercitar o fluxo. Sete usuários e 64 atletas fictícios foram criados para validação. A Federação não forneceu esses atletas nem suas credenciais. O [manifesto da operação](dados/paulista-multiclube-20261106.json) separa os registros e detalha seus IDs. A limpeza foi planejada em modo de leitura e não consta como executada nos handovers.

## 8. Rodar, configurar e conferir

Da raiz do repositório, rode `pnpm dev` para API, web, mobile e ML. Abra um segundo terminal e rode `pnpm dev:desktop` para o Electron. Para testar o backend local, a API em Ajustes do Electron deve apontar para `http://localhost:3000`. No web local, abra [Competições](http://localhost:5173/competicoes) e selecione um clube vinculado. Para administrar, abra o Paulista no desktop com uma conta `SUPERADMIN`.

Na API local, as variáveis ficam em `services/api/.env`. Se o aplicativo usa o Render, configure as variáveis no serviço da **API** no Render. Reinicie a API após alterar as variáveis.

```dotenv
PAULISTA_ENABLED=true
PAULISTA_SYNC_DIARIA=false
```

- `PAULISTA_ENABLED=true` liga a integração. Com a variável ausente ou `false`, os endpoints do Paulista ficam desativados e as competições comuns continuam disponíveis.
- `PAULISTA_SYNC_DIARIA=true` liga a rotina automática, desde que a integração também esteja ligada. A API verifica os agendamentos ao iniciar e a cada minuto. Depois de um sucesso, a próxima tentativa fica para 24 horas depois. Falhas agendam nova tentativa em uma hora. Só eventos acompanhados entram no ciclo de atualização de jogos. O PostgreSQL oferece uma trava temporária de 15 minutos para reduzir execuções simultâneas. A API precisa estar em execução para cumprir os agendamentos.
- Git entrega código e migrations. Quem usa o **mesmo Supabase e schema** já compartilha os registros e migrations aplicadas. Outro banco precisa de suas próprias migrations e importações. No ambiente de destino, `pnpm --filter @ludora/api exec prisma migrate status` confere o estado. Havendo migrations aprovadas e pendentes, o responsável aplica `pnpm --filter @ludora/api exec prisma migrate deploy`. O comando `pnpm build:api` gera o Prisma Client e compila a API. [Guia de deploy](deploy-render-vercel.md)
- Para interromper a rotina automática, desligue `PAULISTA_SYNC_DIARIA` e reinicie a API. Desligar também `PAULISTA_ENABLED` desativa o módulo. O histórico e as partidas já gravadas permanecem no banco.

## 9. O que continua pendente

- Validar regulamentos específicos antes de programar cortes, desempates, cruzamentos, vantagens de mando e regras formativas. Se um avanço depender de informação ausente, o chaveamento deixa a ligação sem confirmação.
- Decidir se a agenda global precisa de uma tela interna dedicada. Hoje o snapshot inclui os jogos de outras equipes, mas a aba **Jogos** é restrita ao clube e o calendário completo pode ser consultado na fonte oficial.
- Implementar transferência assistida ou fusão quando um vínculo incorreto já tem histórico próprio. A operação atual registra a revisão e bloqueia a alteração ambígua.
- Decidir se o fluxo retroativo precisa de editor completo, reconciliação de scout ou reprocessamento de ML. Hoje a operação acrescenta anotações autorizadas e registra a origem.
- Acompanhar mudanças no HTML e nos endpoints públicos da FPFS. O coletor depende do formato publicado e mantém a última versão válida quando o reconhecimento falha. A ausência de 2027 registrada na implantação descreve aquela consulta.

## Registros para aprofundar

- [Piloto e testes iniciais](handovers/2026-11-05-paulista-piloto.md)
- [Implantação e rotina da API](handovers/2026-11-06-paulista-operacao.md)
- [Expansão multiclube, evidências e inventário](handovers/2026-11-06-paulista-multiclube.md)
- [Visão de competições no web](handovers/2026-11-06-paulista-web.md)
- [Correções finais, testes e limites](handovers/2026-11-06-correcao-paulista.md)
- [Guia de operação do Paulista](paulista-operacao.md)
