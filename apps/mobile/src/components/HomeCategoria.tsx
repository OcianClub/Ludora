import { Fragment, memo, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';
import { darkColors } from '@ludora/design-tokens';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { acoesDaPartidaNaHome, resultadoDoClube } from '@/src/utils/resumoPartidas';
import { createStyles } from '@/src/styles/homeCategoriaStyles';
import { HomeSkeleton } from './Skeleton';

type Time = { id: number; nome: string; escudo: string | null };

// Vermelho mais equilibrado para derrota: vivo no tema escuro e legível no claro.
const VERMELHO_DERROTA = '#E5485D';

function EscudoHome({ time, compacto = false, destaque = false, styles }: {
  time: Time;
  compacto?: boolean;
  destaque?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const uri = time.escudo?.trim() || null;
  const [uriComErro, setUriComErro] = useState<string | null>(null);
  const inicial = Array.from(time.nome.trim())[0]?.toUpperCase() || '?';

  return (
    <View style={[compacto ? styles.historyCrestBox : styles.crestBox, destaque && styles.crestHighlight]}>
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
  clube_origem_id?: number;
  sumula_clube_id?: number | null;
  titulares_necessarios?: number;
  titulares_definidos?: number;
  minha_equipe_pronta?: boolean | null;
  gols_sem_autor?: number;
  somente_leitura?: boolean;
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
  sub: string;
  semPerfil?: number;
  pendencias?: { semCamisa: number | null; solicitacoes: number | null };
  carregando: boolean;
  atualizando: boolean;
  proximoJogo: PartidaHome | null;
  historico: PartidaHome[];
  agenda: PartidaHome[];
  podeGerenciar: boolean;
  consultaLocal?: boolean;
  onAtualizar: () => void;
  onVerDetalhes: (partida: PartidaHome) => void;
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
  const { sub, pendencias, semPerfil, carregando, atualizando, proximoJogo: jogo, historico, agenda, podeGerenciar,
    onAtualizar, onVerDetalhes, consultaLocal = false } = props;
  const { colors, tema } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const aoVivo = jogo?.status === 'AO_VIVO';
  const operaSumula = podeGerenciar && (jogo?.sumula_clube_id ?? jogo?.clube_origem_id) === clubeAtivo?.id;
  const prepararDestaque = acoesDaPartidaNaHome(jogo, podeGerenciar).preparar;
  const preparar = [jogo, ...agenda].find(partida =>
    partida && !partida.minha_equipe_pronta && acoesDaPartidaNaHome(partida, podeGerenciar).preparar
  );
  const titulares = preparar?.titulares_definidos;
  const necessarios = preparar?.titulares_necessarios || 5;
  const golsPendentes = [jogo, ...historico].find(partida =>
    partida && (partida.sumula_clube_id ?? partida.clube_origem_id) === clubeAtivo?.id && (partida.gols_sem_autor ?? 0) > 0
  );
  const ultimo = historico[0];
  const rotuloResultado = { V: 'Vitória', E: 'Empate', D: 'Derrota' };
  const contagem = historico.reduce((total, partida) => {
    total[resultadoDoClube(partida)]++;
    return total;
  }, { V: 0, E: 0, D: 0 });
  const verJogos = (status: 'TODOS' | 'AGENDADA' | 'FINALIZADA' = 'TODOS') =>
    router.push({ pathname: '/jogos/jogos', params: { status, sub, ano: status === 'FINALIZADA' ? ultimo?.data.slice(0, 4) : undefined } });
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
          <Text style={styles.sectionTitle}>
            {consultaLocal && aoVivo
              ? 'Último registro da partida'
              : aoVivo
              ? 'Agora em campo'
              : jogo && hoje(jogo.data)
              ? 'É dia de jogo'
              : 'Próxima partida'}
          </Text>

          {jogo && (
            <View style={[styles.badge, aoVivo && styles.liveBadge]}>
              {aoVivo && !consultaLocal && (
                <View style={styles.liveDot} accessible={false} />
              )}

              <Text style={[styles.badgeText, aoVivo && styles.liveText]}>
                {consultaLocal && aoVivo
                  ? 'ÚLTIMO PLACAR'
                  : aoVivo
                  ? 'AO VIVO'
                  : hoje(jogo.data)
                  ? 'HOJE'
                  : dataCurta(jogo.data)}
              </Text>
            </View>
          )}
        </View>

        {jogo ? <View style={[styles.mainCard, aoVivo && styles.mainCardAoVivo]}>
          <View style={styles.matchHeading}>
            <View style={[styles.locationRow, styles.flex]}>
              <Icon name="trophy-outline" size={16} color={colors.textoSecundario} />
              <Text style={styles.eyebrow} numberOfLines={2}>{jogo.competicao?.nome || 'Amistoso'}</Text>
            </View>
            <View style={styles.venueBadge}>
              <Icon name={jogo.emCasa ? 'home' : 'bus'} size={14} color={colors.texto} />
              <Text style={styles.venueText}>{jogo.emCasa ? 'Casa' : 'Fora'}</Text>
            </View>
          </View>
          <View style={styles.teamsRow}>
            {[jogo.mandante, jogo.visitante].map((time, index) => <Fragment key={`${time.id}-${index}`}><View style={styles.team}>
              <EscudoHome time={time} styles={styles} destaque={jogo.emCasa === (index === 0)} />
              <Text style={styles.teamName} numberOfLines={3}>{time.nome}</Text>
            </View>{index === 0 && <View style={styles.scoreCenter}>
              {aoVivo ? <View style={styles.scoreRow} accessible accessibilityLabel={`${jogo.gols_mandante} a ${jogo.gols_visitante}`}>
                <Text style={styles.score}>{jogo.gols_mandante}</Text>
                <View style={styles.scoreDot} />
                <Text style={styles.score}>{jogo.gols_visitante}</Text>
              </View> : <Text style={styles.versus}>VS</Text>}
            </View>}</Fragment>)}
          </View>
          {aoVivo && !consultaLocal && jogo.data.slice(0, 10) < new Date().toLocaleDateString('sv-SE') && (
            <View style={[styles.locationRow, styles.staleNotice]}>
              <Icon name="info" size={15} color={colors.textoSecundario} />
              <Text style={[styles.secondaryText, styles.flex]}>Iniciada em {dataCurta(jogo.data)}. Confira se já terminou.</Text>
            </View>
          )}
          <View style={styles.matchMeta}>
            <View style={styles.dateTimeRow}>
              <View style={styles.metaItem}>
                <Icon name="calendar" size={17} color={colors.textoSecundario} />
                <Text style={styles.metaStrong}>{dataCurta(jogo.data)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Icon name="clock" size={17} color={colors.textoSecundario} />
                <Text style={styles.metaStrong}>{jogo.horario?.slice(0, 5) || 'A definir'}</Text>
              </View>
            </View>
            {!!jogo.local && <View style={styles.locationRow}>
              <Icon name="location" size={16} color={colors.textoSecundario} />
              <Text style={[styles.secondaryText, styles.flex]} numberOfLines={2}>{jogo.local}</Text>
            </View>}
          </View>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} accessibilityRole="button"
            onPress={() => onVerDetalhes(jogo)}>
            <View style={styles.primaryButtonContent}>
              <Text style={styles.primaryButtonText}>
                {consultaLocal ? 'Ver último registro' : aoVivo ? operaSumula ? 'Operar súmula' : 'Acompanhar ao vivo' : prepararDestaque ? 'Preparar partida' : 'Ver partida'}
              </Text>
              {(aoVivo || prepararDestaque) && <Icon name={aoVivo ? 'live' : 'play-circle'} size={20} color={colors.textoSobrePrimaria} />}
            </View>
          </TouchableOpacity>
        </View> : <View style={styles.emptyCard}>
          <Icon name="calendar-remove-outline" size={28} color={colors.textoSecundario} />
          <Text style={styles.cardTitle}>Sem partida marcada</Text>
          <Text style={styles.emptyDescription}>{podeGerenciar ? 'Organize os próximos jogos na aba Jogos.' : 'Assim que uma partida for marcada, ela aparece aqui.'}</Text>
          <TouchableOpacity style={styles.textButton} onPress={() => verJogos()} accessibilityRole="button"><Text style={styles.linkText}>Ir para jogos</Text></TouchableOpacity>
        </View>}

        {podeGerenciar && <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Pendências</Text>
            <Text style={styles.formLegend}>{sub}</Text>
          </View>
          <View style={styles.preparationCard}>
            <View style={styles.preparationHeading}>
              <View style={styles.preparationIcon}><Icon name="info" size={22} color={colors.texto} /></View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>O que precisa da sua atenção</Text>
                <Text style={styles.secondaryText}>Resolva os próximos passos da sua equipe.</Text>
              </View>
            </View>
            {preparar && <TouchableOpacity style={styles.pendingRow} onPress={() => onVerDetalhes(preparar)} accessibilityRole="button">
              <Icon name="account-group-outline" size={21} color={colors.texto} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{titulares === necessarios ? 'Confirmar sua equipe' : 'Preparar próximo jogo'}</Text>
                <Text style={styles.secondaryText}>{titulares == null ? 'Confira a escalação' : `${titulares}/${necessarios} titulares · ${titulares === necessarios ? 'Revise a escalação' : 'Complete a escalação'}`}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textoSecundario} />
            </TouchableOpacity>}
            {!!pendencias?.semCamisa && <View style={styles.pendingRow}>
              <Icon name="tshirt-crew-outline" size={21} color={colors.texto} />
              <View style={styles.flex}><Text style={styles.cardTitle}>Numeração do elenco</Text><Text style={styles.secondaryText}>Jogadores com camisa ainda não definida</Text></View>
              <Text style={styles.pendingCount}>{pendencias.semCamisa}</Text>
            </View>}
            {!!pendencias?.solicitacoes && <TouchableOpacity style={styles.pendingRow} onPress={() => router.push('/solicitacoes-partidas')} accessibilityRole="button">
              <Icon name="email-outline" size={21} color={colors.texto} />
              <View style={styles.flex}><Text style={styles.cardTitle}>Solicitações de partida</Text><Text style={styles.secondaryText}>Aguardando sua resposta</Text></View>
              <Text style={styles.pendingCount}>{pendencias.solicitacoes}</Text>
              <Icon name="chevron-right" size={16} color={colors.textoSecundario} />
            </TouchableOpacity>}
            {golsPendentes && <TouchableOpacity style={styles.pendingRow} onPress={() => onVerDetalhes(golsPendentes)} accessibilityRole="button">
              <Icon name="soccer" size={21} color={colors.texto} />
              <View style={styles.flex}><Text style={styles.cardTitle}>Gols sem autor identificado</Text><Text style={styles.secondaryText}>Revise os registros da partida</Text></View>
              <Text style={styles.pendingCount}>{golsPendentes.gols_sem_autor}</Text>
              <Icon name="chevron-right" size={16} color={colors.textoSecundario} />
            </TouchableOpacity>}
            {!!semPerfil && (
              <View style={styles.pendingNote}>
                <Icon name="radar" size={15} color={colors.textoSecundario} />
                <Text style={[styles.secondaryText, styles.flex]}>
                  {semPerfil} {semPerfil === 1 ? 'atleta ainda sem perfil' : 'atletas ainda sem perfil'} de contribuição.
                  {' '}<Text accessibilityRole="link" style={styles.linkText} onPress={() => router.push('/estatisticas/estatisticas')}>Consultar Scout</Text>
                </Text>
              </View>
            )}
            {!semPerfil && !preparar && !golsPendentes && !pendencias?.semCamisa && !pendencias?.solicitacoes && (
              <Text style={styles.secondaryText}>{pendencias?.semCamisa == null || pendencias.solicitacoes == null ? 'Não foi possível conferir todas as pendências.' : 'Nenhuma ação pendente nesta categoria.'}</Text>
            )}
          </View>
        </View>}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Na sequência</Text>
          <TouchableOpacity onPress={() => verJogos('AGENDADA')} style={styles.sectionAction} accessibilityRole="button">
            <Text style={styles.linkText}>Ver agenda</Text><Icon name="chevron-right" size={16} color={colors.primaria} />
          </TouchableOpacity>
        </View>
        <View style={styles.preparationCard}>
          {agenda.length ? agenda.map(partida => (
            <View key={partida.id} style={styles.agendaGroup}>
              <View style={styles.locationRow}><Icon name="calendar" size={15} color={colors.textoSecundario} /><Text style={styles.secondaryText}>{dataCurta(partida.data)}</Text></View>
              <TouchableOpacity style={styles.pendingRow} onPress={() => onVerDetalhes(partida)} accessibilityRole="button">
                <View style={styles.locationRow}><Icon name="clock" size={13} color={colors.textoSecundario} /><Text style={styles.dateText}>{partida.horario?.slice(0, 5) || 'A definir'}</Text></View>
                <EscudoHome time={partida.emCasa ? partida.visitante : partida.mandante} compacto styles={styles} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{partida.emCasa ? partida.visitante.nome : partida.mandante.nome}</Text>
                  <Text style={styles.secondaryText}>{partida.emCasa ? 'Em casa' : 'Fora de casa'} · {partida.status === 'PREPARADA' ? 'Preparada' : 'Agendada'}</Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.primaria} />
              </TouchableOpacity>
            </View>
          )) : <Text style={styles.secondaryText}>Sem outros compromissos marcados para esta categoria.</Text>}
        </View>

        <View style={styles.historyTitleRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">Histórico de partidas</Text>
          <Text style={styles.formLegend}>{sub}</Text>
        </View>
        <TouchableOpacity onPress={() => verJogos('FINALIZADA')} style={styles.historyAllButton} accessibilityRole="button">
          <Text style={styles.historyAllText}>Ver histórico completo</Text>
          <Icon name="chevron-right" size={16} color={colors.primaria} />
        </TouchableOpacity>
        {historico.length > 0 ? <>
          <View style={styles.historyList}>
            <View style={styles.historySummary}>
              <View style={styles.historySummaryTop}>
                <View style={styles.formRow}>{historico.map((partida, index) => {
                  const resultado = resultadoDoClube(partida);
                  return <TouchableOpacity key={partida.id} onPress={() => onVerDetalhes(partida)} accessibilityRole="button"
                    accessibilityLabel={`${index === 0 ? 'Mais recente. ' : ''}${rotuloResultado[resultado]} em ${dataCurta(partida.data)}. Ver partida.`}
                    hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }} style={styles.formItem}>
                    <View style={[styles.formPill, { backgroundColor: resultado === 'V' ? colors.primaria : resultado === 'E' ? amareloEmpate : VERMELHO_DERROTA }]}>
                      <Text style={[styles.formLetter, { color: resultado === 'E' ? darkColors.fundo : '#fff' }]}>{resultado}</Text>
                    </View>
                  </TouchableOpacity>;
                })}</View>
                <Text style={styles.historySummaryLabel}>{historico.length === 1 ? 'Último jogo' : `Últimos ${historico.length} jogos`}</Text>
              </View>
              <Text style={styles.formSummaryText}>
                <Text style={{ color: colors.primaria }}>{contagem.V} {contagem.V === 1 ? 'vitória' : 'vitórias'}</Text>
                {'  ·  '}{contagem.E} {contagem.E === 1 ? 'empate' : 'empates'}{'  ·  '}
                <Text style={{ color: VERMELHO_DERROTA }}>{contagem.D} {contagem.D === 1 ? 'derrota' : 'derrotas'}</Text>
              </Text>
            </View>
            <View style={[styles.historyRow, styles.historyHeader]} accessible accessibilityLabel="Data, competição, confronto, placar e resultado">
              <Text style={[styles.historyHeaderText, styles.historyDateCell]}>Data</Text>
              <Text style={[styles.historyHeaderText, styles.historyCompetitionCell]}>Comp.</Text>
              <Text style={[styles.historyHeaderText, styles.historyConfronto]}>Confronto</Text>
              <Text style={[styles.historyHeaderText, styles.historyScoreCell]}>Placar</Text>
              <Text style={[styles.historyHeaderText, styles.historyResultCell]}>Resultado</Text>
            </View>
            {historico.map(partida => {
              const resultado = resultadoDoClube(partida);
              const [dia, mes] = dataCurta(partida.data).replace(/\s+de\s+/, ' ').split(' ');
              const competicao = partida.competicao?.nome || 'Amistoso';
              return <TouchableOpacity key={partida.id} style={styles.historyRow} activeOpacity={0.75}
                onPress={() => onVerDetalhes(partida)} accessibilityRole="button"
                accessibilityLabel={`${dataCurta(partida.data)}. ${competicao}. ${partida.mandante.nome} ${partida.gols_mandante} a ${partida.gols_visitante} ${partida.visitante.nome}. ${rotuloResultado[resultado]}. Ver partida.`}>
                <View style={styles.historyDateCell}>
                  <Text style={styles.historyDate}>{dia}</Text>
                  <Text style={styles.historyMonth}>{mes}</Text>
                </View>
                <View style={styles.historyCompetitionCell}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={styles.historyCompetition}>{competicao}</Text>
                </View>
                <View style={styles.historyConfronto}>
                  {[partida.mandante, partida.visitante].map((time, index) => (
                    <View key={index} style={styles.historyTeamRow}>
                      <EscudoHome time={time} compacto styles={styles} />
                      <Text style={[styles.historyTeamName, partida.emCasa === (index === 0) && styles.historyClubName, styles.flex]} numberOfLines={1} ellipsizeMode="tail">{time.nome}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.historyScoreCell}>
                  <Text style={styles.historyGoals}>{partida.gols_mandante}</Text>
                  <Text style={styles.historyGoals}>{partida.gols_visitante}</Text>
                </View>
                <View style={styles.historyResultCell}>
                  <Text numberOfLines={1} style={[styles.historyResult, { backgroundColor: resultado === 'V' ? colors.primaria : resultado === 'D' ? VERMELHO_DERROTA : amareloEmpate, color: resultado === 'E' ? darkColors.fundo : '#fff' }]}>{rotuloResultado[resultado]}</Text>
                  <Icon name="chevron-right" size={14} color={colors.primaria} />
                </View>
              </TouchableOpacity>;
            })}
          </View>
        </> : <Text style={styles.secondaryText}>Nenhuma partida finalizada neste sub.</Text>}
      </>}
    </ScrollView>
  );
});

export default HomeCategoria;
