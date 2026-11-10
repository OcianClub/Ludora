# DesktopTabs

Abas com linha inferior azul, texto alinhado à esquerda e sem fundo no hover. O componente importa seu CSS e associa a aba selecionada ao painel acessível.

```tsx
<DesktopTabs
  label="Área de usuários"
  value={aba}
  options={[
    { value: 'contas', label: 'Contas e acessos' },
    { value: 'cadastro', label: 'Cadastro dos clubes' },
  ]}
  onChange={setAba}
>
  {aba === 'contas' ? <Contas /> : <Cadastro />}
</DesktopTabs>
```

- `value` e `onChange`: controlados pela tela; rotas e consultas permanecem nela.
- `options`: valor, rótulo, contador `count` opcional e `disabled` opcional.
- `children`: conteúdo da aba ativa; a tela decide se mantém seu estado ao alternar.
- `className`: personalização local. Use `--desktop-tabs-gap` e `--desktop-tabs-height` para ajustar espaçamento e altura.
- Teclado: setas e Home/End movem o foco; Enter/Espaço selecionam. Tab segue para o painel e seus controles.

## Contraste de cards internos

`--desktop-surface-raised`, definido em `styles/desktop-ui.css`, usa `#1B1F2A` no tema escuro. Use como fundo de itens dentro de cards, junto de uma borda `1px solid var(--borda)`. No tema claro, deriva de `--fundo-card` com 3% de `--texto` para manter a leitura. Para hover desses itens internos, use `--desktop-surface-raised-hover`.
