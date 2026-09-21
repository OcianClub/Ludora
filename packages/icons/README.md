# @ludora/icons

Biblioteca de ícones compartilhada entre os aplicativos Ludora.

## Uso

```tsx
import { HomeIcon, Icon } from '@ludora/icons';

<HomeIcon size={24} color="#0E78FF" accessibilityLabel="Início" />
<Icon name="ball" size={20} color="#FFFFFF" />
```

Todos os componentes aceitam `size`, `color`, `accessibilityLabel` e as demais propriedades de `SvgProps`.

## Adicionar um ícone

1. Coloque o SVG original em `src/svg`.
2. Adicione uma entrada em `scripts/icons.json`:

```json
{ "source": "notificacao.svg", "component": "NotificationIcon", "name": "notification" }
```

Se um mesmo desenho precisar responder por nomes antigos durante uma migração, use `aliases` sem duplicar o SVG:

```json
{ "source": "busca.svg", "component": "SearchIcon", "name": "search", "aliases": ["magnify"] }
```

3. Na raiz do monorepo, execute:

```sh
pnpm --filter @ludora/icons run generate
pnpm --filter @ludora/icons run typecheck
```

Os arquivos em `src/icons`, `src/Icon.tsx` e `src/index.ts` são gerados automaticamente e não devem ser editados manualmente.

O gerador atual suporta SVGs formados por um ou mais elementos `<path>`. Se encontrar outro elemento vetorial, ele encerra com uma mensagem clara para que o suporte seja adicionado conscientemente.

## Nomes disponíveis

A fonte de verdade é `scripts/icons.json`. O tipo `IconName`, exportado pelo pacote, contém todos os nomes e aliases válidos e oferece autocomplete no editor.
