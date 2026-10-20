import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';
import { darkColors } from '@ludora/design-tokens';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { fetchEscalacaoPartida } from '@/src/services/api';
import { acoesDaPartidaNaHome, resultadoDoClube } from '@/src/utils/resumoPartidas';
import { createStyles } from '@/src/styles/homeCategoriaStyles';
import { HomeSkeleton } from './Skeleton';

type Time = { id: number; nome: string; escudo: string | null };

// Vermelho mais equilibrado para derrota: vivo no tema escuro e legível no claro.
const VERMELHO_DERROTA = '#E5485D';

function EscudoHome({ time, compacto = false, styles }: {
  time: Time;
  compacto?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const uri = time.escudo?.trim() || null;
  const [uriComErro, setUriComErro] = useState<string | null>(null);
  const inicial = Array.from(time.nome.trim())[0]?.toUpperCase() || '?';

  return (
    <View style={compacto ? styles.historyCrestBox : styles.crestBox}>
      {uri && uri !== uriComErro ? (
        <Image
          key={uri}
          source={{ uri }}
          style={compacto ? styles.historyCrest : styles.crest}
          resizeMode="contain"
          onError={() => setUriComErro(uri)}
          accessible={false}
        />
      ) : (
        <Text style={compacto ? styles.historyInitial : styles.crestInitial}>{inicial}</Text>
      )}
    </View>
  );
}

export interface PartidaHome {
  id: number;
  mandante: Time;
  visitante: Time;
  gols_mandante: number;
  gols_visitante: number;
  data: string;
  horario: string | null;
  local: string | null;
  status: 'AGENDADA' | 'PREPARADA' | 'AO_VIVO' | 'FINALIZADA' | 'CANCELADA';
  emCasa: boolean;
  categoria: { id: number; nome: string } | null;
  competicao?: { id: number; nome: string; ano: number } | null;
}

interface Props {
  ativa: boolean;
  carregando: boolean;
  atualizando: boolean;
  revisao: number;
  proximoJogo: PartidaHome | null;
  historico: PartidaHome[];
  agenda: PartidaHome[];
  podeGerenciar: boolean;
  consultaLocal?: boolean;
  iniciandoPartidaId: number | null;
  onAtualizar: () => void;
  onVerDetalhes: (partida: PartidaHome) => void;
  onIniciarPartida: (partida: PartidaHome) => void;
}

function dataCurta(data: string) {
  const [ano, mes, dia] = data.split('T')[0].split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function hoje(data: string) {
  const agora = new Date();
  const [ano, mes, dia] = data.split('T')[0].split('-').map(Number);
  return ano === agora.getFullYear() && mes === agora.getMonth() + 1 && dia === agora.getDate();
}

const HomeCategoria = memo(function HomeCategoria(props: Props) {
  const { ativa, carregando, atualizando, revisao, proximoJogo: jogo, historico, agenda, podeGerenciar,
    iniciandoPartidaId, onAtualizar, onVerDetalhes, onIniciarPartida, consultaLocal = false } = props;
  const { colors, tema } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [preparacao, setPreparacao] = useState<{ id: number; titulares: number } | null>(null);
  const [erroEscalacao, setErroEscalacao] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const aoVivo = jogo?.status === 'AO_VIVO';
  const { preparar, iniciar } = acoesDaPartidaNaHome(jogo, podeGerenciar);
  const titulares = preparacao?.id === jogo?.id ? preparacao?.titulares : undefined;
  const pronta = titulares === 5;
  const ultimo = historico[0];
  const rotuloResultado = { V: 'Vitória', E: 'Empate', D: 'Derrota' };
  const contagem = historico.reduce((total, partida) => {
    total[resultadoDoClube(partida)]++;
    return total;
  }, { V: 0, E: 0, D: 0 });
  const verJogos = () => router.push('/jogos/jogos');

  // Só a categoria visível consulta a escalação; torcedores não fazem essa busca.
  useEffect(() => {
    if (!ativa || !preparar || !jogo) return;
    let cancelada = false;
    setPreparacao(atual => atual?.id === jogo.id ? atual : null);
    setErroEscalacao(false);
    void fetchEscalacaoPartida(jogo.id).then(escalacao => {
      if (!cancelada) setPreparacao({ id: jogo.id, titulares: escalacao.filter(j => j.titular).length });
    }).catch(() => { if (!cancelada) setErroEscalacao(true); });
    return () => { cancelada = true; };
  }, [ativa, preparar, jogo?.id, revisao, tentativa]);

  const corResultado = (resultado: 'V' | 'E' | 'D') => resultado === 'V' ? colors.primaria
    : resultado === 'D' ? VERMELHO_DERROTA : colors.textoSecundario;
  const fundoResultado = (resultado: 'V' | 'E' | 'D') => resultado === 'V' ? colors.fundoBotao
    : resultado === 'D' ? colors.fundoErro : colors.cardSecundario;
  const amareloEmpate = tema === 'light' ? '#F4B942' : colors.amarelo;

  return (
    <ScrollView
      style={styles.pageContainer}
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={onAtualizar} tintColor={colors.primaria} colors={[colors.primaria]} />}
    >
      {carregando ? <HomeSkeleton /> : <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{consultaLocal && aoVivo ? 'Último registro da partida' : aoVivo ? 'Agora em campo' : jogo && hoje(jogo.data) ? 'É dia de jogo' : 'Próxima partida'}</Text>
          {jogo && <View style={[styles.badge, aoVivo && styles.liveBadge]}>
            <Text style={[styles.badgeText, aoVivo && styles.liveText]}>{consultaLocal && aoVivo ? 'ÚLTIMO PLACAR' : aoVivo ? '● AO VIVO' : hoje(jogo.data) ? 'HOJE' : dataCurta(jogo.data)}</Text>
          </View>}
        </View>

        {jogo ? <View style={[styles.mainCard, aoVivo && styles.mainCardAoVivo]}>
          <View style={styles.matchHeading}>
            <Text style={styles.eyebrow} numberOfLines={2}>{jogo.competicao?.nome || 'Amistoso'}</Text>
            <View style={styles.venueBadge}>
              <Icon name={jogo.emCasa ? 'home' : 'bus'} size={14} color={colors.primaria} />
              <Text style={styles.venueText}>{jogo.emCasa ? 'Casa' : 'Fora'}</Text>
            </View>
          </View>
          <View style={styles.teamsRow}>
            {[jogo.mandante, jogo.visitante].map((time, index) => <Fragment key={`${time.id}-${index}`}><View style={styles.team}>
              <EscudoHome time={time} styles={styles} />
              <Text style={styles.teamName} numberOfLines={3}>{time.nome}</Text>
            </View>{index === 0 && <View style={styles.scoreCenter}>
              {aoVivo ? <View style={styles.scoreRow} accessible accessibilityLabel={`${jogo.gols_mandante} a ${jogo.gols_visitante}`}>
                <Text style={styles.score}>{jogo.gols_mandante}</Text>
                <View style={styles.scoreDot} />
                <Text style={styles.score}>{jogo.gols_visitante}</Text>
              </View> : <Text style={styles.versus}>VS</Text>}
            </View>}</Fragment>)}
          </View>
          <View style={styles.matchMeta}>
            <View style={styles.dateTimeRow}>
              <View style={styles.metaItem}>
                <Icon name="calendar" size={18} color={colors.textoSecundario} />
                <View style={styles.metaText}>
                  <Text style={styles.metaLabel}>Data</Text>
                  <Text style={styles.metaStrong}>{dataCurta(jogo.data)}</Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Icon name="clock" size={18} color={colors.textoSecundario} />
                <View style={styles.metaText}>
                  <Text style={styles.metaLabel}>Horário</Text>
                  <Text style={styles.metaStrong}>{jogo.horario?.slice(0, 5) || 'A definir'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.locationRow}>
              <Icon name="location" size={16} color={colors.textoSecundario} />
              <Text style={[styles.secondaryText, styles.flex]} numberOfLines={2}>{jogo.local || 'Local a definir'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} accessibilityRole="button"
            disabled={iniciandoPartidaId === jogo.id}
            onPress={() => iniciar ? onIniciarPartida(jogo) : onVerDetalhes(jogo)}>
            {iniciandoPartidaId === jogo.id ? <ActivityIndicator color={colors.textoSobrePrimaria} />
              : <View style={styles.primaryButtonContent}>
                <Text style={styles.primaryButtonText}>{consultaLocal ? 'Ver último registro' : aoVivo ? 'Acompanhar ao vivo' : iniciar ? 'Iniciar partida' : 'Ver partida'}</Text>
                {(aoVivo || iniciar) && <Icon name={aoVivo ? 'live' : 'play-circle'} size={20} color={colors.textoSobrePrimaria} />}
              </View>}
          </TouchableOpacity>
          {iniciar && <TouchableOpacity style={styles.textButton} onPress={() => onVerDetalhes(jogo)} accessibilityRole="button">
            <Text style={styles.linkText}>Ver detalhes e escalação</Text>
          </TouchableOpacity>}
        </View> : <View style={styles.emptyCard}>
          <Icon name="calendar-remove-outline" size={28} color={colors.textoSecundario} />
          <Text style={styles.cardTitle}>Sem partida marcada</Text>
          <Text style={styles.emptyDescription}>{podeGerenciar ? 'Organize os próximos jogos na aba Jogos.' : 'Assim que uma partida for marcada, ela aparece aqui.'}</Text>
          <TouchableOpacity style={styles.textButton} onPress={verJogos} accessibilityRole="button"><Text style={styles.linkText}>Ir para jogos</Text></TouchableOpacity>
        </View>}

        {preparar && <View style={styles.preparationCard}>
          <View style={styles.preparationHeading}>
            <View style={styles.preparationIcon}><Icon name="trophy-outline" size={20} color={colors.primaria} /></View>
            <View style={styles.flex}><Text style={styles.eyebrow}>ÁREA DO GESTOR</Text><Text style={styles.cardTitle}>{pronta ? 'Equipe pronta para entrar' : 'Prepare sua equipe'}</Text></View>
          </View>
          <Text style={styles.secondaryText}>{erroEscalacao ? 'Não foi possível consultar a escalação.' : titulares === undefined
            ? 'Consultando os titulares…' : pronta ? 'Os 5 titulares estão definidos. Você pode revisar a escalação.'
              : `${titulares} de 5 titulares definidos para a próxima partida.`}</Text>
          {erroEscalacao
            ? <TouchableOpacity style={styles.textButton} onPress={() => setTentativa(t => t + 1)} accessibilityRole="button"><Text style={styles.linkText}>Tentar novamente</Text></TouchableOpacity>
            : <TouchableOpacity style={styles.secondaryButton} onPress={() => onVerDetalhes(jogo!)} accessibilityRole="button"><Text style={styles.linkText}>{pronta ? 'Revisar escalação' : 'Preparar escalação'}</Text></TouchableOpacity>}
        </View>}

        <View style={styles.momentCard}>
          <View style={styles.momentHeading}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Momento da categoria</Text>
              <Text style={styles.secondaryText}>{historico.length ? `${historico.length === 1 ? 'Última partida' : `Últimas ${historico.length} partidas`} · toque para ver detalhes` : 'Resultados recentes'}</Text>
            </View>
          </View>
          {ultimo ? <>
            <View style={styles.formRow}>{[...historico].reverse().map((partida, index) => {
              const resultado = resultadoDoClube(partida);
              const recente = index === historico.length - 1;
              return <TouchableOpacity key={partida.id} onPress={() => onVerDetalhes(partida)} accessibilityRole="button"
                accessibilityLabel={`${recente ? 'Mais recente. ' : ''}${rotuloResultado[resultado]} em ${dataCurta(partida.data)}. Ver partida.`}
                style={styles.formItem}>
                <View style={[styles.formPill, { backgroundColor: resultado === 'V' ? colors.primaria : resultado === 'E' ? amareloEmpate : VERMELHO_DERROTA }]}>
                  <Text style={[styles.formLetter, { color: resultado === 'V' ? colors.textoSobrePrimaria : resultado === 'E' ? darkColors.fundo : colors.fundo }]}>{resultado}</Text>
                </View>
                <Text style={[styles.formDate, recente && styles.formDateRecent]}>{dataCurta(partida.data)}</Text>
              </TouchableOpacity>;
            })}</View>
            <View style={styles.formSummary}>
              <Text style={styles.formSummaryText}><Text style={{ color: colors.primaria }}>{contagem.V} vit.</Text>  ·  {contagem.E} emp.  ·  <Text style={{ color: colors.tituloErro }}>{contagem.D} der.</Text></Text>
              <Text style={styles.formLegend}>Mais recente à direita</Text>
            </View>
          </> : <Text style={styles.secondaryText}>A sequência de resultados aparece após a primeira partida finalizada.</Text>}
        </View>

        {agenda.length > 0 && <>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Na sequência</Text>
            <TouchableOpacity onPress={verJogos} style={styles.sectionAction} accessibilityRole="button"><Text style={styles.linkText}>Ver agenda</Text></TouchableOpacity>
          </View>
          <View style={styles.agendaCard}>{agenda.map((partida, index) => <TouchableOpacity key={partida.id}
            style={[styles.agendaRow, index > 0 && styles.agendaDivider]} onPress={() => onVerDetalhes(partida)} accessibilityRole="button">
            <View style={styles.agendaDate}><Text style={styles.dateText}>{dataCurta(partida.data)}</Text><Text style={styles.secondaryText}>{partida.horario?.slice(0, 5) || 'A definir'}</Text></View>
            <View style={styles.flex}><Text style={styles.cardTitle} numberOfLines={2}>{partida.emCasa ? partida.visitante.nome : partida.mandante.nome}</Text>
              <Text style={styles.secondaryText} numberOfLines={2}>{partida.emCasa ? 'Em casa' : 'Fora de casa'} · {partida.competicao?.nome || 'Amistoso'}</Text></View>
            <Text style={styles.linkText}>›</Text>
          </TouchableOpacity>)}</View>
        </>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {historico.length ? `${historico.length} últimas ${historico.length === 1 ? 'partida' : 'partidas'}` : 'Últimas partidas'}
          </Text>
        </View>
        {historico.length > 0 ? <><View style={styles.historyList}>{historico.map(partida => {
          const resultado = resultadoDoClube(partida);
          const corHistorico = resultado === 'E' ? colors.tituloAtencao : corResultado(resultado);
          const fundoHistorico = resultado === 'E' ? colors.fundoAtencao : fundoResultado(resultado);
          return (
          <TouchableOpacity
            key={partida.id}
            style={styles.historyMatch}
            activeOpacity={0.8}
            onPress={() => onVerDetalhes(partida)}
            accessibilityRole="button"
            accessibilityLabel={`${partida.mandante.nome} ${partida.gols_mandante} a ${partida.gols_visitante} ${partida.visitante.nome}, em ${dataCurta(partida.data)}. Ver detalhes.`}
          >
            <View style={styles.historyMeta}>
              <View style={styles.historyDateGroup}>
                <Icon name="calendar" size={14} color={colors.primaria} />
                <Text style={styles.historyDate}>{dataCurta(partida.data)}</Text>
              </View>
              <Text style={styles.historyCompetition} numberOfLines={1}>{partida.competicao?.nome || 'Amistoso'}</Text>
              <Text style={[styles.historyResult, { color: resultado === 'V' ? colors.textoSobrePrimaria : corHistorico, backgroundColor: resultado === 'V' ? colors.primaria : fundoHistorico }]}>{rotuloResultado[resultado]}</Text>
            </View>
            <View style={styles.historyTeams}>
              {[partida.mandante, partida.visitante].map((time, timeIndex) => {
                const gols = timeIndex === 0 ? partida.gols_mandante : partida.gols_visitante;
                // Os IDs da partida pertencem ao time, não ao clube. A API já
                // informa emCasa pela perspectiva do clube ativo; o nome cobre
                // também respostas que tragam o time com o mesmo nome do clube.
                const nomeDoClube = clubeAtivo?.nome.trim().toLocaleLowerCase('pt-BR');
                const nomeDoTime = time.nome.trim().toLocaleLowerCase('pt-BR');
                const clubeAtual = nomeDoClube === nomeDoTime
                  || (timeIndex === 0 ? partida.emCasa : !partida.emCasa);
                return <View key={`${time.id}-${timeIndex}`} style={[styles.historyTeamRow, clubeAtual && styles.historySelectedTeam]}>
                  <EscudoHome time={time} compacto styles={styles} />
                  <View style={styles.historyTeamInfo}>
                    <Text style={[styles.historyTeamName, clubeAtual && styles.historyClubName]} numberOfLines={2}>{time.nome}</Text>
                    {clubeAtual && <Text style={styles.historyClubLabel}>Seu clube</Text>}
                  </View>
                  <View style={styles.historyScoreBox}>
                    <Text style={styles.historyGoals}>{gols}</Text>
                  </View>
                </View>;
              })}
            </View>
            <View style={styles.historyFooter}>
              <View style={styles.historyDateGroup}>
                <Icon name={partida.emCasa ? 'home' : 'bus'} size={14} color={colors.textoSecundario} />
                <Text style={styles.formLegend}>{partida.emCasa ? 'Em casa' : 'Fora de casa'} · Encerrada</Text>
              </View>
              <Text style={styles.historyDetails}>Ver partida ›</Text>
            </View>
          </TouchableOpacity>
        ); })}</View>
        <TouchableOpacity onPress={verJogos} style={styles.historyAllButton} accessibilityRole="button">
          <Text style={styles.historyAllText}>Ver histórico completo</Text>
          <Icon name="arrow-right" size={16} color={colors.primaria} />
        </TouchableOpacity></> : <Text style={styles.secondaryText}>Nenhuma partida finalizada neste Sub.</Text>}
      </>}
    </ScrollView>
  );
});

export default HomeCategoria;
