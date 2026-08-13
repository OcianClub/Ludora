import { useRef, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '@ludora/design-tokens';

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
                onChangeIndex(0);
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
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color={isPrevDisabled ? colors.borda : colors.textoSecundario}
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
                <View style={styles.itemAtivo}>
                  <Text style={styles.textoAtivo}>{item.title}</Text>
                </View>
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
            color={isNextDisabled ? colors.borda : colors.textoSecundario}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.texto,
    fontSize: typography.fontSize.sm,
  },
});