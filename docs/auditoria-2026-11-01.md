# Auditoria do Ludora — 01/11/2026

## Escopo e resultado

Auditoria com correções no web, API, mobile, desktop e Scout IA. Foram priorizados controle de acesso, isolamento entre contas/clubes, estabilidade assíncrona, dependências e componentes compartilhados. A identidade visual e as permissões de negócio foram preservadas. Não foram executadas migrations, alterações de produção ou exclusões de dados reais.

Base analisada: commit `c32317df1ab42fc842a9423874a2caed05db6a2c`. As alterações desta auditoria permanecem no diretório de trabalho, sem novo commit ou push.

Este documento registra evidências locais; não certifica ausência de vulnerabilidades nem substitui validação de produção.

## Segurança — implementado e validado

| Problema encontrado | Correção | Evidência |
|---|---|---|
| Possibilidade de assumir identidade reservada de superadministrador por alteração de e-mail ou cadastro por convite | Validação central de endereços reservados; preservado o e-mail da própria conta privilegiada | Testes HTTP de identidade privilegiada e regras administrativas |
| Consulta legada de estatísticas sem verificar previamente o escopo do jogador | Validação de ID, clube e categoria antes de consultar os agregados | Testes de escopo com clube/categoria indevidos e confirmação de que a consulta não é executada |
| Token bruto de convite retornado como diagnóstico | Removido em todos os ambientes; código compartilhável permanece disponível no fluxo autorizado | Testes de geração, envio e reemissão de convites |
| WebSocket permanecia conectado após revogação de sessão ou recuperação de senha | Desconexão dos namespaces público e administrativo; expiração do JWT também encerra a conexão | Testes de sessões e recuperação |
| Rotação de e-mails permitia contornar o limite de tentativas por identidade | Limite agregado por IP, limite por IP/e-mail, memória limitada e `Retry-After` | Testes de abuso alternando e-mails |
| Respostas de erro podiam revelar detalhes de persistência | Respostas genéricas para falhas inesperadas; conflitos de negócio conhecidos preservados | Testes HTTP, inclusive falha de persistência sem vazamento de detalhes |
| JSON inválido e payload excessivo tinham tratamento inconsistente | Erros 400/413/415 e CORS 403 centralizados | Testes do middleware HTTP |
| Respostas sensíveis não explicitavam política de cache | `no-store` para autenticação, convites, notificações, administração e membros; demais respostas privadas/revalidáveis | Testes de cabeçalhos |
| IPC/navegação do Electron aceitavam uma origem mais ampla que o documento autorizado | Comparação de protocolo, host, caminho e query; IPC restrito ao frame principal da janela esperada | 4 testes de regras do desktop |
| Serviço Python sem autenticação entre serviços | Chave privada compartilhada, comparação em tempo constante, exigida em produção; sem chave apenas loopback em desenvolvimento | Testes Python e contrato da chamada feita pela API |
| Resposta do ML podia conter jogadores inesperados ou números inválidos | Validação do lote inteiro antes de qualquer escrita: IDs, duplicações, perfis, scores e valores finitos | Testes demonstram zero escritas para resposta inválida |

Também foram ajustados o limite de senha compatível com bcrypt em atualização de perfil e a ocultação de códigos curtos nos logs administrativos.

O acesso de visitantes ao conteúdo público de outros clubes continua permitido. Seguir um clube não virou requisito de acesso. Permissões de edição permanecem no backend.

## Dependências

O `pnpm audit --json` passou de **110 alertas** (3 críticos, 60 altos, 39 moderados e 8 baixos) para **10 alertas** (0 críticos, 3 altos, 6 moderados e 1 baixo). São alertas do catálogo, não uma contagem de ataques reproduzidos.

Foram atualizados Vite do web, Electron, Axios, compression e dependências transitivas com correções compatíveis, registradas no lockfile e nos overrides do workspace. Não foi adicionada biblioteca de interface ou de cache.

| Alertas Node restantes | Quantidade | Encaminhamento |
|---|---:|---|
| `image-size` | 2 altos | Dependência da cadeia Metro/Expo; requer atualização compatível do conjunto |
| `decode-uri-component` | 1 alto e 1 moderado | Cadeia React Navigation/Expo; evitar override de major sem validar navegação nativa |
| `react-router` | 2 moderados | Migração coordenada de web e renderer do desktop |
| `uuid`, `minimatch`, `glob` | 3 moderados | Cadeias de ferramentas Expo/Electron; atualizar os consumidores |
| `deepmerge` | 1 baixo | A versão corretiva informada no aviso não estava disponível no registry consultado |

Nenhum caminho dos alertas restantes retornados pelo comando apontou para `services/api`; isso não constitui garantia de segurança da API.

No ambiente Python foram consultados os avisos publicados pelo PyPI para as **26 distribuições instaladas**. Foi encontrado `opentelemetry-api` 1.45.0, dependência do FastAPI, e atualizado para 1.45.2. Uma constraint impede reinstalar versões anteriores à correção 1.45.1 quando esse pacote for requerido. Os 8 testes do ML e `pip check` passaram após a atualização. Referência: [aviso oficial do OpenTelemetry](https://github.com/open-telemetry/opentelemetry-python/security/advisories/GHSA-xcq7-p3pf-p88h).

Os requisitos Python ainda não possuem lock completo reproduzível por plataforma. A consulta ao catálogo das versões instaladas não substitui auditoria contínua de novas instalações.

## Estabilidade e autenticação

- O cliente HTTP compartilhado do web possui timeout que inclui a leitura da resposta, cancelamento e mensagens diferentes para conexão, demora, autenticação, permissão e indisponibilidade.
- Operações de escrita não são repetidas automaticamente. Quando a confirmação não chega, a mensagem orienta conferir o resultado antes de repetir a operação.
- Respostas atrasadas de outra conta ou clube não preenchem o contexto atual. Logout em outra aba limpa a sessão; troca de conta remonta as áreas privadas e seus formulários.
- A restauração do perfil preserva o clube selecionado mais recentemente. Mudanças de papel removem permissões antigas do estado/cache.
- No mobile, as operações de SecureStore do clube ativo são serializadas. Restauração ou escrita atrasada não deve restabelecer um clube anterior após nova seleção/logout.
- A API deixa de exigir um cliente Resend válido durante a importação do módulo: sem configuração, somente as operações de envio ficam indisponíveis.

Os fluxos existentes de confirmação de cadastro, recuperação de senha, convites e partidas compartilhadas foram mantidos e cobertos pelas suítes isoladas existentes e ampliadas.

## Performance

### Alterações

1. O processamento do Scout passou a selecionar IDs e contagem de escalações e agregar eventos no PostgreSQL, em vez de carregar todos os objetos de jogadores, eventos e escalações em memória. A regra de contagem de partidas ao vivo/finalizadas e exclusão de gols contra foi mantida.
2. Foram preservados o cache de leituras, deduplicação de consultas pendentes e divisão das páginas em chunks, acrescentando descarte de respostas de sessões obsoletas e respeito ao `no-store`.
3. Testes de retorno à Home verificam reutilização de dados e ausência de skeletons durante atualização de conteúdo já carregado. O teste também confere que ícones não geram consultas SVG repetidas.

### Medições locais

Teste de navegador com API simulada, atraso de rede de 300 ms e 120 atletas por categoria:

| Largura | Primeiro carregamento | Retorno com cache |
|---:|---:|---:|
| 360 px | 2.840 ms | 34 ms |
| 820 px | 1.033 ms | 32 ms |
| 1.440 px | 1.066 ms | 32 ms |

O teste usa Vite em desenvolvimento; o primeiro resultado inclui aquecimento/compilação. Estes valores demonstram o comportamento de cache no cenário simulado, **não** uma comparação antes/depois em produção. A melhoria de consultas do Scout foi validada por contrato e testes, sem benchmark contra o Supabase real ou medição de `EXPLAIN ANALYZE`.

## Interface, componentes e acessibilidade

- Criado `LoadingSkeleton` com variantes de lista, tabela, cards, formulário e partida, usando os tokens existentes. Aplicado ao carregamento inicial de 10 páginas e ao fallback de rotas; Home/Scout mantiveram seus skeletons específicos.
- Skeletons possuem nome acessível, elementos decorativos ocultos e respeito a `prefers-reduced-motion`. O spinner compartilhado passou a anunciar seu estado.
- `Input` preserva descrições acessíveis recebidas pelo componente e associa o erro inline sem sobrescrevê-las.
- Os estilos base de `FilterSelect`, antes dependentes do CSS de Partidas, foram movidos para o próprio componente. Aparência compartilhada deixa de depender da página carregada.
- `FilterSelect` e `Choice` abertos dentro de dialog passam a disponibilizar as opções no fluxo rolável do modal, evitando corte pelo container. Foram refinados os nomes acessíveis e o índice ativo quando as opções mudam.
- Cabeçalho, botão de fechar e corpo dos modais receberam ajustes de encolhimento/quebra para telas estreitas.
- Corrigido overflow real das ações de Competições em 320 px, permitindo reorganização dos botões.
- Componentes existentes de busca, filtros, alternância de visualização, estados vazios, toast e Error Boundary foram reutilizados. Não houve redesenho geral de páginas nem criação de outro design system.

As tabelas que precisam de rolagem horizontal mantêm uma região própria; o documento inteiro não deve transbordar. Não foi realizada certificação WCAG nem revisão manual completa com leitor de tela.

## Arquitetura e arquivos principais

Estrutura mantida:

```text
apps/web/          Interface React/Vite e componentes compartilhados
apps/mobile/       React Native/Expo, contextos e persistência
apps/desktop/      Electron: main, IPC e renderer administrativo
services/api/      Express/TypeScript, Prisma, módulos e Socket.IO
services/ml/       FastAPI e processamento estatístico
packages/          Design tokens, ícones e tipos compartilhados
docs/              Contratos, decisões e relatórios
```

Responsabilidades extraídas para arquivos próprios:

- Web: `components/LoadingSkeleton`, `services/http.ts` e `services/authSession.ts`.
- API: `middlewares/http-errors.middleware.ts`, `utils/erro-operacao.ts`, `realtime/sessoes.ts` e `services/scout-result.ts`.
- Mobile: `utils/persistenciaClube.ts`.
- ML: testes de contrato e `constraints.txt` para dependências vulneráveis.

Não foram renomeadas pastas de rotas nem removidos endpoints legados usados por clientes. Os novos utilitários centralizam comportamento efetivamente compartilhado, sem uma reescrita da aplicação.

## Validação executada

| Verificação | Resultado |
|---|---|
| Suíte antes das mudanças | 306 testes aprovados |
| `pnpm test:app:completo` após mudanças | **334 testes aprovados**, zero falhas |
| Testes Python (`unittest discover`) | **8 aprovados** |
| Testes de regras Electron | **4 aprovados** |
| Build da API e web | Aprovados |
| `tsc --noEmit` do mobile | Aprovado |
| Typecheck e build Electron | Aprovados |
| Auditoria de interface | **100 combinações**: 10 rotas × 5 larguras × 2 temas, sem erros JS ou overflow do documento |
| Carregamento lento e movimento reduzido | Aprovados no navegador |
| Select em modal, teclado/Escape e restauração da rolagem | Aprovados no navegador |
| Isolamento de sessão entre abas | **3 cenários aprovados** |
| Fluxos web de autenticação | **17 cenários aprovados** |
| Notificações web | Aprovadas em 320/390/1.366 px, incluindo concorrência para não restaurar aviso excluído |
| Performance/cache | Aprovado em 360/820/1.440 px com fixtures |
| `git diff --check` | Sem erros de whitespace; Git informa conversão LF/CRLF em alguns arquivos |

Os testes principais usam `services/api/tests/setup.cjs`, que substitui credenciais e integrações por configuração isolada antes da execução. Prisma e integrações são simulados nos testes pertinentes; não foi usado PostgreSQL de produção. Os testes web interceptam as chamadas da API e não enviam e-mail ou push.

Os scripts de navegador exigem Playwright e Microsoft Edge disponíveis. Foi utilizado o runtime de automação do Codex, sem acrescentar Playwright às dependências de produção. `performance-smoke.cjs` exige servidor Vite de desenvolvimento, pois importa módulos de `src`; os demais cenários podem usar preview do build.

Artefatos locais em `test-results/audit-*.log`, capturas em `test-results/audit-interface/` e resultados dos catálogos em `test-results/dependency-audit*.json` e `test-results/audit-python-dependencies*.json`. São arquivos ignorados pelo Git.

## Implementado, ainda sem validação em ambiente real

- SecureStore e carrossel: testes de lógica/tipos aprovados; falta executar em APK de desenvolvimento e aparelho físico.
- Electron: regras e build aprovados; falta verificar janela nativa, distribuição/instalador e integração com API real.
- ML e API: contratos aprovados; falta medir o processamento com o banco completo e autenticação entre serviços na hospedagem.
- Socket.IO: regras de expiração/revogação testadas; falta ensaio entre dispositivos reais com push FCM e reconexão em rede instável.
- Interface: navegador automatizado validado; falta revisão de toque, teclado virtual, leitores de tela e Safari em aparelhos reais.

## Identificado, pendente de correção ou decisão

1. **Dependências:** tratar os 10 avisos Node restantes em migrações compatíveis e adotar lock Python reproduzível. Não aplicar majors transitivas às cegas.
2. **Identidade administrativa:** substituir futuramente a allowlist por e-mail por identidade estável e MFA. As reservas de e-mail foram protegidas, mas contas preexistentes no banco não foram investigadas.
3. **Alteração de e-mail comum:** ainda precisa de fluxo de confirmação do novo endereço. A correção atual bloqueia os endereços privilegiados, não implementa essa verificação completa.
4. **Tokens web:** persistência Bearer/localStorage mantida. Uma migração para cookies HttpOnly exigiria revisar CSRF, desktop/mobile, renovação e infraestrutura; não foi feita parcialmente.
5. **Escala horizontal:** limites de tentativas em memória são por processo. Várias réplicas precisam de limitação compartilhada ou na borda e configuração confiável de proxy.
6. **Legado:** consolidar os routers sobrepostos de partidas/escalações em etapa própria, preservando compatibilidade dos clientes.
7. **Banco e carga:** executar planos de consulta, validar índices e testes de carga em banco descartável representativo. O teste `shared-matches.integration.ts`, que cria/remove registros, não foi executado contra o banco configurado do usuário.
8. **Hospedagem:** validar TLS/CORS/CSP na entrega do frontend, limites de corpo/header do proxy do ML e rotação de segredos. O limite de 5.000 atletas no Python não substitui limite de bytes no proxy.

## Configuração necessária para aplicar as mudanças

Execute `pnpm install` para sincronizar o lockfile. No Python, execute novamente `pip install -r requirements.txt` dentro de `services/ml`, com o virtualenv do projeto.

Se o Scout IA estiver habilitado em produção, configure a **mesma `ML_API_KEY` privada** na API e no ambiente do processo Python e reinicie ambos. O Python não lê `.env` automaticamente. Não exponha a chave em variáveis `VITE_*` ou `EXPO_PUBLIC_*`.

O README foi atualizado com essa configuração, a inicialização sem Resend e o isolamento dos testes.
