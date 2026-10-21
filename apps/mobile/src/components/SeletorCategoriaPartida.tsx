import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';
import {
  gruposCategoriasPartida,
  type CategoriaPartida,
} from '@/src/utils/organizarPartida';
import { PainelOrganizarPartida } from './PainelOrganizarPartida';

type Props = {
  categorias: CategoriaPartida[];
  categoriaId: number | null;
  onSelecionar: (id: number) => void;
  onFechar: () => void;
};

export function SeletorCategoriaPartida({
  categorias,
  categoriaId,
  onSelecionar,
  onFechar,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const grupos = useMemo(() => gruposCategoriasPartida(categorias), [categorias]);

  return (
    <PainelOrganizarPartida
      titulo="Categoria da partida"
      subtitulo="Toque na categoria para selecionar."
      onFechar={onFechar}
    >
      <ScrollView
        style={styles.selectorList}
        contentContainerStyle={styles.categoryGroups}
        showsVerticalScrollIndicator={false}
      >
        {grupos.map((grupo) => (
          <View key={grupo.tipo} style={styles.categoryGroup}>
            <Text style={styles.categoryGroupTitle} accessibilityRole="header">
              {grupo.titulo}
            </Text>
            <View style={styles.categoryGrid}>
              {grupo.categorias.map((categoria) => {
                const selecionada = categoria.id === categoriaId;
                return (
                  <TouchableOpacity
                    key={categoria.id}
                    style={[
                      styles.categoryOption,
                      selecionada && styles.categoryOptionSelected,
                    ]}
                    onPress={() => onSelecionar(categoria.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityLabel={`${grupo.titulo}, ${categoria.nome}`}
                    accessibilityState={{ checked: selecionada }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        selecionada && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {categoria.nome}
                    </Text>
                    {selecionada && (
                      <Icon
                        name="check"
                        size={15}
                        color={colors.textoSobrePrimaria}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </PainelOrganizarPartida>
  );
}
