# Filtros de Jogos — versão anterior

As cópias preservam a tela e os estilos imediatamente antes da reformulação do
filtro de Jogos em 21/10/2026. Não dependem de descartar outras alterações do Git.

- `jogos-antes-filtro-2026-10-21.tsx.txt`: tela original.
- `jogosStyles-antes-filtro-2026-10-21.ts.txt`: estilos originais.

Para voltar apenas à interface anterior, restaure essas duas cópias nos destinos:

```text
apps/mobile/app/(tabs)/jogos/jogos.tsx
apps/mobile/src/styles/jogosStyles.ts
```

Faça a restauração somente depois de conferir se houve novas alterações nesses
arquivos, para não sobrescrever trabalho posterior. Não use reset do repositório.
O novo componente `FiltrosJogos.tsx` e seus estilos deixarão de ser importados;
o suporte opcional a `ano` na API pode permanecer, pois o mês sem ano mantém o
comportamento anterior (ano corrente).

## Conferência da nova interface

1. A barra permanece no conteúdo rolável e mostra o mês/ano e status aplicados.
2. Ao abrir, mudar mês/ano/status e fechar por X, fora do painel ou Voltar não aplica.
3. Aplicar altera a lista uma vez. Aplicar sem mudanças não faz outra consulta.
4. Ano inteiro consulta janeiro a dezembro apenas do ano escolhido.
5. Restaurar seleciona mês/ano atuais e todos os status, ainda sem aplicar.
6. Em tela pequena ou texto ampliado, o conteúdo rola e Aplicar permanece acessível.
7. Conferir temas claro/escuro e se a troca de clube fecha o painel anterior.

O backend precisa ser recompilado/reiniciado para aceitar o parâmetro `ano`.
Não há migration ou nova dependência nativa. Testes lógicos não substituem a
conferência da animação e do layout no aparelho.
