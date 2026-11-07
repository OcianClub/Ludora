# Piloto Paulista — operação e limites

> Registro histórico de 05/11. A separação web/desktop, a implantação no Supabase e o agendamento foram atualizados em 06/11: consulte [a operação atual](paulista-operacao.md). As instruções de ativação e o estado “não ativado” abaixo descrevem a entrega anterior.

Implementação de 05/11/2026, em `develop`, sem commit. Backend e web implementados e validados em PostgreSQL descartável. **Não ativado no Supabase compartilhado.** Não há nova tela administrativa Electron nesta entrega; a operação do piloto está no web, restrita a SUPERADMIN.

## Identidade confirmada e fonte

O usuário confirmou expressamente: **Clube Ludora 2 é o Ocian Praia Clube de Praia Grande**. O cadastro consultado ainda informa São Paulo/SP; a cidade não foi alterada. Categoria local Sub-7: ID 9. A confirmação não foi convertida em vínculo no banco compartilhado.

Fonte: [Paulista 2026, Sub-7, A2, evento 900](https://eventos.admfutsal.com.br/evento/900/jogos). Equipe oficial Ocian: 12423. Adversário da amostra: ADC MARVEL, 12241. Jogo de 21/03/2026, 09:30, Ginásio Ocian Praia Clube: **Ocian 1 × 1 ADC Marvel**, súmula 139195, fase 35845. Identidade composta usada: `900:35845:12423:12241`.

Na consulta de validação, foram reconhecidos 297 jogos do Paulista, com 24 IDs de fases do Torneio União excluídos. A página de um mesmo evento mistura essas competições. A projeção local do piloto criou 25 partidas do Ocian. Reimportar criou zero partidas adicionais. Esses números descrevem a consulta executada; a fonte pode mudar.

Conferência por SUB, sem vínculo automático:

| SUB | Divisão | Evento | Equipe candidata |
|---|---|---|---|
| 7 | A2 | 900 | 12423 |
| 8 | A2 | 901 | 12424 |
| 9 | A2 | 902 | 12425 |
| 10 | A2 | 903 | 12426 |
| 12 | A3 | 925 | 13041 |
| 14 | A3 | 923 | 13042 |
| 16 | A3 | 924 | 13043 |
| 18 | A3 | 922 | 13044 |

Os IDs mudam por SUB. A busca por nomes produz candidatos, não comprova identidade. Somente a identidade do piloto Sub-7 foi confirmada nesta conversa. Não são criados jogos de outro SUB por estimativa de intervalo.

## Fluxo

1. SUPERADMIN importa um evento específico. O servidor lê equipes, jogos e classificação na origem fixa, com timeout e limite de tamanho.
2. O parser aceita o título Campeonato Paulista, preserva IDs de fases e exclui fases União. Placar ausente permanece `null`; W.O. não vira empate numérico para cálculo.
3. Um snapshot oficial é salvo com hash, versão, origem e horário. Mudanças geram auditoria. Remoção de jogo ou troca de identidade interrompe a sincronização e preserva a versão anterior para revisão.
4. A administração confirma equipe externa → clube Ludora, com motivo. Depois sincroniza novamente para distribuir as partidas relevantes.
5. Adversários sem cliente viram `Time` com nome/escudo/SUB, sem jogadores, contas ou permissões. Os outros jogos continuam visíveis no painel global, sem entrar na agenda operacional de todos os clubes.
6. Se a casca virar cliente, seu `Time.id` e os `Partida.id` permanecem. A nova participação recebe a categoria do cliente. Conflito com outro time do mesmo SUB bloqueia a operação para revisão; não há união por nome.
7. Resultado oficial fica separado do placar/eventos locais. Divergência em jogo local finalizado aparece como pendência. Atualizar a fonte não apaga o scout nem inventa autores de gols.
8. Complementação retroativa permite evento próprio e escalação do jogador, com autor, motivo e origem `CLUBE_RETROATIVO`. Não soma novamente ao placar. O servidor valida vínculo ao clube, categoria e cargo.

## Banco e compatibilidade

A migration `20261105120000_paulista_piloto` cria sete tabelas: `FpfsEvento`, `FpfsEquipe`, `FpfsTime`, `FpfsVinculo`, `FpfsJogo`, `FpfsPendencia`, `FpfsAuditoria`, com índices e chaves estrangeiras. **Nenhuma coluna nova é adicionada a Clube, Competicao, Time ou Partida.** As relações inversas no schema Prisma são virtuais e não exigem coluna nessas tabelas.

`FpfsEvento.competicaoId` aponta para uma competição compatível com o fluxo existente. `Competicao.clube_id` é a âncora técnica do legado, não concede autoridade para editar a competição oficial. O campo `paulista_evento_id` retornado pela API é calculado no DTO, não é coluna no banco.

O código foi validado com `/competicoes` antes e depois da migration no banco descartável. Também foi feita leitura de `Competicao` no banco compartilhado usando o novo Prisma Client, ainda sem a migration: sucesso. O status desse banco mostrou somente esta nova migration pendente. **Isso comprova a leitura legada observada; não comprova ativação nem gravação do piloto nesse ambiente.**

## Ativação posterior no ambiente real

Os dois flags estão desligados por padrão no `.env.example`. O `.env` real não foi modificado.

Antes de aplicar: revisar o SQL da migration, conferir o destino do ambiente e realizar o procedimento habitual de backup. Os comandos abaixo são instruções de implantação, **não foram executados contra o Supabase compartilhado nesta entrega**:

```powershell
pnpm install
pnpm --filter @ludora/api exec prisma migrate status
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm build:api
pnpm build:web
```

Após aplicar a migration, configurar na API e reiniciar:

```dotenv
PAULISTA_ENABLED=true
PAULISTA_SYNC_DIARIA=false
```

Em `/competicoes/paulista`, como SUPERADMIN:

1. Importar evento 900.
2. Conferir equipe 12423, clube 2 e categoria 9. Registrar a confirmação e motivo.
3. Sincronizar fonte e verificar calendário, casca ADC Marvel, IDs e contagens.
4. Revisar eventuais conflitos com partidas antigas. A importação bloqueia partida legada do mesmo SUB/data para evitar duplicação silenciosa; não existe ferramenta automática de fusão de legado nesta entrega.
5. Conferir uma partida e classificação com a fonte. Somente depois habilitar programação do evento.

`PAULISTA_SYNC_DIARIA=true` habilita o executor. Ele verifica a cada 15 minutos somente eventos com programação ligada e vínculo confirmado, consultando novamente após a mudança de dia em São Paulo. Execute em uma única instância responsável pelo job. Transações Serializable e controle de concorrência impedem importações silenciosamente conflitantes, mas não substituem um scheduler distribuído. Falha de rede mantém o snapshot anterior e registra tentativa de falha quando o evento já existe.

Para desativar o piloto, desligar ambos os flags e reiniciar. Isso não apaga registros já projetados nem reverte migration. Não usar `git pull` como rollback de banco.

## Dados, permissões e limites

- **Oficial:** calendário, placar, equipes, fases e classificação publicados. URL e data de consulta aparecem na interface.
- **Calculado Ludora:** conferência 3/1/0 e saldo, por ID de fase. Ordem provisória, sem afirmar desempates, penalidades ou regulamento oficial.
- **Local:** eventos/scout e placar anotados pelo clube. A pendência mostra a diferença, preservando os dois valores.
- **Teste:** usuários `example.test`, clubes com TESTE no nome e evento 99000001 só no PostgreSQL descartável. O jogo futuro e o placar local 9×1 são fixtures deliberadas; o resultado oficial da amostra é 1×1.
- Desvinculação preserva IDs e histórico quando segura. Se houver eventos/escalações próprios ou for o clube âncora, bloqueia e exige revisão/transferência. Essa transferência ainda não tem fluxo automatizado.
- Futuras sem `id_jogo` usam composição de IDs externos evento/fase/mandante/visitante. Par repetido na fase ou mudança de identidade bloqueia. Não é uma identidade individual garantida pela federação para todas as partidas.
- Confrontos exibem as fases publicadas; não inventam ligações entre chaves, classificados ou vantagens.
- Publicação posterior de resultado atualiza o painel oficial; não encerra automaticamente uma operação local em andamento nem substitui seu placar. A pendência de placar é comparada quando o registro local está finalizado.
- Retroativo inicial aceita GOL, ASSISTENCIA, DEFESA e FALTA, incluindo o jogador na escalação. Não é editor completo de súmula histórica, não remove anotações e não dispara reprocessamento automático de ML.
- Escudos usam URLs da fonte com fallback visual. Os testes de interface bloquearam imagens externas para manter execução determinística; a disponibilidade visual desses arquivos não foi comprovada nesse teste.
- Integração depende do HTML público, não de contrato de API homologado. Uma mudança de formato deve exigir revisão, não importação presumida.

## Evidências e testes

Handover: [2026-11-05-paulista-piloto.md](handovers/2026-11-05-paulista-piloto.md).
Artefatos locais ignorados pelo Git: `test-results/paulista/` (logs, snapshot da amostra, conferência e screenshots). Os comandos e pré-condições para reprodução estão no handover.
