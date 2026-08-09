import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';

interface Props {
  visible: boolean;
  jogadorA: { nome: string; camisa: string | number | null }; // quem está pedindo
  jogadorB: { nome: string; camisa: string | number | null }; // quem já tem a camisa
  onConfirmar: () => void;
  onCancelar: () => void;
}

function nomeCurto(nome: string) {
  const p = nome.trim().split(' ');
  return p.length === 1 ? p[0] : `${p[0]} ${p[p.length - 1]}`;
}

export default function ModalTrocaCamisa({ visible, jogadorA, jogadorB, onConfirmar, onCancelar }: Props) {
  const camisaAlvo   = jogadorB.camisa;   // camisa disputada (que A quer)
  const camisaLivre  = jogadorA.camisa;   // camisa que A tinha antes (vai pro B)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={s.overlay}>
        <View style={s.box}>

          {/* Ícone */}
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name="tshirt-crew" size={28} color={colors.amarelo} />
          </View>

          <Text style={s.titulo}>Camisa #{camisaAlvo} em uso</Text>
          <Text style={s.descricao}>
            <Text style={s.destaque}>{nomeCurto(jogadorB.nome)}</Text>
            {' '}já usa essa camisa.{'\n'}Deseja fazer a troca?
          </Text>

          {/* Preview da troca */}
          <View style={s.trocaRow}>
            {/* Jogador A — recebe a camisa alvo */}
            <View style={s.jogadorCard}>
              <View style={s.camisaBadge}>
                <Text style={s.camisaNum}>#{camisaAlvo ?? '—'}</Text>
              </View>
              <Text style={s.jogadorNome} numberOfLines={1}>{nomeCurto(jogadorA.nome)}</Text>
            </View>

            {/* Seta bidirecional */}
            <MaterialCommunityIcons name="swap-horizontal" size={26} color={colors.primary} style={s.seta} />

            {/* Jogador B — recebe a camisa livre */}
            <View style={s.jogadorCard}>
              <View style={[s.camisaBadge, { backgroundColor: '#252525' }]}>
                <Text style={[s.camisaNum, { color: colors.text_secondary }]}>
                  #{camisaLivre || '—'}
                </Text>
              </View>
              <Text style={s.jogadorNome} numberOfLines={1}>{nomeCurto(jogadorB.nome)}</Text>
            </View>
          </View>

          {/* Botões */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnCancel} onPress={onCancelar} activeOpacity={0.8}>
              <Text style={s.btnCancelTxt}>CANCELAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnConfirm} onPress={onConfirmar} activeOpacity={0.8}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
              <Text style={s.btnConfirmTxt}>TROCAR</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = {
  overlay: {
    flex: 1, backgroundColor: '#000000cc',
    alignItems: 'center' as const, justifyContent: 'center' as const, padding: 28,
  },
  box: {
    backgroundColor: '#161616', borderRadius: 20, padding: 24,
    width: '100%' as const, borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: colors.amarelo + '18',
    alignItems: 'center' as const, justifyContent: 'center' as const,
    marginBottom: 14,
  },
  titulo: {
    fontFamily: 'Creato-Bold', color: colors.text,
    fontSize: 16, marginBottom: 8, textAlign: 'center' as const,
  },
  descricao: {
    fontFamily: 'Creato-Regular', color: colors.text_secondary,
    fontSize: 13, textAlign: 'center' as const, lineHeight: 20, marginBottom: 24,
  },
  destaque: { fontFamily: 'Creato-Bold', color: colors.text },

  trocaRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 8, marginBottom: 28, width: '100%' as const,
  },
  jogadorCard: {
    flex: 1, alignItems: 'center' as const, gap: 8,
    backgroundColor: '#1e1e1e', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  camisaBadge: {
    backgroundColor: colors.primary + '20', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  camisaNum: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 20 },
  jogadorNome: {
    fontFamily: 'Creato-Bold', color: colors.text,
    fontSize: 12, textAlign: 'center' as const,
  },
  seta: { flexShrink: 0 },

  btnRow: { flexDirection: 'row' as const, gap: 10, width: '100%' as const },
  btnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' as const,
  },
  btnCancelTxt: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 },
  btnConfirm: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center' as const,
    flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 6,
  },
  btnConfirmTxt: { fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 13, letterSpacing: 0.5 },
};