import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@ludora/design-tokens';

// Tamanhos padronizados — cobre os 3 contextos que já existem no app hoje
// (atalho de clube em carrossel, card de clube na lista, e o Header). Se
// precisar de outro tamanho no futuro, é só adicionar aqui, em vez de criar
// um valor solto em outra tela.
const TAMANHOS = {
  sm: 40, // usado em linhas compactas (ex: item de time num modal de seleção)
  md: 48, // clubeCardLogo (lista vertical de clubes)
  lg: 56, // clubeAtalhoLogo (carrossel "Seus Clubes")
} as const;

export type TamanhoEscudo = keyof typeof TAMANHOS | number;

interface EscudoClubeProps {
  uri?: string | null;
  tamanho?: TamanhoEscudo;
  style?: ViewStyle;
}

// Escudo com fundo padronizado — mas o fundo muda de propósito conforme o
// que está sendo mostrado:
//  - COM escudo (uri): fundo NEUTRO (cardSecundario), igual pra qualquer
//    clube. Um escudo branco/preto/vermelho (Corinthians), um todo
//    colorido, ou monocromático — todos ficam com a mesma "moldura",
//    sem brigar com a cor do time nem com a identidade visual do app.
//  - SEM escudo ainda (placeholder local, SóPreto.png): fundo AZUL
//    (colors.primaria) — o mark do app é preto, então precisa desse
//    contraste pra não sumir; e como não há cor de clube nenhuma nesse
//    estado, reforçar a marca do app aqui não conflita com nada.
// Em ambos os casos, padding interno garante que a imagem nunca encoste
// na borda, e resizeMode="contain" garante que o escudo nunca seja
// cortado (diferente de "cover", que cropa e foi o que causava o visual
// "grudado"/desalinhado antes).
export function EscudoClube({ uri, tamanho = 'md', style }: EscudoClubeProps) {
  const tamanhoPx = typeof tamanho === 'number' ? tamanho : TAMANHOS[tamanho];
  const raioBorda = Math.round(tamanhoPx * 0.2); // mesma proporção usada hoje (10px pra 48-56px)
  const paddingInterno = Math.round(tamanhoPx * 0.14);

  return (
    <View
      style={[
        styles.container,
        {
          width: tamanhoPx,
          height: tamanhoPx,
          borderRadius: raioBorda,
          padding: paddingInterno,
          backgroundColor: uri ? colors.cardSecundario : colors.primaria,
        },
        style,
      ]}
    >
      <Image
        source={uri ? { uri } : require('@/assets/images/SóPreto.png')}
        style={styles.imagem}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.borda,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagem: {
    width: '100%',
    height: '100%',
  },
});