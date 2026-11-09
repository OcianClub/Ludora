# Handover técnico · Clubes e interface do Desktop

## Arquivos e responsabilidades

| Área | Arquivos | Mudança |
| --- | --- | --- |
| Clubes no Electron | `Clubes.tsx`, `ClubeDetalhe.tsx`, `ClubeCadastroFields.tsx`, `ReaproveitarTime.tsx`, `ExcluirIcone.tsx` | Cadastro em etapas com prévia do time, endereço por CEP, ficha em leitura inicial, edição explícita e lixeira contextual. |
| Elementos compartilhados com o Web | `ClubSettingsSection.tsx`, `ClubePerfil.tsx`, `PlayerRosterCells.tsx`, `PlayerProfileContent.tsx`, `PlayerEditDialog.tsx`, `PlayerShirtDialog.tsx`, `Jogadores.tsx`, `JogadorPerfil.tsx`, `JogadorPerfil.css` | Seções, tabela e ficha de jogador compartilham o código. A Estrutura também usa o `CategoryFilter` existente do Web. |
| Operação no Electron | `OptionTiles.tsx`, `Usuarios.tsx`, `UsuarioClubeEditor.tsx`, `Manutencao.tsx`, `ChamadoManual.tsx`, `Visao.tsx`, `desktop.css` | Seleção pela cor do bloco, colunas de clube/cargo, atalho de sessão junto ao e-mail, brasão na pausa e painéis de visão global. |
| API e contratos | `admin.routes.ts`, `elenco.service.ts`, `jogador.routes.ts`, `perfil.routes.ts`, `manutencao/routes.ts`, `suporte/routes.ts`, `shared-types/src/admin.ts` | Prévia com até cinco confrontos, vínculo transacional dos IDs confirmados, edição e remoção de jogador com escopo, brasões nas escolhas operacionais. |
| Testes | `clubes-smoke.cjs`, `admin.http.test.ts` | Abertura de clube, CEP, revisão do grupo, preservação dos jogos, foto, mudança de SUB, remoção protegida e verificação de acesso. |

## Antes e depois

Na Visão geral do clube, os campos apareciam editáveis ao entrar. Agora a página mostra a ficha de consulta. A ação **Editar clube** abre os campos. A lixeira vermelha aparece no cabeçalho durante a edição dos clubes elegíveis, com confirmação e validação da API antes de excluir.

```tsx
// Antes
<form onSubmit={salvarClube}>…</form>

// Depois
{editandoClube ? <form onSubmit={salvarClube}>…</form>
  : <ClubeResumoCadastro nome={clube.nome} endereco={endereco} plano={plano}/>}
```

Antes, escolher a casca na segunda etapa selecionava uma linha. Agora a busca está na etapa **Identidade**. A prévia agrupa times do mesmo nome e cadastro de origem, mostra seus SUBs e os confrontos recentes. A confirmação passa os IDs exibidos ao backend. O vínculo altera a referência do time ao clube que ele representa. As partidas continuam apontando para os mesmos IDs.

```ts
// Antes
await tx.time.updateMany({ where: { id: cascaId }, data: { clube_representado_id: novo.id } });

// Depois, trecho simplificado
const alterada = await tx.time.updateMany({
  where: { ...cascaDisponivel, AND: [grupo, { id: { in: cascaIds } }] },
  data: { clube_representado_id: novo.id },
});
if (alterada.count !== cascaIds.length) throw new ErroHttp(409, 'Confira a lista novamente.');
```

A Estrutura tinha uma lista própria com edição de nome, posição e camisa. Agora, ao selecionar o SUB, ela abre a tabela e o perfil baseados nos componentes do Web. O editor recebe funções para buscar a categoria e salvar. No Web elas usam HTTP do navegador. No Electron elas usam a ponte IPC e rotas de administração.

```tsx
<PlayerEditDialog player={perfil} currentCategory={perfil.categoria.nome}
  previewCategory={prever} savePlayer={salvar} onClose={fechar} onSaved={atualizar}/>
```

O serviço comum remove atletas sem dependências. Com escalações, acontecimentos, inscrições ou votos, desativa o cadastro e preserva o histórico. Uma escalação em partida ao vivo bloqueia a operação. A API restringe o CPF ao perfil autorizado e mantém o campo somente para consulta.

## CEP, acesso e limites

O CEP no Desktop é consultado após digitar oito números. Uma resposta atrasada só é usada se ainda corresponder ao CEP digitado, e campos alterados manualmente durante a busca são preservados. O CEP ajuda a preencher a sede. Número e complemento dependem da confirmação de quem cadastra.

O administrador do clube continua podendo atualizar a sede pelo Web. Identidade, plano, exclusão e operação de atletas pelo painel interno exigem administrador Ludora. A ficha de jogador no Electron apresenta prévias de partidas e campeonatos. Os links para os históricos completos e o scout continuam no Web.

O reaproveitamento separa cadastros homônimos de clubes de origem diferentes. A validação usou um banco local isolado, com dados sintéticos. Esta entrega reutiliza o schema atual, com zero migrations novas.

## Como verificar

```powershell
pnpm test:app:completo
pnpm test:desktop
pnpm --filter @ludora/web build
pnpm --filter @ludora/desktop build
node apps/desktop/tests/clubes-smoke.cjs
node apps/desktop/tests/usuarios-smoke.cjs
node apps/desktop/tests/manutencao-smoke.cjs
```

O Electron dos testes usa o Playwright e a API isolada. Veja a [preparação do ambiente](2026-11-08-painel-operacional.md#reproduzir-os-testes-com-dados-isolados). Para validar o CEP com o provedor, inicie o servidor de teste sem `--email-isolado`.

- 530 testes do app, 4 do Desktop e builds do Web e Electron passaram.
- No Electron, o CEP `01001-000` preencheu o endereço sem botão. A prévia exibiu cinco de seis confrontos, vinculou dois SUBs e preservou as seis partidas ao excluir o clube. A edição validou foto e posição, e a API mudou o SUB e preservou um gol ao desativar o atleta com histórico. [Prévia do vínculo](../../test-results/clubes/previa-time.png) · [Perfil de teste](../../test-results/clubes/perfil-jogador-claro.png)
- Chamado aberto por teclado e mouse e pausa criada e reativada no Electron. O Web exibiu o protocolo de pausa e aceitou a criação da partida depois da reativação. [Chamado manual](../../test-results/revisao-visual/operacao-chamado-escuro.png)
- No Electron, os títulos de Clube e Cargo foram comparados com as posições das colunas, e o botão de encerrar sessões foi conferido na altura do e-mail. A seleção atingiu texto branco ao fim da transição. A Visão global foi conferida nos dois temas. [Usuários](../../test-results/configuracao-desktop/usuarios-escuro.png) · [Visão global](../../test-results/configuracao-desktop/visao-global-escuro.png)
- No Web, Configurações do clube e a edição do jogador foram abertas com uma conta administradora de clube e a mudança de nome foi salva pela API isolada. [Configurações no Web](../../test-results/configuracao-desktop/web-configuracoes.png)

## Prompt para estudo

> Abra este handover e me ensine cada fluxo do zero com exemplos novos em inglês. Comece pelo clique em Editar clube, explicando estado, leitura e formulário. Depois siga o CEP até a API, mostrando o debounce e como uma resposta antiga é descartada. Explique como IDs, transações e escopo de autorização preservam os jogos e os dados do jogador. Termine mostrando como o mesmo formulário usa HTTP no Web e IPC no Electron, com um comando de teste por vez.

## Ajuste final em Acessos

`CargoClube.tsx` concentra os nomes dos cargos e o indicador de ponto e texto usado em Usuários. A aba Acessos da ficha do clube usa o mesmo componente. Os botões **Remover** e **Remover acesso** usam a classe existente `btn-danger-solid`, com fundo vermelho e texto branco. A confirmação continua sendo necessária antes da remoção.

```tsx
// Antes
<PapelBadge papel={membro.papel}/>
<Btn variant="danger">Remover</Btn>

// Depois
<CargoClube papel={membro.papel}/>
<Btn variant="danger" className="btn-danger-solid">Remover</Btn>
```

Para estudar o ajuste, peça ao próximo chat para seguir o valor de `papel` até o texto, a cor e o ponto no CSS. Em seguida, compare a classe base do botão com a classe sólida e localize a confirmação da ação.

## Integração com a develop

O commit reúne o trabalho local de operação da plataforma. A integração preserva a entrada atual do Paulista, os filtros, o chaveamento e as estatísticas da ficha do jogador no Web. O menu do Paulista dá acesso às competições anteriores do clube. A ficha do Desktop compartilha cabeçalho, células do elenco e formulário de edição com o Web, usando as rotas administrativas para carregar e salvar dados.

O teste de clubes abre o Electron e verifica o ponto do cargo e o texto branco de **Remover** nos dois temas. Ele cancela a confirmação durante essa verificação. A suíte combinada executou 569 casos, com 564 aprovados e cinco casos de publicações capturadas da federação pulados. O Desktop passou os quatro testes de segurança do IPC, além do teste de clubes. Os builds Web e Electron passaram.

No navegador, o painel do Paulista passou nos perfis Administrador e Visitante em quatro larguras. O teste também abriu as competições anteriores e voltou ao painel enquanto o calendário oficial estava indisponível.
