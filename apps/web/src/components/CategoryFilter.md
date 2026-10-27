# CategoryFilter

Seletor reutilizável de Iniciação/Base e subs. Inclui estilos responsivos, arrasto,
centralização, setas, navegação por teclado e respeito a movimento reduzido.
Não depende de rotas, requisições ou contextos da aplicação.

```tsx
import { CategoryFilter } from './components/CategoryFilter';

<CategoryFilter
  categories={categories}
  phase={phase}
  selected={categories.find(category => category.nome === selectedName)}
  onPhase={setPhase}
  onSelect={setSelectedName}
  label="Categoria do elenco"
/>
```

Cada categoria precisa de `id` numérico, `nome` e `tipo` (`INICIACAO` ou `BASE`).
`onSelect` recebe o nome do sub; `onPhase` recebe a fase. A tela controla a seleção
e decide como atualizar seus dados. Importe o componente: seu CSS é carregado junto.

Para páginas de conteúdo arrastáveis, use `HomeSwipeSurface` em conjunto, como no
Dashboard e no Elenco. O seletor sozinho também funciona em formulários e modais.
