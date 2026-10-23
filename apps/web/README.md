# Ludora Web

Interface React + TypeScript + Vite para consultar e administrar informações
do clube. Já existem telas de login, cadastro, seleção de clube, dashboard,
jogadores, elenco, times, competições, partidas e perfil.

O painel interno da empresa Ludora, destinado a administrar clubes-clientes,
é uma entrega separada em `apps/desktop`, ainda não implementada.

## Fluxos de acesso

- `/login`: acesso por e-mail e senha, recuperação e atalho de convite.
- `/registrar`: dados pessoais, senha e confirmação do e-mail por código.
- `/recuperar-senha`: solicitação de código e definição de nova senha.
- `/convite`: entrada do código; `/convite/:codigo`: consulta e aceite.
- `/convite/token/:codigo`: consulta e aceite pelo token longo de um link.

O envio dos códigos depende da configuração de e-mail da API, a mesma usada
pelo mobile. Nenhuma chave do Resend ou do banco deve ficar no frontend.
O endereço de um link de convite enviado por e-mail precisa apontar para uma
rota web válida; criar as telas não altera automaticamente o conteúdo dos e-mails.

Os campos, mensagens, indicador de etapas e hooks de formulário estão em
`src/components/auth`. Os serviços estão em `src/services/auth.ts` e as regras
de validação em `src/utils/authValidation.ts`. São componentes React para web,
sem dependências de React Native, reutilizáveis no renderer de um futuro Electron.
Essa etapa não cria nem configura o aplicativo Electron.

O cadastro mobile menciona termos e privacidade, mas os documentos legais não
estão no repositório. O web não inclui links fictícios nem declara que esses
documentos foram lidos; a publicação e o consentimento ficam pendentes.

Testes unitários, executados na raiz:

```powershell
node --experimental-strip-types --test apps/web/tests/*.test.mjs
```

Com Playwright disponível e o Vite iniciado na porta 5187:

```powershell
node apps/web/tests/auth-flow-smoke.cjs
```

O teste usa respostas simuladas, não envia e-mails, não consome convites reais
e verifica acesso e responsividade de 320 a 1920 px nos dois temas.
Defina `LUDORA_WEB_TEST_URL` para testar em outra porta local.

## Executar localmente

Os comandos abaixo são executados na raiz do repositório. O workspace usa pnpm.
Na primeira preparação, instale as dependências com `pnpm install`.

1. Configure `services/api/.env` a partir de `services/api/.env.example`.
   Credenciais ficam no `.env`, que é ignorado pelo Git, nunca no modelo.
2. Para executar a API diretamente no computador, use `NODE_ENV=development`
   e `TRUST_PROXY_HOPS=0`. Inclua `http://localhost:5173` em `CORS_ORIGINS`.
3. Crie `apps/web/.env.local` com:

   ```env
   VITE_API_URL=http://localhost:3000
   ```

4. Se o Prisma Client ainda não tiver sido gerado após a instalação, execute
   `pnpm --filter @ludora/api exec prisma generate`. Isso gera o cliente, sem
   aplicar mudanças nas tabelas do banco.
5. Em um terminal, compile e inicie a API:

   ```powershell
   pnpm --filter @ludora/api run build
   pnpm --filter @ludora/api start
   ```

6. Em outro terminal, inicie o web:

   ```powershell
   pnpm --filter @ludora/web dev
   ```

Abra `http://localhost:5173`. A API recebe as chamadas em `http://localhost:3000`.
O web não recebe a senha do banco: quem acessa o Supabase é a API.

Se aparecer `EADDRINUSE` na porta 3000, já existe um processo usando essa porta.
Confira se a API já está funcionando antes de tentar iniciá-la novamente.
Para reiniciar uma instância que você iniciou, encerre-a com Ctrl+C no terminal
original e execute `start` novamente.

A API local pode continuar apontando para o banco compartilhado do grupo.
Não execute migrations ou seed apenas para iniciar o web: essas são operações
separadas de manutenção do banco e precisam considerar os demais integrantes.
Não é necessário configurar Scout IA para testar login e consultas básicas;
sem `PYTHON_AI_URL`, a análise de jogadores permanece desativada.

## Build e verificação de tipos

```powershell
pnpm --filter @ludora/web run build
```

O comando verifica os tipos com `tsc` e depois gera os arquivos em `apps/web/dist`.
O comando `dev` não realiza essa mesma verificação completa de tipos.

O `tsconfig.json` direciona os tipos de React para as dependências do próprio
web (React 18). Isso evita que os tipos de React 19 usados pelo mobile sejam
resolvidos ao verificar as rotas do web. Nenhuma verificação foi desativada.

## Comunicação de partidas em tempo real

- `src/services/matchRealtime.ts`: abre a conexão Socket.IO com token e clube,
  filtra a partida e encerra a conexão ao sair da tela.
- `src/pages/PartidaDetalhe.tsx`: carrega os dados, atualiza a interface e mostra
  falhas de carregamento ou conexão.
- `src/pages/PartidaDetalhe.css`: define a aparência dos avisos da tela.

O cliente usa o contrato atual da API:

| Informação | Comportamento |
|---|---|
| Autenticação | Envia `auth.token` e `auth.clubeId` |
| `placar_atualizado` | Usa `id`, `gols_mandante` e `gols_visitante` da partida |
| `evento_partida` | Usa `partida_id` para buscar novamente os dados completos |
| Conexão/reconexão | Consulta novamente partida e eventos para recuperar alterações perdidas |
| Saída da tela | Remove os listeners e desconecta |

A atualização de eventos não substitui a escalação que está sendo editada.
O aviso de conexão não garante sincronização de todas as operações: a API
atual não emite esses avisos ao excluir um evento ou mudar o status da partida.
Essas operações ainda precisam de evolução própria para sincronização entre
diferentes dispositivos. Registrar um evento de gol também não atualiza, por
si só, o placar na rota atual da API; a consistência entre gol e placar segue
como pendência do fluxo de negócio.

## Testes desta etapa

Com Node.js 22.13 ou superior, na raiz do repositório:

```powershell
pnpm --filter @ludora/api run build
node --experimental-strip-types --test services/api/tests/web-realtime.test.mjs
```

Os seis testes exercitam o cliente web contra o servidor Socket.IO da API,
substituindo a consulta de vínculo por dados fictícios. Não consultam nem
alteram o Supabase. Verificam identificação, eventos, isolamento de partidas,
rejeição de token/clube, reconexão e encerramento.

Também foi verificado no navegador, com uma API temporária de demonstração:

- Login, seleção de clube e abertura de partida.
- Atualização de placar de 0 × 0 para 2 × 1 sem recarregar a página.
- Carregamento do evento completo, com jogador, período e minuto.
- Preservação de uma seleção de escalação ainda não salva.
- Aviso de indisponibilidade após queda de conexão.
- Preservação do placar novo (4 × 3) quando uma consulta antiga retorna atrasada.

Esses dados fictícios não fazem parte do aplicativo normal. Esta validação
não substitui o teste com uma conta real e suas permissões, nem comprova o
fluxo completo de cadastro, escalação, registro de gol e finalização de jogo.
Também foi observado que recarregar diretamente uma tela protegida pode levar
à seleção de clube, antes de restaurar o clube salvo. A restauração da sessão
continua como pendência separada desta correção de build e tempo real.
O build ainda emite o aviso de depreciação da API CJS do Vite; ele não impede
a compilação e não foi tratado nesta etapa.

## Visual alinhado ao mobile

O web usa as cores de `packages/design-tokens/src/colors.ts`, os desenhos SVG
de `packages/icons/src/svg` e o logo existente no mobile. A disposição das telas
continua própria para navegador: menu lateral no computador, navegação horizontal
em telas pequenas e cartões que se reorganizam conforme a largura.

Mapa das mudanças para consultar durante o aprendizado:

| Arquivo em `src/` | Para que serve |
| --- | --- |
| `styles/theme.ts` e `main.tsx` | Transformam as cores compartilhadas em variáveis CSS antes de abrir a interface. |
| `styles/global.css` | Define fontes, cores de uso, foco pelo teclado e estilos básicos. |
| `components/Icon.tsx` | Exibe os SVGs do projeto no navegador, sem importar React Native. |
| `components/Brand.tsx` | Reutiliza o logo e apresenta escudos, inclusive quando a imagem não existe ou falha. |
| `components/UI.tsx` e `UI.css` | Padronizam botões, campos, etiquetas, tabelas e formulários. Os rótulos ficam associados aos campos. |
| `components/Layout.tsx` e `Layout.css` | Organizam navegação, clube selecionado, perfil e saída da conta. |
| `components/AuthShell.tsx`, `PasswordInput.tsx` e `pages/Auth.css` | Compartilham o visual de acesso e o controle para mostrar ou ocultar a senha. |
| `pages/Login.tsx` e `Registrar.tsx` | Usam essa estrutura, mantendo as chamadas de autenticação existentes. |
| `pages/SelecionarClube.tsx` e seu CSS | Acrescentam busca local por nome/cidade e atalhos para os clubes vinculados. |
| `components/MatchCard.tsx` e seu CSS | Reutilizam a apresentação de times, situação, data, local e acesso à partida. |
| `pages/Dashboard.tsx` e seu CSS | Organizam categorias, partida principal, momento da categoria e últimos cinco resultados, usando o resumo `/partidas/home`. |
| `components/HomeCategories.tsx`, `HomeMatch.tsx` e `utils/homeDashboard.ts` | Compartilham navegação entre subs, cards e regras de seleção dos jogos da Home. |
| `pages/Partidas.tsx` | Apresenta os jogos em cartões, preserva filtros e ações e informa falhas de carregamento. |
| `pages/PartidaDetalhe.tsx` e seu CSS | Adaptam escudos e placar a diferentes larguras, preservando a integração em tempo real. |

Os números continuam vindo da API configurada em `VITE_API_URL`. Não foram
incluídos clubes, jogadores ou estatísticas fictícias no aplicativo. Quando faltam
informações, a interface mostra um estado vazio ou “a definir”. A data da partida
é apresentada como dia do calendário, sem conversão para o fuso do navegador.

A conferência visual desta etapa usa uma API temporária fora do repositório,
com dados explicitamente identificados como demonstração. Abertura de formulários
e navegação não equivalem à validação de cadastro e exclusão no banco real.
