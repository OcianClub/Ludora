# Exemplos da fila de chamados

O script `services/api/scripts/criar-chamados-teste.cjs` cria cinco chamados fictícios com prefixo `[TESTE]`: novo, revisão atrasada, recorrente, atribuído ao operador e encaminhado ao desenvolvimento. Todos aparecem em Todos; os demais filtros usam os critérios reais da API. As categorias podem se sobrepor.

Na pasta `services/api`, simule primeiro:

```powershell
node scripts/criar-chamados-teste.cjs --operador=super@super.com
```

Para criar no banco configurado nessa API, acrescente `--aplicar`. O script usa identificadores estáveis: executá-lo novamente preserva os exemplos existentes, inclusive alterações feitas pela interface. Não reinicia prazos nem recria ocorrências. Não altera partidas, dados da Federação ou contas, nem envia e-mail ou notificação.

O exemplo de Meus chamados é atribuído à conta indicada em `--operador`. O exemplo encaminhado também é visível à equipe de desenvolvimento. A primeira execução informa quantos registros foram criados e verifica os critérios de cada categoria.
