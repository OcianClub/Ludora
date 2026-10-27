import { Icon } from '@ludora/icons';
import { memo, useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, FlatList } from 'react-native';
import { typography } from '@ludora/design-tokens';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedRef, useAnimatedReaction, scrollTo, cancelAnimation, runOnJS, withSpring, type SharedValue } from 'react-native-reanimated';
import { pageDestination } from '@/src/utils/categoryMotion';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  onChangeIndex: (index: number, velocity?: number) => void;
  originPagina?: SharedValue<number>;
  settlingPagina?: SharedValue<boolean>;
  progressoPagina?: SharedValue<number>;
}

const SubItem = memo(function SubItem({ title, index, ativo, progresso, onPress, styles }: {
  title: string; index: number; ativo: boolean; progresso: SharedValue<number>;
  onPress: () => void; styles: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const destaque = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(progresso.value - index)) }));
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <View style={styles.item}>
        <Text style={styles.texto}>{title}</Text>
        <Animated.View pointerEvents="none" style={[styles.itemDestaque, destaque]}>
          <Text style={styles.textoAtivo}>{title}</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
});

export const CarrosselSubs = memo(function CarrosselSubs({
  tipoFiltro,
  onTrocarTipo,
  indexAtual,
  onChangeIndex,
  progressoPagina, originPagina, settlingPagina,
}: CarrosselSubsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [larguraTrack, setLarguraTrack] = useState(0);
  const progressoLocal = useSharedValue(indexAtual);
  const progresso = progressoPagina ?? progressoLocal;
  const inicio = useSharedValue(indexAtual);
  const origem = useSharedValue(indexAtual);
  const engaged = useSharedValue(false);
  const listRef = useAnimatedRef<FlatList<{ id: string; title: string }>>();
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  useEffect(() => {
    if (!progressoPagina) progressoLocal.value = withSpring(indexAtual, { damping: 25, stiffness: 220 });
  }, [indexAtual, progressoPagina, progressoLocal]);
  useAnimatedReaction(() => ({ value: progresso.value, width: larguraTrack }), value => {
    scrollTo(listRef, Math.max(0, Math.min(dadosAtuais.length - 1, value.value)) * ITEM_INTERVAL, 0, false);
  }, [dadosAtuais.length, larguraTrack]);
  const gesture = Gesture.Pan().activeOffsetX([-10, 10]).failOffsetY([-10, 10])
    .onStart(() => {
      cancelAnimation(progresso); inicio.value = progresso.value; origem.value = Math.round(progresso.value); engaged.value = true;
      if (originPagina) originPagina.value = origem.value;
      if (settlingPagina) settlingPagina.value = false;
    })
    .onUpdate(event => { progresso.value = Math.max(Math.max(0, origem.value - 1), Math.min(Math.min(dadosAtuais.length - 1, origem.value + 1), inicio.value - event.translationX / ITEM_INTERVAL)); })
    .onEnd((event, success) => {
      if (!success) return;
      engaged.value = false;
      const velocity = -event.velocityX / ITEM_INTERVAL;
      const destination = pageDestination(origem.value, progresso.value, velocity, dadosAtuais.length);
      if (progressoPagina) runOnJS(onChangeIndex)(destination, velocity);
      else { progresso.value = withSpring(destination, { damping:25, stiffness:220, velocity, overshootClamping:true }); runOnJS(onChangeIndex)(destination); }
    })
    .onFinalize((_event, success) => {
      if (!success && engaged.value) { engaged.value = false; if (progressoPagina) runOnJS(onChangeIndex)(origem.value); else progresso.value = withSpring(origem.value); }
    });

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
          accessibilityRole="button"
          accessibilityLabel="Categoria anterior"
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

        <GestureDetector gesture={gesture}><View
          style={styles.trackViewport}
          onLayout={({ nativeEvent }) => setLarguraTrack(nativeEvent.layout.width)}
        >
          <Animated.FlatList ref={listRef} horizontal data={dadosAtuais} scrollEnabled={false} showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id} extraData={indexAtual} initialNumToRender={4} removeClippedSubviews={false}
            contentContainerStyle={{ paddingHorizontal: Math.max(0, (larguraTrack - ITEM_INTERVAL) / 2), alignItems: 'center' }}
            getItemLayout={(_, index) => ({ length: ITEM_INTERVAL, offset: ITEM_INTERVAL * index, index })}
            renderItem={({ item, index }) => <SubItem title={item.title} index={index} ativo={index === indexAtual}
              progresso={progresso} colors={colors} styles={styles} onPress={() => onChangeIndex(index)} />}/>
        </View></GestureDetector>

        <TouchableOpacity
          onPress={irParaProximo}
          accessibilityRole="button"
          accessibilityLabel="Próxima categoria"
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
    marginTop: 4,
    paddingBottom: 14,
  },
  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    width: '100%',
    marginBottom: 6,
  },
  tipoSwitchBtn: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 4,
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
    paddingVertical: 5,
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
  trackViewport: { flex: 1, height: 34, overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'center' },
  itemDestaque: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primaria },
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
