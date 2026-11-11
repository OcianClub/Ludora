import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@ludora/icons';
import type { PosicaoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { chavesDasEquipes, faixasPublicadas, chavePublicada, nomeGrupo, nomeOficial } from '../../utils/paulista';
import { BarraCampanha, coresChave, EscudoOficial, Medalha, MenuSelecao, Panel, saldoOficial, usePaulistaStyles } from './PaulistaUI';
import { useTheme } from '../../contexts/ThemeContext';
import { AppButton } from '../ui/Controls';

export const INFORMACAO_CLASSIFICACAO = 'Posições e pontos conforme a federação, sem recálculo pelo Ludora. As faixas mostram as chaves identificadas nas fases publicadas; não são uma projeção de classificação.';
export function PaulistaStandings({ snapshot, minhas, onLocate }: { snapshot: SnapshotPaulista; minhas: Set<number>; onLocate: (view: View) => void }) {
  const { colors } = useTheme(), s = usePaulistaStyles(), { width } = useWindowDimensions();
  const [fase, setFase] = useState(''), [grupo, setGrupo] = useState(''), [info, setInfo] = useState(false), [localizada, setLocalizada] = useState(false);
  const rowRef = useRef<View>(null), scrollRef = useRef<ScrollView>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const model = useMemo(() => {
    const chaves = new Set(snapshot.classificacao.filter(r => minhas.has(r.equipeId)).map(r => chavePublicada(`${r.fase} ${r.grupo}`)).filter(Boolean));
    const disponiveis = snapshot.classificacao.filter(r => /CLASSIFICA/i.test(r.fase) || chaves.has(chavePublicada(`${r.fase} ${r.grupo}`)));
    const fases = [...new Map(disponiveis.map(r => [r.faseId, r.fase]))];
    const iniciais = disponiveis.filter(r => /CLASSIFICA/i.test(r.fase));
    const faseDoClube = iniciais.find(r => minhas.has(r.equipeId))?.faseId || iniciais[0]?.faseId;
    const selecionada = fases.some(([id]) => id === fase) ? fase : faseDoClube || fases[0]?.[0];
    const tabela = disponiveis.filter(r => r.faseId === selecionada), grupos = [...new Set(tabela.map(r => r.grupo))];
    const grupoAtual = grupos.includes(grupo) ? grupo : tabela.find(r => minhas.has(r.equipeId))?.grupo || grupos[0];
    const inicial = tabela.some(r => /CLASSIFICA/i.test(r.fase));
    const opcoesGrupo = [...new Map((inicial ? iniciais : tabela).map(r => [`${r.faseId}|${r.grupo}`, r.grupo]))];
    const rows = tabela.filter(r => r.grupo === grupoAtual).sort((a, b) => a.posicao - b.posicao);
    const chavesPublicadas = chavesDasEquipes(snapshot), faixas = faixasPublicadas(rows, chavesPublicadas);
    const label = (id: string, nome: string) => nomeOficial(nome) + (fases.filter(([, n]) => n === nome).length > 1 ? ` · ${snapshot.classificacao.filter(r => r.faseId === id).slice(0, 2).map(r => nomeOficial(snapshot.equipes.find(e => e.id === r.equipeId)?.nome || '')).join(' × ')}` : '');
    const options = [...(iniciais.length ? [{ value: 'inicial', label: 'Fase de classificação' }] : []), ...fases.filter(([, nome]) => !/CLASSIFICA/i.test(nome)).map(([id, nome]) => ({ value: id, label: label(id, nome) }))];
    return { rows, chavesPublicadas, faixas, inicial, grupoAtual, opcoesGrupo, selecionada, faseDoClube, options, completa: !!rows.length && rows.every((r, i) => r.posicao === i + 1) };
  }, [snapshot, minhas, fase, grupo]);
  const equipes = useMemo(() => new Map(snapshot.equipes.map(e => [e.id, e])), [snapshot.equipes]);
  const destaque = model.rows.find(r => minhas.has(r.equipeId));
  const faixa = destaque && model.faixas.find(f => destaque.posicao >= f.inicio && destaque.posicao <= f.fim);
  const entries = useMemo(() => model.rows.flatMap(row => {
    const faixa = model.faixas.find(f => f.inicio === row.posicao);
    return [...(faixa ? [{ type: 'band' as const, key: `band-${row.posicao}`, faixa }] : []), { type: 'row' as const, key: `${row.faseId}:${row.grupo}:${row.equipeId}`, row }];
  }), [model]);
  const frozen = Math.min(210, Math.max(164, width * .49)), rowHeight = 62;
  const bandColor = (chave: string | null) => coresChave[chave as keyof typeof coresChave] || colors.textoSecundario;
  const bgRow = (r: PosicaoPaulista) => minhas.has(r.equipeId) ? colors.fundoBotao : colors.card;
  function localizar() {
    if (rowRef.current) onLocate(rowRef.current);
    scrollRef.current?.scrollTo({ x: 0, animated: true }); setLocalizada(true); clearTimeout(timer.current); timer.current = setTimeout(() => setLocalizada(false), 2200);
  }
  if (!snapshot.classificacao.length) return <View style={s.empty}><Icon name="trophy" size={30} color={colors.textoSecundario} /><Text style={[s.muted, { textAlign: 'center' }]}>Classificação oficial ainda não publicada pela federação.</Text></View>;
  return <View style={{ gap: 18 }}>
    <View style={{ gap: 12 }}><Text style={[s.tiny, { color: colors.primaria, letterSpacing: 1.8, fontSize: 9, fontFamily: 'Inter_600SemiBold' }]}>CLASSIFICAÇÃO OFICIAL</Text><View style={s.between}><Text style={[s.heading, { flex: 1 }]}>{model.inicial ? nomeGrupo(nomeOficial(model.grupoAtual || 'Classificação')) : nomeOficial(model.rows[0]?.fase || 'Tabela publicada')}</Text>{model.completa && <Text style={s.muted}>{model.rows.length} equipes</Text>}</View>
      <MenuSelecao label="Selecionar etapa" value={model.inicial ? 'inicial' : model.selecionada || ''} options={model.options} onChange={value => { setFase(value === 'inicial' ? model.faseDoClube || '' : value); setGrupo(''); }} />
      {model.opcoesGrupo.length > 1 && <MenuSelecao label="Selecionar grupo" value={`${model.selecionada}|${model.grupoAtual}`} options={model.opcoesGrupo.map(([value, label]) => ({ value, label: nomeGrupo(nomeOficial(label)) }))} onChange={value => { const index = value.indexOf('|'); setFase(value.slice(0, index)); setGrupo(value.slice(index + 1)); }} />}
    </View>
    {destaque && <Panel style={{ borderColor: colors.primaria }}><View style={s.body}>
      <View style={[s.between, { alignItems: 'flex-start' }]}><View style={[s.row, { gap: 10, flex: 1, paddingTop: 4 }]}><EscudoOficial equipe={equipes.get(destaque.equipeId)} size={36} /><View style={{ flex: 1, gap: 7 }}><Text style={[s.tiny, { letterSpacing: 2, fontSize: 8 }]}>SEU CLUBE</Text><Text style={s.heading} numberOfLines={1}>{nomeOficial(equipes.get(destaque.equipeId)?.nome || '')}</Text></View></View><View style={{ alignItems: 'flex-end' }}><Text style={[s.number, { fontSize: 48, lineHeight: 60 }]}>{destaque.posicao}º</Text><Text style={s.tiny}>{model.completa ? `de ${model.rows.length} equipes` : 'posição publicada'}</Text><Text style={[s.tiny, { fontSize: 10 }]}>{nomeGrupo(nomeOficial(model.grupoAtual || ''))}</Text></View></View>
      {!!model.chavesPublicadas.get(destaque.equipeId) && <View style={{ alignItems: 'flex-start', gap: 5 }}><Medalha chave={model.chavesPublicadas.get(destaque.equipeId)} />{faixa?.chave && <Text style={[s.tiny, { fontSize: 10 }]}>{faixa.inicio}º ao {faixa.fim}º</Text>}</View>}
      <View style={[s.row, { borderTopWidth: 1, borderTopColor: colors.linha, paddingTop: 15 }]}>{[['Pontos', destaque.pontosNota || destaque.pontos], ['Jogos', destaque.jogos], ['Saldo de gols', saldoOficial(destaque.saldo)]].map(([label, n], index) => <View key={label} style={[s.metric, { borderLeftWidth: index ? 1 : 0, borderLeftColor: colors.linha }]}><Text style={s.tiny}>{label}</Text><Text style={[s.heading, { fontSize: 20 }]}>{n}</Text></View>)}</View>
      <View style={s.between}><Text style={s.tiny}>V · E · D</Text><Text style={[s.text, { color: colors.primaria, fontFamily: 'Inter_600SemiBold' }]}>{destaque.vitorias} · <Text style={{ color: colors.amarelo }}>{destaque.empates}</Text> · <Text style={{ color: '#F43F5E' }}>{destaque.derrotas}</Text></Text></View><BarraCampanha linha={destaque} />
      <AppButton label="Localizar meu clube" onPress={localizar} />
    </View></Panel>}
    <Panel><View style={{ flexDirection: 'row' }}>
      <View style={{ width: frozen, zIndex: 1, backgroundColor: colors.card }}>
        <View style={[s.row, { height: 42, paddingHorizontal: 12, gap: 6, backgroundColor: colors.card }]}><Text style={[s.tiny, { width: 34 }]}>Pos.</Text><Text style={s.tiny}>Equipe</Text></View>
        {entries.map(entry => entry.type === 'band' ? <View key={entry.key} style={[s.row, { height: 33, gap: 7, paddingHorizontal: 12, backgroundColor: colors.fundo }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: bandColor(entry.faixa.chave) }} /><Text style={[s.tiny, { color: bandColor(entry.faixa.chave), fontSize: 10, fontFamily: 'Inter_600SemiBold' }]}>{entry.faixa.chave ? `Chave ${nomeOficial(entry.faixa.chave)}` : 'A confirmar'}</Text><Text style={[s.tiny, { fontSize: 9 }]}>{entry.faixa.inicio}º ao {entry.faixa.fim}º</Text></View> : <View key={entry.key} ref={entry.row === destaque ? rowRef : undefined} collapsable={false} accessible accessibilityLabel={`${entry.row.posicao}º, ${nomeOficial(equipes.get(entry.row.equipeId)?.nome || '')}${minhas.has(entry.row.equipeId) ? ', seu clube' : ''}`} style={[s.row, { height: rowHeight, gap: 6, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: colors.linha, backgroundColor: entry.row === destaque && localizada ? colors.cardSecundario : bgRow(entry.row), borderLeftWidth: minhas.has(entry.row.equipeId) ? 3 : 2, borderLeftColor: minhas.has(entry.row.equipeId) ? colors.primaria : bandColor(model.chavesPublicadas.get(entry.row.equipeId) || null) }]}>
          <Text style={[s.text, { width: 32, fontFamily: 'Inter_600SemiBold' }]}>{entry.row.posicao}º</Text><View style={s.team}><EscudoOficial equipe={equipes.get(entry.row.equipeId)} size={25} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[s.tiny, { color: colors.texto, fontFamily: 'Inter_600SemiBold' }]}>{nomeOficial(equipes.get(entry.row.equipeId)?.nome || 'A confirmar')}</Text>{minhas.has(entry.row.equipeId) && <Text style={[s.tiny, { fontSize: 9 }]}>Seu clube</Text>}</View></View>
        </View>)}
      </View>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled accessibilityLabel="Estatísticas oficiais. Deslize para consultar todas as colunas." style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minWidth: 464 }}><View style={[s.row, { height: 42 }]}>{['PTS', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].map((label, index) => <Text accessibilityLabel={['Pontos', 'Jogos', 'Vitórias', 'Empates', 'Derrotas', 'Gols marcados', 'Gols sofridos', 'Saldo de gols'][index]} key={label} style={[s.tiny, { width: 58, textAlign: 'center' }]}>{label}</Text>)}</View>
        {entries.map(entry => entry.type === 'band' ? <View key={entry.key} style={{ height: 33, backgroundColor: colors.fundo }} /> : <View key={entry.key} style={[s.row, { height: rowHeight, borderBottomWidth: 1, borderBottomColor: colors.linha, backgroundColor: entry.row === destaque && localizada ? colors.cardSecundario : bgRow(entry.row) }]}>{[entry.row.pontosNota || entry.row.pontos, entry.row.jogos, entry.row.vitorias, entry.row.empates, entry.row.derrotas, entry.row.golsPro, entry.row.golsContra, entry.row.saldo].map((n, index) => <Text key={index} style={[s.text, { width: 58, textAlign: 'center', fontFamily: index === 0 ? 'Inter_600SemiBold' : 'Inter_400Regular', fontVariant: ['tabular-nums'] }]}>{n}</Text>)}</View>)}</View>
      </ScrollView>
      <LinearGradient pointerEvents="none" colors={[colors.card, colors.card + '00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: frozen, top: 0, bottom: 0, width: 8, zIndex: 2 }} />
    </View>{!model.rows.length && <Text style={[s.muted, { padding: 16 }]}>A fonte ainda não publicou a tabela desta etapa.</Text>}</Panel>
    <View style={{ gap: 8 }}><TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: info }} onPress={() => setInfo(v => !v)} style={[s.row, { minHeight: 40, gap: 6 }]}><Icon name={info ? 'chevron-down' : 'chevron-right'} size={13} color={colors.textoSecundario} /><Text style={s.tiny}>Sobre a classificação oficial</Text></TouchableOpacity>{info && <Text style={s.muted}>{INFORMACAO_CLASSIFICACAO}{model.rows.some(r => r.pontosNota) ? '\n* Pontuação com nota na fonte oficial. Consulte a federação para o motivo.' : ''}</Text>}</View>
  </View>;
}
