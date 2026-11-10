# Cadastro de clubes — agrupamento de adversários e seleção de SUBs

## Origem do problema e conferência da Federação

O modal de reaproveitamento consultava `Time` local e agrupava por nome exato **e clube de origem**, depois de limitar a consulta a 60 linhas. `Aurora FC`, `Aurora FC sub-7` e cópias em clubes diferentes apareciam separados; o nome do SUB entrava indevidamente na identidade apresentada.

Aurora FC e Estrela Azul são também nomes definidos nas seeds locais (`services/api/prisma/seed.ts` e `seed-clubes.cjs`). O endpoint deste modal já excluía os times com `FpfsTime`; portanto os prints não demonstram erro de importação do portal oficial.

Na fonte consultada em 10/11/2026, a Federação publica eventos por temporada/divisão/categoria. Um mesmo clube pode ter IDs diferentes entre categorias: Ocian no [SUB-7/A2, equipe 12423](https://eventos.admfutsal.com.br/evento/900/equipe/12423), e no [SUB-12/A3, equipe 13041](https://eventos.admfutsal.com.br/evento/925/equipe/13041), com o mesmo endereço e telefone publicados. Não se deve presumir que exista um ID único do clube entre todos os SUBs, nem substituir esses IDs por um agrupamento de nome.

## Implementação

- Listagem com um card por nome-base do clube, independentemente dos SUBs e das cópias locais em outras origens.
- Normalização de caixa, espaços e acentos. Só remove o sufixo `sub-N` quando ele corresponde à categoria do registro; conserva A/B e nomes distintos. Não usa correspondência aproximada para criar vínculos.
- Agrupamento no servidor **antes** da paginação. Consulta agrupada com páginas de 30 clubes (teto 50), busca e botão carregar mais. A busca aceita também o sufixo SUB de rascunhos antigos.
- Na confirmação, seleção direta de SUBs, divididos em Iniciação/Base. Bloqueia confirmação sem seleção ou sem registros elegíveis.
- Detalhes de origem opcionais permitem desmarcar um cadastro homônimo que não seja do clube. Os checkboxes refletem os SUBs selecionados.
- Categorias escolhidas passam para a etapa Configuração e persistem no rascunho existente. Caso sejam alteradas ali, o envio filtra novamente os vínculos pelos SUBs finais.
- Reutiliza os IDs dos times e jogos; não renomeia registros históricos nem move categorias de outro clube. Nenhum vínculo oficial FPFS é criado ou removido por esse caminho. A revisão oficial continua no painel Paulista.
- Criação revalida disponibilidade, nome-base, categorias e IDs em transação serializável. Rejeita registro de outro grupo, registro oficial protegido, seleção desatualizada ou já vinculada e categoria de origem ausente nos SUBs do novo clube.

Agrupar o nome é uma sugestão visual para confirmação humana, não prova de identidade jurídica. Patrocínios, abreviações diferentes e equipes A/B não foram fundidos automaticamente. Alterar categorias depois continua disponível em Estrutura; isso não confirma, por si só, outras identidades oficiais.

## Compatibilidade e arquivos

- `GET /admin/clubes/cascas?agrupar=clube`: resposta `{ grupos, proximo }`. Sem esse parâmetro, mantém a lista legada.
- `GET /admin/clubes/cascas/:id/previa?agrupar=clube`: agrega os cadastros locais para conferência, com SUBs disponíveis e amostra dos jogos recentes.
- `POST /admin/clubes`: campo opcional `casca_agrupada`; contratos antigos sem o campo mantidos. `casca_ids` contém apenas os registros escolhidos e `subs` as categorias finais.
- Helper novo `services/api/src/modules/admin/clubes-candidatos.ts`; interface em `ReaproveitarTime.tsx`, integração no cadastro e validação do rascunho; tipo `NovoClube` estendido de forma aditiva.
- Nenhuma biblioteca ou migração nova; nenhum comando de alteração do banco habitual, sincronização da Federação ou envio real executado nesta tarefa.

## Verificação

- Regressão geral: **583 testes passaram**, zero falhas. Build TypeScript da API incluído.
- Build desktop com typecheck de main/preload/renderer concluído.
- Integração em PostgreSQL isolado: agrupamento entre origens, paginação, busca com SUB, seleção parcial, exclusão de registros arquivados/já vinculados/oficiais, injeção de outro grupo, rejeição de seleção antiga e preservação de placar/IDs.
- Interface com IPC simulado em **1440×900 escuro, 900×700 claro e 640×480 escuro**: clube único, alternância dos SUBs, confirmação desabilitada quando vazia, conferência da origem, rascunho reaberto e payload limitado ao SUB escolhido. Demais cenários de cadastro/acessos/convites do teste também passaram.
- Testes específicos da normalização incluem acentos, A/B, nomes próximos, sufixo incompatível e ausência de categoria.
- Evidências locais: `test-results/clubes-grupos-*.log` e `test-results/desktop-clubes-ui/reaproveitar-{1440,900,640}.png`.

Limites: os testes de escrita usaram o banco isolado e dados próprios removidos no encerramento. Não foi feita uma fusão retroativa de registros existentes em produção nem uma nova importação da Federação. A comparação da fonte foi de leitura; não houve consulta a dados de atletas para alimentar o cadastro.
