import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import type { EquipePaulista, JogoPaulista } from '../../../../../packages/shared-types/src/paulista';
import { agendaProvisoria } from '../../../../../packages/shared-types/src/paulistaPresentation/paulistaBracket';
import { nomeOficial, temResultado } from '../../utils/paulista';
import { useTheme } from '../../contexts/ThemeContext';
import { EscudoOficial, Panel, ResultadoOficial, useDestaqueClube, usePaulistaStyles } from './PaulistaUI';

const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const PaulistaMatchCard = memo(function PaulistaMatchCard({ jogo, equipes, minhas, onOpen, realcarClube = false }: {
  jogo: JogoPaulista;
  equipes: Map<number, EquipePaulista>;
  minhas: Set<number>;
  onOpen: (jogo: JogoPaulista) => void;
  realcarClube?: boolean;
}) {
  const { colors } = useTheme();
  const s = usePaulistaStyles();
  const destaque = useDestaqueClube();
  const mandante = equipes.get(jogo.mandanteId);
  const visitante = equipes.get(jogo.visitanteId);
  const emCasa = minhas.has(jogo.mandanteId);
  const souVisitante = minhas.has(jogo.visitanteId);
  const temMando = emCasa !== souVisitante;
  const data = jogo.data ? new Date(jogo.data.slice(0, 10) + 'T12:00:00Z') : null;
  const agendaConfirmada = !agendaProvisoria(jogo);
  const diaValido = data && Number.isFinite(data.getTime()) && agendaConfirmada;
  const horario = agendaConfirmada && jogo.horario ? jogo.horario.slice(0, 5) : 'Horário a confirmar';
  const nome = (equipe?: EquipePaulista) => nomeOficial(equipe?.nome || 'Equipe a confirmar');

  const time = (equipe: EquipePaulista | undefined, destaque: boolean) => (
    <View style={styles.equipe}>
      <EscudoOficial equipe={equipe} size={40} destaque={destaque} />
      <Text numberOfLines={1} style={[s.text, styles.nome]}>{nome(equipe)}</Text>
    </View>
  );

  return (
    <Panel style={[
      styles.card,
      realcarClube && (emCasa || souVisitante) && {
        backgroundColor: destaque.fundo,
        borderLeftWidth: 3,
        borderLeftColor: destaque.borda,
      },
    ]}>
      <View style={styles.topo}>
        <View style={styles.agenda}>
          <Text style={diaValido ? [s.number, styles.data] : s.muted}>
            {diaValido ? diaMes.format(data).replace(' de ', ' ').replace('.', '').toUpperCase() : 'Data a confirmar'}
          </Text>
          <View style={[s.row, styles.horario]}>
            {diaValido && <Text style={s.text}>{capitalizar(diaSemana.format(data).replace('.', ''))}</Text>}
            <Icon name="clock-outline" size={13} color={colors.textoSecundario} />
            <Text style={s.text}>{horario}</Text>
          </View>
        </View>
        <View style={[s.row, styles.chips]}>
          <ResultadoOficial jogo={jogo} minhas={minhas} />
          {temMando && (
            <View style={[s.row, styles.mando, { backgroundColor: colors.cardSecundario }]}>
              <Icon name={emCasa ? 'home-outline' : 'bus'} size={12} color={colors.texto} />
              <Text style={[s.tiny, { color: colors.texto }]}>{emCasa ? 'Casa' : 'Fora'}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={s.tiny}>{nomeOficial(jogo.fase)}</Text>
      <View style={[s.row, styles.confronto]}>
        {time(mandante, emCasa)}
        {temResultado(jogo) ? (
          <View style={[s.row, styles.placar]} accessible accessibilityLabel={`${jogo.golsMandante} a ${jogo.golsVisitante}`}>
            <Text style={s.number}>{jogo.golsMandante}</Text>
            <Text style={s.muted}>·</Text>
            <Text style={s.number}>{jogo.golsVisitante}</Text>
          </View>
        ) : (
          <Text style={[s.muted, styles.placar]}>{jogo.ocorrencia === 'WO' ? 'W.O.' : 'VS'}</Text>
        )}
        {time(visitante, souVisitante)}
      </View>
      <View style={[s.row, styles.local, { borderTopColor: colors.linha }]}>
        <Icon name="location" size={15} color={colors.textoSecundario} />
        <Text style={[s.tiny, { flex: 1 }]} numberOfLines={2}>{jogo.local?.trim() || 'Local a confirmar'}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Ver detalhes: ${nome(mandante)} contra ${nome(visitante)}`}
        onPress={() => onOpen(jogo)}
        style={[s.row, styles.detalhes, { borderColor: colors.borda }]}
      >
        <Text style={[s.text, styles.nome]}>Ver detalhes</Text>
        <Icon name="chevron-right" size={15} color={colors.textoSecundario} />
      </TouchableOpacity>
    </Panel>
  );
});

const styles = StyleSheet.create({
  card: { padding: 14, gap: 9 },
  topo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  agenda: { flex: 1, minWidth: 0 },
  data: { fontSize: 24, lineHeight: 30 },
  horario: { gap: 5, flexWrap: 'wrap' },
  chips: { gap: 5, flexShrink: 0 },
  mando: { borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6, gap: 4 },
  confronto: { gap: 8, paddingVertical: 3 },
  equipe: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  nome: { fontFamily: 'Inter_600SemiBold' },
  placar: { gap: 9, minWidth: 52, justifyContent: 'center', textAlign: 'center' },
  local: { borderTopWidth: 1, paddingTop: 8, gap: 6 },
  detalhes: { minHeight: 44, borderWidth: 1, borderRadius: 7, justifyContent: 'center', gap: 7, marginTop: 4 },
});
