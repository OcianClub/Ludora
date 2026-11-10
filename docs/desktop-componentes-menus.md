# Menus e selects do Desktop

Componentes exclusivos de `apps/desktop`, com o visual aprovado nos logs. Não modificam componentes do Web ou Mobile e não exigem bibliotecas adicionais.

## Arquivos

- `src/renderer/src/components/DesktopMenu.tsx`: menu de ações, itens, rádios, toggles, rótulos e divisórias.
- `src/renderer/src/components/DesktopSelect.tsx`: seletor controlado com opções tipadas.
- `src/renderer/src/components/DesktopMenu.css`: aparência comum, independente da página de logs.

## Select

```tsx
import { DesktopSelect } from '../components/DesktopSelect';

<DesktopSelect
  label="Situação"
  value={situacao}
  onChange={setSituacao}
  options={[
    { value: '', label: 'Todas as situações' },
    { value: 'ativa', label: 'Ativa' },
    { value: 'encerrada', label: 'Encerrada' },
  ]}
/>
```

- Cada opção pode receber `icon` (ReactNode) e `disabled`.
- `indicator="radio"` é o padrão: azul com centro branco na seleção. `indicator="dot"` usa a bolinha azul simples, como no período dos logs.
- `disabled` desabilita o seletor inteiro; `placeholder` define o texto quando o valor não está nas opções.
- `className` permite ajustar largura/posicionamento da página sem copiar os estilos internos.
- O componente não consulta API, não persiste filtros nem escolhe uma opção por conta própria. Esses comportamentos continuam na página.

## Menu de ações

```tsx
import {
  DesktopMenu, DesktopMenuItem, DesktopMenuRadioItem,
  DesktopMenuToggleItem, DesktopMenuSeparator, DesktopMenuLabel,
} from '../components/DesktopMenu';

<DesktopMenu label="Opções da lista">
  <DesktopMenuItem onSelect={exportar}>Exportar</DesktopMenuItem>
  <DesktopMenuSeparator/>
  <DesktopMenuLabel>Ordenação</DesktopMenuLabel>
  <DesktopMenuRadioItem checked={ordem === 'asc'} onSelect={() => setOrdem('asc')}>
    Mais antigos primeiro
  </DesktopMenuRadioItem>
  <DesktopMenuRadioItem checked={ordem === 'desc'} onSelect={() => setOrdem('desc')}>
    Mais recentes primeiro
  </DesktopMenuRadioItem>
  <DesktopMenuSeparator/>
  <DesktopMenuToggleItem checked={quebrar} onChange={setQuebrar}>
    Quebrar linhas longas
  </DesktopMenuToggleItem>
</DesktopMenu>
```

O gatilho padrão é `...`. A propriedade `trigger` aceita conteúdo personalizado. Itens de ação e rádio aceitam `icon` e `disabled`; toggle aceita `disabled`.

## Interação e acessibilidade

- Ações e rádios fecham o menu e devolvem o foco ao gatilho.
- Toggle permanece aberto e mantém o foco, permitindo ligar/desligar sem reabrir.
- Setas, Home/End e Escape controlam o menu; Enter/Espaço acionam o item.
- A seleção usa `menuitemradio` com `aria-checked`; toggle usa `menuitemcheckbox`. Os indicadores visuais são decorativos.
- Opções desabilitadas não entram na navegação por teclado. A opção selecionada habilitada recebe foco ao abrir.
- Menu sobreposto não empurra o conteúdo e usa o posicionamento existente para caber na janela.
- Toggle respeita preferência por movimento reduzido.

## Uso atual

Logs utiliza os componentes para nível, período, ações, ordenação e quebra de linhas. As demais telas podem adotar o padrão gradualmente, sem substituição automática de todos os filtros existentes.
