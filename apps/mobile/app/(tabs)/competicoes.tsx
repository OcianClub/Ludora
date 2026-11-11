import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Icon } from '@ludora/icons';
import { apiFetch } from '@/src/services/api';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { HeaderClube } from '@/src/components/HeaderClube';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import type { EquipePaulista, JogoPaulista, PosicaoPaulista } from '../../../../packages/shared-types/src/paulista';

type Evento = { id: number; ano: number; divisao: string; categoria: string; fonte: string; equipes: EquipePaulista[]; jogos: JogoPaulista[]; classificacao: PosicaoPaulista[]; equipesClube: number[] };
export default function Competicoes() {
  const { colors } = useTheme(), { clubeAtivo } = useClubeAtivo();
  const [eventos, setEventos] = useState<Evento[]>([]), [id, setId] = useState<number>();
  const [aba, setAba] = useState('Jogos'), [erro, setErro] = useState(false), [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true); setErro(false); setEventos([]);
    if (clubeAtivo) void apiFetch(`/publico/clubes/${clubeAtivo.id}/paulista`).then(async r => {
      if (!r.ok) throw new Error();
      const lista: Evento[] = await r.json();
      if (ativo) { setEventos(lista); setId(atual => lista.some(e => e.id === atual) ? atual : lista[0]?.id); }
    }).catch(() => { if (ativo) setErro(true); }).finally(() => { if (ativo) setCarregando(false); });
    else setCarregando(false);
    return () => { ativo = false; };
  }, [clubeAtivo?.id, revisao]));
  const evento = eventos.find(e => e.id === id);
  const nome = (equipeId: number) => evento?.equipes.find(e => e.id === equipeId)?.nome || 'A confirmar';
  const minhas = new Set(evento?.equipesClube);
  const jogos = evento?.jogos.filter(j => minhas.has(j.mandanteId) || minhas.has(j.visitanteId)) ?? [];
  return <View style={{ flex: 1, backgroundColor: colors.fundo }}>
    <HeaderClube />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 32 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.texto, fontSize: 26, fontFamily: 'Oswald_600SemiBold', flex: 1 }}>Campeonato Paulista</Text>
        {evento && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Consultar fonte oficial da federação" onPress={() => {
          if (/^https:\/\/eventos\.admfutsal\.com\.br\/evento\/\d+\/?$/.test(evento.fonte)) void Linking.openURL(evento.fonte);
        }} style={{ padding: 10 }}><Icon name="share" size={22} color={colors.primaria} /></TouchableOpacity>}
      </View>
      <Text style={{ color: colors.textoSecundario }}>Publicação oficial da Federação Paulista de Futsal</Text>
      {carregando ? <ActivityIndicator color={colors.primaria} /> : erro ? <ErroCarregamento titulo="Não foi possível carregar o campeonato" descricao="Confira sua conexão e tente novamente." onTentarNovamente={() => setRevisao(v => v + 1)} /> : !evento ?
        <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}><Icon name="trophy-outline" size={32} color={colors.textoSecundario} /><Text style={{ color: colors.textoSecundario, textAlign: 'center' }}>Nenhuma participação publicada para este clube.</Text></View> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {eventos.map(e => <TouchableOpacity key={e.id} accessibilityRole="tab" accessibilityState={{ selected: e.id === id }} onPress={() => setId(e.id)} style={{ padding: 12, borderRadius: 8, backgroundColor: e.id === id ? colors.primaria : colors.card }}><Text style={{ color: e.id === id ? colors.textoSobrePrimaria : colors.texto }}>{e.categoria} · {e.divisao} · {e.ano}</Text></TouchableOpacity>)}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>{['Jogos', 'Classificação'].map(a => <TouchableOpacity key={a} accessibilityRole="tab" accessibilityState={{ selected: aba === a }} onPress={() => setAba(a)} style={{ flex: 1, padding: 12, borderBottomWidth: 2, borderBottomColor: aba === a ? colors.primaria : colors.linha }}><Text style={{ color: colors.texto, textAlign: 'center' }}>{a}</Text></TouchableOpacity>)}</View>
          {aba === 'Jogos' ? jogos.slice().reverse().map(j => <View key={j.id} style={{ padding: 14, borderRadius: 10, gap: 10, backgroundColor: colors.card }}>
            <Text style={{ color: colors.textoSecundario, fontSize: 12 }}>{j.fase} · {j.data?.slice(0, 10).split('-').reverse().join('/') || 'Data a confirmar'} {j.horario || ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text numberOfLines={2} style={{ flex: 1, color: colors.texto }}>{nome(j.mandanteId)}</Text><Text style={{ color: colors.texto, fontSize: 22, fontFamily: 'Oswald_600SemiBold' }}>{j.golsMandante ?? '–'} · {j.golsVisitante ?? '–'}</Text><Text numberOfLines={2} style={{ flex: 1, color: colors.texto, textAlign: 'right' }}>{nome(j.visitanteId)}</Text></View>
            {!!j.ocorrencia && <Text style={{ color: colors.textoSecundario }}>{j.ocorrencia}</Text>}
          </View>) : <ScrollView horizontal><View style={{ minWidth: 520, gap: 1 }}>
            {[...new Set(evento.classificacao.map(p => `${p.faseId}|${p.grupo}`))].map(grupo => <View key={grupo}>
              <Text style={{ color: colors.texto, paddingVertical: 12, fontWeight: '600' }}>{evento.classificacao.find(p => `${p.faseId}|${p.grupo}` === grupo)?.fase} · {grupo.split('|')[1]}</Text>
              <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.cardSecundario }}><Text style={{ width: 36, color: colors.textoSecundario }}>Pos.</Text><Text style={{ width: 260, color: colors.textoSecundario }}>Equipe</Text><Text style={{ width: 68, color: colors.textoSecundario }}>PTS</Text><Text style={{ width: 68, color: colors.textoSecundario }}>Jogos</Text><Text style={{ color: colors.textoSecundario }}>SG</Text></View>
              {evento.classificacao.filter(p => `${p.faseId}|${p.grupo}` === grupo).sort((a,b) => a.posicao - b.posicao).map(p => <View key={p.equipeId} style={{ flexDirection: 'row', padding: 12, backgroundColor: minhas.has(p.equipeId) ? colors.fundoBotao : colors.card, borderBottomWidth: 1, borderBottomColor: colors.linha }}><Text style={{ width: 36, color: colors.texto }}>{p.posicao}º</Text><Text numberOfLines={1} style={{ width: 260, color: colors.texto, fontWeight: minhas.has(p.equipeId) ? '700' : '400' }}>{nome(p.equipeId)}</Text><Text style={{ width: 68, color: colors.texto }}>{p.pontos}</Text><Text style={{ width: 68, color: colors.texto }}>{p.jogos}</Text><Text style={{ color: colors.texto }}>{p.saldo}</Text></View>)}
            </View>)}
          </View></ScrollView>}
        </>}
    </ScrollView>
  </View>;
}
