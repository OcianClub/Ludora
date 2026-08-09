import { View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from './historicoPartidasStyles';

interface Time { id: number; nome: string; escudo: string | null; }
interface Partida {
  id: number;
  mandante: Time;
  visitante: Time;
  gols_mandante: number;
  gols_visitante: number;
  data: string;
  status: string;
}

interface HistoricoPartidasProps {
  partida: Partida;
}

export function HistoricoPartidas({ partida }: HistoricoPartidasProps) {
  const formatarData = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
            .toUpperCase().replace(/ DE /g, ' ').replace('.', '');
  };

  const vitoriaMandante = partida.gols_mandante > partida.gols_visitante;
  const vitoriaVisitante = partida.gols_visitante > partida.gols_mandante;
  const empate = partida.gols_mandante === partida.gols_visitante;

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.colorBorder} />
      <View style={styles.matchCard}>
        
        <View style={styles.timeUm}>
          <View style={styles.escudoBackground}>
            {partida.mandante.escudo ? (
              <Image source={{ uri: partida.mandante.escudo }} style={styles.escudoTime} />
            ) : (
              <Image source={require('@/assets/images/SóPreto.png')} style={styles.escudoTime} />
            )}
          </View> 
          <Text 
            style={[styles.txtTimeUm, (!vitoriaMandante && !empate) && { color: 'gray' }]} 
            numberOfLines={2}
          >
            {partida.mandante.nome}
          </Text>
        </View>

        <View style={styles.placarContainer}>
          <Text style={styles.dataJogo}>{formatarData(partida.data)}</Text>
          <View style={styles.golsWrapper}>
            <View style={styles.golBox}>
              <Text style={styles.txtGol}>{partida.gols_mandante}</Text>
            </View>
            <Text style={styles.traco}>-</Text>
            <View style={styles.golBox}>
              <Text style={styles.txtGol}>{partida.gols_visitante}</Text>
            </View>
          </View>
        </View>

        <View style={styles.timeDois}>
          <View style={styles.escudoBackground}>
            {partida.visitante.escudo ? (
              <Image source={{ uri: partida.visitante.escudo }} style={styles.escudoTime} />
            ) : (
              <Image source={require('@/assets/images/SóPreto.png')} style={styles.escudoTime} />
            )}
          </View> 
          <Text 
            style={[styles.txtTimeDois, (vitoriaVisitante || empate) && { color: '#FFF' }]} 
            numberOfLines={2}
          >
            {partida.visitante.nome}
          </Text>
        </View>
        
        <TouchableOpacity>
          <MaterialCommunityIcons name="chart-box-outline" size={30} color="#575757" style={styles.statsIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}