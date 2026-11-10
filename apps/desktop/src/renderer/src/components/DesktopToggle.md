# Toggle do desktop

`DesktopToggle` é o interruptor usado nos formulários de conta e permissões.

```tsx
<DesktopToggle label="Todas as categorias" checked={todas} onChange={setTodas} disabled={salvando}/>
```

O botão tem área de toque e foco por teclado; o leitor de tela recebe o rótulo e o estado ligado/desligado. `DesktopToggleIndicator` fornece o mesmo desenho para `DesktopMenuToggleItem`, usado nos logs, preservando a semântica de cada contexto (`switch` no formulário e `menuitemcheckbox` no menu).
