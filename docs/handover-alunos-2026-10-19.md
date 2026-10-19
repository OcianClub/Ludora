# Handover Técnico — alunos, categorias, camisas e temas

Data: 19/10/2026. Projeto: Ludora. Branch: develop.
Base inspecionada: commit 1f18a19, após o pull informado pelo usuário.
Entrega local: arquivos editados, sem commit ou push.

## 1. Mapeamento

Os caminhos abaixo são relativos a `C:\Users\CoquinhaGelada\Desktop\Ludora`.

| Arquivo | Estado nesta etapa | Responsabilidade |
| --- | --- | --- |
| services/api/src/modules/jogadores/elenco.rules.ts | Criado | Funções puras para idade da temporada, categoria e planejamento da redistribuição das camisas. |
| services/api/src/modules/jogadores/elenco.service.ts | Criado | Validação, autorização, transações de cadastro/troca, atualização de temporada e agendamento. |
| services/api/src/modules/jogadores/jogador.routes.ts | Modificado | Encaminha cadastro, edição e atualização de idades para o serviço; adiciona consulta de categoria; devolve conflito estruturado. |
| services/api/src/server.ts | Modificado | Inicia a atualização automática após abrir a porta e cancela o intervalo ao encerrar. |
| services/api/.env.example | Modificado | Documenta ATUALIZACAO_TEMPORADA. Não é o arquivo de credenciais. |
| services/api/tests/elenco.test.cjs | Criado | Dez testes de regras e serviço, com banco simulado em memória. |
| apps/web/src/pages/Jogadores.tsx | Modificado | Blocos por sub, formulário com categoria calculada, confirmação de camisa, consulta, edição e exclusão. |
| apps/web/src/pages/Jogadores.css | Criado | Aparência responsiva da nova tela, com prefixo alunos- para evitar colisão com Elenco.css. |
| apps/web/src/services/api.ts | Modificado | Novo contrato de cadastro/edição, consulta da categoria e erro com detalhes de conflito. |
| apps/web/src/styles/theme.ts | Modificado | Aplica paletas claras/escuras já existentes e salva preferência no navegador. |
| apps/web/src/components/Layout.tsx | Modificado | Seletor de aparência no menu lateral desktop. |
| apps/mobile/src/components/EscalacaoPartida.tsx | Modificado | Troca manual de camisa passa a usar uma única requisição confirmada; considera também alunos não convocados. |
| docs/cadastro-alunos-temporada.md | Criado | Referência operacional: regras, execução automática, contratos, testes e limitações. |
| docs/handover-alunos-2026-10-19.md | Criado | Este relatório e o prompt de continuidade didática. |

Alterações já presentes antes desta etapa, preservadas e não atribuídas a ela:
`apps/mobile/src/services/api.ts` e `docs/documentacao-comentarios.json`.
Não foram alterados schema Prisma, migrations ou credenciais. A paleta clara veio
do pull do Murilo; esta entrega a conecta ao web, não a recria.

## 2. Resumo do fluxo

### Cadastro manual

1. Usuário autorizado abre Jogadores, agora apresentado como Alunos e categorias.
2. Informa nome, CPF, nascimento e posição. A camisa é opcional.
3. O React consulta `GET /jogadores/categoria?nascimento=YYYY-MM-DD`.
4. O servidor calcula o sub, verifica se existe naquele clube e se o usuário tem
   acesso à categoria. Retorna categoria e temporada.
5. O formulário mostra o resultado e habilita a camisa. A categoria não é mais uma
   escolha manual contraditória com a data de nascimento.
6. Ao salvar, `POST /jogadores` ou `PATCH /jogadores/:id` recalcula tudo no servidor.
   A consulta anterior é uma prévia, não uma autorização permanente.
7. Sem conflito de camisa, o cadastro é salvo. Com conflito, a API responde 409 com
   nome do ocupante, número, categoria e dados necessários para confirmação.
8. Cancelar não grava. Confirmar envia uma nova requisição; a API revalida o conflito
   e salva as duas alterações dentro da mesma transação.

O frontend organiza a experiência. A API continua responsável por autorizar e
validar. Chamadas pelo Insomnia passam pelas mesmas regras.

### Categoria pela idade da temporada

A idade usada é `ano da temporada - ano do nascimento`. A temporada usa o fuso
America/Sao_Paulo. Não espera o aniversário: quem completa 13 em dezembro já fica
no Sub-14 desde o início daquele ano.

| Idade que completa no ano | Categoria | Grupo |
| --- | --- | --- |
| Até 7 | Sub-7 | Iniciação |
| 8 | Sub-8 | Iniciação |
| 9 | Sub-9 | Iniciação |
| 10 | Sub-10 | Iniciação |
| 11 e 12 | Sub-12 | Base |
| 13 e 14 | Sub-14 | Base |
| 15 e 16 | Sub-16 | Base |
| 17 e 18 | Sub-18 | Base |

Datas inválidas e futuras são recusadas. Não foi criada uma idade mínima adicional.

### Camisa: manual versus automática

A camisa é ocupada por aluno ativo da mesma categoria no mesmo clube. Não é uma
restrição global: dois subs diferentes podem ter o número 21.

- Cadastro manual: Alex solicita a camisa 10 de James. Ao confirmar, Alex recebe
  10 e James fica sem número.
- Edição manual no mesmo sub: Alex tem 7 e solicita a 10 de James. Ao confirmar,
  Alex recebe 10 e James recebe 7.
- Se o aluno editado não tinha camisa, James fica sem número.
- Se o nascimento editado muda o sub, não se transporta a antiga camisa para um
  jogador de outra categoria; o ocupante do destino fica sem número após confirmação.
- Mudança automática de temporada: a camisa acompanha o aluno se estiver livre no
  destino. Se ocupada, o aluno que chega fica sem número. Não toma a camisa do residente.

A atualização automática considera o destino de todos os alunos ativos antes de
reservar os números. Residentes têm prioridade; entre transferidos, menor ID ganha
em caso de empate. Duplicatas antigas entre residentes também são resolvidas pelo
menor ID, deixando os demais sem número. Esse desempate técnico torna o resultado
repetível; não representa prioridade esportiva.

### Transações e concorrência

Uma transação agrupa as gravações: se a criação de Alex falhar depois de retirar a
camisa de James, a retirada também é desfeita. O isolamento Serializable permite
que o PostgreSQL detecte conflitos entre transações concorrentes. O serviço repete
a operação até duas vezes após o erro P2034; se persistir, retorna 409 para tentar
novamente. Na repetição, lê novamente o elenco e confere a confirmação recebida.

Não foi adicionada uma restrição UNIQUE para camisa no banco. A garantia depende
do uso deste serviço pelas operações da aplicação. Gravações manuais externas no
banco podem produzir duplicatas; não devem contornar a regra.

### Automação de temporada

A rotina começa quando o servidor inicia e executa novamente a cada hora. Não
precisa de uma tela aberta. Se a hospedagem estiver suspensa ou desligada, executa
na próxima inicialização; não há promessa de execução exatamente à meia-noite.

Cada clube é atualizado em transação própria. Categoria de destino ausente impede
a atualização daquele clube, sem atualização parcial. Uma falha não impede tentar
os outros clubes. Acima do Sub-18, o aluno fica inativo, sem apagar seu registro.
Alunos já inativos não são reativados.

A rotina modifica o cadastro atual do aluno. Não modifica partidas, eventos e
escalações anteriores, nem cria uma tabela de histórico de vínculos por temporada.
A rota administrativa existente usa o mesmo serviço.

**Efeito ao executar a API:** com a nova versão e configuração padrão, o servidor
inicia essa rotina no banco configurado. Para desenvolvimento sem essa atualização,
use `ATUALIZACAO_TEMPORADA=false`. `NODE_ENV=test` também desliga o agendador.
Nesta entrega, a API real não foi reiniciada e nenhum dado do Supabase foi alterado.

### Apresentação e reutilização

Os blocos mostram contagem, alunos sem camisa e ações existentes de edição/exclusão.
A busca por nome permanece. O antigo seletor manual de categoria foi substituído
pela prévia calculada. Perfil/nota de IA não são mais colunas nesta tela de cadastro;
a tela Elenco, voltada à consulta esportiva, permanece separada.

As cores do web vêm das paletas darkColors/lightColors que o Murilo adicionou ao
pacote compartilhado. O menu lateral permite Sistema, Escuro e Claro; a escolha é
salva no localStorage. Isso é preferência visual, não permissão de conta. O seletor
fica no menu desktop, ocultado pelo layout existente em telas pequenas.

## 3. Diff explicativo — antes versus depois

Trechos abaixo são recortes das versões anterior e atual; não representam arquivos
inteiros. Quando uma função é nova, o "antes" descreve a ausência correspondente.

### 3.1 Camisa omitida em PATCH

Antes, em jogador.routes.ts:

```ts
let dados: any = { nome, posicao, numCamisa: numCamisa ? Number(numCamisa) : null };
```

Mesmo uma atualização apenas do nome podia escrever null na camisa, porque
`numCamisa` ausente é undefined e cai no ramo falso da expressão.

Depois, em elenco.service.ts:

```ts
const camisa = entrada.numCamisa === undefined
  ? atual?.numCamisa ?? null
  : lerCamisa(entrada.numCamisa);
```

Agora há três intenções distintas:
- Campo omitido: preservar o valor anterior.
- Campo null ou string vazia: remover o número.
- Número informado: validar inteiro entre 1 e 99.

`?.` acessa a propriedade apenas se o objeto existir. `??` usa o valor da direita
somente para null/undefined. O operador ternário escolhe uma das duas expressões.

### 3.2 Regra de idade extraída da rota

Antes, a mesma lista aparecia em cadastro, edição e atualização administrativa:

```ts
const anoNasc = new Date(dtNasc).getFullYear();
const idade = new Date().getFullYear() - anoNasc;
const categoriaAdequada = regrasCategorias.find(r => idade <= r.limite);
```

Depois, em elenco.rules.ts:

```ts
const idade = anoTemporada(agora) - Number(valor.slice(0, 4));
const limite = [7, 8, 9, 10, 12, 14, 16, 18].find(limite => idade <= limite);
return limite === undefined ? null : `sub-${limite}`;
```

A validação da data acontece antes desse recorte. Uma função pura recebe a data e
um instante de referência, e retorna o nome da categoria. Isso permite testar a
virada do ano sem alterar o relógio do computador. A consulta ao banco continua
no serviço, separada do cálculo.

### 3.3 Atualização anual com tratamento de camisa

Antes:

```ts
if (cat && (cat.id !== j.categoria_id || !j.ativo)) {
  await prisma.jogador.update({
    where: { id: j.id },
    data: { categoria_id: cat.id, ativo: true }
  });
}
```

Mudava de categoria sem conferir a camisa e podia reativar um aluno inativo.

Depois, o planejamento considera somente ativos e reserva números no destino:

```ts
const ocupadas = new Set<string>();
return planos.map(({ aluno, destino }) => {
  let camisa = aluno.numCamisa;
  if (destino !== null && camisa !== null) {
    const chave = `${destino}:${camisa}`;
    if (ocupadas.has(chave)) camisa = null;
    else ocupadas.add(chave);
  }
  // Retorna o plano de atualização; a função pura não grava no banco.
});
```

Esse último recorte omite o objeto de retorno, para focar na reserva do número.
`Set` é uma coleção sem repetição. A chave combina categoria e número: `14:21` e
`12:21` são diferentes. A ordenação anterior garante a prioridade dos residentes.
O serviço grava apenas planos marcados como alterados, em uma transação.

### 3.4 Conflito de camisa identificado

Antes, somente no cadastro:

```ts
if (camisaEmUso) return res.status(409).json({
  error: `A camisa ${numCamisa} já está sendo usada na categoria.`
});
```

A edição não tinha a mesma verificação. A resposta não trazia o ocupante para a UI.

Depois, no serviço:

```ts
const confirmacao = entrada.confirmar_camisa;
if (confirmacao?.jogador_id !== conflito.id || confirmacao?.camisa_anterior !== anterior) {
  throw new ErroElenco(409,
    `A camisa ${camisa} já pertence a ${conflito.nome} no ${categoria.nome.toUpperCase()}.`, {
      conflito_camisa: {
        jogador_id: conflito.id, nome: conflito.nome, camisa,
        categoria: categoria.nome, camisa_anterior: anterior
      }
    });
}
```

A UI pode apresentar a situação exata. Confirmar não significa ignorar conflitos:
a API confere novamente ID do ocupante e camisa anterior. Se mudarem, apresenta
um novo conflito para revisão em vez de confiar na tela antiga.

### 3.5 Gravação atômica

Antes, a rota gravava diretamente o jogador; não havia operação conjunta de troca.

Depois, o serviço envolve a operação em:

```ts
return await prisma.$transaction(operacao, {
  isolationLevel: 'Serializable',
  timeout: 20000
});
```

Dentro da operação, usa `tx.jogador.update` para o ocupante e `tx.jogador.create`
ou `tx.jogador.update` para o aluno. `tx` representa a mesma transação. Não confundir
com duas chamadas independentes a `prisma`, que poderiam ser salvas separadamente.

### 3.6 Mobile: uma chamada em vez de duas

Antes, em EscalacaoPartida.tsx:

```ts
await atualizarJogador(Number(modalCamisa.id_jogador), { numCamisa: num });
if (camisaAtual && camisaAtual > 0) {
  await atualizarJogador(Number(conflito.id_jogador), { numCamisa: camisaAtual });
}
```

Depois:

```ts
await atualizarJogador(Number(modalCamisa.id_jogador), {
  numCamisa: num,
  confirmar_camisa: {
    jogador_id: Number(conflito.id_jogador),
    camisa_anterior: camisaAtual
  },
});
```

O mobile pede a operação completa, e a API executa a troca com rollback. A busca
local deixou de limitar o conflito aos convocados: a camisa pertence ao elenco.
A resposta do servidor ainda prevalece se a lista local estiver desatualizada.

### 3.7 Web: categoria calculada e confirmação

Antes, o formulário tinha seleção manual:

```tsx
<Select label="Categoria" options={catOpts}
  value={form.categoria_id}
  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
  required />
```

Depois, consulta a API quando a data muda:

```ts
preverCategoria(form.dtNasc).then(resultado => {
  if (ativo) setPrevisao({ ...resultado, nascimento: form.dtNasc });
}).catch(err => {
  if (ativo) setErroCategoria(err.message);
});
```

O efeito espera 250 ms, cancela o temporizador na limpeza e usa `ativo` para ignorar
respostas de uma consulta antiga. Só habilita a camisa quando a previsão corresponde
à data atual. Isso evita usar o sub calculado para um nascimento anterior.

Antes, o cliente descartava os detalhes do erro:

```ts
if (!res.ok) throw new Error(json.error || 'Erro ao criar jogador');
```

Depois, preserva o conflito:

```ts
if (!res.ok) throw new ErroJogador(
  json.error || 'Não foi possível salvar o jogador', json.conflito_camisa
);
```

E a tela trata esse caso:

```ts
if (err instanceof ErroJogador && err.conflito) setConflito(err.conflito);
```

`instanceof` reconhece a classe de erro. O estado `conflito` abre o aviso com os
botões Cancelar troca e Confirmar. O estado não realiza a gravação por si só.

### 3.8 Agendamento

Antes, server.ts apenas iniciava HTTP; a rota administrativa precisava ser chamada.

Depois, ao iniciar o servidor:

```ts
if (process.env.NODE_ENV !== 'test' && process.env.ATUALIZACAO_TEMPORADA !== 'false') {
  pararAtualizacao = iniciarAtualizacaoTemporada();
}
```

A função executa uma primeira atualização, cria um intervalo de uma hora e devolve
uma função que cancela esse intervalo. `encerrar` chama essa função. O sinalizador
`executando` evita sobrepor duas execuções no mesmo processo; entre processos, as
transações tratam conflitos de gravação.

### 3.9 Temas compartilhados

Antes:

```ts
import { colors } from '../../../../packages/design-tokens/src/colors';
export function applyTheme() {
  // colors era o alias da paleta escura.
}
```

Depois:

```ts
import { darkColors, lightColors } from '../../../../packages/design-tokens/src/colors';
const light = preference === 'light' ||
  (preference === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
const colors = light ? lightColors : darkColors;
```

O mesmo mapeamento existente transforma as cores em variáveis CSS. O seletor salva
`ludora_tema`; mudanças do tema do sistema reaplicam a preferência vigente.

## 4. Validação e limites

- Compilação TypeScript da API: passou.
- TypeScript e build Vite do web: passaram.
- TypeScript do mobile: passou.
- Dez testes automatizados de elenco: passaram, sem banco externo.
- Navegador com API simulada: cadastro, cálculo de sub, bloqueio da camisa antes do
  cálculo, conflito, cancelar, confirmar transferência, resultado no bloco, tema
  claro e layout em 390 px sem overflow horizontal.
- Diff sem erros de whitespace; somente aviso normal de conversão LF/CRLF.

O pnpm tentou consultar o registro para sua própria versão e falhou por rede.
A validação foi feita com as ferramentas já instaladas. Comandos na raiz:

```powershell
node services/api/node_modules/typescript/bin/tsc -p services/api/tsconfig.json
node --test services/api/tests/elenco.test.cjs
node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
node apps/mobile/node_modules/typescript/bin/tsc -p apps/mobile/tsconfig.json --noEmit
```

Para o build Vite, entrar em apps/web e executar:

```powershell
node node_modules/vite/bin/vite.js build
```

O aviso de depreciação CJS do Vite já existia e não bloqueou o build.

A prova visual usa dados fictícios: James Walker e Alex Carter, no clube explicitamente
marcado DEMONSTRAÇÃO. A API temporária foi encerrada e não integra o produto.
Screenshot: `C:\Users\CoquinhaGelada\.codex\visualizations\2026\09\22\01a0c716-5f85-73c1-9caa-c7f271bf0bce\alunos-demonstracao.png`.

Limites concretos:
- Não executamos migrations, teste real de concorrência no PostgreSQL nem teste do
  fluxo modificado dentro do Expo. O banco dos usuários não foi usado nos testes.
- O CPF é validado por formato/tamanho, não pelos dígitos verificadores.
- Históricos de partidas ficam preservados, mas não há histórico de vínculo anual
  do aluno; relatórios por temporada podem precisar desse modelo futuramente.
- As permissões continuam as existentes: ADMIN/TECNICO/MESARIO com escopo de
  categorias. Cargos personalizados e olheiro não foram adicionados.
- A interface nova ainda usa a autorização geral podeGerenciar para exibir ações;
  o servidor recusa categorias sem autorização. Não foi criada uma matriz visual
  completa de permissões por botão.
- Não foi instalado Electron, feita integração de federação nem implementada assinatura.
- A paridade desejada entre mobile e desktop foi registrada como direção; esta entrega
  implementa o fluxo de alunos no web, não uma auditoria de paridade de todo o sistema.

## 5. Prompt para Novo Chat

Copie o texto abaixo e anexe este relatório ou forneça acesso ao repositório.

```text
Quero que você me ensine do zero as alterações do Ludora documentadas no arquivo
C:\Users\CoquinhaGelada\Desktop\Ludora\docs\handover-alunos-2026-10-19.md.

Sou estudante de Desenvolvimento de Software. Já pratiquei funções, parâmetros,
retorno, arrays, for...of, contadores, if/else, &&, ||, ! e comparações. Preciso de
ajuda com sintaxe, TypeScript, React, HTTP/API, Prisma e transações.

Primeiro leia o relatório e confira os arquivos atuais e as instruções AGENTS.md.
Não presuma que o código continua igual ao relatório. Diferencie implementação,
proposta e limitações; não chame testes simulados de testes no banco real.

Nesta conversa, quero aprender: não altere código, branch, banco ou dependências
sem eu pedir. Use a develop existente se depois houver trabalho autorizado.

Ensine um assunto por vez, começando pelo caminho de uma ação: preencher nascimento,
calcular sub, escolher camisa, receber conflito, confirmar, salvar os dois alunos e
atualizar a tela. Mostre em qual arquivo cada etapa acontece e explique frontend,
rota, serviço, regra pura e banco sem pressupor que eu domino esses conceitos.

Depois compare os trechos Antes e Depois do relatório e explique cada construção:
useState, useEffect, limpeza do efeito, promises, async/await, try/catch/finally,
optional chaining (?.), nullish coalescing (??), ternário, spread, tipos e interfaces,
classes de erro, instanceof, find/filter/map/sort, Set, HTTP 400/403/404/409,
Prisma TransactionClient, $transaction, Serializable, rollback, repetição de conflito,
setInterval/unref, variáveis de ambiente, localStorage e variáveis CSS.

Para cada tema: explique o problema anterior, o motivo da decisão, o comportamento
novo e o teste que verifica essa decisão. Use exemplos inéditos em inglês e preserve
os nomes reais do código ao analisá-lo. Não invente garantias de segurança ou de
concorrência que os testes em memória não comprovam.

Dê atenção especial a: idade pelo ano e fuso de São Paulo; 13 anos no Sub-14;
camisa por clube/categoria; diferença entre campo omitido e null; troca manual versus
mudança automática; preservação de históricos; não reativar alunos inativos;
permissões na API, que não dependem de esconder botões; limitações ainda existentes.

Não despeje tudo numa única aula. Comece pelo fluxo geral e pelo cálculo da categoria.
Pode propor um pequeno exercício opcional ao final de um assunto, sem me impedir de
continuar. Seja direto, corrija meus equívocos e não concorde automaticamente comigo.
```
