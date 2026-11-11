# Mobile — preparação, súmula ao vivo e pós-jogo

## Escopo

Implementação no aplicativo Expo/React Native. O Web serviu como referência de dados, regras, permissões e apresentação. As alterações locais anteriores de acesso público foram preservadas. Nenhum registro do banco de dados ou da Federação foi modificado durante a implementação e os testes.

## Preparação e substituições

- Confirmação exige cinco titulares, exatamente um goleiro, camisas válidas e exclusivas. Outros goleiros podem permanecer na reserva.
- A mesma restrição já existe na confirmação e no início da partida na API; foi mantida.
- Substituições por toque ou arraste continuam disponíveis. A interface e a API impedem retirar o único goleiro ou colocar um segundo em campo.
- O gestor da equipe pode fazer suas substituições mesmo quando o outro clube opera a súmula.

## Ao vivo

- Placar com ações de gol, cinco indicadores de faltas por período e sem os contadores de cartões redundantes.
- Modal de autoria com jogadores em campo primeiro, camisa azul para quem está em campo, reserva cinza e seleção circular com check. Reservas não podem receber novos eventos ao vivo.
- Gol contra escolhe o autor do adversário e beneficia a equipe correta. Assistência é opcional, deve ser de outro jogador elegível da equipe, e não é oferecida no gol contra. Minuto aceita números de 0 a 200.
- Registro explícito sem autor e identificação posterior editam o evento correto; ausência de assistência opcional não cria pendência.
- Acontecimentos alinhados por equipe, separados por tempo; menus nas extremidades. Anulação/desfazer identifica o lance e pede confirmação. Gol e assistência vinculada são desfeitos juntos.
- Palpites de mandante/empate/visitante usam a API existente: visitantes consultam, contas autenticadas votam uma vez por partida e podem mudar o voto enquanto ao vivo. Atualização por socket, reconexão e consulta periódica.
- Escalação, botão de encerramento separado, comparativo, destaques e histórico seguem a ordem solicitada.

## Publicação e conexão

- Cada lançamento tem cinco segundos para cancelamento; o envio posterior aguarda confirmação do servidor. A barra indica a janela de cancelamento, não o progresso da rede.
- Escritas em sequência, proteção contra toque repetido e identificadores preservados nas tentativas manuais.
- Ao sair/ir para segundo plano, lançamentos ainda não enviados ficam pausados. A retomada é explícita e oferece cinco segundos completos novamente.
- Rascunhos são guardados no SecureStore e restritos à sessão, clube e partida. Ao reabrir, envios interrompidos são reconciliados antes de qualquer nova publicação. Falha ao persistir é informada.
- A API passa a reconhecer reenvios de correção de autoria, substituição e correção de placar, além de criação/remoção de eventos que já tinham essa proteção. O identificador continua opcional para manter compatibilidade com clientes antigos.
- Encerramento fica bloqueado enquanto houver lançamentos pendentes. A integração já existente de Scout/IA no servidor foi preservada.

## Pós-jogo e compartilhamento

- Placar final, mensagem de vitória/empate e consulta compacta dos períodos já iniciados. O filtro sincroniza acontecimentos, totais, destaques e estatísticas individuais, sem modificar o placar final.
- Comparativo e destaques reutilizam a mesma função pura do Web, movida para `packages/shared-types/src/matchInsights.ts`. Fórmula de participação: gols + assistências × 0,6; defesas separadas; empates preservados; apenas eventos e escalações publicados.
- Explicação completa dos critérios disponível no botão de informação, incluindo o link de referência SportsLab. Sem atribuir nota ou inferir minutos, eficiência ou habilidade.
- Prévia vetorial exportável em PNG, versão em texto, controles independentes de nomes e destaques, cópia do link, compartilhamento nativo e salvamento em pasta escolhida no Android.
- A imagem preserva nomes longos com quebra controlada e inclui os empatados. Escudos com falha ou demora usam iniciais; sua ausência não bloqueia a geração.
- Nova dependência nativa: `expo-sharing` na versão compatível com o Expo 54 já utilizado. A geração utiliza `react-native-svg`, `expo-file-system` e `expo-clipboard` existentes.

## Componentes e utilitários

- `AnalisePartida`: comparativo, períodos, destaques, empates e explicação.
- `PalpitePartida`: votação com consulta pública e atualização em tempo real.
- `CompartilharPartida`: prévia, PNG, texto e ações nativas.
- `SelectField`: seletor mobile reutilizável com identificação visual da seleção.
- `useFilaSumula`: ciclo de vida e persistência da fila de publicação.
- `validacaoSumula`: autoria, assistência, minuto, substituição, períodos e desfazer vinculado.
- `compartilharPartida`: modelo público do compartilhamento e quebra dos textos.
- `packages/shared-types/src/matchPoll.ts`: contrato e validação de votação reutilizados pelo Web e Mobile.

## Verificações

- `pnpm test:app:completo`: 612 testes passaram, zero falhas. Inclui testes de API com transporte/banco isolados, preparação, permissões, autoria, eventos, votos, substituições, reenvio, anulações e integração já existente do encerramento.
- TypeScript do Mobile, builds da API, Web e Desktop passaram.
- Exportação de produção Android concluída; isso valida o empacotamento, não gera um APK instalável.
- `apps/mobile/tests/sumula-ui-smoke.cjs`: 21 cenários com os componentes reais renderizados via React Native Web e serviços isolados. Larguras 320, 390, 600 e 900; gestor, usuário comum, visitante e pós-jogo. Verifica ausência de overflow, controles por permissão, votação, abertura do compartilhamento, cancelamento, pausa/retomada, resposta perdida após gravação e encerramento.
- Capturas locais e logs em `test-results/mobile-sumula*`. O teste de interface usa o Edge/Playwright e não envia dados ao banco real.

## Aplicação e limites

- Não há nova migration. Após pull: executar `pnpm install` e atualizar a API publicada para incluir as proteções de reenvio.
- É necessário gerar e distribuir outro APK preview para receber este código e o módulo nativo de compartilhamento. O APK já enviado ao EAS anteriormente não incorpora alterações posteriores ao upload.
- Não houve push, deploy, encerramento de partidas reais nem envio de notificações reais.
- Sem dispositivo Android conectado nesta sessão: arraste/teclado do sistema, retorno após o sistema encerrar o processo e abertura/salvamento pelo menu nativo ainda exigem teste no celular. O teste via navegador não substitui essa verificação.
- Nenhuma redução de latência da rede/backend foi afirmada: as mudanças tratam estados, reconciliação e resposta percebida, e não foram acompanhadas por um benchmark em dispositivo real.
