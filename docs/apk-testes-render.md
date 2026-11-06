# APK Android de testes com API e ML no Render

O perfil `preview` em `apps/mobile/eas.json` gera APK instalável, com JavaScript embarcado, sem servidor Expo/Metro ou computador ligado. O perfil `development` continua disponível para desenvolvimento com o APK dev-client.

## Gerar

Na raiz do Ludora:

```powershell
cd apps/mobile
npx eas-cli@latest build --platform android --profile preview --clear-cache
```

Acesse a conta Expo associada ao projeto, se o CLI pedir. O EAS fornece o link para baixar o APK ao concluir; compartilhe esse APK/link com quem testará em Android. O comando envia os arquivos atuais para o build, não exige push no Git. Nenhum build em nuvem foi iniciado automaticamente nesta alteração.

O primeiro build usa `--clear-cache` para descartar artefatos anteriores. O Metro também separa o cache pela URL pública da API, evitando reaproveitar um bundle com IP local ao trocar para Render.

A URL está definida no perfil de build:

```dotenv
EXPO_PUBLIC_API_URL=https://ludora-pgho.onrender.com
```

O `.env` local foi ajustado para a mesma URL. Para voltar ao backend local durante desenvolvimento, altere apenas `apps/mobile/.env` para o IP LAN do computador e reinicie o Expo. Os perfis preview/production continuam explicitamente usando Render, independentemente dessa troca local.

## ML

O aplicativo chama somente a API Node. O Python é chamado pelo backend, mantendo a chave privada fora do APK:

```
APK → https://ludora-pgho.onrender.com → https://ludora-ml.onrender.com
```

No painel Render do serviço **API Node**, confirme:

```dotenv
PYTHON_AI_URL=https://ludora-ml.onrender.com
```

`ML_API_KEY` deve ter o mesmo valor privado na API e no serviço Python. Não colocar essa chave em `.env` do aplicativo, `EXPO_PUBLIC_*` nem em `eas.json`. A configuração do painel Render não é alterada por editar arquivos locais.

Dados exibidos pelo Scout vêm da API/banco. O Python recalcula perfis em segundo plano nos fluxos existentes, como finalização/correção de partidas. Publicar um novo APK não publica automaticamente a API ou o Python.

## Precisa de outro APK?

Para enviar uma versão independente do seu computador, sim: use o perfil **preview**. O APK de desenvolvimento usado com QR code continua servindo para desenvolver, mas o arquivo de teste deve ser o preview.

A URL pública fica incorporada ao JavaScript do build. Alterações posteriores no app/URL exigem gerar e instalar novo APK neste projeto, que ainda não possui Expo Update configurado. Alterações só no backend/ML normalmente exigem deploy desses serviços, sem substituir o APK, desde que o contrato continue compatível.

## Conferir antes de compartilhar

- API e Python publicados e acessíveis em `/health`.
- Login, seleção de clube, Jogos, preparação e Scout usando a API publicada.
- Contas de teste criadas/convites aceitos no backend publicado.
- O telefone pode estar fora da rede do computador; não precisa de Metro nem QR code para usar o APK preview.

Referências: [APKs no EAS](https://docs.expo.dev/build-reference/apk/), [perfis de build](https://docs.expo.dev/build/eas-json/), [variáveis públicas](https://docs.expo.dev/guides/environment-variables/).
