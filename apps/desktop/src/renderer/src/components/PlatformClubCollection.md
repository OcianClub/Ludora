# Clubes da plataforma

`PlatformClubCards` e `PlatformClubTable` compartilham os escudos, o chip de plano, o status e a formatação dos dados. O CSS acompanha os componentes, sem depender dos estilos da página Visão global.

```tsx
import {
  PlatformClubCards,
  PlatformClubTable,
  type PlatformClubSort,
  type PlatformClubSortKey,
} from './PlatformClubCollection';

const [ordem, setOrdem] = useState<PlatformClubSort>(null);

function ordenar(key: PlatformClubSortKey) {
  setOrdem(atual => atual?.key !== key
    ? { key, dir: 1 }
    : atual.dir === 1 ? { key, dir: -1 } : null);
}

// Recebem os mesmos clubes, já filtrados e ordenados pela tela.
<PlatformClubCards clubes={clubesVisiveis}/>
<PlatformClubTable clubes={clubesVisiveis} ordem={ordem} onSort={ordenar}/>
```

- Os dados usam `ClubeResumo`, o contrato já existente da API.
- A tabela informa a direção de ordenação ao leitor de tela e mantém os botões de cabeçalho acessíveis por teclado.
- A tela controla busca, filtros, ordenação e estado vazio; os componentes não fazem consultas nem alteram os dados recebidos.
- Ambos preservam os links para `/clubes/:id`.
- `PlatformClubCard` também pode ser usado individualmente.
- `PlatformSummaryCard` é a composição compartilhada dos cards da Visão global e dos SUBs do Paulista. Recebe `icon`, `title`, `subtitle`, `status` e `metrics` (`{ label, value }[]`). Use `to` para navegação por link ou `onClick` para uma ação; `label` identifica o card para leitores de tela. A superfície, o hover e a distribuição das informações permanecem compartilhados.
- `PlatformClubOption` usa a mesma superfície, o escudo e o hover dos cards, em uma opção compacta com radio nativo. Recebe `clube`, `name` (grupo), `checked`, `onSelect` e `disabled`.
- As colunas respondem à largura do container `desktop-content`, acompanhando o espaço disponível com a sidebar expandida ou recolhida.
