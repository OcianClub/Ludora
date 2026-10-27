# Handover técnico — jogadores, partidas e categorias

> A navegação mobile e os ícones foram alterados posteriormente. Para o estado atual desses dois itens, leia [spring dos SUBs e ícones](2026-10-27-sub-spring-position-icons.md).

Data: 27/10/2026. Branch utilizada: `develop`. Base conferida: `7c2c538` (`pronto jeff`). Este relatório inclui a conclusão das alterações locais da etapa anterior. Nenhuma branch, commit ou push foi criado.

## 1. Resultado e regras

### Jogadores

- Categorias começam fechadas. A URL guarda os SUBs abertos, fase, busca, filtros, ordenação e visualização.
- A API envia primeiro o resumo real de quantidades. Abrir um SUB consulta cinco atletas. `Mostrar mais` consulta os demais em páginas de até 100 registros.
- Respostas atrasadas são descartadas quando muda o clube ou o filtro. Falha na API apresenta recuperação; contrato antigo não vira um contador zero silencioso.
- A linha mostra camisa, nome, SVG da posição, posição por escrito, idade cronológica, partidas e acesso ao perfil. Foram retirados Editar, Excluir e o aviso sobre nascimento.
- Partidas na linha contam IDs distintos de escalações ou eventos do atleta, dentro do clube. Uma partida com vários eventos conta uma vez.
- A idade exibida considera o aniversário. A categoria esportiva continua seguindo a idade da temporada; são cálculos diferentes.
- Os ícones são SVGs escritos no projeto. Goleiro usa duas luvas sobrepostas em amarelo; as demais posições usam formas sólidas neutras.

### Perfil e histórico aprovados

Rotas web:

```
/jogadores/:id
/jogadores/:id/partidas?pagina=1&status=FINALIZADA
/jogadores/:id/campeonatos?pagina=1&ano=2026
```

O perfil mostra foto ou avatar, informações do atleta, três partidas e três campeonatos. Os históricos usam páginas de 20 registros e permitem abrir detalhes das partidas. Campeonatos são derivados de inscrição ou participação real, e não de todo o calendário do clube.

Links usam React Router. O botão voltar do navegador recupera a URL anterior; ao retornar à lista, os SUBs abertos e os filtros são recuperados. Os atletas são consultados novamente, começando pelos cinco primeiros.

Edição reutiliza as regras transacionais de categoria e conflito de camisa. Foto, nome, nascimento, posição e camisa são editáveis. A foto enviada é reduzida no navegador para até 384 pixels e convertida em JPEG. O limite de conteúdo persistido é 180.000 caracteres. Esta versão armazena a imagem compactada no banco; um serviço de arquivos é a evolução adequada para maior volume.

CPF:

- Administrador e técnico com acesso à categoria podem receber o campo no endpoint de perfil.
- Mesário, olheiro e visitante não recebem CPF nessa resposta.
- O formulário é somente leitura e o backend rejeita a tentativa de alterar o CPF existente.
- As respostas de criação/edição não devolvem CPF. A autorização não depende de esconder elementos no React.

### Nova partida e sede

- O confronto exige exatamente um time vinculado ao clube ativo. O vínculo é pelo ID `clube_representado_id`; nomes iguais não comprovam que o time é do clube.
- Escolher adversário como mandante coloca o próprio clube como visitante e define Fora. Inverter o mando preserva o adversário.
- O backend recalcula `emCasa` em POST e PATCH, mesmo se o cliente mandar um valor incompatível.
- O seletor mantém escudo e nome; `Clube Ludora` aparece em azul. Check significa apenas seleção. O próprio clube vem primeiro, seguido de clubes vinculados e adversários genéricos.
- Calendário segue o tema. Horário é digitado: `1945` → `19:45`, `0830` → `08:30`. São aceitos quatro dígitos e horários de 00:00 a 23:59; a API também valida o intervalo.
- Sugestões de local priorizam sede própria, sedes Ludora, locais já utilizados e Google, quando habilitado. Busca externa tem atraso de 300 ms no frontend, cancelamento e timeout de quatro segundos no backend. Falha na sugestão não impede digitação manual nem deixa aviso permanente.
- `/clube` mostra escudo, nome e endereço estruturado. O nome do clube no cabeçalho abre esse perfil; Trocar clube continua disponível no botão próprio. Apenas ADMIN pode salvar o perfil da sede.
- O endereço contém logradouro, número, complemento, bairro, cidade, UF e CEP. Registros antigos podem permanecer sem endereço.

Google Places está preparado, mas não foi habilitado nem validado com uma conta real. A variável é `GOOGLE_PLACES_API_KEY`, somente no backend. A integração usa Autocomplete (New), documentado em [Google Places](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete). A ativação também deve considerar atribuição e políticas descritas na [documentação oficial](https://developers.google.com/maps/documentation/places/web-service/policies). Resultados de teste usaram um provedor falso, sem cobranças ou chamadas externas.

### Categorias mobile

O código encontrado já usava `PagerView` com `onPageScroll`/Reanimated; o seletor dos SUBs era um track com `PanResponder`, não uma FlatList.

Foi mantido o PagerView. A translação e a decisão de concluir ou reverter o gesto permanecem nativas e consideram o gesto recebido pelo componente. A página de saída reduz até 0,9, a de entrada parte de aproximadamente 0,8 e ambas variam opacidade. Na acomodação, escala e opacidade usam `withSpring`. Movimento reduzido é respeitado.

O seletor agora usa `Animated.FlatList`, centralizada por `scrollTo` no thread de UI. Seu gesto usa projeção de distância/velocidade e spring. O mesmo progresso acompanha Home, Jogos e Scout. Antes de um salto entre SUBs, as páginas intermediárias são preparadas para diminuir a possibilidade de páginas vazias durante a animação.

**Limite técnico:** a curva de translação do PagerView não foi substituída por um spring próprio; ela continua sendo a implementação nativa. Não foi criado um pager com Pan Gesture. Nenhum aparelho/emulador estava conectado ao ADB, portanto o resultado visual nativo e a eliminação do piscar ainda exigem teste no dispositivo. Typecheck e regras de snap passaram; isso não substitui validação visual Android/iOS.

## 2. Mapeamento dos arquivos

Os caminhos abaixo partem da raiz do repositório.

| Arquivo | Propósito da alteração |
|---|---|
| `apps/web/src/App.tsx` | Rotas do atleta, históricos e clube; camada global de tooltip. |
| `apps/web/src/pages/Jogadores.tsx` | Resumo, carregamento por SUB, URL, linhas compactas e links do perfil. |
| `apps/web/src/pages/Jogadores.css` | Título maior, linha com estatísticas e botão de abertura. |
| `apps/web/src/pages/JogadorPerfil.tsx` | Novo perfil, prévias e duas telas de histórico. |
| `apps/web/src/pages/JogadorPerfil.css` | Layout responsivo do perfil, dados e históricos. |
| `apps/web/src/components/PlayerEditDialog.tsx` | Edição, compactação da foto, previsão de categoria e confirmação de camisa. |
| `apps/web/src/pages/ClubePerfil.tsx` | Perfil do clube e formulário da sede. |
| `apps/web/src/components/Layout.tsx` | Link do cabeçalho para o perfil do clube. |
| `apps/web/src/components/PositionGlyph.tsx` | SVGs sólidos de posições. |
| `apps/web/src/components/CollectionControls.tsx` e `.css` | Posição com ícone/tooltip e seletor com rótulo; retirada das classes coloridas antigas. |
| `apps/web/src/components/Tooltip.tsx` e `.css` | Dicas por hover e foco, descrição acessível, Escape e uso em modais. Botões/links com `aria-label` são atendidos globalmente. |
| `apps/web/src/utils/playerAge.ts` | Idade cronológica na listagem e no perfil. |
| `apps/web/src/services/api.ts` | Campo opcional de foto no contrato de edição. |
| `apps/web/src/pages/Partidas.tsx` | Mando automático, lista de times, calendário, horário e local. |
| `apps/web/src/pages/ScheduleCreate.css` | Estado de mando calculado e seleção azul. |
| `apps/web/src/components/MatchEditors.tsx` | Mesmas regras de confronto, local, data e horário na edição. |
| `apps/web/src/utils/matchTeams.ts` | Seleção e inversão dos lados sem duplicar o time próprio. |
| `apps/web/src/utils/timeInput.ts` | Máscara e validação do horário. |
| `apps/web/src/components/MatchDateTime.tsx` e `.css` | Calendário do tema e campo numérico de horário. |
| `apps/web/src/components/LocationInput.tsx` e `.css` | Combobox com sugestões canceláveis, teclado e entrada manual. |
| `apps/web/src/components/HomeCategories.tsx` e `.css` | Arraste livre, encaixe, wheel, setas e teclado no seletor web. |
| `apps/web/src/components/HomeSwipeSurface.tsx` | Evita que o gesto da página concorra com o gesto do seletor. |
| `services/api/prisma/schema.prisma` | `Jogador.foto` opcional e `Clube.endereco` JSON opcional. |
| `services/api/prisma/migrations/20261027120000_perfil_jogador_sede_clube/migration.sql` | Adição das duas colunas, sem substituir tabelas ou registros. |
| `services/api/src/app.ts` | Registro dos novos endpoints. |
| `services/api/src/modules/jogadores/perfil.routes.ts` | Perfil e históricos com escopo do clube, autorização e paginação. |
| `services/api/src/modules/jogadores/jogador.routes.ts` | Resumo, filtros, páginas e retirada de CPF das respostas de escrita. |
| `services/api/src/modules/jogadores/participacoes.ts` | Uma consulta parametrizada para partidas distintas de vários atletas. |
| `services/api/src/modules/jogadores/elenco.service.ts` | Persistência da foto e bloqueio de alteração de CPF, mantendo transações. |
| `services/api/src/modules/clubes/endereco.ts` | Validação e formatação do endereço estruturado. |
| `services/api/src/modules/clubes/perfil-clube.routes.ts` | Consulta da sede e edição exclusiva de administrador. |
| `services/api/src/modules/partidas/locais.routes.ts` | Sugestões locais e adaptador opcional do Places. |
| `services/api/src/modules/partidas/mando.ts` | Regra de presença do próprio clube e cálculo de mando. |
| `services/api/src/modules/partidas/partida.routes.ts` | Validação de mando e horário na criação/edição. |
| `services/api/src/middlewares/rate-limit.middleware.ts` | Limite de chamadas ao autocomplete. |
| `services/api/src/utils/foto.ts` | Formatos permitidos e limite da imagem. |
| `services/api/.env.example` | Variável opcional do Google e origem do preview na porta 4173, sem credenciais. |
| `services/api/.env` (local, ignorado pelo Git) | Adicionadas as origens localhost/127.0.0.1 da porta 4173 ao CORS existente. Demais variáveis preservadas. |
| `apps/mobile/src/hooks/useCategoryPagerMotion.ts` | Progresso compartilhado e preparação antes da navegação programática. |
| `apps/mobile/src/components/CategoryPageMotion.tsx` | Escala, opacidade, spring e movimento reduzido. |
| `apps/mobile/src/components/CarrosselSubs.tsx` | FlatList animada, centralização e snap do seletor. |
| `apps/mobile/src/utils/categoryMotion.ts` | Decisão de destino por distância/velocidade, com limites. |
| `apps/mobile/app/(tabs)/index.tsx` | Integração da animação na Home. |
| `apps/mobile/app/(tabs)/jogos/jogos.tsx` | Integração da animação em Jogos. |
| `apps/mobile/app/(tabs)/estatisticas/estatisticas.tsx` | Integração da animação no Scout. |
| `apps/mobile/tests/categoryMotion.test.ts` | Snap, retorno e limites. |
| `apps/web/tests/playerInteractions.test.mjs` | Horário, aniversário, seleção e inversão dos times. |
| `apps/web/tests/interactions-smoke.cjs` | Fluxos completos em temas e tamanhos diferentes. |
| `apps/web/tests/player-states-smoke.cjs` | Vazio, 35 jogadores, erro, recuperação, toque, CPF e upload. |
| `apps/web/tests/visual-fixture.cjs` | Dados HTTP falsos para os novos endpoints e cenários. |
| `services/api/tests/webInteractions.http.test.ts` | HTTP com JWT real, banco substituído, permissões e contratos. |
| `services/api/tests/elenco.test.cjs` | CPF imutável e imagem inválida sem alteração de cadastro. |

## 3. Antes e depois — trechos principais

### Carregamento do elenco

Antes: a página baixava todos os jogadores e cortava a lista em memória.

```ts
Promise.all([fetchJogadores(), fetchCategorias()]);
const visible = players.slice(0, 5);
```

Depois: primeiro vêm os totais; os atletas são pedidos por categoria.

```ts
requestJson(`/jogadores?resumo=true&${query}`);
requestJson(`/jogadores?${query}&categoria_id=${categoryId}&limite=5&offset=0`);
```

`limite` controla quantos registros vêm. `offset` indica quantos registros anteriores pular. O backend mantém os filtros e a autorização nas duas consultas.

### Presença do clube no confronto

Antes: cada lado e o mando podiam ser alterados separadamente.

```ts
setForm(f => ({ ...f, mandante_id: String(team.id) }));
// emCasa vinha da escolha manual.
```

Depois: uma função calcula os dois lados e o mando juntos; a API valida novamente.

```ts
const selection = selectMatchTeam(times, clube.id, categoryId, side, team.id, form);
setForm(f => ({ ...f, ...selection }));
const mando = mandoDoClube(timesValidos, mandanteId, visitanteId, clubeId);
```

O spread `...selection` copia as propriedades calculadas para um novo objeto de estado.

### CPF

Antes: a atualização preservava o CPF existente, mesmo se recebesse outro valor.

```ts
const cpf = atual?.cpf ?? entrada.cpf;
```

Depois: uma tentativa de troca é rejeitada explicitamente.

```ts
if (atual && entrada.cpf !== undefined && entrada.cpf !== atual.cpf) {
  throw new ErroElenco(400, 'O CPF não pode ser alterado.');
}
```

### Horário

Antes: seletor de hora/minuto em modal. Depois: máscara numérica reutilizada em criação e edição.

```ts
const digits = value.replace(/\D/g, '').slice(0, 4);
return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
```

`replace` elimina o que não é número; `slice` limita e separa os quatro dígitos. A máscara não decide se a hora existe: essa verificação é feita separadamente.

### Mobile

Antes: o progresso movia o seletor e o conteúdo não tinha escala/opacidade vinculadas ao gesto.

```ts
progressoPagina.value = event.position + event.offset;
```

Depois: esse mesmo sinal também dirige a apresentação de cada página.

```ts
const distance = Math.min(1, Math.abs(index - progress.value));
const scale = 1 - distance * (outgoing ? .1 : .2);
```

O PagerView já desloca as páginas; aplicar outra translação duplicaria o movimento. O `withSpring` foi usado na acomodação visual e no seletor dos SUBs, preservando a translação nativa do pager.

## 4. Validação e estado operacional

- Build da API e build de produção do web aprovados.
- TypeScript do mobile aprovado.
- **246 testes automatizados aprovados**, incluindo os testes existentes de API, mobile e utilitários web.
- Navegador: 390 e 1366 px, claro/escuro; perfil, edição, histórico, voltar, cinco atletas, restante, drag, wheel, tooltip, data, horário, local, criação e edição de partida.
- Cenários adicionais: 35 atletas, vazio, carregamento, erro/recuperação, resposta de API antiga, toque e teclado; CPF ausente para visitante; upload e persistência simulada da foto.
- Capturas em `test-results/web-interactions/`; dados dessas capturas são demonstração interceptada no navegador. Nenhum desses jogadores foi criado no banco real pelo teste.
- Banco real: migração aplicada e conferência somente de leitura das colunas e dos totais. A migração adicionou campos opcionais; não renomeou clubes nem substituiu elencos.
- Prisma Client regenerado. A API local foi recompilada e reiniciada na porta 3000. CORS de `http://localhost:5173` e `http://localhost:4173` verificado; o preview 4173 estava bloqueado e foi liberado na configuração local.
- Google real, Android/iOS visual e geração de instalador Electron não foram validados nesta entrega.

Comandos de reprodução:

```powershell
pnpm --filter @ludora/api build
pnpm --filter @ludora/web build
pnpm --filter @ludora/mobile exec tsc --noEmit
pnpm test:app:completo
node apps/web/tests/interactions-smoke.cjs
node apps/web/tests/player-states-smoke.cjs
```

Os dois últimos exigem Playwright disponível e o web na porta 5188, ou `LUDORA_WEB_TEST_URL` apontando para outra porta. O projeto não ganhou dependência de Playwright em produção; a validação usou o runtime de testes disponível nesta máquina.

Ao atualizar outra máquina/API, executar `prisma migrate deploy` e `prisma generate` antes de iniciar a versão nova. No banco conectado a esta máquina, a migração já foi aplicada. O Render precisa receber o código atualizado para servir os novos contratos; este trabalho não fez deploy remoto.

## 5. Prompt para novo chat

> Estou aprendendo programação no projeto Ludora. Leia `docs/handovers/2026-10-27-perfis-partidas-categorias.md`, confira a branch develop e os arquivos atuais antes de explicar. Quero aprender do zero, em etapas pequenas, sem criar branch nem alterar código automaticamente: primeiro o fluxo Jogadores → API → banco → resposta → React; depois paginação, estado na URL, permissões e CPF; depois edição, foto e regras de camisa; depois mando e máscara de horário; por último PagerView, SharedValue, worklets, FlatList, scrollTo e withSpring. Para cada etapa explique o propósito do arquivo, as funções, parâmetros, retorno, sintaxe TypeScript/React e a decisão técnica, usando exemplos novos em inglês e explicações em português. Diferencie código testado, dados de demonstração e validação nativa pendente. Não afirme que a animação Android foi verificada, nem que a translação nativa do PagerView usa um spring nosso. Explique os trechos Antes/Depois e só avance depois de eu conseguir acompanhar, sem me impor exercícios a cada passo.
