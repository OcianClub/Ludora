# Auditoria mobile — 18/10/2026

Revisão estática e testes automatizados dos fluxos de Home, Jogos, Scout,
organização de partidas, autenticação, clube ativo, perfil e notificações.
As alterações locais anteriores foram preservadas.

## Problemas corrigidos

| Área | Problema confirmado | Correção |
| --- | --- | --- |
| Carregamentos | Respostas antigas podiam substituir o clube/filtro atual | Controle de versão das requisições e invalidação ao perder foco |
| Clube ativo | Telas atualizavam antes de o novo ID ser salvo | Persistência antes de publicar a troca no contexto |
| Rede | Login e chamadas da API podiam esperar sem limite | Timeout com cancelamento e mensagens legíveis, sem repetir POST automaticamente |
| Home | Cálculos e ordenações repetidos ao trocar de página | Resumos memorizados; desempate do próximo jogo pelo horário |
| Jogos | Aplicar filtros idênticos deixava o skeleton ativo | Só iniciar novo carregamento quando o filtro mudar |
| Scout | Troca entre clubes com o mesmo papel não atualizava necessariamente os dados | Dependência do ID do clube e proteção contra respostas antigas |
| Scout | Retornar à tela redefinia a categoria escolhida | Seleção inicial apenas ao carregar outro clube |
| Organização | Data/hora validadas somente pelo tamanho | Validação de calendário e intervalos reais |
| Organização | Mesmo time podia ocupar ambos os lados | Validação e exclusão do adversário na lista de seleção |
| Organização | Falha de carregamento sem tratamento e envio repetido | Erro com nova tentativa e bloqueio síncrono de envio |
| Notificações | Um fetch por evento em sequência, sem atualização ao retomar | Agrupamento em janela de 250 ms; atualização ao reconectar/retomar |
| Preferências | Falha de rede era apresentada como permissão negada | Distinguir negativa de permissão de erro na operação |
| Sessão | Logout preservava clube em memória e registro push | Desvincular dispositivo antes de limpar credenciais e contexto |
| Inicialização | Token inválido apagava só parte do clube; busca sem timeout | Limpar contexto completo e limitar validação inicial a 8 s |

## Cenários automatizados

`apps/mobile/tests/audit.test.ts`: 22 cenários de funções e transporte, usando
requisições simuladas: datas impossíveis, ano bissexto, horários limites,
times iguais, dados incompletos, respostas fora de ordem, saída da tela,
sucesso HTTP, rede indisponível, timeout, cancelamento, HTTP 401, prioridade
de partida ao vivo, ordenação por horário, pontuação em casa/fora, histórico
e lista vazia.

`services/api/tests/notificacoes-audit.test.cjs`: 5 cenários isolados dos handlers,
com persistência simulada: filtros por conta/clube, ID inválido, limpeza somente
de lidas, desvinculação de push por proprietário e token inválido. Estes testes
não exercitam os middlewares reais nem conectam ao Supabase.

Comandos a partir da raiz:

```powershell
pnpm --filter @ludora/mobile exec tsc --noEmit
pnpm --filter @ludora/api run build
pnpm --filter @ludora/api exec tsx --test ../../apps/mobile/tests/audit.test.ts
pnpm --filter @ludora/api exec node --test tests/notificacoes-audit.test.cjs
```

## Limites e próximos testes no aparelho

- Não houve medição de FPS, RAM, tempo real de abertura ou benchmark antes/depois.
  Não é possível atribuir percentual de ganho a estas alterações.
- Não foram executados testes visuais ou toques automatizados em Android/iOS.
  Os testes de corrida cobrem o utilitário usado nas telas, não a navegação nativa.
- Fluxo manual: entrar, selecionar clube A, trocar rapidamente para B, verificar
  Home/Jogos/Scout, aplicar o mesmo filtro duas vezes e tentar novamente sem rede.
- Formulário: rejeitar 31/02, 24:00 e times iguais; confirmar envio único com dois
  toques; conferir teclado, seletor de times e encerramento de modal.
- Push: permitir/negar permissão, receber gol com app em segundo plano, retomar
  após perder rede e sair da conta. A entrega depende de Firebase/Expo e dispositivo.
- Logout precisa de conexão quando há push registrado, para confirmar a
  desvinculação. Se falhar, mantém a sessão e permite nova tentativa. JWT expirado
  neste fluxo ainda precisa de estratégia de revogação/renovação no backend.
- Em produção, definir `EXPO_PUBLIC_API_URL` com URL HTTPS acessível; o fallback
  local foi mantido. O timeout geral é 20 s; endpoints legitimamente mais lentos
  podem precisar de tratamento específico. Cancelar a espera de POST não desfaz
  uma operação já recebida pela API; idempotência no servidor é melhoria futura.
- Histórico de notificações carrega os 100 avisos recentes. Paginação e listas
  virtualizadas para grandes históricos de jogos permanecem melhorias futuras.
- Ocultar ações no mobile não substitui a autorização por clube/categoria na API.

## Aplicar e testar

Reiniciar a API compilada (`pnpm start` em `services/api`) e recarregar pelo Metro.
As mudanças são TypeScript/JavaScript; não exigem novo APK nem migration.
