# Auditoria do Desktop — 09/11/2026

## Escopo

Revisão do aplicativo Electron e de suas telas administrativas. Foram preservadas as alterações locais anteriores. A implementação desta revisão está concentrada em `apps/desktop`; não houve alteração de contratos, rotas ou banco da API, nem de arquivos do Web, Mobile ou importação da Federação.

## Organização e interface

- Navegação organizada em Gestão, Operação e Sistema, respeitando o papel da conta. Visão global fica primeiro para quem tem acesso.
- Controle de expansão dentro da sidebar; logo oculto quando ela está contraída. Cabeçalho e conteúdo usam o mesmo alinhamento horizontal.
- Superfícies, campos, botões, tabelas, mensagens e modais seguem a identidade existente do Web, com ajustes delimitados ao Desktop.
- Distribuição responsiva baseada também na largura disponível do conteúdo: a sidebar aberta não deixa os cartões comprimidos ou sobrepostos.
- Visão global: indicadores existentes, acessos diretos a operações e cartões de clubes com estatísticas legíveis.
- Área da equipe: diagnóstico reunido em uma seção com horário da consulta e estados mais claros. Ela continua separada da Visão global porque atende também contas internas com permissões menores. Banco e integrações mantém o diagnóstico técnico detalhado.
- Clubes: situação e plano separados, busca e plano preservados na URL e no retorno de um detalhe. O fluxo de reaproveitar um time não deixa dois modais visíveis simultaneamente.
- Usuários: identidade da conta em destaque e agrupamento de vínculos, papel interno e situação da conta. Mantidas a revisão e as confirmações de alterações de acesso.
- Chamados e manutenção: seletores compactos para opções extensas, agrupamentos de campos e instruções sob demanda. Valores preenchidos e confirmações são preservados diante de falhas.
- Banco: uma falha de atualização preserva o último diagnóstico e informa o erro. Ajustes: troca de servidor tem revisão explícita e falhas de validação preservam a sessão.
- Campeonato Paulista: ajustes visuais delimitados ao Desktop; cálculo, publicação, sincronização e dados oficiais não foram alterados.

## Problemas corrigidos

- Regras responsivas importadas do Web ocultavam o cabeçalho de Chamados em janelas pequenas, sobrepondo o botão Novo chamado às abas. Foi aplicada uma regra específica do Desktop.
- Chamados consultava as opções e contadores novamente a cada busca digitada. Essas consultas agora acompanham a atualização da fila, separadas do texto pesquisado.
- Leituras GET simultâneas idênticas podiam duplicar o transporte. Agora compartilham apenas a solicitação em andamento; respostas concluídas não são armazenadas como cache. Escritas e mudanças de sessão limpam esse agrupamento.
- Uma resposta 401 de uma sessão antiga podia encerrar uma sessão nova. A expiração agora verifica se token e servidor ainda correspondem à solicitação que falhou.
- Falha inesperada na restauração da autenticação podia manter o carregamento. Agora retorna à entrada.
- Logs atualizavam/ordenavam a interface entrada a entrada e seu acompanhamento podia rolar a página inteira. Agora chegam em lotes a cada 100 ms, com limite de 1.000 entradas e rolagem interna do console. Eventos e temporizadores são liberados ao sair.
- Formulário de vínculo do clube recebeu trava durante o envio para impedir novas submissões pelo controle enquanto salva.
- Erros de renderização de uma página possuem recuperação local, preservando a navegação administrativa.

## Operações nativas e segurança

Logs agora oferecem **Copiar exibidos** e **Exportar .txt**, respeitando os filtros atuais. A exportação abre o diálogo nativo de salvamento.

A interface envia somente IDs; o processo principal seleciona registros do histórico já autorizado. Não aceita texto de log ou caminho de arquivo arbitrário do renderer. As operações exigem SUPERADMIN, origem confiável do renderer e sessão válida; a sessão é verificada novamente após o diálogo de salvar.

Foram mantidos isolamento de contexto, sandbox, validações de IPC, restrições de navegação e token no processo principal. Nenhuma biblioteca foi adicionada.

## Evidências de performance

- Separação das páginas em carregamento sob demanda: o arquivo JavaScript de entrada do renderer passou de **824,37 kB para 474,94 kB** no build local desta revisão, cerca de **42% menor**. É uma comparação do arquivo de entrada sem compressão, não do tamanho total do aplicativo ou de todos os chunks.
- Teste unitário: 20 leituras simultâneas da mesma chave produzem uma execução do transporte; uma nova leitura após a conclusão executa outra solicitação.
- Simulação de 1.500 logs mantém 1.000 elementos; pausa/retomada, filtros e saída da tela foram verificados.
- Simulação de buscas sucessivas confirmou que as opções de filtro de Chamados não são recarregadas pelo texto da busca.

Não foi medida melhoria de FPS, latência de API real ou consumo de memória em uso prolongado. Os ganhos acima se limitam às evidências descritas.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Build do Desktop, incluindo TypeScript de main/preload e renderer | Passou |
| Testes unitários do Desktop | 10 passaram |
| Navegação, permissões, sidebar e layout | 6 cenários passaram, entre 640 × 480 e 1440 × 900, nos temas claro/escuro |
| Controles, teclado, filtros, estados e modais | 4 cenários passaram |
| Operações administrativas com serviços simulados | 3 cenários passaram: 1440 escuro, 900 claro e 640 escuro |
| Electron real com perfil temporário e serviços simulados | Passou |
| Conferência de whitespace do diff | Passou; apenas avisos locais de conversão LF/CRLF do Git |

As simulações operacionais cobrem navegação pelas páginas, retorno de clube com filtros, revisão de suspensão, falha preservando formulário, criação de chamado após erro, criação de pausa após erro, logs em rajada, cópia/exportação filtrada, liberação de listener, cancelamento da troca de servidor, falha de configuração e sessão expirada.

O teste do Electron real cobre login, preload/IPC, proteções da janela, autorização dos logs, salvamento temporário e resposta 401 atrasada de uma sessão anterior. A escrita na área de transferência e o seletor de arquivo foram substituídos no teste para não interferir no ambiente do usuário.

Capturas de validação: `test-results/desktop-navigation`, `test-results/desktop-ui` e `test-results/desktop-operations`.

Comandos principais:

```powershell
pnpm --filter @ludora/desktop run build
pnpm --filter @ludora/desktop run test
node apps/desktop/tests/navigation-smoke.cjs
node apps/desktop/tests/ui-smoke.cjs
node apps/desktop/tests/operations-smoke.cjs
node apps/desktop/tests/electron-isolated-smoke.cjs
```

Os scripts visuais precisam de Playwright e Microsoft Edge; neste ambiente foi usado o Playwright fornecido pelo runtime local, via NODE_PATH.

## Limites e próxima validação

- Nenhuma operação administrativa foi executada contra banco ou API real. Criação/edição real de clubes, integrações externas, entrega de e-mail, sincronização da Federação e políticas do backend precisam de homologação com contas/dados próprios para teste.
- Web e Mobile não tiveram seus arquivos alterados, e não foram declarados validados integralmente por este trabalho. A compatibilidade é preservada por manter contratos e componentes de origem intactos.
- Não foram gerados nem validados instaladores assinados, atualização automática ou execução em macOS/Linux.
- As proteções de envio impedem cliques repetidos durante o processamento; garantia transacional e idempotência no servidor continuam dependendo das regras existentes da API.
- Revisar desempenho com volume real de clubes/usuários e rede do ambiente publicado antes de afirmar ganhos de tempo para o usuário.
- Não foi realizado commit ou push.

## Refinamento posterior solicitado — Visão global, Usuários e Logs

- A página Área da equipe foi removida. O diagnóstico está integrado à Visão global; o endereço antigo redireciona para ela. Suporte e Desenvolvimento acessam os atalhos e o diagnóstico já permitidos, sem consultar os indicadores globais exclusivos de SUPERADMIN.
- Barras de busca usam o mesmo CollectionSearch de Partidas do Web. A altura dos controles principais foi padronizada em 44 px no Desktop; a busca de usuários no vínculo do clube também foi convertida.
- Usuários fica apenas em linhas de 84 px. Conta, Clube, Cargo e Situação permitem ordenar pelo cabeçalho em ciclo crescente → decrescente → padrão, dentro dos grupos existentes. A ordem original da consulta é restaurada no terceiro clique. A aba Contas por clubes foi substituída pelo seletor Clube em Mais filtros, com identificação dos filtros ativos e limpeza.
- Logs foi reorganizado com nível, busca, período, ampliação do console e menu sobreposto. O menu oferece copiar/exportar os exibidos, ordenar, quebrar linhas e limpar a tela. Datas separam o histórico e o controle de pausa fica no rodapé.
- O período filtra somente o histórico recebido nesta sessão (máximo 1.000 registros); não foi criada consulta histórica no servidor. Copiar/exportar respeita também a ordem exibida, com os mesmos controles de autorização no processo principal.
- Foram acrescentados testes da ordenação cíclica, alturas uniformes, filtro de clube, menu de logs, ampliação/restauração e alinhamento do rodapé em janelas pequenas. Os testes unitários agora somam 11 casos aprovados. As alterações seguem restritas ao Desktop e sua documentação.

### Ajuste dos seletores de logs

- Nível e período usam o mesmo menu sobreposto de opções, com bolinha azul na seleção, navegação por teclado e retorno do foco ao fechar.
- Um único seletor Ao vivo oferece última hora, 4/24 horas e 2/7/14/30 dias. Não há intervalo personalizado ou seletor Local/UTC; os horários seguem o fuso do dispositivo. Os períodos continuam restritos aos registros recebidos, sem promessa de retenção no servidor.
- A opção Acompanhar novos foi removida. Pausar/Retomar permanece, e selecionar Ao vivo retoma a atualização.
- Um teste unitário adicional valida os limites dos períodos, datas inválidas e diferenças de fuso. Total: 12 testes unitários aprovados.

## Refinamento — Banco e integrações

- Banco e migrações foram reunidos em um diagnóstico compacto. Pendências são âmbar e falhas vermelhas; comparação indisponível aparece como não verificada, sem presumir zero.
- Integrações têm estado e escopo da verificação separados: Scout responde à consulta de saúde; configuração de e-mail/Storage não implica teste de envio/upload.
- Indicadores do servidor ficam em faixa própria. Registros por tabela vão ao final, agrupados por área, com rótulos legíveis e números formatados. Chaves adicionais recebidas da API continuam visíveis em Outros registros.
- Atualização mostra horário e mantém os dados anteriores durante o carregamento; erro parcial apresenta aviso sem apagar o diagnóstico anterior. Não foram alteradas APIs, banco, permissões ou dados da Federação.
- Build aprovado. A simulação do renderer foi ampliada para conferir hierarquia dos blocos, escopo das verificações e preservação de dados após falha parcial.

## Logs — cores, filtros e leitura sem interrupção (10/11)

- Campos HTTP separados em método, rota e status; mensagens desconhecidas e auditorias permanecem intactas. Status 2xx verde, 3xx neutro, 4xx âmbar e 5xx vermelho. Métodos têm cor própria, sem representar sucesso ou falha.
- Duração destacada a partir de 1.000 ms (âmbar) e 3.000 ms (vermelho), com limites configuráveis nesta sessão em Mais filtros. A duração existente é medida no middleware da API até o evento finish; não representa tempo total de rede/renderização.
- Mais filtros inclui método, família de status e Somente lentas. Como interpretar explica as cores e limites sob demanda.
- Cada registro abre detalhes por clique ou teclado, com cópia individual usando o IPC autorizado já existente. Nenhum endpoint, token ou corpo adicional foi exposto.
- Ao ler registros antigos, a coleta continua sem forçar rolagem. O botão Novos registros retorna ao extremo correspondente à ordenação. Contagem considera apenas novos IDs visíveis, evitando duplicações e registros filtrados.
- Build e 14 testes unitários aprovados. Verificação visual/operacional contempla filtros, detalhes, cópia individual, limites personalizados e preservação da linha em leitura ao inserir registros no topo.

## Componentes reutilizáveis de dropdown (10/11)

- `DesktopMenu` e `DesktopSelect` centralizam a apresentação e interação dos menus aprovados nos logs.
- Itens de ação, rádio, toggle, rótulo e separador são componentes próprios; opções aceitam ícones e estados desabilitados. Seletores suportam rádio azul com centro branco ou ponto azul.
- Estilos comuns foram extraídos para `components/DesktopMenu.css`, sem dependência das classes da página de logs. Ações e rádios fecham; toggle mantém o menu aberto.
- Logs e seletor de período já usam os componentes. Nenhum filtro de outras telas foi convertido automaticamente.
- Guia de uso: `docs/desktop-componentes-menus.md`. Build aprovado; cenários operacionais existentes verificam menus, seleção e toggle por mouse/teclado.
