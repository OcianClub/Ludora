import { Icon } from '@ludora/icons';
import { memo, useRef, useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import Animated, { scrollTo, useAnimatedRef, useAnimatedReaction, useSharedValue, useAnimatedStyle, interpolateColor, type SharedValue } from 'react-native-reanimated';
import { useTheme, type ThemeColors } from '@/src/contexts/ThemeContext';

const MARGEM_CONTEUDO = 20;
const LARGURA_ITEM = 100;
const GAP_ITEM = 8;
const ITEM_INTERVAL = LARGURA_ITEM + GAP_ITEM;

const LARGURA_BOTAO = 32;
const PADDING_H = 8;

export const SUBS_INICIACAO = [
  { id: '1', title: 'SUB-7' },
  { id: '2', title: 'SUB-8' },
  { id: '3', title: 'SUB-9' },
  { id: '4', title: 'SUB-10' },
];

export const SUBS_BASE = [
  { id: '5', title: 'SUB-12' },
  { id: '6', title: 'SUB-14' },
  { id: '7', title: 'SUB-16' },
  { id: '8', title: 'SUB-18' },
];

interface CarrosselSubsProps {
  tipoFiltro: 'INICIACAO' | 'BASE';
  onTrocarTipo: (tipo: 'INICIACAO' | 'BASE') => void;
  indexAtual: number;
  onChangeIndex: (index: number) => void;
  progressoPagina?: SharedValue<number>;
}

function SubItem({ title, index, ativo, progresso, onPress, styles, colors }: {
  title: string; index: number; ativo: boolean; progresso?: SharedValue<number>;
  onPress: () => void; styles: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const fundo = useAnimatedStyle(() => {
    const proximidade = progresso ? Math.max(0, 1 - Math.abs(progresso.value - index)) : Number(ativo);
    return { backgroundColor: interpolateColor(proximidade, [0, 1], [colors.card, colors.primaria]) };
  });
  const texto = useAnimatedStyle(() => {
    const proximidade = progresso ? Math.max(0, 1 - Math.abs(progresso.value - index)) : Number(ativo);
    return { color: interpolateColor(proximidade, [0, 1], [colors.textoSecundario, colors.textoSobrePrimaria]) };
  });
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <Animated.View style={[styles.item, { borderRadius: 8 }, fundo]}>
        <Animated.Text style={[ativo ? styles.textoAtivo : styles.texto, texto]}>{title}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export const CarrosselSubs = memo(function CarrosselSubs({
  tipoFiltro,
  onTrocarTipo,
  indexAtual,
  onChangeIndex,
  progressoPagina,
}: CarrosselSubsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  const [larguraTrack, setLarguraTrack] = useState(0);
  const deslocamentoAtual = useRef(0);
  const arrastando = useRef(false);
  const gestoSeletor = useSharedValue(false);
  const aguardandoPagina = useSharedValue(-1);
  const ultimaSelecao = useRef(indexAtual);
  ultimaSelecao.current = indexAtual;
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  useAnimatedReaction(
    () => progressoPagina?.value,
    (progresso) => {
      if (progresso === undefined || gestoSeletor.value || !larguraTrack) return;
      if (aguardandoPagina.value >= 0 && Math.abs(progresso - aguardandoPagina.value) > 0.01) return;
      aguardandoPagina.value = -1;
      scrollTo(listRef, progresso * ITEM_INTERVAL, 0, false);
    },
    [progressoPagina, larguraTrack],
  );

  useEffect(() => {
    if (!larguraTrack || indexAtual < 0 || indexAtual >= dadosAtuais.length) return;
    if (progressoPagina) return;
    const destino = indexAtual * ITEM_INTERVAL;
    if (Math.abs(deslocamentoAtual.current - destino) < 1) return;
    arrastando.current = false;
    listRef.current?.scrollTo({ x: destino, animated: true });
  }, [indexAtual, tipoFiltro, larguraTrack, dadosAtuais.length, progressoPagina]);

  function concluirGesto(deslocamento: number) {
    if (!arrastando.current) return;
    arrastando.current = false;
    deslocamentoAtual.current = deslocamento;
    const novoIndex = Math.max(0, Math.min(dadosAtuais.length - 1, Math.round(deslocamento / ITEM_INTERVAL)));
    aguardandoPagina.value = novoIndex;
    gestoSeletor.value = false;
    if (novoIndex !== ultimaSelecao.current) {
      ultimaSelecao.current = novoIndex;
      onChangeIndex(novoIndex);
    }
  }

  const irParaAnterior = () => {
    if (indexAtual > 0) onChangeIndex(indexAtual - 1);
  };

  const irParaProximo = () => {
    if (indexAtual < dadosAtuais.length - 1) onChangeIndex(indexAtual + 1);
  };

  const isPrevDisabled = indexAtual === 0;
  const isNextDisabled = indexAtual === dadosAtuais.length - 1;

  return (
    <View style={styles.wrapper}>
      <View style={styles.tipoSwitchContainer}>
        {(['INICIACAO', 'BASE'] as const).map(tipo => (
          <TouchableOpacity
            key={tipo}
            style={[styles.tipoSwitchBtn, tipoFiltro === tipo && styles.tipoSwitchBtnAtivo]}
            onPress={() => {
              if (tipo !== tipoFiltro) {
                onTrocarTipo(tipo);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tipoSwitchTxt, tipoFiltro === tipo && styles.tipoSwitchTxtAtivo]}>
              {tipo === 'INICIACAO' ? 'INICIAÇÃO' : 'BASE'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.internal}>
        <TouchableOpacity
          onPress={irParaAnterior}
          style={styles.botao}
          activeOpacity={0.7}
          disabled={isPrevDisabled}
        >
          <Icon
            name="chevron-left"
            size={24}
            color={isPrevDisabled ? colors.borda : colors.textoSecundario}
          />
        </TouchableOpacity>

        <Animated.ScrollView
          ref={listRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_INTERVAL}
          decelerationRate="fast"
          directionalLockEnabled
          bounces={false}
          onLayout={({ nativeEvent }) => setLarguraTrack(nativeEvent.layout.width)}
          onScrollBeginDrag={() => { arrastando.current = true; gestoSeletor.value = true; aguardandoPagina.value = -1; }}
          onScroll={({ nativeEvent }) => { deslocamentoAtual.current = nativeEvent.contentOffset.x; }}
          scrollEventThrottle={32}
          onScrollEndDrag={({ nativeEvent }) => {
            if (nativeEvent.velocity?.x === 0) concluirGesto(nativeEvent.contentOffset.x);
          }}
          onMomentumScrollEnd={({ nativeEvent }) => concluirGesto(nativeEvent.contentOffset.x)}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: Math.max(0, (larguraTrack - ITEM_INTERVAL) / 2) }]}
        >
          {dadosAtuais.map((item, index) => (
            <SubItem key={index} title={item.title} index={index} ativo={index === indexAtual}
              progresso={progressoPagina} colors={colors} styles={styles} onPress={() => onChangeIndex(index)} />
          ))}
        </Animated.ScrollView>

        <TouchableOpacity
          onPress={irParaProximo}
          style={styles.botao}
          activeOpacity={0.7}
          disabled={isNextDisabled}
        >
          <Icon
            name="chevron-right"
            size={24}
            color={isNextDisabled ? colors.borda : colors.textoSecundario}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: MARGEM_CONTEUDO,
    marginTop: 10,
    paddingBottom: 20,
  },
  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 6,
    width: '100%',
    marginBottom: 16,
  },
  tipoSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tipoSwitchBtnAtivo: {
    backgroundColor: colors.cardSecundario,
  },
  tipoSwitchTxt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.xs,
    letterSpacing: 0.5,
  },
  tipoSwitchTxtAtivo: {
    color: colors.texto,
  },
  internal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: PADDING_H,
    width: '100%',
  },
  botao: {
    width: LARGURA_BOTAO,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    alignItems: 'center',
  },
  item: {
    width: LARGURA_ITEM,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: GAP_ITEM / 2,
  },
  itemAtivo: {
    width: LARGURA_ITEM,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: GAP_ITEM / 2,
    backgroundColor: colors.primaria,
  },
  texto: {
    fontFamily: typography.fontFamily.corpo.medium,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
  },
  textoAtivo: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSobrePrimaria,
    fontSize: typography.fontSize.sm,
  },
});
