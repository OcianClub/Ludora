import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@ludora/icons';
import { typography } from '@ludora/design-tokens';
import { useTheme, type ThemeColors } from '@/src/contexts/ThemeContext';

type Props = {
  visible: boolean;
  titulo: string;
  descricao: string;
  confirmarTexto: string;
  carregandoTexto: string;
  icone: IconName;
  destrutivo?: boolean;
  carregando?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
};

export function ConfirmacaoConta({
  visible, titulo, descricao, confirmarTexto, carregandoTexto, icone,
  destrutivo = false, carregando = false, onConfirmar, onFechar,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const fechar = () => { if (!carregando) onFechar(); };
  const corAcao = destrutivo ? colors.tituloErro : colors.textoSobrePrimaria;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fechar}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backdrop}
          onPress={fechar}
          disabled={carregando}
          accessibilityRole="button"
          accessibilityLabel="Cancelar e fechar confirmação"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]} accessibilityViewIsModal>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topRow}>
              <View style={[styles.icon, destrutivo && styles.iconDanger]}>
                <Icon name={icone} size={25} color={destrutivo ? colors.tituloErro : colors.primaria} />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={fechar}
                disabled={carregando}
                accessibilityRole="button"
                accessibilityLabel="Fechar confirmação"
              >
                <Icon name="close" size={23} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <Text style={styles.title} accessibilityRole="header">{titulo}</Text>
            <Text style={styles.description}>{descricao}</Text>
            {destrutivo && <View style={styles.warning}>
              <Icon name="lock-outline" size={16} color={colors.tituloErro} />
              <Text style={styles.warningText}>Esta ação é permanente.</Text>
            </View>}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.confirmButton, destrutivo && styles.confirmDanger, carregando && styles.busy]}
                onPress={onConfirmar}
                disabled={carregando}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ disabled: carregando, busy: carregando }}
              >
                {carregando && <ActivityIndicator size="small" color={corAcao} />}
                <Text style={[styles.confirmText, { color: corAcao }]}>{carregando ? carregandoTexto : confirmarTexto}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={fechar} disabled={carregando} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ disabled: carregando }}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '100%', flexShrink: 1, overflow: 'hidden' },
  content: { paddingHorizontal: 24, paddingTop: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  icon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fundoBotao },
  iconDanger: { backgroundColor: colors.fundoErro },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.fontFamily.corpo.semiBold, fontSize: 22, color: colors.texto, marginBottom: 10 },
  description: { fontFamily: typography.fontFamily.corpo.regular, fontSize: 14, lineHeight: 22, color: colors.textoSecundario },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  warningText: { flex: 1, fontFamily: typography.fontFamily.corpo.medium, fontSize: 13, color: colors.tituloErro },
  actions: { marginTop: 26, gap: 6 },
  confirmButton: { minHeight: 52, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.primaria, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  confirmDanger: { backgroundColor: colors.fundoErro, borderWidth: 1, borderColor: colors.bordaErro },
  busy: { opacity: 0.7 },
  confirmText: { fontFamily: typography.fontFamily.corpo.semiBold, fontSize: 15, textAlign: 'center' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: typography.fontFamily.corpo.medium, fontSize: 14, color: colors.textoSecundario },
});
