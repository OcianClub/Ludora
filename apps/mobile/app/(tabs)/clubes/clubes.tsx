// Caminho: app/(tabs)/clubes/clubes.tsx
//
// Aba "Clubes" dentro do app. Mostra a mesma lista de clubes, mas agora
// já existe um clube ativo (Header mostra nome/escudo do clube atual).
// Serve pra trocar de clube ativo (ex: sair do Ocian e entrar no Corinthians)
// e também pra seguir/deixar de seguir novos clubes sem sair do app.

import ClubesExplorer from '@/src/screens/ClubesExplorer';

export default function ClubesTrocar() {
  return <ClubesExplorer modo="trocar" />;
}