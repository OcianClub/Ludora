# DesktopSelect

Select compartilhado do desktop. Usa o mesmo menu, cores, rádio e navegação por teclado dos logs. O CSS é importado pelo próprio componente.

```tsx
<DesktopSelect
  label="Responsável"
  showLabel
  fullWidth
  height={44}
  optionHeight={40}
  value={responsavel}
  onChange={setResponsavel}
  options={responsaveis.map(p => ({ value: String(p.id), label: p.nome }))}
/>
```

- `height`: altura do campo, em pixels (número) ou medida CSS. Padrão: 44.
- `optionHeight`: altura mínima de cada opção. Padrão: 40.
- `fullWidth`: campo e lista ocupam toda a largura disponível.
- `width`: largura específica, como `240` ou `'20rem'`.
- `showLabel`: mostra o rótulo acima do campo. O nome acessível existe mesmo com o rótulo oculto.
- `placeholder`, `disabled`, `className`: personalização e estado.
- `indicator`: `'radio'` (padrão, azul com centro branco) ou `'dot'`.
- `expandInDialog`: coloca as opções no fluxo do formulário, permitindo que um modal compacto cresça ao abrir o select. Use quando o menu sobreposto seria cortado pelo corpo do modal; o padrão continua sobreposto.
- Cada opção aceita `icon` e `disabled`.

Sem `fullWidth`, preserva o menu compacto dos seletores dos logs. As opções se sobrepõem ao conteúdo, sem empurrá-lo. Nomes e regras específicas de negócio devem ser preparados pela tela, não pelo select.
