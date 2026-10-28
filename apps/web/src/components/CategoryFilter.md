# CategoryFilter

Seletor reutilizável de Iniciação/Base e subs. No desktop, os subs ficam alinhados
à esquerda e quebram de linha. No celular, usam rolagem horizontal nativa e
centralização da seleção. Não há setas nem arrasto do conteúdo da página.
As duas faixas usam `tablist`, com Home/End e setas do teclado.
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

Nas páginas de clube, `useClubCategory` restaura a última fase e sub por clube,
respeitando seleções explícitas da URL. Ao mudar de fase, remova o parâmetro do
sub para selecionar o primeiro da nova fase. A barra é sticky no conteúdo normal;
também pode ser usada dentro de formulários e modais sem alterar o contexto salvo.
