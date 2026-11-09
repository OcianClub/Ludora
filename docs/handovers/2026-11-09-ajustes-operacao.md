# Handover técnico · Operação Ludora

## Arquivos e responsabilidades

| Área | Arquivos | Mudança |
| --- | --- | --- |
| Formulários no Electron | `OptionTiles.tsx`, `MotivoTiles.tsx`, `ChamadoManual.tsx`, `Manutencao.tsx`, `desktop.css` | Blocos com seleção por mouse e teclado. O chamado abre na fila após salvar. Manutenção apresenta operação, alcance, prazo e motivos em blocos. |
| Equipe e usuários | `Equipe.tsx`, `Usuarios.tsx`, `UsuarioClubeEditor.tsx` | Atalhos por papel, diagnóstico da API, contas por clube, modos linha/bloco e edição de vínculo com confirmação para ações destrutivas. |
| Clubes | `Clubes.tsx`, `ClubeDetalhe.tsx`, `ClubeCadastroFields.tsx`, `ClubeElenco.tsx`, `admin.routes.ts`, `elenco.service.ts`, `packages/shared-types/src/admin.ts` | Busca de CEP com alternativa, reaproveitamento de um time por ID, exclusão protegida e edição de jogador pelo SUB com as regras de camisa já usadas no Ludora. |
| Web e Mobile | `Layout.tsx`, `PublicLayout.tsx`, `SupportButton.tsx`, `ClubWorkspace.css`, `PublicAccess.tsx`, `SelecionarClube.tsx`, `publico.routes.ts`, `ClubesExplorer.tsx`, `apps/mobile/src/services/api.ts` | Suporte com ícone acima da conta na área de gestão. Clubes desativados aparecem como indisponíveis para entrada. |
| Campeonato Paulista | `services/api/src/modules/paulista/{rules,service,operations,routes,chamados}.ts`, `apps/desktop/src/renderer/src/{pages/Paulista,components/PaulistaReview}.tsx`, `apps/web/src/pages/Paulista.tsx` | Separação entre publicação, correção, calendário, ocorrência e identidade. Projeção segura e auditada. Alertas, comparação e revisão em telas reais. |
| Verificação | `admin.http.test.ts`, `paulista-operacional.integration.ts`, `paulista-operacional-smoke.cjs`, `clubes-smoke.cjs`, `usuarios-smoke.cjs`, `manutencao-smoke.cjs` | Cenários reproduzíveis com PostgreSQL isolado, API e Electron. |

## Antes e depois

**Chamado manual.** Os cinco campos de seleção usavam listas. Agora recebem opções no mesmo componente de Usuários. Cada grupo mantém uma única escolha, e a aparência da caixinha é controlada pelo CSS.

```tsx
// Antes
<Select label="Plataforma" options={plataformas} ... />

// Depois
<OptionTiles
  label="Plataforma"
  options={plataformas}
  value={form.servico}
  onChange={v => alterar('servico', v)}
/>
```

**Paulista.** Antes, diferenças na súmula e nos gols entravam como alteração oficial de calendário. Agora só data, horário e local entram nessa comparação. Um placar publicado pode atualizar a partida existente se ela estiver sem atividade do clube. O importador confere eventos, escalações, alterações operacionais e a versão da última projeção antes de sobrescrever.

```ts
// Antes, em essência
const changes = diferencas(publicado, oficial);
if (changes.length) abrirPendencia(jogoId, 'ALTERACAO_OFICIAL', changes);

// Depois, em essência
const mudanca = classificarMudanca(publicado, oficial);
if (mudanca.agenda.length && partidaLocal && !segura) {
  await abrirPendencia(tx, jogoId, 'ALTERACAO_OFICIAL', { changes: mudanca.agenda });
}
if (segura && resultadoNumerico(oficial)) {
  // Atualizar o placar no ID existente e registrar origem, antes e depois.
}
```

No cenário de teste, a classificação usa **5 × 2**, enquanto a súmula do clube mantém **6 × 2** e o evento de gol. **Manter dado oficial** registra a conferência. **Solicitar correção ao clube** exibe um aviso à equipe operacional do clube. **Encaminhar aos desenvolvedores** cria uma tarefa técnica rastreável. A pausa atua sobre um evento específico. A análise de vínculo abre uma tarefa de suporte e registra a decisão.

**Cadastro do clube.** Reaproveitar um adversário preenche `Time.clube_representado_id`, preservando o ID ao qual as partidas apontam. A criação e o vínculo ocorrem na mesma transação. Se o clube puder ser excluído, a referência ao cliente volta a ficar vazia e o time permanece. Contas, jogadores, histórico esportivo, tarefas ou vínculos oficiais protegem a exclusão.

## Ambiente, testes e evidências

Para usar o ambiente normal, rode `pnpm dev` na raiz do projeto. Os testes que gravam usam o ambiente isolado da equipe, com PostgreSQL local na porta `55448`, API na `3018` e Web na `5198`.

```powershell
pnpm test:app:completo
pnpm test:desktop
pnpm --filter @ludora/desktop build
pnpm --filter @ludora/api exec tsx tests/paulista-operacional.integration.ts
node apps/desktop/tests/paulista-operacional-smoke.cjs
node apps/desktop/tests/clubes-smoke.cjs
node apps/desktop/tests/usuarios-smoke.cjs
node apps/desktop/tests/manutencao-smoke.cjs
```

Os scripts Electron pressupõem o Playwright acessível pelo Node, a API isolada ativa e o build desktop atualizado. Veja a [sequência de preparação do ambiente isolado](2026-11-08-painel-operacional.md#reproduzir-os-testes-com-dados-isolados). Para consultar CEP em tempo real nesse ambiente, inicie a API sem a flag `--email-isolado`, que bloqueia chamadas externas durante os testes de e-mail.

- `pnpm test:app:completo` passou 530 testes. `pnpm test:desktop` passou 4. O build do Electron e a checagem TypeScript do Web e do Mobile passaram.
- Chamado e Área da equipe no Electron. Suporte no Web com 1380 e 393 px. [Chamado manual](../../test-results/revisao-visual/operacao-chamado-escuro.png) · [Suporte em tela estreita](../../test-results/revisao-visual/operacao-suporte-393.png)
- Fila expandida, comparação e chamado técnico em claro e escuro. [Comparação](../../test-results/paulista-operacional/comparacao-escuro.png) · [Aviso do clube no Web](../../test-results/paulista-operacional/web-aviso-clube.png)
- Cadastro, CEP, edição de atleta e reutilização de time. [Estrutura](../../test-results/clubes/estrutura-claro.png)
- Pausa e reativação de uma operação com impacto confirmado no Web. [Bloqueio com protocolo](../../test-results/manutencao/web-bloqueio.png)

## Banco e limites

Esta rodada reutiliza as tabelas existentes e acrescenta zero migrations. Os cenários foram gravados com dados de teste. O CEP usa [ViaCEP](https://viacep.com.br/) e a [BrasilAPI](https://brasilapi.com.br/docs#tag/CEP) como alternativa. O CEP `01001-000` foi usado na validação. Outro CEP pode depender da cobertura das fontes e permite preenchimento manual.

- O reaproveitamento seleciona um time por vez. A associação oficial de uma equipe da Federação segue pelo fluxo próprio do Paulista.
- W.O. e adiamento ficam identificados na publicação oficial e exigem tratamento próprio antes de virar um resultado local. Partidas que já existiam preservam seu estado local nesses casos.
- A entrada de clube indisponível foi testada no Web pela API pública e checada por TypeScript no app. A validação do Mobile em aparelho está pendente.
- A solicitação de correção chega à equipe operacional do clube pela aba Avisos do campeonato.
- O Web público usa o cabeçalho para a conta, com o ícone de suporte ao lado. A gestão usa o rodapé da barra lateral e o menu Mais no celular.

## Prompt para outro chat

> Leia este handover e os arquivos do Ludora que ele aponta. Ensine do zero em português, usando exemplos novos com nomes em inglês. Comece pelo caminho de um clique no bloco até o envio de um chamado e explique props, estado, função de retorno e validação. Depois mostre como a API distingue publicação, agenda e divergência, por que usa transação e como sabe se um placar é local ou oficial. Por fim, explique como o ID de um time reaproveitado preserva seus jogos e como reproduzir um teste por vez. Mostre trechos pequenos e explique o papel de cada linha.
