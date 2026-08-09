import { useRef, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';

const { width: windowWidth } = Dimensions.get('window');
const MARGEM_CONTEUDO = 20;
const LARGURA_DISPONIVEL = windowWidth - MARGEM_CONTEUDO * 2;
const LARGURA_ITEM = 100;
const GAP_ITEM = 8;
const ITEM_INTERVAL = LARGURA_ITEM + GAP_ITEM;

const LARGURA_BOTAO = 32;
const PADDING_H = 8;
const LARGURA_TRACK = LARGURA_DISPONIVEL - LARGURA_BOTAO * 2 - PADDING_H * 2;

const PADDING_CENTRALIZADOR = (LARGURA_TRACK - LARGURA_ITEM) / 2;

export const SUBS_INICIACAO = [
  { id: '1', title: 'SUB-7' },
  { id: '2', title: 'SUB-8' },
  { id: '3', title: 'SUB-9' },
  { id: '4', title: 'SUB-10' },
];

export const SUBS = [
  { id: '1', title: 'SUB 12' },
  { id: '2', title: 'SUB 14' },
  { id: '3', title: 'SUB 16' },
  { id: '4', title: 'SUB 18' },
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
}

function DotIndicator({
  total,
  current,
  onPress,
}: {
  total: number;
  current: number;
  onPress: (i: number) => void;
}) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onPress(i)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <View style={[dotStyles.dot, i === current && dotStyles.dotActive]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: {
    width: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#252525',
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
});

export function CarrosselSubs({
  tipoFiltro,
  onTrocarTipo,
  indexAtual,
  onChangeIndex,
}: CarrosselSubsProps) {
  const listRef = useRef<FlatList>(null);
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  useEffect(() => {
    setTimeout(() => {
      if (indexAtual >= 0 && indexAtual < dadosAtuais.length) {
        listRef.current?.scrollToIndex({
          index: indexAtual,
          animated: true,
          viewPosition: 0.5,
        });
      }
    }, 50);
  }, [indexAtual, dadosAtuais.length]);

  const irParaAnterior = () => {
    if (indexAtual > 0) onChangeIndex(indexAtual - 1);
  };

  const irParaProximo = () => {
    if (indexAtual < dadosAtuais.length - 1) onChangeIndex(indexAtual + 1);
  };

  const handleTrocarFase = (tipo: 'INICIACAO' | 'BASE') => {
    if (tipo !== tipoFiltro) {
      onTrocarTipo(tipo);
      onChangeIndex(0);
    }
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
            onPress={() => handleTrocarFase(tipo)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tipoSwitchTxt, tipoFiltro === tipo && styles.tipoSwitchTxtAtivo]}>
              {tipo === 'INICIACAO' ? 'INICIAÇÃO' : 'BASE'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── CARROSSEL ── */}
      <View style={styles.internal}>
        <TouchableOpacity
          onPress={irParaAnterior}
          style={styles.botao}
          activeOpacity={0.7}
          disabled={isPrevDisabled}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={isPrevDisabled ? '#2a2a2a' : '#FFF'}
          />
        </TouchableOpacity>

        <FlatList
          ref={listRef}
          data={dadosAtuais}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          scrollEnabled={true}
          snapToInterval={ITEM_INTERVAL}
          decelerationRate="fast"
          contentContainerStyle={styles.listContent}
          getItemLayout={(_, index) => ({
            length: ITEM_INTERVAL,
            offset: ITEM_INTERVAL * index,
            index,
          })}
          renderItem={({ item, index }) => {
            const isActive = index === indexAtual;

            if (isActive) {
              return (
                <LinearGradient
                  colors={['#006AFF', '#009FFF']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.itemAtivo}
                >
                  <Text style={styles.textoAtivo}>{item.title}</Text>
                </LinearGradient>
              );
            }

            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => onChangeIndex(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.texto}>{item.title}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          onPress={irParaProximo}
          style={styles.botao}
          activeOpacity={0.7}
          disabled={isNextDisabled}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={isNextDisabled ? '#2a2a2a' : '#FFF'}
          />
        </TouchableOpacity>
      </View>

      <DotIndicator
        total={dadosAtuais.length}
        current={indexAtual}
        onPress={onChangeIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: MARGEM_CONTEUDO,
    marginTop: 10,
    paddingBottom: 10,
  },

  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    width: '100%',
    marginBottom: 10,
  },
  tipoSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tipoSwitchBtnAtivo: {
    backgroundColor: colors.primary + '22',
  },
  tipoSwitchTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  tipoSwitchTxtAtivo: {
    color: colors.primary,
  },

  // ── CARROSSEL ──
  internal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: PADDING_H,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  botao: {
    width: LARGURA_BOTAO,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    alignItems: 'center',
    paddingHorizontal: PADDING_CENTRALIZADOR,
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
    borderRadius: 10,
    marginHorizontal: GAP_ITEM / 2,
  },
  texto: {
    fontFamily: 'Creato-Bold',
    color: '#444',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  textoAtivo: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 1,
  },
});