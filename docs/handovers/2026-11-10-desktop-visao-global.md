# Visão global do Desktop — 10/11/2026

## Alterações

- Atalhos de Chamados, Manutenção e Federação com contagens reais e estados de atenção. Fonte indisponível é mostrada como desconhecida, sem substituir falhas por zero.
- Blocos compactos Agora e Saúde dos serviços. Conexões correspondem aos sockets Web/App nesta instância da API, não a usuários únicos ou operadores por partida.
- Configuração de e-mail e habilitação do Paulista não são apresentadas como testes de entrega ou de sincronização.
- Atualização única no topo; dados anteriores permanecem visíveis em falhas. Diagnóstico mantém seu próprio horário de consulta.
- Quatro totais em faixa compacta. Clubes com tabela padrão, ordenação crescente/decrescente/padrão, busca local e alternativa em cards.
- Aviso e lista de partidas ainda AO_VIVO há mais de 24 horas. Calculado pelo dia civil e horário brasileiro; sem horário, considera o fim do dia. A revisão apenas consulta e direciona ao clube. Nenhuma partida, inclusive de seed, é encerrada ou modificada.
- Permissões de Suporte e Desenvolvedor preservadas; a nova consulta operacional é exclusiva do Superadmin.

## API e compatibilidade

GET /admin/overview/operacao é uma adição protegida pelo middleware Superadmin existente. Não altera /admin/overview nem as respostas usadas pelo Web/Mobile. Não requer migração. Contagens da Federação reutilizam divergenciaPlacar e pendenciaDeCalendario, com os mesmos estados abertos da fila administrativa; não acessam o site externo nem iniciam sincronização. Falhas independentes produzem null na seção correspondente.

## Verificação

Builds com checagem de tipos de API e Desktop. Quatro testes novos do resumo operacional com banco simulado: somente leitura, divergências, falhas parciais e limites de 24 horas. Suíte Desktop: 14 testes. Navegação simulada: seis cenários de tamanho/tema/papel. Operações simuladas: 1440/900/640 px, busca, alternância de visualização, ciclo da ordenação, revisão sem escrita, atualização com falha e responsividade da sidebar.

Os testes não acessam nem modificam o banco real. Não foi medida melhoria de velocidade no backend publicado. A lista de revisão não encerra partidas nem oferece edição de súmula no Desktop.

## Refinamento de 10/11 — início real, visual e lembretes

A regra anterior (data agendada + 24 horas) foi substituída. Agora a consulta usa o registro mais recente de mudança de status da AuditoriaPartida e só classifica como atrasada a partida ainda AO_VIVO cujo STATUS_AO_VIVO ocorreu há mais de 24 horas. Uma data agendada antiga não é evidência. Partidas sem histórico de início ficam separadas, com duração desconhecida. O fluxo legado também passou a salvar as mudanças de status dentro da mesma transação. Nenhuma data histórica foi inventada ou alterada; não há migração.

Verificação somente de leitura no banco configurado em 10/11/2026 às 12:07 UTC: 27 AO_VIVO, 1 com mais de 24h comprovadas, 26 sem registro do início. O painel consulta novamente a operação a cada minuto enquanto visível e ao recuperar foco; exibe horário de consulta. A contagem é uma fotografia dessa consulta, não uma garantia de atualização instantânea.

Ações de atenção usam superfícies cinzas e texto claro; só pequenos pontos sinalizam o estado. Aviso de revisão neutro com marcador discreto. Totais centralizados por seção. Escudos cinza com iniciais claras. Cards de clubes com estatísticas distribuídas em três colunas, sem empilhamento acidental. Busca mantém o componente CollectionSearch compartilhado com o Web.

No modal, cada confronto mostra dois escudos, horário real de início ou duração desconhecida. O envio do lembrete exige ação explícita e seleção de um administrador ou técnico habilitado do organizador, não suspenso. A API confere novamente status, início e acesso do destinatário. Uma trava transacional por partida impede envios simultâneos; o registro da auditoria impede outro envio por 24h mesmo se a notificação for excluída. Aviso salvo no sistema e emitido por Socket.IO; push assíncrono respeita preferências existentes e sua entrega não é garantida. Se a súmula foi transferida, o texto orienta o organizador a solicitar encerramento ao operador. O lembrete não altera o status nem atualiza Scout por conta própria.

GET/POST /admin/overview/partidas/:id/lembrete usam a proteção Superadmin existente. Não foi enviado nenhum lembrete a usuários reais na validação. Testes de envio usam banco e transporte simulados.
