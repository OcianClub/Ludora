# Controles comuns do mobile

A referência visual é a barra de busca do Scout. Jogos, Scout, Clubes, solicitações e os seletores de partida reutilizam estes componentes conforme a função de cada controle.

- `SearchField`: busca controlada com lupa, limpar busca, foco na borda inteira e encaminhamento de ref para o campo.
- `IconButton`: ação de 40 px, raio de 8 px, área de toque complementar, rótulo acessível obrigatório, contador ou indicador opcional. Em uma linha com busca, acompanha a altura do campo.
- Ao usar `arrow-left` no `IconButton`, o controle segue o voltar do cadastro: 42 px, raio de 10 px, fundo de card e borda sutil. O modo `ghost` dos demais ícones mantém a área de toque sem moldura.
- `AppButton`: ações primária, secundária, discreta e destrutiva, com estados ocupado/desabilitado. Chevron de avanço fica à direita.
- `AppSheet`: modal por baixo, limite de largura/altura, área segura, conteúdo com rolagem interna, cabeçalho e ações separados. Usado pelos filtros de Jogos, Scout e Solicitações, e pelos seletores do Scout.
- `ModalHeader`: cabeçalho reutilizável também nos diálogos especializados de preparação, súmula e organização. Esses diálogos mantêm seu tratamento próprio de teclado, dados e fechamento.
- `createFilterStyles`: chips compactos e mesmo estado selecionado nos três filtros.

Cores e tipografia vêm dos tokens e de `ThemeContext`. Ao criar novas buscas/filtros, prefira estes componentes a copiar estilos locais. Não substitua os callbacks de fechar/salvar: eles podem validar alterações pendentes ou publicação de eventos.

## Validação de 05/11/2026

TypeScript sem erros; 178 testes existentes passando; verificações de interface com os componentes React Native renderizados no navegador em 320, 360, 412 e 768 px, temas claro e escuro. Verificados altura/alinhamento de busca e ícones, limpar busca, aplicar/limpar/fechar filtros e seletor de ordenação dentro do modal do Scout. Também verificados fluxos do Scout, súmula e substituições com dados simulados.

A componentização reduz estilos duplicados e facilita manter consistência. Não foi medida melhoria de tempo de resposta decorrente desta mudança. A validação em navegador não substitui a revisão de teclado, área segura e gestos num dispositivo Android/iOS real.
