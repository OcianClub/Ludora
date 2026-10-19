# Handover Técnico — Times, Jogadores e Scout

Data: 19/10/2026. Branch: develop. Entrega local, sem commit ou push.
Este relatório cobre a etapa posterior ao handover-alunos-2026-10-19.md.

## 1. Mapeamento

Caminhos relativos a C:\Users\CoquinhaGelada\Desktop\Ludora.

| Arquivo | Estado nesta etapa | Responsabilidade |
| --- | --- | --- |
| apps/web/src/components/CollectionControls.tsx | Criado | ViewToggle, Choice, ConfirmDelete, PositionBadge e normalização visual das posições. |
| apps/web/src/components/CollectionControls.css | Criado | Filtros, menus, etiquetas, avisos e controles padronizados. |
| apps/web/src/components/BirthDateField.tsx | Criado | Seletor próprio de ano, mês e dia, com limites e dias válidos. |
| apps/web/src/utils/playerForm.ts | Criado | Máscara de CPF, números, nomes e regras de data do formulário. |
| apps/web/tests/playerForm.test.mjs | Criado | Três testes de formato, caracteres e datas. |
| apps/web/src/pages/Times.tsx | Modificado | Agrupamento visual por nome, subs, escudo, filtros, blocos/lista e diálogos. |
| apps/web/src/pages/Times.css | Criado | Cartões e lista com cabeçalho de time e subtítulos dos subs. |
| apps/web/src/pages/Jogadores.tsx | Modificado | Modos, filtros, origem do cadastro, máscara, posições e avisos internos. |
| apps/web/src/pages/Jogadores.css | Modificado | Lista, etiquetas e aviso da categoria calculada. |
| apps/web/src/pages/Elenco.tsx | Modificado | Scout separa identificação, nota de IA e desempenho; inclui ficha de detalhes. |
| apps/web/src/pages/Elenco.css | Modificado | Hierarquia visual do Scout, métricas, blocos/lista e responsividade. |
| apps/web/src/pages/Partidas.tsx | Modificado | Reutiliza ViewToggle, mantendo as regras de agrupamento e ordenação. |
| services/api/src/modules/jogadores/elenco.rules.ts | Modificado | Idade mínima de 4 anos pela temporada. |
| services/api/src/modules/jogadores/elenco.service.ts | Modificado | Validação de caracteres e posições; compatibilidade com nomes antigos de Alas. |
| services/api/tests/elenco.test.cjs | Modificado | Dois testes adicionais para idade mínima e validação da API. |
| docs/cadastro-alunos-temporada.md | Atualizado | Limite de idade atualizado e referência ao novo relatório. |
| docs/handover-visual-2026-10-19.md | Criado | Este relatório e o prompt para estudo. |

Layout.tsx, Layout.css e theme.ts NÃO foram editados nesta etapa. O botão de aparência
alterado pelo usuário foi preservado. Arquivos do mobile, api.ts, server.ts e outros
com modificações da etapa anterior continuam no working tree: o diff global não
representa somente o trabalho desta entrega. Nenhuma migration foi criada/aplicada.

## 2. Resumo do fluxo e decisões

### Times

O banco mantém um registro por time/categoria. A tela agrupa registros pelo nome
normalizado, sem alterar registros nem vínculos de partidas. Blocos abrem os subs
com um clique. Lista mostra o nome destacado com os subs abaixo. Busca, filtro de
categoria e ordem A–Z/Z–A organizam a consulta.

O escudo usa a primeira URL disponível no grupo; se não existir ou não carregar,
o espaço fica vazio. Editar/excluir atua em um sub específico, não no grupo inteiro.
Nomes iguais de entidades diferentes podem ser agrupados: uma identidade de equipe
separada no modelo seria necessária para eliminar essa ambiguidade futuramente.

A exclusão usa diálogo do Ludora. Se a API recusar por partidas vinculadas, o erro
fica no diálogo. Sucesso também aparece no site, sem alert/confirm do navegador.

### Jogadores

Blocos/lista, busca por nome, filtro de posição, com/sem camisa e ordem por nome.
A contagem no cabeçalho de cada sub é o total daquele elenco, não só o filtrado.

Adicionar aluno pelo Sub-16 guarda a origem. A prévia da API informa se a data é
daquele sub ou se o aluno será cadastrado em outro. O botão não força uma categoria
incompatível. O servidor continua recalculando a categoria na gravação.

CPF recebe máscara progressiva 000.000.000-00. Letras e emojis são filtrados. A
máscara não verifica os dígitos verificadores nem a titularidade do CPF. Camisa
aceita somente dígitos, de 1 a 99, ou vazio. Nomes aceitam letras Unicode, acentos,
espaços, apóstrofos e hífens, sem emojis, números ou controles. A API também valida
os campos: não depende apenas do formulário. Não foi aplicado um filtro global a
todos os campos de todas as telas do produto.

Nascimento usa menus próprios de Ano, Mês e Dia. Não abre o calendário nativo.
Trocar mês/ano limpa um dia inexistente: 31 de janeiro não vira silenciosamente
uma data de março ao selecionar fevereiro. Limites: temporada - 18 até temporada
- 4; em 2026, 2008–2022. A idade é pelo ano, não pelos aniversários já completos.

O formulário usa noValidate para exibir os próprios erros em vez dos balões do
navegador. Isso não remove validação no backend. Nome ausente, CPF incompleto,
camisa inválida, erros da API e sucesso são apresentados dentro da página.

### Posições

Goleiro, Fixo, Pivô e Alas são botões com etiquetas, não select nativo. Goleiro usa
o ícone de defesa existente. Ala, Ala Direito e Ala Esquerdo são mostrados como Alas
no web e aceitos/normalizados pela API em gravações, preservando compatibilidade
com o mobile. Não houve migração em massa dos valores existentes.

### Scout

A rota /elenco permanece. Identidade, avaliação de IA e estatísticas possuem áreas
visuais distintas. Resumos mostram atletas filtrados, atletas com jogos e atletas
com avaliação; não somam participações como se fossem jogos únicos do clube.

Uma nota só é apresentada quando há perfil não iniciado por "Sem" e nota disponível.
Sem isso, exibe Ainda não avaliado. Zero com perfil real continua sendo nota válida.
Esse critério usa o contrato atual; um status explícito de avaliação seria mais
robusto numa evolução da API.

Os cartões mostram partidas, gols e assistências. Ver scout abre detalhes com
mais três métricas: defesas, cartões e faltas. Os valores são acumulados, sem filtro
de temporada; a tela informa isso. Não foram inventadas estatísticas, executada IA,
criado ranking oficial ou acrescentada divisão mandante/visitante.

### Componentes e backend

ViewToggle é compartilhado por Times, Jogadores, Scout e Partidas. Choice atende
filtros e nascimento com opções tematizadas, botões reais, foco, Tab, setas,
Home/End e Escape. Fecha ao clicar fora ou sair com o teclado. Não houve auditoria
completa com leitores de tela.

O limite mínimo foi adicionado à função compartilhada de categoria da API. Como a
rotina de temporada usa essa função, alunos legados ativos com menos de 4 anos serão
inativados na próxima execução, assim como os acima de 18. Os registros não serão
apagados. A rotina NÃO foi executada no banco real nesta etapa. O controle existente
ATUALIZACAO_TEMPORADA=false continua podendo desativar o agendador.

As preferências de filtros/visualização são locais às telas, sem persistência entre
visitas. Não reformulamos Competições, Perfil e todas as outras telas. A aparência
nova usa as variáveis de tema existentes e preserva o botão ajustado pelo usuário.

## 3. Diff explicativo — Antes vs Depois

Recortes do início e final desta etapa. Não necessariamente correspondem ao HEAD:
havia código local da entrega anterior. Os trechos são didáticos, não arquivos completos.

### Times: linhas soltas para grupos

Antes:

```tsx
{filtrados.map(t => (
  <tr key={t.id}>
    <td><strong>{t.nome}</strong></td>
    <td>{cat?.nome || '—'}</td>
  </tr>
))}
```

Depois, preparação do grupo:

```ts
const groups = new Map<string, Time[]>();
const key = t.nome.trim().toLocaleLowerCase();
groups.set(key, [...(groups.get(key) || []), t]);
```

Map associa o nome normalizado a um array dos subs. O spread monta o novo array.
A interface percorre primeiro os grupos, depois os subs; não altera o banco.

### Botões repetidos para componente reutilizável

Antes: Partidas continha seus dois botões de visualização diretamente no JSX.
Depois:

```tsx
<ViewToggle value={viewMode} onChange={setViewMode} />
```

Props passam o estado e a função que o altera. Cada tela mantém seu próprio estado;
o componente compartilha aparência e interação, não os dados de todas as telas.

### Confirmação nativa para modal

Antes:

```ts
if (!window.confirm(`Excluir ${jogador.nome}?`)) return;
await deletarJogador(jogador.id);
```

Depois:

```tsx
<ConfirmDelete
  name={deleting?.nome ?? null}
  busy={salvando}
  error={deleteError}
  onClose={() => setDeleting(null)}
  onConfirm={() => void excluir()}
/>
```

Clicar em Excluir define o alvo; Confirmar chama a API. Cancelar limpa o estado.
busy bloqueia novas ações durante a requisição; erro mantém o contexto no modal.
A operação continua usando DELETE, sem nova lixeira ou recuperação.

### Entrada livre para máscara e campos controlados

Antes:

```ts
setForm(f => ({ ...f, [campo]: valor }));
```

Depois:

```ts
const sanitized = campo === 'cpf' ? formatCpf(valor)
  : campo === 'numCamisa' ? digitsOnly(valor).slice(0, 2)
  : campo === 'nome' ? cleanName(valor)
  : valor;
setForm(f => ({ ...f, [campo]: sanitized }));
```

Máscara:

```ts
const digits = digitsOnly(value).slice(0, 11);
return digits
  .replace(/^(\d{3})(\d)/, '$1.$2')
  .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
  .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
```

As regex capturam grupos de dígitos; $1/$2 recolocam os grupos com pontuação.
O backend remove a pontuação para armazenar. Formatar não equivale a validar CPF.

### Data nativa para escolhas tematizadas

Antes:

```tsx
<Input label="Data de nascimento" type="date"
  value={form.dtNasc}
  onChange={e => alterar('dtNasc', e.target.value)} required />
```

Depois:

```tsx
<BirthDateField key={editando?.id ?? 'new'} value={form.dtNasc}
  onChange={value => alterar('dtNasc', value)} />
```

O componente mantém três partes e só devolve YYYY-MM-DD quando a data é válida.
O resto do fluxo continua recebendo a mesma string ISO de antes.

### Idade mínima

Antes:

```ts
const idade = anoTemporada(agora) - Number(valor.slice(0, 4));
const limite = [7, 8, 9, 10, 12, 14, 16, 18].find(limite => idade <= limite);
```

Depois:

```ts
const idade = anoTemporada(agora) - Number(valor.slice(0, 4));
if (idade < 4) return null;
const limite = [7, 8, 9, 10, 12, 14, 16, 18].find(limite => idade <= limite);
```

A saída antecipada evita classificar crianças de 1–3 anos como Sub-7. Os anos do
formulário são calculados em vez de fixar 2022 para sempre.

### Posições simplificadas com compatibilidade

Antes:

```ts
const POSICOES = ['Goleiro', 'Fixo', 'Ala', 'Ala Direito', 'Ala Esquerdo', 'Pivô'];
```

Depois no web:

```ts
export const POSITIONS = ['Goleiro', 'Fixo', 'Pivô', 'Alas'];
```

Depois na API:

```ts
const informada = entrada.posicao === undefined
  ? atual?.posicao ?? 'Alas' : entrada.posicao;
const posicao = ['Ala', 'Ala Direito', 'Ala Esquerdo'].includes(informada)
  ? 'Alas' : informada;
```

O resultado é validado contra a lista das quatro opções. Assim, valores antigos
ainda enviados pelo mobile são compreendidos, enquanto emojis são recusados.

### Nota de IA versus ausência

Antes:

```tsx
{j.nota_geral != null && <span>{j.nota_geral.toFixed(1)}</span>}
```

Depois:

```ts
function hasAssessment(player: PerfilJogador) {
  return !!player.perfil_ml
    && !/^sem\b/i.test(player.perfil_ml)
    && player.nota_geral != null;
}
```

A API pode devolver zero com perfil Sem dados. Agora essa situação aparece como
Ainda não avaliado. Zero acompanhado de perfil real não é ocultado.

## 4. Verificação

- TypeScript da API e do web: passou.
- Build Vite: passou.
- 12 testes de elenco + 3 de formulário + 5 de partidas: 20 passaram.
- Banco dos testes: memória. Nenhuma alteração no Supabase.
- No navegador: agrupamento/expansão/lista de Times; erro 409 de exclusão dentro
  do modal; origem Sub-16 calculando Sub-14; CPF digitado recebendo máscara;
  anos 2008–2022; cadastro fictício com sucesso; formulário vazio com erro próprio;
  Scout e ficha com defesas; temas claro/escuro nos fluxos; 390 px sem overflow.

Os servidores temporários foram encerrados e o arquivo de mock removido. Os testes
simulados não comprovam integração real com PostgreSQL, concorrência no banco,
execução no Expo ou acessibilidade completa. Avisos conhecidos de CJS do Vite e
tipo de módulo nos testes não bloquearam a validação.

O diff global aponta espaços finais em Layout.tsx/theme.ts que já estavam no início
desta etapa. Foram preservados para não misturar alterações do usuário.

Comandos usados na raiz:

```powershell
node services/api/node_modules/typescript/bin/tsc -p services/api/tsconfig.json
node --test services/api/tests/elenco.test.cjs
node --experimental-strip-types --test apps/web/tests/playerForm.test.mjs apps/web/tests/matchSchedule.test.mjs
node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
```

Build em apps/web: `node node_modules/vite/bin/vite.js build`.

## 5. Prompt para Novo Chat

Copie o texto e disponibilize o relatório e o código:

```text
Quero aprender as alterações do Ludora descritas em:
C:\Users\CoquinhaGelada\Desktop\Ludora\docs\handover-visual-2026-10-19.md

Sou estudante. Conheço funções, parâmetros, retorno, arrays, for...of, contadores,
if/else, &&, ||, ! e comparações. Preciso aprender sintaxe, React, TypeScript, CSS,
HTTP/API e Prisma passo a passo.

Leia o relatório e confira os arquivos atuais e AGENTS.md antes de explicar. Se o
projeto mudou, destaque a diferença. Quero ensino: não altere arquivos, branch,
banco ou dependências sem eu pedir. Preserve develop e o trabalho local do grupo.

Comece pelo fluxo: abrir Adicionar aluno pelo Sub-16, selecionar nascimento, receber
Sub-14, formatar CPF, escolher posição/camisa, salvar e visualizar o resultado.
Depois ensine um tema por vez:
1. useState, props, callbacks, componentes controlados e renderização condicional.
2. Por que ViewToggle compartilhado padroniza quatro telas sem compartilhar seus dados.
3. Map para agrupar times, spread, filter, sort e localeCompare. Diferencie apresentação
   de mudança no modelo de dados.
4. Regex, grupos $1/$2, Unicode, máscara de CPF e inputMode; diferencie formatação,
   filtragem, validação de cliente, validação de servidor e dígitos verificadores.
5. Datas por partes, limites dinâmicos, fevereiro, UTC, São Paulo e idade da temporada.
6. Menus customizados, useRef/useEffect, eventos, foco, setas, Tab, Escape e ARIA.
7. Modal de exclusão, carregamento, erro, sucesso e requisição DELETE.
8. Grid/Flex, variáveis CSS, posições como etiquetas e responsividade.
9. Estatísticas versus nota de IA, zero versus null e dados ausentes.
10. Testes sem banco e o que eles comprovam ou não.

Em cada assunto, mostre Antes vs Depois, explique cada construção de sintaxe e
conecte a decisão ao problema resolvido. Use exemplos novos em inglês; preserve os
nomes reais ao analisar o projeto. Não trate dados fictícios como registros reais.

Não despeje tudo numa única aula. Comece pelo fluxo geral e pelo primeiro tema.
Exercícios podem ser curtos e opcionais, sem bloquear o avanço. Corrija meus erros
e não concorde comigo automaticamente.
```
