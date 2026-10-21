# Handover técnico — interface e clubes representados

Data: 20/10/2026. Repositório: `C:\Users\CoquinhaGelada\Desktop\Ludora`. Branch: `develop`. Base inspecionada: `38e03e5`.
Alterações locais, sem commit ou push nesta entrega.

## 1. Resultado e limites

- Times agrupados pelo clube representado ou pelo nome sem o sufixo de sub. “Estrela Azul sub-7” e “Estrela Azul sub-14” aparecem em um grupo.
- Colunas independentes: expandir um cartão desloca somente os cartões abaixo, na mesma coluna. Cartões ocupam a largura da sua coluna.
- Jogadores mostram cinco por categoria, com expansão individual e botão compartilhado.
- Aparência compacta no login e na navegação; filtros e modos de visualização reutilizados em Times, Jogadores, Scout, Partidas e Competições.
- Visão geral por fase/sub, partida ao vivo em destaque, últimos cinco resultados pela perspectiva do clube, agenda e preparação de escalação quando aplicável.
- Scout separado por sub, identidade do atleta, estatísticas e avaliação disponível. Ausência de avaliação não vira nota zero.
- Sino com avisos reais da API; consultas a cada 30 segundos enquanto a página está visível.
- Pessoas e acessos: administrador atribui cargos e categorias a membros do próprio clube.
- Vínculo explícito de time a clube: API com auditoria e reversão. Preserva IDs de times, partidas e eventos.
- Histórico compartilhado é consultável pelo clube representado; edição continua com o clube que registrou a partida.
- Mobile: cabeçalho/carrossel menores, centralização vertical e respiro abaixo dos subs. Filtros de jogos dentro da rolagem.

**Não chamar esta entrega de desktop pronto.** `apps/desktop` continua contendo apenas sua documentação. O painel global da empresa, a tela para vincular/desvincular clubes, pagamentos, integração federativa e cargos personalizados continuam futuros.

**Limitação Android:** tipagem e testes de regras passaram, mas não foi possível confirmar visualmente esta versão no emulador. Expo Go exibiu erro com o Metro existente configurado para development client. A tentativa de iniciar um servidor Expo Go separado foi rejeitada pela revisão automática da ferramenta com “blocked by policy”, sem motivo específico. A alteração de layout não deve ser apresentada como validada no S23.

## 2. Mapeamento dos arquivos

Caminhos abaixo relativos à raiz indicada acima. “Novo” significa arquivo ainda não rastreado antes desta entrega.

### Web

| Arquivos | Estado e propósito |
|---|---|
| `apps/web/src/components/BlockColumns.tsx`, `BlockColumns.css` | Novos. ResizeObserver calcula a quantidade de colunas; cada coluna é uma pilha independente. CSS de títulos e categorias compartilhados. |
| `apps/web/src/components/CollectionControls.css` | Modificado. Centraliza filtros, botão de expansão e alternância Blocos/Lista; elimina regras concorrentes. |
| `apps/web/src/components/ThemeToggle.tsx`, `ThemeToggle.css` | Novos. Controle compacto Claro/Escuro reutilizado. |
| `apps/web/src/components/Notifications.tsx`, `Notifications.css` | Novos. Sino, contador, leitura individual/todas e navegação para a partida. |
| `apps/web/src/components/AuthShell.tsx` | Tema no login e linguagem de futsal. |
| `apps/web/src/components/Layout.tsx`, `Layout.css` | Integra tema, sino, acesso administrativo e identificação de demonstração. |
| `apps/web/src/components/MatchCard.tsx` | Rótulo “Acompanhar ao vivo”. |
| `apps/web/src/components/UI.tsx` | Rótulos Visitante e Olheiro. |
| `apps/web/src/main.tsx` | Carrega o CSS global antes dos componentes. |
| `apps/web/src/App.tsx` | Rota de Pessoas e acessos. |
| `apps/web/src/pages/Times.tsx`, `Times.css` | Agrupamento, expansão, selo de clube, brasão, confirmação de visita e colunas independentes. Busca/ordem usam o nome representado. |
| `apps/web/src/utils/teamIdentity.ts` | Novo. Normaliza nomes e remove somente o sufixo de sub; não altera os registros do banco. |
| `apps/web/src/pages/Jogadores.tsx`, `Jogadores.css` | Cinco alunos por sub, expansão isolada e linhas mais compactas. |
| `apps/web/src/pages/Dashboard.tsx`, `Dashboard.css` | Organização por categoria, momento V/E/D, destaque ao vivo, agenda e preparação. |
| `apps/web/src/pages/Elenco.tsx`, `Elenco.css` | Subs em ordem numérica, filtros e cards de scout organizados. |
| `apps/web/src/pages/Partidas.tsx` | Filtro de adversário, colunas, exclusão no site; categoria escolhida antes dos times, competição filtrada por fase. |
| `apps/web/src/pages/PartidaDetalhe.tsx` | Histórico compartilhado somente leitura; nomes dos eventos e escalação publicada; assinatura de atualizações do clube de origem. |
| `apps/web/src/pages/Competicoes.tsx`, `Competicoes.css` | CSS novo e página atualizada: filtros, cards/lista e confirmação interna de exclusão. |
| `apps/web/src/pages/Membros.tsx`, `Membros.css` | Novos. Pesquisa, cargo, escopo por categoria e confirmação de alteração. |
| `apps/web/src/services/api.ts` | Tipos do vínculo/histórico, jogador do evento e helper de requisição JSON. |
| `apps/web/src/services/matchRealtime.ts` | Escuta também alterações gerais da partida, além de placar/eventos. |

### API e banco

| Arquivos | Estado e propósito |
|---|---|
| `services/api/prisma/schema.prisma` | OLHEIRO, relação Time → Clube representado e auditoria do vínculo. |
| `services/api/prisma/migrations/20261020120000_clubes_representados_olheiro/migration.sql` | Nova migração aditiva aplicada ao banco configurado. |
| `services/api/prisma/seed-clubes.cjs` | Nova seed incremental de demonstração, com prévia por padrão. |
| `services/api/prisma/seed.ts` | Inclui OLHEIRO na ordenação de papéis para manter compatibilidade de tipos. Não foi executada a seed antiga. |
| `services/api/src/app.ts` | Registra rotas de membros e vínculo antes das rotas genéricas de cadastro. |
| `services/api/src/modules/clubes/membros.rules.ts` | Novo. Valida cargo e categorias antes da transação. |
| `services/api/src/modules/clubes/membros.routes.ts` | Novo. Lista membros e altera cargos com escopo de clube e revalidação do administrador na transação. |
| `services/api/src/modules/clubes/vinculo-time.routes.ts` | Novo. Vínculo/desvínculo com administração dos clubes envolvidos e trilha de auditoria. |
| `services/api/src/modules/clubes/clube.routes.ts` | Olheiro pode deixar de seguir, como visitante. |
| `services/api/src/modules/cadastros/cadastro.routes.ts` | Respostas dos times incluem a identidade do clube representado. |
| `services/api/src/middlewares/permissoes.middleware.ts` | Olheiro com leitura pública, sem escrita; leitura de partidas compartilhadas. |
| `services/api/src/modules/partidas/visibilidade.ts` | Novo. Escopo de leitura, perspectiva de mando, identidade atual e indicação de somente leitura. |
| `services/api/src/modules/partidas/partidas-lista.service.ts` | Consulta partidas próprias/representadas e relaciona categorias por faixa etária. |
| `services/api/src/modules/partidas/partida.routes.ts` | Detalhe devolve perspectiva e identidade do clube representado. |

### Mobile

| Arquivos | Propósito |
|---|---|
| `apps/mobile/src/components/CarrosselSubs.tsx` | Botão Iniciação/Base com altura mínima 36 e alinhamento central; margem entre controles e espaço de 14 abaixo. |
| `apps/mobile/src/components/Header.tsx`, `apps/mobile/src/styles/headerStyles.ts` | Reduz espaços fixos preservando os controles. |
| `apps/mobile/app/(tabs)/jogos/jogos.tsx` | Filtros roláveis; não oferece edição de partida compartilhada. |
| `apps/mobile/app/(tabs)/index.tsx` | Detalhes compartilhados abrem sem acesso de edição. |
| `apps/mobile/src/components/HomeCategoria.tsx`, `apps/mobile/src/utils/resumoPartidas.ts` | Reconhecem somente leitura e não oferecem preparar/iniciar nesse caso. |
| `apps/mobile/src/components/DetalhesPartida.tsx`, `apps/mobile/src/hooks/usePartidaTempoReal.ts` | Socket acompanha o clube de origem; consulta HTTP mantém o clube ativo para preservar a perspectiva correta. |
| `apps/mobile/src/contexts/ClubeAtivoContext.tsx`, `apps/mobile/src/utils/identidadeHeader.ts` | Tipagem/rótulo de olheiro sem incluí-lo nos gestores. |
| `apps/mobile/src/services/api.ts` | Apenas acréscimo de OLHEIRO ao tipo nesta continuação. A resolução prévia do conflito em BASE_URL já estava localmente e foi preservada. |

### Testes e documentação

| Arquivos | Propósito |
|---|---|
| `services/api/tests/membros.test.ts` | Novo. Cargos, perspectiva, preservação de identidade e IDs. |
| `services/api/tests/acessosClubes.http.test.ts` | Novo. HTTP/JWT/middleware reais; Prisma substituído por adaptador em memória, sem acessar o Supabase. |
| `services/api/tests/partidasLista.test.ts` | Contrato atualizado da lista/visibilidade por faixa etária. |
| `apps/mobile/tests/home.test.ts` | Regressão: gestor não inicia partida somente leitura. |
| `apps/web/tests/teamIdentity.test.mjs` | Novo. Agrupamento de nomes legados sem confundir nomes diferentes. |
| `apps/web/tests/visual-smoke.cjs` | Novo. Navegação, temas, geometria, filtros, modais, notificações e responsividade. |
| `apps/web/tests/visual-fixture.cjs` | Novo. Respostas fictícias somente no navegador do teste, sem banco. |
| `apps/web/tests/api-demo-smoke.cjs` | Novo. Quatro contas/cargos contra API local real, consultas e tentativas que devem ser negadas. |
| `.gitignore` | Ignora credenciais locais e capturas dos testes. |
| `README.md` | Corrige estado do web, documenta olheiro e operação da demonstração. |
| Este documento | Mapeamento, decisões, evidências, limites e roteiro de estudo. |

## 3. Regras e fluxo

### Representar um clube sem reescrever o histórico

Um Time continua sendo a equipe de uma categoria cadastrada pelo clube organizador. O campo opcional `clube_representado_id` informa que aquela equipe representa um clube real do Ludora.

O vínculo não troca IDs, não copia partidas e não une automaticamente registros por semelhança de nome. Quando existente, a identidade pública passa a usar nome/brasão do clube representado. Desfazer o vínculo recupera a identidade local que permaneceu gravada no Time.

`PATCH /times/vinculo` recebe:

~~~json
{"time_ids":[20,21],"clube_id":3,"motivo":"Clube confirmado pelo administrador"}
~~~

Para desfazer, usar os mesmos IDs, `clube_id: null` e motivo. IDs acima são exemplos; consultar os reais antes de chamar.

Até existir um administrador global da empresa, a API exige administração do clube de origem e de todos os clubes anterior/novo envolvidos. Não basta ser administrador do Ocian para declarar que uma equipe pertence ao Santos. A futura tela desktop deverá mostrar uma prévia dos subs, clubes e históricos afetados e permitir a reversão explícita.

Auditoria guarda time, clube anterior, clube novo, autor e motivo. Não há FK na tabela de auditoria para que exclusões futuras não apaguem a identificação histórica.

Partidas visíveis: registradas pelo clube ativo OU com mandante/visitante representando esse clube. Partidas de outro organizador retornam `somente_leitura: true`. A API mantém a barreira de escrita por clube/categoria; esconder botões é somente a parte de interface.

O placar de uma partida compartilhada é interpretado pela perspectiva do clube que a consulta. Os sockets ouvem o clube de origem; as consultas HTTP continuam levando o clube ativo.

**Limite do modelo:** adicionar posteriormente jogadores/eventos dos dois clubes à mesma partida ainda exige definir lado/equipe na escalação e nos eventos. O modelo atual de escalação possui unicidade de camisa por partida, e não por equipe. Não foi liberada edição conjunta sem resolver isso.

### Cargos por clube

| Cargo | Comportamento implementado |
|---|---|
| Visitante / TORCEDOR | Consulta pública. |
| OLHEIRO | Consulta pública com identificação de função. Ainda não tem relatórios privados extras. |
| TECNICO / MESARIO | Gestão nas categorias atribuídas ou em todas, conforme configuração. |
| ADMIN | Gestão do clube e dos acessos. Não pode alterar o próprio cargo nessa tela. |

`GET /membros` e `PATCH /membros/:id` exigem ADMIN. A lista expõe nome, ID e escopo, sem e-mail ou senha. Mudanças de cargo substituem as categorias em uma transação serializável. O administrador é verificado novamente dentro da transação, para considerar mudanças concorrentes de permissão.

### Layout

O layout anterior usava uma grade com linhas compartilhadas. `align-items: start` evita esticar o cartão vizinho, mas não impede a próxima linha inteira de descer.

Agora há uma grade de **colunas** e uma pilha flexível em cada coluna. A distribuição é estável por índice enquanto a largura não muda. Ao mudar largura ou filtro, os itens podem mudar de coluna. A ordem de foco/leitura acompanha as colunas; o modo Lista oferece uma sequência única.

## 4. Antes e depois explicados

Trechos simplificados para destacar a decisão; consultar os arquivos para a implementação integral.

### Expansão

Antes:

~~~tsx
<div className="alunos-grid">
  {categories.map(renderCategory)}
</div>
~~~

Depois:

~~~tsx
const columns = Array.from({ length: count }, () => []);
Children.toArray(children).forEach((child, index) => {
  columns[index % columns.length].push(child);
});
~~~

`%` calcula o resto da divisão: distribui os cartões alternadamente. Cada array é renderizado em uma coluna independente. O estado `expanded` guarda IDs de categorias, permitindo abrir uma sem abrir as outras.

~~~tsx
expanded.includes(categoryId) ? players : players.slice(0, 5)
~~~

`slice` cria a lista visível sem remover jogadores da lista original.

### Identidade dos times

Antes: agrupamento pelo nome completo, incluindo “sub-7”.

Depois:

~~~ts
const key = team.clube_representado_id
  ? `club:${team.clube_representado_id}`
  : teamKey(team.nome);
~~~

Um clube confirmado usa ID; um adversário sem vínculo usa nome normalizado apenas para apresentação. Igualdade de nome não concede propriedade ou acesso.

### Partidas compartilhadas

Antes:

~~~ts
where: { categoria: { clube_id: clubeId } }
~~~

Depois:

~~~ts
where: {
  OR: [
    { categoria: { clube_id: clubeId } },
    { mandante: { clube_representado_id: clubeId } },
    { visitante: { clube_representado_id: clubeId } }
  ]
}
~~~

`OR` significa que qualquer condição permite encontrar a partida. Isso é escopo de consulta; as rotas de escrita continuam exigindo o clube organizador.

### Permissão no cliente

Antes:

~~~tsx
isAdmin={podeGerenciar}
~~~

Depois:

~~~tsx
isAdmin={podeGerenciar && !partidaSelecionada.somente_leitura}
~~~

`&&` exige as duas condições; `!` inverte somente leitura. A validação correspondente permanece no servidor, pois o usuário pode chamar a API fora da interface.

### Centralização no mobile

Antes: espaçamento reduzido sem centralização vertical explícita no botão.

Depois:

~~~ts
tipoSwitchBtn: {
  flex: 1,
  minHeight: 36,
  justifyContent: 'center',
  paddingVertical: 4,
  alignItems: 'center',
}
~~~

No eixo vertical desse componente, `justifyContent` centraliza; `alignItems` centraliza no eixo horizontal. `minHeight` permite crescer se o texto precisar. Ainda requer avaliação visual com tamanho de fonte real do aparelho.

### Cargos

Antes: não havia edição de cargos no web.

Depois:

~~~ts
await prisma.$transaction(async tx => {
  // Revalidar administrador e conferir membro/categorias do clube.
  await tx.usuarioClubeCategoria.deleteMany({
    where: { usuario_clube_id: id }
  });
  await tx.usuarioClube.update({
    where: { id },
    data: {
      papel: input.papel,
      acesso_todas_categorias: input.acessoTotal,
      categorias: { create: input.ids.map(categoria_id => ({ categoria_id })) }
    }
  });
}, { isolationLevel: 'Serializable' });
~~~

A transação evita salvar metade da mudança. `map` transforma IDs em objetos de relacionamento; não concede acesso sem as verificações anteriores.

## 5. Banco e demonstração executada

Migração aditiva aplicada e Prisma Client regenerado. Seed incremental executada no banco configurado do projeto:

- Clube 2: antigo Ludora FC → Ocian.
- Clube 3: Jefferson → Santos.
- Clube 4: novo Ludora FC.
- Resultado da execução: **192 partidas novas e 384 jogadores novos**.
- 12 contas demo: ADMIN, visitante, técnico e olheiro para cada clube.
- Competições próprias dos clubes, com prefixo `[DEMO]`, seguidores e avisos internos de demonstração.
- Os registros esportivos preexistentes foram preservados; por isso os totais exibidos podem ser maiores.
- Novos jogadores têm nomes fictícios em inglês, CPFs sintéticos, camisa vazia e nenhuma nota de IA inventada.
- A seed não envia e-mails ou push. Avisos internos ficam identificados como demonstração.
- A seed avança sequências de IDs se houver registros inseridos manualmente à frente do contador.
- Credenciais: `.local-demo/contas.json`, ignorado pelo Git. Não copiar para README ou commit.
- `.local-demo/clubes-antes-*.json` guarda somente identificação anterior dos clubes; **não é backup completo do banco**.

A seed usa chaves e marcadores para evitar duplicações e não troca senhas existentes. Reexecução completa de idempotência não foi validada nesta entrega. Não reaplicar apenas para abrir o sistema.

Reverter arquivos Git não desfaz migração ou seed. A reversão de vínculo é diferente de remover todos os dados demo.

## 6. Verificações e evidências

| Verificação | Resultado |
|---|---|
| API: TypeScript/build | Passou |
| Web: TypeScript + Vite build | Passou |
| Mobile: TypeScript sem emissão | Passou |
| `pnpm test:app` | **120 testes passaram**, incluindo a suíte existente e novos testes de permissões |
| `node --test apps/web/tests/*.test.mjs` | **9 testes passaram** |
| Navegador Edge/Playwright com fixture | Passou; inclui partida compartilhada, nomes de eventos e ausência de edição |
| Navegador Edge/Playwright com API real | Passou; login, navegação, filtros, temas, colunas, cinco jogadores, confirmação interna e notificações |
| API real com quatro contas/cargos demo | Passou; acesso administrativo restrito e escrita negada no histórico adversário |
| Capturas 1440×1000 e largura 390 px | Revisadas; sem overflow horizontal do documento nas seis telas verificadas |
| `git diff --check` | Passou; apenas avisos de normalização LF/CRLF |
| Renderização Android/S23 | **Pendente**, não confundir com o teste responsivo do navegador |

As 129 verificações automatizadas não representam 129 fluxos ponta a ponta. A suíte contém testes de regras, serviços e HTTP com persistência substituída. Os dois smoke tests “API real” são evidência adicional de integração local.

Durante as verificações houve falhas transitórias de conexão com Supabase. A execução final com API real passou. Isso não comprova disponibilidade contínua do serviço.

Capturas locais em `test-results/real-api/` e `test-results/fixture/`, ignoradas pelo Git. A segunda pasta usa somente dados de teste interceptados; não é evidência de persistência.

Avisos existentes: Vite CJS deprecated e Node MODULE_TYPELESS_PACKAGE_JSON nos testes do web. Não impediram compilação ou execução.

### Reproduzir

Na raiz:

~~~powershell
pnpm --filter @ludora/api build
pnpm --filter @ludora/web build
pnpm --filter @ludora/mobile exec tsc --noEmit
pnpm test:app
node --test apps/web/tests/*.test.mjs
~~~

Com API em 3000 e Vite em 5173, e Playwright disponível no ambiente Node:

~~~powershell
node apps/web/tests/visual-smoke.cjs --fixture
node apps/web/tests/visual-smoke.cjs
node apps/web/tests/api-demo-smoke.cjs
~~~

Nesta máquina o Playwright foi usado pelo runtime empacotado do Codex via `NODE_PATH`. Ele não foi adicionado como dependência do repositório. O runner usa Edge instalado.

A API local foi reiniciada com o build atual, mantendo `ATUALIZACAO_TEMPORADA=false` apenas no processo de teste; nenhum arquivo de ambiente foi reescrito. Vite existente foi reutilizado. Não iniciar outra API na mesma porta se ela já estiver ativa.

## 7. Próximas decisões

1. Validar no Android o carrossel, centralização com fonte ampliada e espaçamento de filtros. Corrigir a configuração Expo Go/development client antes de julgar o layout.
2. Desktop: modelar administrador global da empresa separado de ADMIN de clube. Depois criar tela de clubes-clientes, cadastro do responsável, convite e vínculo revisável dos times preexistentes.
3. Mostrar prévia antes de vincular: clubes de origem, subs, quantidade de partidas e clubes afetados. Oferecer desfazer com motivo/auditoria; sem união automática por nome.
4. Definir eventos/escalações por lado antes de liberar complementação dos dois clubes na mesma partida.
5. Separar permissão de leitura privada do rótulo “olheiro”, caso haja relatórios privados; não transformar o cargo em acesso irrestrito.
6. Cadastro público web ainda precisa acompanhar o contrato de confirmação por código descrito no README. Esta entrega testou login de contas existentes e demo.
7. Calendário de federação e cobrança continuam separados desta entrega.

## 8. Prompt para novo chat

> Estou aprendendo programação e trabalho no Ludora, monorepo TypeScript com React/Vite no web, React Native/Expo no mobile, Express/Prisma e PostgreSQL/Supabase na API. Leia docs/handover-clubes-interface-2026-10-20.md e confira os arquivos atuais na branch develop antes de explicar. Não presuma que o desktop/Electron ou os itens pendentes estão implementados.
>
> Ensine do zero, passo a passo, as decisões deste handover: componentes e props, useState/useEffect e cleanup, ResizeObserver e colunas independentes, arrays/map/filter/slice e operador %, normalização de nomes, cargos por clube, autenticação versus autorização, transações Prisma, FK opcional e auditoria, perspectiva de placar e sockets. Use exemplos pequenos novos em inglês, preservando as convenções do projeto, e conecte cada exemplo ao trecho real.
>
> Para cada tema, explique primeiro o problema, depois o antes/depois, depois cada parte da sintaxe e como o teste verifica o comportamento. Diferencie testes com banco substituído, dados controlados no navegador e testes com API real. Não faça alterações nem execute seed enquanto estiver apenas me ensinando. Não exponha credenciais. Explique os limites de histórico compartilhado e por que um vínculo não deve conceder edição. Avance em blocos curtos sem me bloquear com exercícios a cada passo.

