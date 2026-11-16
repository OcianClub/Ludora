import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MatchCardLayout } from '../MatchCardLayout';
import { Icon } from '@ludora/icons';
import type { EquipePaulista, JogoPaulista } from '../../../../../packages/shared-types/src/paulista';
import { agendaProvisoria } from '../../../../../packages/shared-types/src/paulistaPresentation/paulistaBracket';
import { nomeOficial, temResultado } from '../../utils/paulista';
import { useTheme } from '../../contexts/ThemeContext';
import { EscudoOficial, ResultadoOficial, useDestaqueClube, usePaulistaStyles } from './PaulistaUI';

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
      <EscudoOficial equipe={equipe} size={48} destaque={destaque} />
      <Text numberOfLines={2} style={[s.text, styles.nome, styles.nomeEquipe]}>{nome(equipe)}</Text>
    </View>
  );

  return (
    <MatchCardLayout
      label={`Ver detalhes: ${nome(mandante)} contra ${nome(visitante)}`}
      action="Ver detalhes" onPress={() => onOpen(jogo)}
      local={jogo.local?.trim() || 'Local a confirmar'}
      style={realcarClube && (emCasa || souVisitante) ? {
        backgroundColor: destaque.fundo, borderLeftWidth: 3, borderLeftColor: destaque.borda,
      } : undefined}
      agenda={<View style={[s.row, styles.agenda]}>
        <Text style={diaValido ? [s.number, styles.data] : s.muted}>
          {diaValido ? diaMes.format(data).replace(' de ', ' ').replace('.', '').toUpperCase() : 'Data a confirmar'}
        </Text>
        {diaValido && <Text style={s.text}>{capitalizar(diaSemana.format(data).replace('.', ''))}</Text>}
        <Icon name="clock-outline" size={13} color={colors.textoSecundario}/>
        <Text style={s.text}>{horario}</Text>
      </View>}
      context={<Text style={[s.tiny, { marginTop: 7 }]}>{nomeOficial(jogo.fase)}</Text>}
      badgesBelow={temResultado(jogo)}
      badges={<>
        <ResultadoOficial jogo={jogo} minhas={minhas}/>
        {temMando && <View style={[s.row, styles.mando, { backgroundColor: colors.cardSecundario }]}>
          <Icon name={emCasa ? 'home-outline' : 'bus'} size={12} color={colors.texto}/>
          <Text style={[s.tiny, { color: colors.texto }]}>{emCasa ? 'Casa' : 'Fora'}</Text>
        </View>}
      </>}
      home={time(mandante, emCasa)} away={time(visitante, souVisitante)}
      score={temResultado(jogo) ? <View style={[s.row, styles.placar]} accessible accessibilityLabel={`${jogo.golsMandante} a ${jogo.golsVisitante}`}>
        <Text style={s.number}>{jogo.golsMandante}</Text>
        <Text style={s.muted}>·</Text>
        <Text style={s.number}>{jogo.golsVisitante}</Text>
      </View> : <Text style={[s.muted, styles.placar]}>{jogo.ocorrencia === 'WO' ? 'W.O.' : 'VS'}</Text>}
    />
  );
});

const styles = StyleSheet.create({
  agenda: { flexWrap: 'wrap', gap: 7 },
  data: { fontSize: 22, lineHeight: 28 },
  mando: { borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6, gap: 4 },
  equipe: { width: '100%', minWidth: 0, alignItems: 'center', gap: 7 },
  nome: { fontFamily: 'Inter_600SemiBold' },
  nomeEquipe: { textAlign: 'center', fontSize: 13, lineHeight: 20, height: 40 },
  placar: { gap: 9, minWidth: 52, justifyContent: 'center', textAlign: 'center' },
});
