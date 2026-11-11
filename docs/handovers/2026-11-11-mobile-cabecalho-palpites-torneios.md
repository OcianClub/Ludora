# Cabeçalho do clube, palpites e barra do app

## Mapeamento

| Arquivo | Alteração |
| --- | --- |
| `apps/mobile/src/components/Header.tsx` | Exibe nome e cargo como texto e remove o aviso acionado pelo toque. |
| `apps/mobile/app/(tabs)/_layout.tsx` e `apps/mobile/src/styles/tabBarStyles.ts` | Exibem “Torneios” com o troféu, tipografia comum e espaço horizontal uniforme. O leitor de tela anuncia “Competições”. |
| `apps/mobile/src/components/SumulaPartida.tsx` e `PalpitePartida.tsx` | Escondem a votação na operação do jogo ao vivo e respeitam a permissão individual da API. Mantêm a consulta do resultado depois do jogo. |
| `services/api/src/modules/partidas/palpites.service.ts` e `palpites.routes.ts` | Reutilizam a autorização por clube e categoria e retornam HTTP 403 ao tentar votar em partida sob sua gestão. A permissão individual fica na resposta autenticada. |
| `packages/shared-types/src/matchPoll.ts`, `apps/web/src/hooks/useMatchPoll.ts` e `apps/web/src/components/MatchPoll.tsx` | Validam e mantêm a permissão individual ao mesclar atualizações públicas. O Web também oculta o cartão aberto para a conta impedida. |
| `services/api/tests/palpites.test.ts`, `apps/mobile/tests/sumula-ui-smoke.cjs` e `apps/web/tests/match-insights-smoke.cjs` | Testam escopo dos cargos, bloqueio direto na API, voto do torcedor, anonimato, pós-jogo e regressão na operação da súmula. |

## Como funciona

O cartão de palpite deixa a súmula ao vivo quando o técnico, mesário ou administrador tem acesso de gestão naquela partida. A API verifica as categorias dos dois participantes, inclusive se a conta consultar o jogo com outro clube selecionado. Para registros antigos sem participantes, usa a categoria original da partida. Torcedores autenticados continuam votando. Visitantes anônimos e o público do pós-jogo podem consultar os resultados conforme o fluxo existente.

O voto continua passando pela transação existente. A verificação ocorre antes de salvar, então a recusa não incrementa a revisão nem gera evento no socket. O campo privado `podeVotar` acompanha a consulta autenticada. Os clientes preservam esse campo ao receber percentuais públicos por socket.

O título da aba é “Torneios” para caber com a tipografia já usada em “Início”, “Jogos”, “Clubes” e “Scout”. O leitor de tela recebe “Competições”. A rota e a tela de competições são as mesmas. [Referência de navegação do Material Design](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md#anatomy)

## Antes e depois

```diff
- <TouchableOpacity onPress={showLogo ? mostrarIdentidade : undefined}>
+ <View style={styles.leftContainer}>
    {/* Nome e cargo */}
- </TouchableOpacity>
+ </View>

- {(aoVivo || finalizada) && <PalpitePartida data={data} />}
+ {(finalizada || (aoVivo && !data.podePreparar && !data.podeSumula)) && (
+   <PalpitePartida data={data} />
+ )}

  // Antes, bastavam uma sessão válida e uma votação aberta.
+ if (await podeGerenciarPartida(tx, partida, usuarioId)) {
+   throw new ErroPalpite(403, 'Quem gerencia esta partida não pode dar um palpite nela.');
+ }
```

## Validação

- Android no Expo Go SDK 54, com API simulada. Toque no brasão e no nome do Santos como técnico, abertura da súmula com os controles de gol, voto confirmado como torcedor e navegação para “Torneios”. Barra conferida em 320 dp nos temas claro e escuro.
- Cinco testes da API de palpites, 30 cenários mobile via React Native Web e oito combinações de largura/tema no Web passaram. TypeScript mobile, build Web e exportação Android passaram.
- A suíte completa registrou 617 sucessos, cinco testes pulados e uma falha preexistente em `proposal-updates.test.cjs`. O teste de notificação de solicitações não simula a gravação da auditoria e tenta conectar ao endereço fictício do banco de testes. O teste e a rota correspondente estão iguais ao commit de origem.
- A API atualizada aplica o bloqueio no servidor. A entrega não exige alteração de `.env` ou migração do banco.

## Prompt para novo chat

> Ensine estas mudanças do Ludora do zero, em português, usando exemplos curtos em inglês. Comece pela diferença entre View e TouchableOpacity e por como o Expo Router escolhe o rótulo da aba. Depois explique como o app decide mostrar o cartão da súmula, como a API cruza cargo, clube e categoria antes de gravar o voto e como o socket atualiza o placar da votação sem transmitir a permissão individual. Use os trechos antes e depois deste relatório e explique como rodar os testes.
