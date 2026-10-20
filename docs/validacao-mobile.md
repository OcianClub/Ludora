# Validação mobile antes de distribuir

Os testes automatizados usam dados simulados e conexões locais. Não comprovam
entrega de push, comportamento do Android com o app encerrado ou fluidez visual.
Use contas e clubes de teste para não alterar informações reais.

## Verificações locais

Na raiz do repositório:

```powershell
pnpm test:app
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
| Compartilhar | Abra o menu nativo e cancele; depois compartilhe com nomes desligados | Cancelar não dá erro; texto não contém nomes de atletas |
| Cadastro | Use e-mail de teste permitido pelo remetente e confirme o código | Conta só é criada após confirmação; reenvio não duplica cadastro |
| Recuperação | Redefina senha e tente usar a sessão antiga | Nova senha funciona; credencial antiga deixa de autorizar acesso |

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

Preencha ao validar de verdade; não marque aprovado apenas por passar no teste automatizado.

| Data/build | Aparelho/Android | Cenário | Resultado observado | Aprovado? |
|---|---|---|---|---|
| — | — | — | Pendente de teste físico | — |
