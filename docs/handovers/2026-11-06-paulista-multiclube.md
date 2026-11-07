# Handover técnico — Paulista em todos os SUBs e múltiplos clubes

06/11/2026 · checkout `develop` · sem branch nova, commit ou push.

## 1. Entrega e ambiente

O banco usado pelo projeto foi expandido: oito SUBs confirmados do Ocian, oito do Santos de teste e oito da União Mauá de teste. São **16 eventos oficiais**, porque Ocian e União Mauá compartilham os mesmos eventos. Santos participa da A1; Ocian e União Mauá estão na A2 na Iniciação e A3 na Base.

Não existe outro ambiente obrigatório para visualizar: continuar usando `pnpm dev` e, em outro terminal, `pnpm dev:desktop`. Se já estiverem rodando, usar as janelas existentes; não iniciar outra API na mesma porta. Web: `http://localhost:5173/competicoes`. API local: porta 3000. As alterações de frontend aparecem pelo Vite; o Electron permanece no fluxo electron-vite já existente.

Banco conferido antes das gravações: Supabase, PostgreSQL `postgres`, schema `public`, host `aws-1-sa-east-1.pooler.supabase.com`, conexão administrativa 5432 e aplicação pelo pooler. Credenciais não foram incluídas no relatório. As **16 migrations estavam aplicadas**; nenhuma migration nova foi criada ou aplicada nesta etapa.

Backup anterior à operação: `.local-demo/backups/2026-11-06-multiclube/ludora-public.dump`, SHA-256 `ae57a5f9280bb256635b0f81ad5a256c6c1fd2ec09b9eb7db058bb5d4723105a`. O arquivo foi listado e restaurado no PostgreSQL local de validação já existente, banco `ludora_multiclube_before`. A restauração final terminou sem erro. É backup do schema da aplicação, não de Auth/Storage do Supabase. Contém dados privados; não versionar.

O PostgreSQL descartável serviu somente aos testes destrutivos e à conferência do backup. As participações e contas demonstráveis estão no banco normal do projeto, não nesse contêiner.

## 2. Evidência individual de identidade

Cada linha foi conferida no catálogo do **Campeonato Paulista de futsal 2026**, na lista de equipes, página individual, classificação e jogos. Não foi usada notícia de futebol de campo. O ID de equipe muda conforme o SUB.

| SUB | Ocian: divisão / evento / equipe / posição inicial | Santos: divisão / evento / equipe / posição inicial | União Mauá: divisão / evento / equipe / posição inicial |
| --- | --- | --- | --- |
| 7 | A2 / 900 / 12423 / 12º | A1 / 908 / 12858 / 4º | A2 / 900 / 12403 / 13º |
| 8 | A2 / 901 / 12424 / 23º | A1 / 909 / 12859 / 6º | A2 / 901 / 12404 / 8º |
| 9 | A2 / 902 / 12425 / 22º | A1 / 910 / 12860 / 6º | A2 / 902 / 12405 / 2º |
| 10 | A2 / 903 / 12426 / 11º | A1 / 911 / 12861 / 5º | A2 / 903 / 12406 / 4º |
| 12 | A3 / 925 / 13041 / 4º | A1 / 907 / 12283 / 3º | A3 / 925 / 12740 / 1º |
| 14 | A3 / 923 / 13042 / 6º | A1 / 905 / 12284 / 11º | A3 / 923 / 12741 / 3º |
| 16 | A3 / 924 / 13043 / 7º | A1 / 906 / 12285 / 7º | A3 / 924 / 12742 / 3º |
| 18 | A3 / 922 / 13044 / 5º | A1 / 904 / 12286 / 6º | A3 / 922 / 12743 / 6º |

Na Base, posição é a posição **do grupo inicial**, não um ranking geral entre grupos. Fases posteriores também conservam suas próprias tabelas.

O arquivo [manifesto completo](../dados/paulista-multiclube-20261106.json) registra, para cada uma das 24 participações: temporada, divisão, IDs, URLs, endereço publicado, linhas da classificação, todos os jogos da equipe e um jogo conferido pela API com mando e partida local. URLs seguem o padrão `https://eventos.admfutsal.com.br/evento/EVENTO/equipe/EQUIPE` e `/evento/EVENTO/equipes`.

Evidência adicional: os oito cadastros oficiais do Ocian publicam Rua Mooca, 685, Praia Grande; os oito do Santos publicam Rua Princesa Isabel, Vila Belmiro, Santos; os oito da União Mauá publicam Av. Joaquim Chavasco, 398, Mauá. A página individual não exibe o nome da equipe como texto: o nome vem da lista oficial que aponta àquele ID; categoria, endereço e escudo dão contexto adicional. Nomes parecidos continuam sendo apenas sugestões na aplicação.

O clube Ocian **2** foi reutilizado, conforme a identidade já confirmada pelo usuário. Nenhum segundo Ocian foi criado. Cadastro e jogadores reais foram preservados. A cidade divergente do cadastro antigo não foi corrigida silenciosamente.

## 3. Dados reais, oficiais e temporários

### Cadastros reutilizados e criados

- Ocian **2**: cliente real existente; categorias **9–16** e times existentes reutilizados.
- Santos **3**: cadastro de demonstração já existente, com categorias **17–24** e escudo próprio. Foi reutilizado; **não é um clube criado nesta operação** e não pode ser apagado como se fosse novo.
- A. União Mauá · TESTE **30**: novo cliente temporário; categorias **58–65**. A conta representa o participante oficial para testes, sem declarar que a entidade real contratou o Ludora.
- **7 usuários**, IDs **57–63**: administradores, técnicos e torcedores dos dois clubes de teste, mais operador SUPERADMIN da plataforma. Seis vínculos UsuarioClube; técnicos autorizados somente ao Sub-12.
- **64 jogadores fictícios**, quatro por SUB de cada clube de teste, nomes começando por `TESTE`, exemplos em inglês e posições Goleiro/Fixo/Ala/Pivô. Nenhum elenco da Federação foi importado.
- O campo CPF obrigatório no banco recebeu identificadores `TST-P26-...`, deliberadamente sem formato de CPF real. Não são documentos válidos nem números gerados que poderiam coincidir com uma pessoa. A criação foi pelo script operacional de teste; a validação normal do cadastro de pessoas não foi relaxada.

As senhas aleatórias estão somente em `.local-demo/paulista-multiclube-20261106/acessos.md` e `credenciais.json`, ignorados pelo Git. Os sete logins foram validados contra a API local. Não publicar esses arquivos nem as sessões JWT de teste.

### Contas para abrir o sistema

| ID | Login | Uso |
| --- | --- | --- |
| 57 | `teste.paulista.santos.admin@ludora.test` | Administração do Santos |
| 58 | `teste.paulista.santos.tecnico@ludora.test` | Edição somente do Sub-12 |
| 59 | `teste.paulista.santos.torcedor@ludora.test` | Leitura |
| 60 | `teste.paulista.maua.admin@ludora.test` | Administração da União Mauá |
| 61 | `teste.paulista.maua.tecnico@ludora.test` | Edição somente do Sub-12 |
| 62 | `teste.paulista.maua.torcedor@ludora.test` | Leitura |
| 63 | `teste.paulista.plataforma@ludora.test` | Electron, administração da integração |

### Inventário da operação

O manifesto contém **todos os IDs** criados, os vínculos reutilizados, times físicos, permissões por categoria, auditorias e as partidas compartilhadas. Não confundir “registro novo” com “dado fictício”: os calendários são oficiais.

| Entidade | Novos registros |
| --- | ---: |
| Clube / Categoria / Jogador | 1 / 8 / 64 |
| Usuario / UsuarioClube | 7 / 6 |
| Time / Competicao / Partida / ParticipantePartida | 296 / 15 / 449 / 458 |
| FpfsEvento / FpfsEquipe / FpfsJogo / FpfsTime | 15 / 424 / 4132 / 424 |
| FpfsVinculo / FpfsPendencia / FpfsAuditoria | 23 / 1 / 57 |
| Evento / EscalacaoPartida de teste | 1 / 1 |

O evento 900, suas equipes e os 25 jogos operacionais anteriores já existiam. O total agora é 4429 jogos oficiais reconhecidos nos 16 eventos, com 474 partidas operacionais. Nem todo jogo oficial vira partida operacional: precisa de cliente confirmado e calendário utilizável; W.O./adiamento ficam na leitura oficial enquanto não houver operação apropriada.

Exemplo de reaproveitamento: time **252**, casca da União Mauá/Sub-7, foi vinculado ao clube 30 sem trocar o ID. Conserva a categoria física original 9, do contexto em que nasceu; o participante da União Mauá aponta à categoria própria 58. Isso preserva o histórico sem copiar a partida. O detalhe resolve a categoria pelo participante do clube atual.

Há **9 partidas oficiais compartilhadas Ocian–União Mauá**, com um ID de Partida e dois participantes. Exemplos: **358**, fase inicial Sub-7, e **379**, quartas da Prata. Os mandos foram conferidos individualmente. Não foi inventado confronto Ocian–Santos: eles participam de divisões diferentes nesta temporada.

## 4. Mudanças de código e propósito

O checkout já estava modificado. Esta lista delimita esta etapa; não atribui todas as alterações locais anteriores a ela.

| Arquivo | Mudança |
| --- | --- |
| `services/api/scripts/paulista-multiclube.ts` — novo | Inspeção, conferência da fonte, plano, aplicação única, retomada por manifesto, cenário de divergência, verificação autenticada, logins e relatório de limpeza somente leitura. |
| `services/api/scripts/backup-paulista.cjs` | Destino opcional por `PAULISTA_BACKUP_DIR`, preservando o backup anterior. |
| `services/api/src/modules/paulista/provider.ts` | Aceita pontuação oficial com nota `8*`, preserva a marca e rejeita células vazias/texto desconhecido. |
| `services/api/src/modules/paulista/service.ts` | Importação em lote e consultas reutilizadas dentro da transação; mantém IDs, auditoria e proteção de dados locais. Inclui escudo do cliente vinculado e estado operacional no painel. |
| `services/api/src/modules/paulista/rules.ts` | Exclui abreviações e palavras genéricas da sugestão de identidade; não sugere União Mauá para São Paulo FC - A por compartilharem somente “A.”. |
| `services/api/src/modules/paulista/operations.ts` | Resumo administrativo com nomes dos clubes vinculados e quantidade de divergências em aberto/revisão. |
| `packages/shared-types/src/paulista.d.ts` | Tipos opcionais da nota de pontuação, escudo e estado operacional. Sem coluna nova. |
| `apps/web/src/pages/Competicoes.tsx` | Paulista antes das competições locais na ordenação, mantendo filtros de organização/tipo/ano. |
| `apps/web/src/pages/Paulista.tsx` | Nome/escudo do cliente na apresentação, globo na faixa de categorias e filtros dos estados normais das partidas. Fonte original permanece separada. |
| `apps/web/src/utils/paulistaView.ts` | Estado local para jogo ainda sem resultado, preservando finalização oficial quando há placar publicado. |
| `apps/web/src/components/PaulistaStandings.tsx` | Destaque visual do clube, GP/GC adicionais e indicação da nota da Federação. |
| `apps/web/src/components/PaulistaBracket.tsx` e `pages/Paulista.css` | Resumo útil da chave, participação publicada e quantidade de confrontos, preservando conexões conservadoras e responsividade. |
| `apps/web/src/pages/PartidaDetalhe.tsx` | Formata nomes dos jogos oficiais também nos componentes do detalhe normal; não grava a formatação no banco. |
| `apps/desktop/src/renderer/src/pages/Paulista.tsx` | Tarefas, estado legível, atualização do campeonato, nome do cliente, confronto identificado e revisão sem JSON técnico na tela. |
| `apps/desktop/src/renderer/src/components/PaulistaReview.tsx` — novo | Comparação lado a lado e auditoria em linguagem de operação. |
| `apps/desktop/src/renderer/src/styles/desktop.css` | Apresentação das tarefas, comparação e auditoria. |
| `services/api/tests/paulista.test.ts`, `apps/web/tests/paulistaView.test.mjs` | Testes da pontuação anotada pela fonte e estados operacionais. |
| `apps/web/tests/paulista-multiclube-smoke.cjs` — novo | Navegação de três clubes sobre a API/banco do projeto; bloqueia mutações durante o teste de navegador. |
| `apps/desktop/tests/paulista-multiclube-smoke.cjs` — novo | Electron real com perfil separado, conta temporária e decisão restrita à divergência de teste. |
| `docs/dados/paulista-multiclube-20261106.json` — novo | Manifesto de IDs, evidências, retomadas, cenário e resultados autenticados. Sem senhas ou tokens. |
| Este handover e guia de operação | Explicação, limitações e limpeza posterior. |

## 5. Antes e depois das funções principais

### Importação

Antes, cada repetição fazia consultas e upserts individuais para todas as equipes e jogos:

```ts
for (const j of s.jogos) {
  const old = await tx.fpfsJogo.findUnique({ where: { id: j.id } });
  // upsert e consultas repetidas de categoria/time em cada confronto
}
```

Depois, os IDs existentes são carregados uma vez e registros novos entram em lote:

```ts
const anteriores = new Map((await tx.fpfsJogo.findMany({ where: { eventoId: s.id } }))
  .map(j => [j.id, j]));
await tx.fpfsJogo.createMany({
  data: s.jogos.filter(j => !anteriores.has(j.id)).map(/* dados oficiais */),
  skipDuplicates: true,
});
```

O loop continua conferindo alterações e distribuindo somente a participantes confirmados. Categorias, times, participações e placares existentes são reutilizados na transação Serializable. Repetir não recria partida nem soma participantes. O hash/versão e a auditoria continuam ativos.

A primeira tentativa encontrou o limite de duração no banco remoto e foi desfeita. O manifesto guardou contas e vínculos já concluídos; a retomada não recriou esses dados. Também foi corrigida a comparação de idempotência do script: consultas sem `orderBy` não garantem ordem; a comparação agora ordena por ID. As falhas anteriores permanecem nos logs locais, não foram apresentadas como testes aprovados.

### Nota da classificação

Antes: `Number('8*')` virava `NaN` e bloqueava todo o Sub-16/A3.

Depois:

```ts
if (publicados.some((v, k) => !(k === 0 ? /^-?\d+\*?$/ : /^-?\d+$/).test(v)))
  throw new Error('Valores de classificação inválidos.');
const valores = publicados.map(v => Number(v.replace(/\*$/, '')));
```

O número oficial é 8 e a apresentação preserva `8*` em `pontosNota`. Não calcula uma punição, não supõe motivo e não substitui o número por `3 × vitórias + empates`.

### Identidade visual e estado

Antes: a tela usava apenas o nome/escudo da equipe externa e adaptava todo jogo sem resultado como agendado.

Depois, uma cópia de apresentação usa o clube vinculado; o payload original não é modificado. O estado operacional vem da partida local enquanto não houver resultado numérico oficial:

```ts
return temResultado(j) ? 'FINALIZADA' : local || 'AGENDADA';
```

W.O. e adiamento continuam ocorrências próprias. A lista não transforma ausência de placar em 0×0. Jogos apenas oficiais podem abrir leitura; jogos locais do clube abrem o detalhe normal.

### Revisão no Electron

Antes: mudanças de calendário e auditoria apareciam como JSON e o confronto era identificado por uma chave técnica.

Depois: `PaulistaComparison` apresenta informação, Federação atual e anotação do clube/publicação anterior. `PaulistaAudit` mostra decisão, motivo e data. O confronto usa equipes e calendário. Aplicar decisão exige motivo e confirmação; a API continua rejeitando versão divergente e identidade ambígua. Não foi implementada transferência destrutiva de histórico por um clique.

## 6. Cenário demonstrável de divergência

Somente partida nova **630**, Santos Sub-12, evento **907**, jogo `907:35852:12154:12283`; Ocian não participa.

- Oficial: **3×6**; anotação local de teste: **4×6**.
- Atleta fictício **690**, acontecimento DEFESA **1460**, escalação própria criada pela anotação histórica.
- Pendência **1**, auditoria de partida **225**; origem claramente TESTE no manifesto/auditoria.
- A classificação continua usando a publicação oficial. O Electron comparou os valores, exigiu motivo e confirmação e registrou a decisão **CONFERIDA**. Conferida significa decisão registrada, não apagar a diferença nem sobrescrever os eventos.
- Após a decisão, o acontecimento ainda existe e o placar oficial permanece 3×6. Não foi introduzido reprocessamento de ML nem foram substituídos perfis/scouts reais.

## 7. Validação

- **370 testes de regressão passaram**, zero falhas; inclui build da API, contratos web/mobile existentes e novos testes de parser/estado.
- **7 testes de integração PostgreSQL passaram**, zero falhas: legado, compartilhamento, importação repetida/concorrente, atualização de data/placar, autorização, eventos históricos e preservação do oficial.
- Os **24 vínculos** foram conferidos individualmente pela API contra os dados baixados da Federação: categoria/divisão, linhas da classificação, jogo e mando. A lista normal Competições inclui os oito eventos de cada clube.
- **12 verificações de cargo/categoria** passaram: ADMIN edita; TECNICO edita Sub-12 e é bloqueado no Sub-7; TORCEDOR só lê. Escritas proibidas retornaram 403; acesso administrativo também foi negado às seis contas de clube.
- **7 logins** temporários passaram com as senhas geradas.
- Web real: três clubes × claro/escuro × 390/1366px, categorias, classificação, chave, detalhes normais, voltar e ausência de overflow/erros JavaScript. W.O. real da União Mauá abre leitura oficial.
- Web isolado: quatro combinações de tema/largura passaram; inclui categoria sem vínculo, erro de carregamento, estados sem placar/adiado/W.O., fases distintas com nomes iguais, teclado e gesto de toque emulado no chaveamento.
- Electron real: login temporário, 16 acompanhados, comparação, confirmação em duas etapas e decisão auditada passaram em claro/escuro, com perfil separado.
- Builds web/API/Electron concluídos. `git diff --check` sem erros; avisos LF/CRLF do checkout Windows.
- **226 jogadores reais do Ocian idênticos ao backup restaurado**, comparados pelo conteúdo integral serializado das linhas. Todos os IDs preexistentes inventariados continuam presentes.

Artefatos ignorados em `test-results/paulista-multiclube/` (capturas) e `test-results/paulista-web/` (logs). O teste de navegador teve ajustes de seletores: o resumo normal usa `.match-result`; o primeiro jogo da União Mauá é W.O. sem partida operacional; a descrição W.O. existe também no cartão atrás do modal. Foram corrigidas essas premissas do teste, sem forçar a aplicação a fingir um fluxo diferente.

## 8. Limpeza posterior — preparada, NÃO executada

Comando somente de análise, a partir da raiz:

```powershell
pnpm --filter @ludora/api exec tsx scripts/paulista-multiclube.ts cleanup-plan
```

Produz `.local-demo/paulista-multiclube-20261106/cleanup-plan.json`, com contas, jogadores, vínculos, referências de chaves estrangeiras e partidas que impedem remoção. **Não contém comando de exclusão.** Foram encontradas 404 partidas no contexto dos clientes temporários, incluindo histórico preexistente; 18 envolvem Ocian (9 oficiais novas/compartilhadas e outras preexistentes). Há 388 ancoradas no contexto Santos/União Mauá e um jogador fictício já com histórico. Esses totais não autorizam apagar nada.

Procedimento para uma tarefa futura:

1. Fazer outro backup e conferir o manifesto, banco de destino e dependências atuais. A lista pode mudar depois desta entrega.
2. Revogar/desabilitar somente as contas temporárias após conferir IDs e vínculos; não atingir contas preexistentes. Não apagar o clube Santos 3 nem Ocian 2.
3. Atletas com acontecimentos, escalações ou inscrições exigem revisão explícita. Não usar DELETE em cascata para contornar dependências.
4. Usar o fluxo auditado para desvincular equipe oficial. Se houver contribuição própria ou clube âncora, interromper e planejar transferência/arquivo; a API bloqueia reversão simples nesses casos.
5. Preservar partidas compartilhadas, times reutilizados e dados oficiais. Um evento importado pela operação é dado real da Federação, não lixo de teste.
6. Até resolver as âncoras, preferir desabilitar acesso e arquivar o cliente temporário. Remoção física completa não foi prometida nem automatizada por esta entrega.

## 9. Limitações

- Ocian é o único cliente real. Santos e União Mauá são contextos temporários para demonstração; os dados oficiais não comprovam contratação nem autorização comercial dessas entidades.
- O cadastro Santos e suas categorias já existiam. Foram preservados, inclusive cidade antiga divergente; não renomeados ou corrigidos silenciosamente.
- Os oito escudos publicados da União Mauá retornam HTTP 404. O sistema preserva a referência e mostra fallback, sem usar o escudo do Ocian ou um desenho inventado. Ocian/Santos usam os escudos cadastrados no Ludora.
- Não há inferência de calendário por intervalo de 1h, categoria adjacente ou divisão do outro SUB. Todos os jogos vieram dos respectivos eventos.
- Ligações do chaveamento continuam conservadoras: título repetido não funde fase; empate/W.O./ida e volta ambíguos não autorizam deduzir avanço. O Sub-7/Prata mantém cinco conexões corroboradas e a ligação ambígua continua ausente.
- Toque validado em emulação, não aparelho físico. Não foi alterado o app mobile.
- Decisão de divergência mantém os eventos/scout e a publicação oficial separados. Um editor de transferência/fusão de âncoras ou reconciliação automática completa continua fora desta entrega.
- Scripts operacionais são específicos desta expansão registrada. Não repetir `apply`, `resume` ou `scenario` como seed rotineira de desenvolvimento. `apply` recusa operação já iniciada; usar o manifesto e revisar antes de qualquer retomada.
- Operações posteriores conferem uma assinatura do destino (host, porta, usuário e banco, sem senha). Se o ambiente apontar a outro destino, o script interrompe antes de operar.
- Serviços Render não foram publicados nesta tarefa. Mudanças locais e dados no Supabase não atualizam automaticamente o código das APIs remotas; essas versões precisam ser alinhadas antes de operar o calendário por elas.

## 10. Prompt para estudar em outro chat

> Leia `docs/handovers/2026-11-06-paulista-multiclube.md`, o manifesto em `docs/dados/paulista-multiclube-20261106.json` e o código atual do Ludora. Estou aprendendo programação. Ensine do zero, em blocos pequenos, sem fazer novas alterações. Comece pela diferença entre Clube, equipe oficial, Time, Categoria, Partida e ParticipantePartida. Use o exemplo real da partida 379: Ocian e União Mauá acessam o mesmo ID, mas têm categoria e mando próprios. Explique como IDs externos, mapas, consultas em lote e transações evitam duplicação; por que o nome não confirma identidade; como a pontuação 8* é preservada; e como dados oficiais diferem da anotação local 4×6 da partida de teste 630. Depois explique autorização ADMIN/TECNICO/TORCEDOR, motivo, confirmação, auditoria e os bloqueios da limpeza. Mostre os trechos antes/depois e explique a sintaxe de TypeScript, React e Prisma com exemplos novos em inglês. Não presuma que já sei esses frameworks. Diferencie registros oficiais, cadastros preexistentes e dados fictícios; não me ensine a apagar histórico para resolver dependências. Não bloqueie a explicação com exercícios a cada passo.
