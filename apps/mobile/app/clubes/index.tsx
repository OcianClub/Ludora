// Caminho: app/clubes/index.tsx
//
// Primeira tela depois do login (login.tsx faz router.replace('/clubes')).
// Fica FORA do grupo (tabs) de propósito: aqui o usuário ainda não tem
// necessariamente um "clube ativo" selecionado. Ao tocar em um clube
// (seguido ou não), o app grava o clube ativo no SecureStore e navega
// para dentro de (tabs).

import ClubesExplorer from '@/src/screens/ClubesExplorer';

export default function ClubesEntrada() {
  return <ClubesExplorer modo="entrada" />;
}