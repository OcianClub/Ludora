# Mobile: acesso sem cadastro

## Entrada e navegação

- Instalação sem sessão abre a descoberta de clubes; não cria conta fictícia.
- Clube selecionado permanece acessível na Home e na agenda pública.
- Descoberta inclui partidas ao vivo com atualização no namespace público.
- Perfil oferece login, cadastro e preferências de tema sem exigir conta.
- Seguir clube exige login; cancelar mantém a exploração disponível.
- Login revalida o cargo no servidor e preserva o clube quando disponível. Não confia no cargo salvo durante o acesso anônimo.
- Scout e telas privadas ficam ocultos/bloqueados para quem não tem sessão. A API continua exigindo autenticação e permissões nas escritas.
- Notificações pessoais, preferências e registro de push não são consultados pelo visitante.

## Dados públicos

Reutilizadas as rotas do Web de clubes, Home, detalhe de partida e socket `/publico`.
Adicionadas duas consultas de leitura à API:

- `GET /publico/clubes/:clubeId/partidas/agenda`: mesmos filtros e paginação da agenda existente, resposta por lista explícita de campos públicos.
- `GET /publico/clubes/:clubeId/paulista`: publicação oficial já armazenada, sem sincronização ou escrita, sem auditoria, divergências internas ou motivos de suporte.

A aba Paulista do mobile permite consultar jogos do clube e classificação oficial por categoria/temporada. Não implementa o mapa interativo do Web.
Dados de federação, partidas antigas e seeds não são modificados.

## Aplicação e distribuição

Não há migration nova ou dependência nova nesta alteração. Publicar a API atualizada no Render antes de distribuir o APK, pois o novo app usa as duas consultas acima.

O perfil EAS `preview` já define `EXPO_PUBLIC_API_URL=https://ludora-pgho.onrender.com`.

Na pasta `apps/mobile`, gerar o APK:

```powershell
pnpm dlx eas-cli build --platform android --profile preview
```

O APK anterior não contém o modo visitante. O build remoto não foi solicitado/executado nesta tarefa.

## Conferência no aparelho antes de distribuir

Validação automatizada concluída:

- `pnpm test:app:completo`: 587 testes passaram, zero falhas; inclui a compilação da API.
- `pnpm --filter @ludora/mobile exec tsc --noEmit`: passou.
- Exportação Android com Metro/Hermes: concluída, 1.930 módulos. É uma verificação de empacotamento, não um APK instalável.
- Consultas públicas testadas com banco simulado, incluindo isolamento de campos privados e bloqueio de escritas sem autenticação. Nenhum seed ou banco real foi alterado.

Não houve teste em emulador ou aparelho físico nesta execução. Conferir no novo APK:

- Instalar sem dados/sessão: abrir clubes diretamente.
- Abrir clube, Home, agenda, partida ao vivo e finalizada.
- Confirmar que não há botões de edição, publicação ou preparo para visitante.
- Seguir: cancelar e continuar navegando; entrar e conferir o clube e cargo.
- Perfil: alternar tema e acessar cadastro/login.
- Abrir Paulista, alternar categoria/temporada e classificação.
- Login gestor: conferir preparo e súmula; sair e confirmar retorno a Clubes.
- Conferir a rede móvel e a recuperação após a API iniciar no Render.

Os testes automatizados não substituem essa conferência final do APK em Android físico.
