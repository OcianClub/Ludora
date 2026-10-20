import { Icon } from '@ludora/icons';
import { memo, useRef, useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, PanResponder } from 'react-native';
import { typography } from '@ludora/design-tokens';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
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
  progressoPagina,
}: CarrosselSubsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [larguraTrack, setLarguraTrack] = useState(0);
  const progressoLocal = useSharedValue(indexAtual);
  const progresso = progressoPagina ?? progressoLocal;
  const arrasto = useSharedValue(0);
  const inicioGesto = useRef(indexAtual);
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  useEffect(() => {
    if (!progressoPagina) progressoLocal.value = withTiming(indexAtual, { duration: 180 });
  }, [indexAtual, progressoPagina, progressoLocal]);

  const movimento = useAnimatedStyle(() => ({
    transform: [{ translateX: (larguraTrack - ITEM_INTERVAL) / 2 -
      Math.max(0, Math.min(dadosAtuais.length - 1, progresso.value)) * ITEM_INTERVAL + arrasto.value }],
  }));

  const gesto = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, movimento) => Math.abs(movimento.dx) > 8 && Math.abs(movimento.dx) > Math.abs(movimento.dy) * 1.4,
    onPanResponderGrant: () => { inicioGesto.current = indexAtual; },
    onPanResponderMove: (_, movimento) => {
      arrasto.value = Math.max(-(dadosAtuais.length - 1 - inicioGesto.current) * ITEM_INTERVAL,
        Math.min(inicioGesto.current * ITEM_INTERVAL, movimento.dx));
    },
    onPanResponderRelease: (_, movimento) => {
      const deslocamento = Math.abs(movimento.dx) > 20 ? Math.sign(movimento.dx) * Math.max(1, Math.round(Math.abs(movimento.dx) / ITEM_INTERVAL)) : 0;
      const destino = Math.max(0, Math.min(dadosAtuais.length - 1, inicioGesto.current - deslocamento));
      arrasto.value = withTiming(0, { duration: 160 });
      if (destino !== indexAtual) onChangeIndex(destino);
    },
    onPanResponderTerminate: () => { arrasto.value = withTiming(0, { duration: 160 }); },
  }), [indexAtual, onChangeIndex, dadosAtuais.length, arrasto]);

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

        <View
          style={styles.trackViewport}
          onLayout={({ nativeEvent }) => setLarguraTrack(nativeEvent.layout.width)}
          {...gesto.panHandlers}
        >
          <Animated.View style={[styles.track, { width: dadosAtuais.length * ITEM_INTERVAL }, movimento]}>
          {dadosAtuais.map((item, index) => (
            <SubItem key={index} title={item.title} index={index} ativo={index === indexAtual}
              progresso={progresso} colors={colors} styles={styles} onPress={() => onChangeIndex(index)} />
          ))}
          </Animated.View>
        </View>

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
