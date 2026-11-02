# Papel de plataforma SUPERADMIN

`Usuario.papel_plataforma` possui `USUARIO` (padrão) e `SUPERADMIN`.
É independente de `UsuarioClube.papel`: ADMIN, TECNICO, MESARIO, OLHEIRO e TORCEDOR continuam pertencendo a um clube.

SUPERADMIN libera o painel desktop e as rotas `/admin`: visão global, gestão de clubes e planos, categorias, membros, usuários, revogação de sessões, diagnóstico e logs. Não concede automaticamente cargos ou edição nas telas de clubes do web/mobile.

## Ativar

A migration é aditiva: todas as contas existentes começam como USUARIO. Ela não promove contas por suposição. Após revisar o banco de destino e aplicar as migrations pendentes:

```powershell
pnpm --filter @ludora/api exec prisma migrate deploy
pnpm --filter @ludora/api exec prisma generate
pnpm superadmin:grant seu-email-cadastrado@exemplo.com
pnpm run build:api
```

O comando de concessão usa o banco de `services/api/.env` (ou as variáveis do processo). Execute somente no banco que deseja administrar. Em produção, aplique a migration antes de publicar o backend atualizado e execute a concessão em terminal administrativo seguro. Nenhuma migration ou concessão foi executada automaticamente por esta implementação.

Entre no desktop com o e-mail e senha normais da conta. Não é necessário um clube para acessar o painel. O backend consulta o papel persistido; enviar SUPERADMIN no cadastro, convite, alteração de perfil ou JWT não concede acesso.

## Compatibilidade

`SUPERADMIN_EMAILS` continua liberando as contas antigas para evitar interromper o acesso atual. Para usar somente o papel persistido, conceda SUPERADMIN às contas autorizadas, depois limpe essa variável e reinicie a API. Enquanto ela estiver preenchida, retirar apenas o papel no banco não revoga o acesso dos e-mails listados.

Não há opção pública ou convite de clube para conceder esse papel. A atribuição é administrativa pelo comando acima. Os sockets e as rotas do desktop usam a mesma autorização global.
