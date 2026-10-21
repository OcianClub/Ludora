# Validação do Ludora — 21/10/2026

## Resultado

Suíte completa: **171 testes aprovados, zero falhas, zero ignorados**.
A API compilou, os tipos do mobile e do web passaram e a verificação de
compatibilidade do Expo informou dependências atualizadas.

Isso valida regras, utilitários e contratos HTTP/Socket.IO locais. Não equivale
a um teste visual completo nem comprova entrega de push em todos os estados do Android.

| Grupo | Testes aprovados |
|---|---:|
| API/mobile em TypeScript | 137 |
| Elenco e auditoria de notificações em CommonJS | 17 |
| Tempo real: cliente web, servidor Socket.IO e JWT reais | 8 |
| Utilitários do web | 9 |
| Total | 171 |

## Cenários cobertos automaticamente

- Cadastro, recuperação de senha, códigos, expiração, tentativas e invalidação de sessão.
- Isolamento de consultas e cache por clube/sessão; expiração, limpeza e ausência de cópia.
- Rede indisponível, timeout, cancelamento e rejeição de acesso sem sucesso offline artificial.
- Resposta antiga após troca de clube, leitura local atrasada e consultas simultâneas.
- Regras de placar, conflitos concorrentes e rollback simulado das alterações.
- Resumos da Home e pós-partida, partidas compartilhadas e contexto do Scout.
- Preferências de push por clube/tipo e filtros da conta, sem apagar o histórico.
- Exclusão de avisos, limpeza de lidas e desvinculação de dispositivo limitadas à própria conta.
- Falha HTTP no push, lotes de 100 dispositivos e ausência de destinatários.
- Falha de push preservando histórico e emissão interna por sala de usuário.
- Socket real: token inválido/revogado, usuário/clube inexistente, visita pública,
  sala correta, eventos de outra partida, reconexão e encerramento da conexão.

Os testes usam persistência simulada. Não foram criadas partidas, alteradas contas,
aplicadas migrations, executados seeds ou enviadas notificações para dispositivos reais.

## Correções na validação

A suíte adicional de sockets inicialmente teve quatro falhas. Ela simulava a
consulta antiga de vínculo, mas não simulava a consulta atual de versão de sessão
e existência do clube. Também esperava bloquear leitura pública sem vínculo.
O teste foi atualizado para o contrato atual; a autorização de produção não foi
relaxada. Foram acrescentadas verificações de sessão revogada e clube inexistente.

O comando `pnpm test:app` não incluía os testes `.cjs`, `.mjs` e utilitários web.
Foi adicionado `pnpm test:app:completo`, que compila a API e executa esses grupos
junto da suíte existente. O comando anterior continua disponível.

## Desempenho sintético

`pnpm perf:scout`: 1.600 atletas, oito categorias e 12 rodadas alternadas.
Mediana anterior de 9,71 ms e otimizada de 5,31 ms por rodada nesta execução.
É medição de processamento em Node, sem rede, FPS ou renderização Android.

## Validação manual informada pelo usuário

Recebimento de push na tela inicial após o amigo iniciar uma partida: confirmado.
Modelo do aparelho, versão da build e estado exato do app não foram informados.
O usuário também confirmou que o carregamento entre clubes ficou satisfatório.
Esses relatos não foram convertidos em medições de latência ou FPS.

## Pendências no aparelho

O ADB não identificou nenhum dispositivo conectado nesta rodada. Permanecem:

1. Gols, agendamentos e resultados com app aberto, em segundo plano e encerrado normalmente.
2. Negar/reabilitar permissão do sistema e desativar/reabilitar preferências gerais e por clube.
3. Logout/login em outra conta e confirmação de que não recebe novos pushes da conta anterior.
4. Modo avião com/sem cópia, retorno da rede e abertura offline de uma build autônoma.
5. Navegação visual, gestos, compartilhamento nativo e fluidez em build release.

Use o checklist em [validação mobile](./validacao-mobile.md) e contas de teste.
Nenhum desses casos foi marcado como aprovado automaticamente.

## Ponto de atenção encontrado na revisão

O envio de push verifica o status HTTP do Expo, mas não interpreta os tickets
individuais nem consulta recibos posteriores. HTTP 200 não garante entrega:
dispositivos desregistrados e rejeições individuais ainda precisam de tratamento
e observabilidade. Essa revisão não implementou limpeza de tokens ou retentativas.
O recebimento manual confirmado demonstra um caminho funcionando, não todos os casos.

## Repetir

```powershell
pnpm test:app:completo
pnpm --filter @ludora/mobile exec tsc --noEmit
pnpm --filter @ludora/web exec tsc --noEmit
pnpm --filter @ludora/mobile exec expo install --check
pnpm perf:scout
```
