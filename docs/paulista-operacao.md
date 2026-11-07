# Paulista — operação atual, 06/11/2026

A expansão para todos os SUBs confirmados e clientes temporários está no [handover multiclube](handovers/2026-11-06-paulista-multiclube.md), com [manifesto de IDs](dados/paulista-multiclube-20261106.json). Os dados de demonstração estão no banco normal do projeto. O procedimento de limpeza é somente leitura e não foi executado.

A etapa posterior de experiência web (abertura pela lista normal, visão geral, classificação e chaveamento) está documentada no [handover do web](handovers/2026-11-06-paulista-web.md). Ela não aplicou novas migrations nem importações no Supabase; as operações de banco descritas abaixo pertencem à etapa anterior.

## O que muda para quem usa

O **clube consulta** os campeonatos vinculados às suas equipes no web. A **equipe Ludora administra** descoberta, identidades e conflitos no Electron. Ser SUPERADMIN não faz os botões técnicos aparecerem no web do clube.

O web escolhe automaticamente um evento em que o clube tem participação confirmada, começa pelos seus jogos e permite consultar todos os jogos daquele evento. Iniciação/Base e SUBs usam o componente visual atual. Classificação é oficial e separada por fase/chave; a visão geral da fase só é oferecida como tal quando há chave única. Não se fabrica ranking geral unindo chaves com regras desconhecidas. O cálculo 3/1/0 continua identificado como conferência provisória.

No desktop, abrir **Campeonato Paulista**. Os filtros mostram descobertos, acompanhados, identidades a revisar e erros. Abrir um campeonato mostra candidatos, vínculos, divergências e auditoria. Não há campo obrigatório de ID nem botão “Importar evento” no fluxo normal.

Novo clube: o cadastro consulta candidatos com nome, escudo, categoria e quantidade de jogos conhecidos. A escolha leva à revisão na área Paulista depois de criar o clube. **Criar o clube não confirma a identidade automaticamente.** A confirmação seguinte registra motivo e preserva a casca e os jogos existentes.

Vínculo incorreto sem contribuição própria pode ser desfeito. Se houver escalações/eventos próprios ou for a âncora da agenda, a reversão é bloqueada. “Registrar revisão assistida” abre um registro auditável com o procedimento: conferir identidade, inventariar participações e contribuições, definir transferência, validar histórico. O sistema não executa transferência automática nesses casos; essa ferramenta continua pendente.

## Como iniciar normalmente

Na raiz, primeiro terminal:

```powershell
pnpm dev
```

Inicia os quatro serviços habituais: API 3000, ML 8000, Expo normalmente 8081 e web normalmente 5173. O terminal precisa ficar aberto. Não precisa Docker para o uso normal: a API usa o Supabase configurado em `services/api/.env`.

Segundo terminal:

```powershell
pnpm dev:desktop
```

No Electron, entrar com conta de plataforma SUPERADMIN. Em Ajustes, a API deve apontar para `http://localhost:3000` para testar este código local. Uma configuração antiga apontando ao Render não passa a executar o código local por abrir o Electron.

| Mudança | Comportamento |
|---|---|
| React/CSS web | Vite atualiza a tela por HMR |
| React/CSS do Electron | electron-vite atualiza o renderer por HMR |
| Processo main/preload do Electron | electron-vite recompila; pode recarregar/reabrir a janela |
| TypeScript importado da API | Node watch + tsx reinicia o servidor; conexão Socket.IO reconecta |
| Python | Uvicorn reload, comportamento preservado |
| `.env` | Reiniciar o respectivo comando; não confiar em HMR |
| Schema Prisma | Revisar/aplicar migration e gerar client; parar APIs antes de gerar no Windows se houver DLL bloqueada |

`pnpm build:api`/`pnpm start:api` continuam sendo build e execução de produção. `pnpm dev:paulista`, que já existia nas alterações locais, foi preservado como visualização isolada opcional; não é necessário nem o caminho de uso normal.

## Automação sem adivinhar

1. Consulta o seletor real de temporadas, limitado ao ano atual e próximo ano publicado.
2. Descobre somente título Paulista (16), suas divisões e SUBs 7, 8, 9, 10, 12, 14, 16 e 18; no máximo 64 eventos e duas consultas de equipes simultâneas.
3. Salva catálogo e equipes sem associar por nome. Se o formato falhar, mantém o catálogo válido anterior.
4. IDs já confirmados permitem acompanhamento. Nomes geram candidatos para decisão humana.
5. Só eventos acompanhados recebem importação periódica de jogos/classificação. A versão oficial é separada de scout/placar local.
6. Agenda é distribuída aos SUBs de clientes confirmados. Adversários viram cascas sem contas ou permissões. Não replica jogos entre categorias nem estima horários.

O executor confere agendamentos na partida da API e a cada minuto. Descoberta e sincronização têm intervalo de 24h após sucesso; falha agenda nova tentativa em 1h. Um lease no PostgreSQL reduz execução simultânea por várias APIs. Ele expira em 15 minutos; não é uma fila de jobs durável com renovação de lease.

O processo da API precisa permanecer ligado. Fechar `pnpm dev` interrompe a execução local. Flags locais não habilitam o job em um Render ainda com código antigo. Para operação contínua, publicar o backend atualizado e configurar as flags no ambiente que ficará disponível.

**2027 não foi encontrado publicado nesta verificação.** Não foi criado campeonato 2027. A conferência de outras categorias do Ocian continua exigindo confirmação individual; o piloto real ativado é o Sub-7/A2.

## Supabase: o que foi aplicado

Destino conferido sem divulgar credenciais: PostgreSQL `postgres`, schema `public`, pooler `aws-1-sa-east-1.pooler.supabase.com`, porta administrativa 5432 (aplicação 6543).

- Backup custom do schema `public`, incluindo dados da aplicação e migrations: `.local-demo/backups/2026-11-06/ludora-public.dump`, ignorado pelo Git. Contém dados privados; não compartilhar ou versionar. Não é backup dos schemas Auth/Storage da plataforma Supabase.
- Restauração verificada em PostgreSQL 17 separado. Os três clubes originais foram recuperados; migrations e leitura autenticada de Competições passaram nessa cópia.
- Aplicadas `20261105120000_paulista_piloto` e `20261106120000_paulista_operacao`: nove tabelas novas. Sem novas colunas ou remoções nas tabelas antigas. `prisma migrate status`: atualizado.
- Catálogo real: 24 eventos publicados de 2026. Importado evento 900, Sub-7/A2, 297 jogos do Paulista reconhecidos; fases União excluídas.
- Vínculo confirmado: clube 2 → equipe externa 12423, Sub-7 local 9. Cidade cadastrada permaneceu São Paulo, divergência já conhecida; identidade foi confirmada pelo usuário como Ocian de Praia Grande.
- Distribuídas 25 partidas do Ocian. Adversário da amostra ADC Marvel (12241) tem casca e histórico, sem nova conta/administrador/jogadores.
- Competição antiga Festival Ludora e suas partidas foram preservadas. Corrigido um falso conflito: mesma data, com adversários distintos, não equivale ao mesmo jogo.
- `.env` local da API recebeu somente `PAULISTA_ENABLED=true` e `PAULISTA_SYNC_DIARIA=true`. Arquivos de ambiente de outros desenvolvedores e serviços remotos não foram alterados.

O código ainda precisa ser publicado nos serviços remotos. APIs antigas que apontam ao mesmo banco não recebem automaticamente as novas proteções de edição por uma migration. Durante essa transição, evitar operar o Paulista por versões antigas.

## Revisão e desativação

“Manter oficial” registra decisão e motivo; não ajusta silenciosamente placar, jogador ou evento local. Uma nova diferença reabre a pendência; repetir a mesma fonte não apaga a decisão anterior. Alterações oficiais de data/local/resultado aparecem para revisão; troca de identidade/mando que afete a chave do jogo interrompe a importação e exige análise, preservando a versão válida.

Para parar consultas automáticas: `PAULISTA_SYNC_DIARIA=false` na API e reiniciar. Para desativar todo o módulo: também `PAULISTA_ENABLED=false`. É possível pausar um campeonato pelo desktop, com motivo. Desativar flags não apaga catálogo, partidas ou histórico.

`git pull` não reverte banco. Em incidente, parar sincronizadores, preservar evidências e revisar a recuperação em banco separado. A restauração do dump já foi exercitada; restaurar no Supabase exige planejar conflitos com dados inseridos depois do backup. Não executar restore destrutivo por rotina.

Testes destrutivos continuam restritos por código a bancos locais descartáveis. Não apontar essas suítes ao Supabase.
