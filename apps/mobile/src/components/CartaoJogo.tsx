import { memo, useMemo } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/jogosStyles';
import { agoraAgenda, rotuloAgenda, type PartidaAgendaBase } from '@/src/utils/agendaJogos';

export interface PartidaJogo extends PartidaAgendaBase {
  somente_leitura?: boolean;
  mandante: { id: number; nome: string; escudo: string | null };
  visitante: { id: number; nome: string; escudo: string | null };
  gols_mandante: number;
  gols_visitante: number;
  local: string | null;
  emCasa: boolean;
  categoria: { id: number; nome: string } | null;
}

export const CartaoJogo = memo(function CartaoJogo({ partida, agora, gestor, onPress }: {
  partida: PartidaJogo;
  agora: Date;
  gestor: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const partidaEhHoje = partida.data.slice(0, 10) === agoraAgenda(agora).slice(0, 10);
  const partidaAoVivo = partida.status === 'AO_VIVO';
  const rotulo = rotuloAgenda(partida, agora, gestor);
  return (
    <TouchableOpacity
  key={partida.id}
  style={[
    styles.matchCard,
    partidaEhHoje && styles.matchCardHoje,
    partidaAoVivo && styles.matchCardAoVivo,
  ]}
  activeOpacity={0.85}
  onPress={onPress}
>
  {/* TOP CARD */}
  <View style={styles.cardTop}>
    <View style={styles.cardTopLeft}>
      <Icon
        name="clock-outline"
        size={16}
        color={colors.textoSecundario}
      />
      <Text style={styles.timeText}>
        {partida.horario ?? '--:--'}
      </Text>
      <View style={styles.separator} />
      <Text style={styles.catText}>
        {partida.categoria?.nome
          .replace('SUB', '')
          .trim() ?? '?'}
      </Text>
      {partidaEhHoje && !partidaAoVivo && (
        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeText}>
            HOJE
          </Text>
        </View>
      )}
    </View>
    <View style={styles.cardBadges}>
      {partidaAoVivo && (
        <View style={[styles.badge, styles.liveBadge]}>
          <View style={styles.liveDot} accessible={false} />
          <Text style={[styles.badgeText, styles.liveBadgeText]}>
            AO VIVO
          </Text>
        </View>
      )}
      <View
        style={[
          styles.badge,
          !partida.emCasa && {
            backgroundColor:
              colors.cardSecundario,
          },
        ]}
      >
        <Icon
          name={
            partida.emCasa
              ? 'home-outline'
              : 'bus'
          }
          size={14}
          color={
            partida.emCasa
              ? colors.textoSobrePrimaria
              : colors.texto
          }
        />
        <Text
          style={[
            styles.badgeText,
            {
              color: partida.emCasa
                ? colors.textoSobrePrimaria
                : colors.texto,
            },
          ]}
        >
          {partida.emCasa ? 'CASA' : 'FORA'}
        </Text>
      </View>
    </View>
  </View>
   {rotulo && <Text style={styles.matchStatus}>{rotulo}</Text>}
    {/* BODY CARD */}
  <View style={styles.cardBody}>
    <View style={styles.teamCol}>
      {partida.mandante.escudo ? (
        <Image
          source={{
            uri: partida.mandante.escudo,
          }}
          style={styles.teamLogo}
        />
      ) : (
        <View style={styles.fundoImg}>
          <Image
            source={require('@/assets/images/SóPreto.png')}
            style={styles.teamLogo}
          />
        </View>
      )}
      <Text
        style={styles.teamName}
        numberOfLines={2}
      >
        {partida.mandante.nome}
      </Text>
    </View>
     <View style={styles.placarCentral}>
      {partida.status === 'AGENDADA' ||
      partida.status === 'PREPARADA' ||
      partida.status === 'CANCELADA' ? (
        <>
          <Text style={styles.placarText}>-</Text>
          <Text style={styles.vsText}>VS</Text>
        </>
      ) : (
        <Text style={styles.placarText}>
          {partida.gols_mandante} -{' '}
          {partida.gols_visitante}
        </Text>
      )}
    </View>
     <View style={styles.teamCol}>
      {partida.visitante.escudo ? (
        <Image
          source={{
            uri: partida.visitante.escudo,
          }}
          style={styles.teamLogo}
        />
      ) : (
        <View style={styles.fundoImg}>
          <Image
            source={require('@/assets/images/SóPreto.png')}
            style={styles.teamLogo}
          />
        </View>
      )}
      <Text
        style={styles.teamName}
        numberOfLines={2}
      >
        {partida.visitante.nome}
      </Text>
    </View>
  </View>
   {/* FOOTER CARD */}
  <View style={styles.cardFooterDivider} />
  <View style={styles.cardFooter}>
    <Icon
      name="map-marker-outline"
      size={16}
      color={colors.texto}
    />
    <Text style={styles.locationText}>
      {partida.local ?? 'Local não definido'}
    </Text>
  </View>
</TouchableOpacity>
  );
});

