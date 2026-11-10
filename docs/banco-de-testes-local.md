# Banco de testes local (Windows x64)

Este ambiente usa um PostgreSQL 16 portátil em `127.0.0.1:55448`, banco
`ludora_equipe`. Não usa nem modifica os arquivos `.env` do desenvolvimento.
Não copia usuários ou dados do Supabase. Todos os registros são fictícios.

Execute os comandos a partir da raiz do Ludora, após instalar as dependências
do projeto e gerar o Prisma Client (`pnpm --filter @ludora/api exec prisma generate`).

## Testar com um comando

```powershell
pnpm test:integracao:api
```

O comando inicia o banco, aplica as migrações somente nele e testa autenticação,
papéis da plataforma, suporte, manutenção, convites, recuperação de acesso e
importação operacional do Paulista. A API de testes usa a porta 3018 durante
a execução e é encerrada ao terminar. O banco fica ligado, preservando os dados.

E-mails são interceptados em memória. A importação Paulista utiliza snapshots
fictícios e não consulta nem altera a Federação. Sincronizações automáticas e
o ML ficam desativados nesse ambiente. Os testes podem criar novos registros
fictícios a cada execução; este banco não deve armazenar dados reais.

## Controlar o banco

```powershell
pnpm db:test:start
pnpm db:test:status
pnpm db:test:stop
```

Na primeira execução, o instalador baixa os binários Windows x64 do pacote
`@embedded-postgres/windows-x64`, versão fixada `16.15.0-beta.19`, e verifica
a integridade SHA-512 informada pelo registro npm. O PostgreSQL é 16.15;
o sufixo beta é a versão do pacote que distribui os binários.
Não instala serviço do Windows nem exige Docker.

Runtime, banco, logs e credenciais ficam em `.local-demo/equipe/`, ignorado pelo
Git. O servidor aceita conexões somente do próprio computador e exige senha
aleatória via SCRAM. Não há comando de reset ou exclusão neste instalador.

## Manter uma API fictícia para testes manuais

```powershell
pnpm dev:api:teste
```

Após as validações iniciais, a API permanece em `http://127.0.0.1:3018`.
As quatro contas fictícias e senhas aleatórias ficam em
`.local-demo/equipe/contas.json`. Não publique esse arquivo. Pare a API com
Ctrl+C antes de executar `pnpm test:integracao:api`, pois ambos usam a porta 3018.

Para conectar uma interface a essa API, use a configuração local de URL dessa
interface. A API permite a origem `http://localhost:5198`; uma instância Web
para testes manuais pode ser iniciada em PowerShell assim:

```powershell
$env:VITE_API_URL = 'http://127.0.0.1:3018'
pnpm --filter @ludora/web exec vite --port 5198 --strictPort
```

Use uma janela/perfil de navegador separado para não misturar a sessão fictícia
com a sessão do ambiente normal. Feche esse terminal para descartar a variável
temporária. Esses testes manuais não oferecem ML, envio real de e-mail nem
sincronização real do Paulista.

O `pnpm dev` normal continua usando suas conexões habituais. Não substitua
`DATABASE_URL`/`DIRECT_URL` no `.env` principal para executar esta suíte.

## Falhas comuns

- **Porta 55448 ocupada:** o comando recusa iniciar outro servidor nessa porta.
  Verifique `pnpm db:test:status`; não encerre processos desconhecidos.
- **Porta 3018 ocupada:** encerre a API de testes anterior antes de rodar a suíte.
- **Configuração apontando para outro servidor:** o instalador e a suíte recusam
  endereços diferentes de `127.0.0.1:55448/ludora_equipe`.
- **Banco existente sem config.json:** restaure a configuração original;
  o instalador não redefine senhas nem apaga os dados automaticamente.

Os binários portáteis são distribuídos pelo projeto
[embedded-postgres](https://github.com/leinelissen/embedded-postgres).
