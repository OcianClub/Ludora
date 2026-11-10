# Tabelas do desktop

`DesktopTable` fornece a tabela semântica, o container com rolagem, as cores, bordas e o hover da linha inteira. Clubes e usuários usam esta mesma base.

`DesktopSortButton` exibe os dois indicadores de direção. Apenas o indicador ativo recebe a cor primária; o texto mantém sua cor. A tela continua responsável pelo ciclo crescente → decrescente → padrão e por ordenar os dados.

```tsx
<DesktopTable label="Contas" tableClassName="minha-tabela">
  <thead><tr><th scope="col" aria-sort="ascending">
    <DesktopSortButton label="Nome" direction="asc" onClick={ordenarPorNome}/>
  </th></tr></thead>
  <tbody>{contas.map(conta => <tr key={conta.id}><td>{conta.nome}</td></tr>)}</tbody>
</DesktopTable>
```

Personalize larguras de colunas e altura das linhas com `tableClassName`; `className` se aplica ao container. Quando o conteúdo não couber, a rolagem fica dentro dele.

`DesktopUserTable` monta as colunas e os acessos às contas. Recebe `usuarios`, `ordem`, `onSort`, `onManage` e `label`, sem realizar consultas ou modificar permissões. `currentUserId` mantém a conta conectada no topo da lista recebida, com destaque sutil e chip “Você”, preservando a ordenação das demais contas.

Os chips `CargoClube` e `CargoPlataforma` compartilham a apresentação em `CargoClube.css`, incluindo tamanho e ícones. Os selects dos filtros utilizam `DesktopSelect`.
