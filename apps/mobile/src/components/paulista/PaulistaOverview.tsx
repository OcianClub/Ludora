import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import type { JogoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { campanhaPublicada, classificacaoProxima, nomeGrupo, nomeOficial, resumoClube, etapaPublicada, hojePaulista, type EstadoEtapa } from '../../utils/paulista';
import { BarraCampanha, ConfrontoOficial, dataOficial, EscudoOficial, LinkPaulista, Marcador, Medalha, Panel, ResultadoOficial, saldoOficial, usePaulistaStyles } from './PaulistaUI';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '@ludora/icons';

export const estadoEtapa: Record<EstadoEtapa, string> = { advanced: 'Avanço confirmado', ended: 'Eliminação confirmada', published: 'Confronto publicado', pending: 'Aguardando publicação', unreached: 'Não alcançada' };
export function PaulistaOverview({ snapshot, minhas, clubeNome, chave, onTab, onOpen }: {
  snapshot: SnapshotPaulista; minhas: Set<number>; clubeNome: string; chave?: string; onTab: (aba: 'jogos' | 'classificacao' | 'chaveamento') => void; onOpen: (jogo: JogoPaulista) => void;
}) {
  const s = usePaulistaStyles(), { colors } = useTheme(), { width } = useWindowDimensions();
  const resumo = useMemo(() => resumoClube(snapshot, minhas, hojePaulista()), [snapshot, minhas]);
  const campanha = useMemo(() => campanhaPublicada(snapshot, minhas, chave), [snapshot, minhas, chave]);
  const vizinhas = useMemo(() => classificacaoProxima(snapshot, resumo.classificacao), [snapshot, resumo.classificacao]);
  const equipes = useMemo(() => new Map(snapshot.equipes.map(e => [e.id, e])), [snapshot.equipes]);
  const equipe = snapshot.equipes.find(e => minhas.has(e.id));
  const linha = resumo.classificacao;
  const etapas = [{ etapa: -1, titulo: 'Classificação', estado: (campanha.jogos.length ? 'advanced' : linha ? 'published' : 'pending') as EstadoEtapa }, ...campanha.etapas];
  const jogos = campanha.jogos.length ? campanha.jogos : [resumo.ultimo, resumo.proxima].filter((j, i, all): j is JogoPaulista => !!j && all.findIndex(k => k?.id === j.id) === i);
  const wide = width >= 760;
  return <View style={{ gap: 18 }}>
    <Panel>
      <View style={[s.body, { gap: 20 }]}>
        <View style={[s.row, { gap: 9 }]}><EscudoOficial equipe={equipe} size={29} /><Text style={[s.text, { flex: 1, fontFamily: 'Inter_600SemiBold' }]}>{clubeNome} · {snapshot.categoria.toUpperCase()} · Divisão {snapshot.divisao}</Text></View>
        <Medalha chave={chave} filled />
        <Text accessibilityRole="header" style={s.title}>{campanha.titulo}</Text>
        <View accessibilityLabel="Percurso nas fases publicadas" style={{ gap: 0 }}>{etapas.map((etapa, index) => <View key={etapa.etapa} style={{ flexDirection: 'row', gap: 9, minHeight: index === etapas.length - 1 ? 42 : 62 }}>
          <View style={{ alignItems: 'center', width: 25 }}><Marcador estado={etapa.estado} />{index < etapas.length - 1 && <View style={{ flex: 1, width: 1, marginVertical: 5, backgroundColor: colors.borda }} />}</View>
          <View style={{ flex: 1, gap: 2 }}><Text style={[s.text, { fontFamily: 'Inter_600SemiBold', color: etapa.estado === 'pending' || etapa.estado === 'unreached' ? colors.textoSecundario : colors.texto }]}>{etapa.titulo === 'Semifinais' ? 'Semifinal' : etapa.titulo}</Text><Text style={s.tiny}>{etapa.etapa === -1 ? linha ? `${linha.posicao}º lugar` : 'A confirmar' : estadoEtapa[etapa.estado]}</Text></View>
        </View>)}</View>
      </View>
      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.borda, gap: 5, alignItems: 'center' }}>
        <Text style={s.muted}>Posição na fase de classificação</Text><Text style={[s.number, { fontSize: 48, lineHeight: 59 }]}>{linha ? `${linha.posicao}º` : '—'}</Text>
        <Text style={[s.tiny, { textAlign: 'center' }]}>{vizinhas.total ? `de ${vizinhas.total} equipes · ` : ''}{linha ? nomeGrupo(nomeOficial(linha.grupo)) : 'Tabela a confirmar'}</Text><LinkPaulista onPress={() => onTab('classificacao')}>Ver classificação</LinkPaulista>
      </View>
    </Panel>
    <Panel style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
        <View style={[s.metric, { flexBasis: wide ? '25%' : '50%', borderRightWidth: 1, borderRightColor: colors.borda }]}><Text style={s.muted}>Pontos</Text><Text style={s.number}>{linha?.pontosNota || linha?.pontos || (linha ? 0 : '—')}</Text></View>
        <View style={[s.metric, { flexBasis: wide ? '25%' : '50%' }]}><Text style={s.muted}>Jogos</Text><Text style={s.number}>{linha?.jogos ?? '—'}</Text></View>
        <View style={[s.metric, { flexBasis: wide ? '25%' : '50%', borderRightWidth: 1, borderRightColor: colors.borda, paddingHorizontal: 8 }]}><Text style={[s.muted, { textAlign: 'center' }]}>Vitórias · empates · derrotas</Text><Text style={s.number}>{linha ? <>{linha.vitorias}<Text style={s.tiny}> V </Text>{linha.empates}<Text style={s.tiny}> E </Text>{linha.derrotas}<Text style={s.tiny}> D</Text></> : '—'}</Text>{linha && <BarraCampanha linha={linha} />}</View>
        <View style={[s.metric, { flexBasis: wide ? '25%' : '50%' }]}><Text style={s.muted}>Saldo de gols</Text><Text style={s.number}>{linha ? saldoOficial(linha.saldo) : '—'}</Text></View>
      </View>
    </Panel>
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 18 }}>
      <Panel style={{ width: wide ? undefined : '100%', flex: wide ? 1.25 : undefined }}>
        <View style={s.body}>
          <View style={s.between}><Text style={s.heading}>Trajetória</Text><LinkPaulista onPress={() => onTab('jogos')}>Ver jogos</LinkPaulista></View>
          {linha && <View style={[s.row, { alignItems: 'flex-start', gap: 10 }]}><Marcador estado={campanha.jogos.length ? 'advanced' : 'published'} /><View style={{ flex: 1, gap: 7 }}><Text style={[s.text, { fontFamily: 'Inter_600SemiBold' }]}>Fase de classificação · {nomeGrupo(nomeOficial(linha.grupo))}</Text><Text style={s.muted}>{linha.posicao}º lugar · {linha.pontosNota || linha.pontos} pontos · {linha.jogos} jogos</Text></View></View>}
          {jogos.map(j => <View key={j.id} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ alignItems: 'center', width: 25 }}><Marcador estado={campanha.estados.get(j.id) || 'published'} /><View style={{ flex: 1, width: 1, marginTop: 5, backgroundColor: colors.borda }} /></View>
            <View style={{ flex: 1, gap: 9, paddingBottom: 8 }}><View style={[s.between, { flexWrap: 'wrap' }]}><Text style={[s.text, { fontFamily: 'Inter_600SemiBold' }]}>{['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final'][etapaPublicada(j.fase)] || nomeOficial(j.fase)}{chave && etapaPublicada(j.fase) >= 0 ? ` · ${nomeOficial(chave)}` : ''}</Text>{resumo.ultimo?.id === j.id && <Text style={s.tiny}>Último jogo</Text>}</View>
              <ConfrontoOficial jogo={j} equipes={equipes} minhas={minhas} onPress={() => onOpen(j)} />
              <View style={[s.between, { flexWrap: 'wrap', gap: 5 }]}><Text style={s.tiny}>{dataOficial(j.data)} · {j.horario || 'Horário a confirmar'}</Text><ResultadoOficial jogo={j} minhas={minhas} /></View>
              {!!j.local && <View style={[s.row, { alignItems: 'flex-start', gap: 5 }]}><Icon name="location" size={13} color={colors.textoSecundario} /><Text style={[s.tiny, { flex: 1 }]}>{j.local}</Text></View>}
            </View>
          </View>)}
          {campanha.etapas.filter(e => e.estado === 'pending' || e.estado === 'unreached').map(e => <View key={e.etapa} style={[s.row, { gap: 10, alignItems: 'flex-start' }]}><Marcador estado={e.estado} /><View style={{ flex: 1, gap: 6 }}><Text style={s.muted}>{e.titulo}</Text><Text style={s.tiny}>{estadoEtapa[e.estado]}</Text></View></View>)}
          {!jogos.length && <Text style={s.muted}>O calendário aparecerá quando a federação publicar os jogos.</Text>}
          {!!chave && <View style={{ borderTopWidth: 1, borderTopColor: colors.linha, paddingTop: 10 }}><LinkPaulista onPress={() => onTab('chaveamento')}>Ver chaveamento</LinkPaulista></View>}
        </View>
      </Panel>
      <Panel style={{ width: wide ? undefined : '100%', flex: wide ? 1 : undefined }}>
        <View style={s.body}><Text style={s.heading}>Classificação</Text><Text style={s.tiny}>Na fase de classificação{linha ? ` · ${nomeGrupo(nomeOficial(linha.grupo))}` : ''}</Text>
          <View style={[s.row, s.divider, { minHeight: 38, gap: 7 }]}><Text style={[s.tiny, { width: 32 }]}>Pos.</Text><Text style={[s.tiny, { flex: 1 }]}>Equipe</Text><Text style={[s.tiny, { width: 30, textAlign: 'center' }]}>PTS</Text><Text style={[s.tiny, { width: 32, textAlign: 'right' }]}>SG</Text></View>
          <View style={{ marginTop: -14 }}>{vizinhas.linhas.map(r => <View key={r.equipeId} style={[s.row, s.divider, { minHeight: 60, gap: 7, borderLeftWidth: 2, borderLeftColor: minhas.has(r.equipeId) ? colors.primaria : 'transparent', backgroundColor: minhas.has(r.equipeId) ? colors.fundoBotao : 'transparent', paddingHorizontal: 6 }]}><Text style={[s.text, { width: 26 }]}>{r.posicao}º</Text><View style={s.team}><EscudoOficial equipe={equipes.get(r.equipeId)} size={23} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[s.tiny, { color: minhas.has(r.equipeId) ? colors.texto : colors.textoSecundario }]}>{nomeOficial(equipes.get(r.equipeId)?.nome || 'A confirmar')}</Text>{minhas.has(r.equipeId) && <Text style={[s.tiny, { fontSize: 9 }]}>Seu clube</Text>}</View></View><Text style={[s.text, { width: 30, textAlign: 'center' }]}>{r.pontosNota || r.pontos}</Text><Text style={[s.text, { width: 32, textAlign: 'right' }]}>{saldoOficial(r.saldo)}</Text></View>)}</View>
          {!vizinhas.linhas.length && <Text style={s.muted}>Classificação oficial ainda não publicada para este grupo.</Text>}
          <View style={{ alignItems: 'center' }}><LinkPaulista onPress={() => onTab('classificacao')}>Ver classificação completa</LinkPaulista></View>
        </View>
      </Panel>
    </View>
  </View>;
}
