# Validação mobile antes de distribuir

Os testes automatizados usam dados simulados e conexões locais. Não comprovam
entrega de push, comportamento do Android com o app encerrado ou fluidez visual.
Use contas e clubes de teste para não alterar informações reais.

## Verificações locais

Na raiz do repositório:

```powershell
pnpm test:app
pnpm test:app:completo
pnpm --filter @ludora/mobile exec tsc --noEmit
pnpm --filter @ludora/api run build
```

## Cenários no aparelho

| Cenário | Como testar | Resultado esperado |
|---|---|---|
| Troca de clube | Abra avisos do clube A, atualize e troque para B | Nenhum aviso ou contador de A aparece em B |
| Exclusão em andamento | Exclua um aviso de A e troque para B | A ação fica restrita a A; não altera a lista de B |
| Confirmação antiga | Abra “Limpar lidas”, troque de contexto e tente confirmar | A confirmação antiga não executa uma limpeza no contexto novo |
| Consulta pública | Visite um clube que não acompanha | Home e histórico continuam acessíveis; avisos explicam a necessidade de acompanhar |
| Deixar de seguir | Deixe de seguir o clube ativo | A visita pública permanece; contador e avisos deixam de usar o vínculo anterior |
| Conta diferente | Saia de A, entre em B e visite o mesmo clube | Não aparecem cache, avisos ou permissões da conta anterior |
| Falha de conexão | Desligue o backend e tente atualizar/alterar um aviso | Mensagem útil; não repete escrita automaticamente; atualizar permite conferir o estado salvo |
| Modo offline | Carregue Home e Scout, mantenha o app aberto e desligue a rede | Cópia identificada como local, com horário; sem permitir edição |
| Primeiro acesso offline | Sem cópia válida, tente abrir Home/Scout sem rede | Estado de erro com nova tentativa, sem inventar dados vazios |
| Resumo final | Abra uma finalizada e compare placar/eventos | Resultado usa placar salvo; divergência de autoria é sinalizada |
| Resumo compartilhado | Abra pelo clube B uma partida registrada pelo clube A | Resultado pela perspectiva de B, sem atribuir atletas de A como destaques de B |
| Cache e origem | Carregue uma partida compartilhada, use cópia offline e depois reconecte | Mantém somente leitura e acompanha a sala do clube de origem, inclusive em cópias antigas após a primeira atualização HTTP |
| Cache lento | Troque de clube com a rede respondendo antes da leitura local | A resposta atual não espera o arquivo local; a cópia atrasada não substitui os dados novos |
| Compartilhar | Abra o menu nativo e cancele; depois compartilhe com nomes desligados | Cancelar não dá erro; texto não contém nomes de atletas |
| Cadastro | Use e-mail de teste permitido pelo remetente e confirme o código | Conta só é criada após confirmação; reenvio não duplica cadastro |
| Recuperação | Redefina senha e tente usar a sessão antiga | Nova senha funciona; credencial antiga deixa de autorizar acesso |
| Organizar partida | Selecione categoria, competição ou amistoso, times, data com ano, horário e local | Criação mantém o clube correto; ao voltar, Jogos exibe o mês/ano da partida criada |
| Categoria da partida | Abra o seletor, confira Iniciação/Base, selecione outro sub e reabra; repita com acesso restrito a categorias | Grade mostra apenas categorias disponíveis; seleção atual marcada e preservada ao cancelar; troca limpa times incompatíveis com aviso, sem apagar data, horário ou competição |
| Identificação do clube | Abra Organizar partida com clubes de nome longo, com e sem escudo, nos temas claro e escuro | Nome legível e sem corte; escudo usa a inicial do clube se estiver ausente ou falhar |
| Revisão da partida | Preencha, toque em Criar partida, volte para editar e revise novamente; confirme apenas ao final | Abrir ou cancelar revisão não cria partida; resumo destaca o sub e confere com o envio; confirmação bloqueia novos toques durante envio e mantém dados se houver erro |
| Escudos ao organizar | Selecione times com escudo próprio, vinculados a um clube com escudo e sem imagem | Lista e cards mostram a identidade do clube vinculado; sem vínculo usam o escudo próprio; inicial apenas quando não há imagem utilizável |
| Teclado ao organizar | Em celular pequeno, digite data, mude para horário e local; feche e reabra o teclado várias vezes | Campo focado permanece visível e pode ser rolado; botão de criar retorna sem espaço residual abaixo ao fechar teclado; dados e revisão continuam preservados |
| Rascunho da partida | Preencha dados e tente sair pela seta ou Voltar do Android | Confirma descarte; continuar mantém todos os campos; durante envio não fecha |
| Calendário e campos | Teste fevereiro, virada do ano, digitação e campos incompletos | Data válida com ano explícito, erros junto aos campos e rolagem até a primeira pendência |
| Teclado e seletores | Abra busca de time/competição e data; teste teclado, tela pequena e temas | Painéis inferiores roláveis, botão de criação acessível, sem alterar a edição de partidas |

## Notificações externas

Teste em APK com as credenciais de push configuradas, não somente no Expo Go.
Gere os eventos a partir de outra sessão de gestão. Teste cada caso com o app
aberto, em segundo plano e encerrado normalmente, anotando os resultados.

1. Com permissão concedida e preferências ativadas, marque uma partida, registre
   um gol e finalize uma partida. Confira aviso externo, histórico e contador.
2. Desative somente gols de um clube. Gol não deve gerar push desse clube;
   agendamentos/resultados continuam ativos. O histórico permanece disponível.
3. Desative o botão geral do perfil. Nenhum tipo deve gerar novo push, mas o
   histórico continua recebendo avisos. Preferências por clube são preservadas.
4. Negue a permissão do sistema. O app deve orientar como habilitá-la, sem
   apresentar a permissão como concedida. Depois habilite nas configurações.
5. Deslogue, entre com outra conta e gere um evento exclusivo da conta anterior.
   O dispositivo não deve receber novos avisos destinados apenas à conta antiga.

Um aviso já enviado ou entregue antes de desativar a preferência pode permanecer
na central do sistema. Diferencie isso de um novo envio. Encerramento normal e
“Forçar parada” nas configurações do Android são situações distintas; registre
qual foi usada no teste. Um APK de desenvolvimento precisa do Metro para abrir
o JavaScript; teste inicialização completamente offline em uma build autônoma.

## Registro de execução

### Desempenho na troca de clubes e abas

1. Com `EXPO_PUBLIC_DEBUG_PERF=1`, reinicie o Metro e carregue Home/Scout do clube A.
2. Visite B e volte para A. Confira a cópia local durante a atualização, sem dados
   de B aparecendo em A. Compare a primeira abertura com a revisita.
3. Alterne Home/Scout após terminar a preparação em segundo plano. A cópia deve
   aparecer sem esperar outra leitura de arquivos; a atualização remota continua.
4. Troque A/B rapidamente, faça logout/login em outra conta e teste rede indisponível.
   Dados de sessão anterior e respostas atrasadas não podem substituir o clube atual.
5. Registre os logs `api:*`, `consulta:*`, `clube:persistencia` e `*:estado-pronto`.
   Compare também numa build release; tempo de estado pronto não é medição de FPS.

Medição local autenticada em 20/10/2026, antes da compressão: partidas resumidas
407 ms/166.297 bytes e perfis Scout 403 ms/87.320 bytes. São amostras na máquina
do backend, não tempos no celular ou garantia de latência. Os cinco segundos
relatados precisam ser comparados no aparelho após as otimizações.

Após a consulta específica da Home, o clube maior retornou 72 partidas/47.294
bytes, em vez de 256/166.297 bytes (JSON sem compressão). Na instância temporária
local, a rota completa, autenticada e com gzip, levou 158–185 ms nos seis pedidos
medidos entre os três clubes. Isso não mede a navegação nem a rede do aparelho.
Os resumos foram comparados com a lista completa para as oito categorias de cada
um dos três clubes do seed; destaque, agenda e histórico coincidiram usando o
mesmo desempate por ID para horários iguais. Nenhum dado do seed foi alterado.

Na validação física, confira também erro de conexão ao abrir um clube novo:
o skeleton precisa terminar e permitir tentar novamente, sem exibir partidas do
clube anterior. Verifique entrada após login e troca interna entre clubes;
somente a segunda deve reutilizar a rota de abas existente.

Preencha ao validar de verdade; não marque aprovado apenas por passar no teste automatizado.

| Data/build | Aparelho/Android | Cenário | Resultado observado | Aprovado? |
|---|---|---|---|---|
| 21/10/2026; build não informada | Não informado | Push recebido após amigo iniciar partida; usuário relatou estar na tela inicial | Recebimento confirmado pelo usuário; não comprova todos os estados do Android | Sim, apenas esse cenário |

O estado exato do aplicativo (primeiro plano, segundo plano ou encerrado) não foi
identificado no relato. Os demais cenários físicos permanecem pendentes. Resultado
da rodada automatizada: [relatório de 21/10/2026](./validacao-mobile-2026-10-21.md).
