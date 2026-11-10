# Relatório consolidado de mudanças — Ludora Desktop

**Data:** 10/11/2026  
**Aplicativo:** Ludora Admin, desenvolvido em Electron  
**Escopo:** melhorias realizadas nesta rodada de interface, navegação, operação, desempenho e segurança do desktop.

## 1. Objetivo e resultado

O desktop foi reorganizado como painel interno de administração do Ludora, preservando as funcionalidades existentes e aproximando sua apresentação da identidade visual do Web e Mobile. O foco foi facilitar a leitura das informações, tornar os controles consistentes, adaptar as telas à largura da janela e reduzir problemas de atualização e navegação.

Este relatório descreve o estado final consolidado. Sugestões abandonadas ou substituídas durante as revisões não são apresentadas como funcionalidades atuais. As alterações desta rodada estão concentradas em `apps/desktop` e documentação; não alteram os dados da Federação, o banco ou os contratos da API.

## 2. Navegação e identidade visual

- Visão global passou a ser a primeira entrada da navegação.
- Sidebar organizada nas seções **Gestão da plataforma**, **Operação** e **Sistema**, com ícones associados à finalidade das telas.
- Controle de expandir/recolher posicionado dentro da própria sidebar, ao lado do logo. Quando contraída, o logo cede espaço ao controle.
- Preferência de sidebar preservada nas janelas maiores. Em janelas menores, a navegação se adapta ao espaço disponível.
- Removido o texto “Administrador Ludora” do cabeçalho superior. Cabeçalho e conteúdo usam o mesmo alinhamento horizontal.
- Mantidos o seletor de tema, a identificação do servidor da API e o estado da conexão em tempo real.
- Buscas padronizadas com o componente utilizado em Partidas do Web. Controles principais do desktop padronizados em 44 px.
- Refinados fundos, bordas, espaçamentos, tabelas, estados vazios, mensagens de erro, modais e skeletons.
- Layouts consideram a largura do conteúdo, inclusive o espaço ocupado pela sidebar expandida.

## 3. Mudanças por tela

### Visão global

- Indicadores da plataforma com melhor distribuição e hierarquia.
- Atalhos para chamados, manutenção e integração com a Federação, conforme as permissões da conta.
- Diagnóstico dos serviços incorporado à página, com horário da consulta e atualização própria.
- **Área da equipe removida como tela separada.** Seu endereço antigo redireciona para Visão global.
- Contas de Suporte e Desenvolvimento recebem a apresentação compatível com seu papel; indicadores globais exclusivos de SUPERADMIN não são consultados por elas.
- Cartões dos clubes reorganizados para separar identidade, localização, plano/situação e estatísticas.
- Uma falha na atualização preserva os últimos dados carregados e apresenta aviso.

### Clubes e detalhes do clube

- Padronização visual de diretório, indicadores, seções e formulários.
- Situação do clube e plano apresentados separadamente.
- Busca e filtro de plano preservados na URL e ao retornar de um detalhe.
- Ajuste no fluxo de reaproveitar time existente para evitar dois modais visíveis simultaneamente.
- Bloqueio dos controles de envio durante o salvamento de vínculos, reduzindo submissões repetidas pela interface.

### Usuários

- Exibição em **linhas por padrão**, removendo a alternância Linhas/Blocos.
- Linhas com altura uniforme de 84 px e truncamento de conteúdos longos.
- Ordenação por **Conta, Clube, Cargo e Situação** ao clicar nos cabeçalhos: crescente → decrescente → padrão.
- O terceiro clique restaura a ordem recebida da consulta, mantendo os agrupamentos existentes.
- Removida a aba **Contas por clubes**; a seleção de clube passou para **Mais filtros**.
- Modal de gerenciamento com nome, e-mail e seções mais claras para vínculos, papel interno e situação da conta.
- Mantidas as revisões e confirmações de operações que alteram acesso ou encerram sessões.
- Falhas preservam o formulário e as confirmações já preenchidas.

### Chamados e manutenção

- Melhor agrupamento dos campos, seletores mais compactos e explicações secundárias sob demanda.
- Correção do cabeçalho de Chamados em janelas pequenas, evitando sobreposição entre botão e abas.
- Busca de chamados deixou de recarregar opções e contadores a cada alteração do texto pesquisado.
- Fluxos de criação de chamado e pausa de função preservam os dados após falhas.
- Mantida a revisão do impacto antes de confirmar uma pausa.

### Campeonato Paulista

- Ajustes de apresentação e consistência visual limitados ao desktop.
- Preservados os fluxos existentes de acompanhamento, sincronização e conferência de divergências.
- Nenhuma alteração nos cálculos, publicações ou dados oficiais da Federação nesta rodada.

### Banco e integrações

- Banco e migrações reunidos em um bloco compacto, com conexão, latência, versão do PostgreSQL e contagens.
- Migrações pendentes recebem destaque âmbar; falhas, vermelho. Comparação indisponível aparece como não verificada, sem presumir zero.
- Integrações posicionadas antes das contagens de registros, com ícones e estados explícitos.
- Scout IA distingue serviço respondendo, indisponível, não configurado e disponibilidade não verificada.
- E-mail e armazenamento distinguem **configuração** de **verificação funcional**: a consulta não é apresentada como teste de envio ou upload.
- Indicadores do servidor ficam em seção própria: ambiente, Node, tempo em execução, memória e conexões app/web.
- Super Admins deixou esse bloco técnico.
- Registros por tabela passaram para o final, agrupados em Clubes e elenco, Competições e partidas e Comunicação.
- Rótulos legíveis, valores alinhados e números formatados em português. Chaves adicionais da API continuam visíveis em Outros registros.
- Atualização informa o horário, mantém o diagnóstico durante o carregamento e preserva os dados anteriores em falhas parciais, com aviso.

### Logs ao vivo

- Console reorganizado com busca, nível, período, ampliação e menu de opções.
- Nível e período usam o mesmo estilo de menu sobreposto, com bolinha azul na opção selecionada.
- Seletor **Ao vivo** com última hora, 4/24 horas e 2/7/14/30 dias, sem intervalo personalizado e sem seletor Local/UTC. Horários seguem o dispositivo.
- Cabeçalho, separadores de data e barra de busca receberam fundo mais escuro.
- Removido “Acompanhar novos”; mantidos Pausar/Retomar. Selecionar Ao vivo retoma a atualização.
- Menu com copiar exibidos, exportar `.txt`, ordenar, quebrar linhas longas e limpar a tela.
- Cópia e exportação respeitam filtros e ordem exibida; exportação utiliza o diálogo nativo de salvamento.
- Novos registros são processados em lotes de 100 ms, com limite de 1.000 entradas e rolagem interna do console.
- Menus têm navegação por teclado, fechamento por Escape e retorno do foco ao controle.

**Limite importante:** os períodos filtram apenas o histórico recebido na sessão. Não foi criada consulta histórica no servidor, nem retenção garantida de 30 dias.

### Ajustes e sessão

- Troca de servidor com revisão explícita, apresentando endereço atual e novo antes de confirmar.
- Cancelamento não modifica o servidor. Falhas de validação preservam a sessão.
- Explicação da segurança da sessão conforme a disponibilidade do cofre do sistema operacional.

## 4. Correções técnicas e segurança

- Leituras GET simultâneas idênticas compartilham a solicitação em andamento. A resposta concluída não vira cache permanente.
- Escritas e mudanças de sessão limpam esse agrupamento para evitar reaproveitamento indevido.
- Resposta 401 atrasada de uma sessão antiga não encerra uma sessão nova: token e servidor são conferidos antes da expiração.
- Falha inesperada ao restaurar a autenticação retorna à entrada, evitando carregamento indefinido.
- Erros de renderização de uma página oferecem recuperação local, mantendo a navegação administrativa.
- Eventos e temporizadores dos logs são liberados ao sair da tela.
- Copiar/exportar logs exige sessão válida, papel SUPERADMIN e origem confiável do renderer. O processo principal seleciona registros autorizados pelos IDs recebidos; não aceita texto ou caminho arbitrário do renderer.
- A sessão é conferida novamente após o diálogo de exportação.
- Preservados isolamento de contexto, sandbox do Electron, validações de IPC e armazenamento do token no processo principal.
- Nenhuma biblioteca nova foi necessária nesta rodada.

## 5. Evidências de desempenho

| Mudança | Evidência disponível |
| --- | --- |
| Carregamento de páginas sob demanda | Na comparação registrada na auditoria, o JavaScript inicial passou de 824,37 kB para 474,94 kB, aproximadamente 42% menor. O último build consultado registra 473,93 kB. São arquivos de entrada sem compressão, não o tamanho total do aplicativo. |
| Agrupamento de consultas em andamento | Teste com 20 leituras simultâneas da mesma chave executa um transporte; uma leitura posterior à conclusão faz nova solicitação. |
| Logs em rajada | Simulação de 1.500 entradas mantém 1.000 registros e verifica pausa, retomada, filtros e liberação do listener. |
| Busca de chamados | Simulação confirma que mudanças no texto não recarregam as opções de filtros. |

Não foram medidos ganhos de FPS, latência de API real ou consumo de memória em uso prolongado. Não há afirmação de melhoria nessas métricas.

## 6. Validações realizadas durante a implementação

| Validação | Resultado registrado |
| --- | --- |
| Build e verificação TypeScript do desktop | Aprovados, inclusive após a reformulação de Banco e integrações. |
| Testes unitários do desktop | 12 aprovados na última execução registrada. |
| Navegação, papéis, sidebar e layout | 6 cenários aprovados em etapa anterior. |
| Controles, teclado, filtros e modais | 4 cenários aprovados em etapa anterior. |
| Operações administrativas com serviços simulados | 3 cenários aprovados: 1440 × 900 escuro, 900 × 700 claro e 640 × 480 escuro. Última execução inclui a reformulação de Banco e integrações. |
| Electron real com perfil temporário | Aprovado em etapa anterior, com serviços simulados. |
| Conferência do diff | Sem erros de whitespace; há avisos locais de conversão LF/CRLF do Git. |

Foram verificados também ordenação cíclica, menus sem deslocar o conteúdo, limites dos períodos de logs, exportação filtrada, recuperação após falhas e preservação do diagnóstico em erro parcial.

As validações acima foram executadas ao longo da implementação. **A geração deste relatório não representa uma nova execução de todos os testes.** Operações administrativas dos testes utilizaram serviços simulados; não alteraram banco ou API reais.

As capturas estão em `test-results/desktop-navigation`, `test-results/desktop-ui` e `test-results/desktop-operations`.

## 7. Situação da entrega e pontos pendentes

- Mudanças estão no diretório de trabalho local; no momento da conferência deste relatório, ainda há arquivos modificados e novos sem commit. Não foi realizado commit ou push nesta rodada.
- Não foi gerado novo instalador para distribuição.
- Ainda é necessária homologação das operações administrativas com contas e dados próprios de teste: clubes, permissões, integrações externas, entrega de e-mails e sincronização real.
- Não foram validados instaladores assinados, atualização automática ou execução em macOS/Linux.
- Prevenção de cliques repetidos na interface não substitui garantias transacionais e de idempotência do backend.
- Web e Mobile não foram alterados por este conjunto de melhorias do desktop, nem declarados integralmente testados por ele.

## 8. Arquivos de referência

- Navegação: `apps/desktop/src/renderer/src/components/AdminLayout.tsx`.
- Rotas e carregamento sob demanda: `apps/desktop/src/renderer/src/App.tsx`.
- Componentes administrativos: `apps/desktop/src/renderer/src/components/AdminUI.tsx`, `DesktopMenu.tsx`, `ServicesDiagnostic.tsx` e `DesktopErrorBoundary.tsx`.
- Apresentação: `apps/desktop/src/renderer/src/styles/desktop-ui.css` e `desktop-pages.css`.
- Telas: `apps/desktop/src/renderer/src/pages`.
- Operações nativas: `apps/desktop/src/main/ipc.ts`, preload e contratos de comunicação do desktop.
- Consultas e sessão: `apps/desktop/src/renderer/src/services/api.ts`, `apps/desktop/src/shared/inflight.ts` e `apps/desktop/src/main/api-client.ts`.
- Testes: `apps/desktop/tests/desktop-data.test.ts`, `operations-smoke.cjs` e `electron-isolated-smoke.cjs`.
- Registro técnico da auditoria: `docs/handovers/2026-11-09-desktop-auditoria-interface.md`.
