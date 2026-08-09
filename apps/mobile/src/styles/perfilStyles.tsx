import { StyleSheet } from "react-native";
import { colors } from "@/src/theme/colors";

const MARGEM = 20;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
   content: {
    paddingHorizontal: MARGEM,
    paddingTop: 16,
  },
  contentSecundario: {
    flexDirection: 'column',
    gap: 30
  },
  cardContainer: {
    flexDirection: 'column',
    marginBottom: 20,
},
  card: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 10
  },
  cardSpace: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20
  },
  titulo: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 18
  },
  subtitulo: {
    fontFamily: 'Creato-Regular',
    color: colors.cinza_claro,
    fontSize: 15
  },
  cardText: {
    flexDirection: 'column',
    gap: 6
  },
  headerPerfil: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  nomeUsuario: {
    fontFamily: 'Creato-Bold',
    fontSize: 22,
    color: colors.primary
  },
  dataMembro: {
    fontFamily: 'Creato-Regular',
    fontSize: 16,
    color: colors.cinza_claro
  },
  btnSair: {
    backgroundColor: '#202020',
    borderRadius: 10,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  txtSair: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
  },
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 30,
},
modalCard: {
  backgroundColor: '#1A1A1A',
  borderRadius: 20,
  padding: 28,
  width: '100%',
  alignItems: 'center',
  gap: 8,
  borderWidth: 1,
  borderColor: '#2a2a2a',
},
modalTitulo: {
  fontFamily: 'Creato-Bold',
  color: colors.text,
  fontSize: 18,
  marginBottom: 4,
},
modalSubtitulo: {
  fontFamily: 'Creato-Regular',
  color: colors.text_secondary,
  fontSize: 14,
  textAlign: 'center',
  marginBottom: 8,
},
modalBotoes: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 12,
  width: '100%',
},
btnNao: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: 'center',
  backgroundColor: '#2a2a2a',
  borderWidth: 1,
  borderColor: '#3a3a3a',
},
txtNao: {
  fontFamily: 'Creato-Bold',
  color: colors.text_secondary,
  fontSize: 13,
  letterSpacing: 0.8,
},
btnSim: {
  flex: 1,
  paddingVertical: 14,
  borderRadius: 12,
  alignItems: 'center',
  backgroundColor: colors.vermelho + '22',
  borderWidth: 1,
  borderColor: colors.vermelho,
},
txtSim: {
  fontFamily: 'Creato-Bold',
  color: colors.vermelho,
  fontSize: 13,
  letterSpacing: 0.8,
},
})