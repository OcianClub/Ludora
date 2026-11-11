import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { io } from 'socket.io-client';
import { Icon } from '@ludora/icons';
import { liveBadgeColors, typography } from '@ludora/design-tokens';
import { apiFetch, BASE_URL, fetchClubes, type ClubeListado } from '../services/api';
import { useClubeAtivo } from '../contexts/ClubeAtivoContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { clubeParaPartida, dataPartidaDescoberta, limitesCarrossel, nomeEquipeDescoberta, partidasDisponiveis, type PartidaDescoberta } from '../utils/aoVivoDiscovery';
import { SinalAoVivo } from './SinalAoVivo';
import { Skeleton } from './Skeleton';

const GAP = 12;

const Equipe = memo(function Equipe({ equipe }: { equipe: PartidaDescoberta['mandante'] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [falhou, setFalhou] = useState<string | null>(null);
  const nome = nomeEquipeDescoberta(equipe.nome);
  const uri = equipe.escudo?.trim();
  return <View style={styles.equipe}>
    <View style={styles.escudo}>
      {uri && uri !== falhou
        ? <Image source={{ uri }} style={styles.imagem} resizeMode="contain" onError={() => setFalhou(uri)} />
        : <Text style={styles.inicial}>{Array.from(nome)[0]?.toUpperCase() || '?'}</Text>}
    </View>
    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.nome}>{nome}</Text>
  </View>;
});

const CartaoPartida = memo(function CartaoPartida({ jogo, largura, ocupado, abrindo, onAbrir }: {
  jogo: PartidaDescoberta; largura: number; ocupado: boolean; abrindo: boolean;
  onAbrir: (jogo: PartidaDescoberta) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <TouchableOpacity
    style={[styles.card, { width: largura }]} activeOpacity={0.8} disabled={ocupado}
    onPress={() => onAbrir(jogo)} accessibilityRole="button"
    accessibilityState={{ disabled: ocupado, busy: abrindo }}
    accessibilityLabel={`Acompanhar ${nomeEquipeDescoberta(jogo.mandante.nome)} ${jogo.gols_mandante} a ${jogo.gols_visitante} ${nomeEquipeDescoberta(jogo.visitante.nome)}, ${jogo.categoria}, ao vivo`}
  >
    <View style={styles.meta}>
      <Text style={styles.categoria}>{jogo.categoria.toUpperCase()}</Text>
      <View style={styles.indicador} />
    </View>
    <View style={styles.placarRow}>
      <Equipe equipe={jogo.mandante} />
      <View style={styles.placar}>
        <Text style={styles.gols}>{jogo.gols_mandante}</Text>
        <Text style={styles.separador}>–</Text>
        <Text style={styles.gols}>{jogo.gols_visitante}</Text>
      </View>
      <Equipe equipe={jogo.visitante} />
    </View>
    <View style={styles.rodape}>
      <Text numberOfLines={1} style={styles.data}>{dataPartidaDescoberta(jogo.data, jogo.horario)}</Text>
      {abrindo ? <ActivityIndicator size="small" color={colors.primaria} /> : <Icon name="chevron-right" size={16} color={colors.textoSecundario} />}
    </View>
  </TouchableOpacity>;
});

export default function AoVivoPublico({ clubes }: { clubes?: ClubeListado[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { clubeAtivo, definirClubeAtivo } = useClubeAtivo();
  const [jogos, setJogos] = useState<PartidaDescoberta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroConsulta, setErroConsulta] = useState(false);
  const [abrindoId, setAbrindoId] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const abrindo = useRef(false);
  const contexto = useRef({ clubes, clubeAtivo, definirClubeAtivo, router });
  contexto.current = { clubes, clubeAtivo, definirClubeAtivo, router };
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const atualizar = useRef<() => void>(() => {});
  useFocusEffect(useCallback(() => {
    let ativo = true, pendente = false, repetir = false;
    const controller = new AbortController();
    async function carregar() {
      if (!ativo || AppState.currentState !== 'active') return;
      if (pendente) { repetir = true; return; }
      pendente = true;
      do {
        repetir = false;
        try {
          const resposta = await apiFetch('/publico/partidas/ao-vivo', { signal: controller.signal, revalidar: true });
          if (!resposta.ok) throw new Error();
          const rows = await resposta.json();
          if (!Array.isArray(rows)) throw new Error();
          if (ativo) { setJogos(rows); setErroConsulta(false); }
        } catch { if (ativo) setErroConsulta(true); }
        finally { if (ativo) setCarregando(false); }
      } while (ativo && repetir && AppState.currentState === 'active');
      pendente = false;
    }
    atualizar.current = () => void carregar();
    void carregar();
    const socket = io(`${BASE_URL}/publico`, { auth: { descoberta: true } });
    let conectou = false;
    socket.on('ao_vivo_alterado', carregar);
    socket.on('connect', () => { if (conectou) void carregar(); conectou = true; });
    const listener = AppState.addEventListener('change', estado => { if (estado === 'active') void carregar(); });
    const timer = setInterval(() => void carregar(), 30000);
    return () => {
      ativo = false; controller.abort(); clearInterval(timer); listener.remove();
      socket.removeAllListeners(); socket.disconnect(); atualizar.current = () => {};
    };
  }, []));

  const disponiveis = useMemo(() => partidasDisponiveis(jogos, clubes), [jogos, clubes]);
  const abrir = useCallback(async (jogo: PartidaDescoberta) => {
    if (abrindo.current) return;
    abrindo.current = true; setAbrindoId(jogo.id); setErro('');
    try {
      const ctx = contexto.current;
      const lista = ctx.clubes ?? await fetchClubes();
      const clube = clubeParaPartida(jogo, lista, ctx.clubeAtivo?.id);
      if (!clube) throw new Error();
      await ctx.definirClubeAtivo({ id: clube.id, nome: clube.nome, escudo: clube.escudo, papel: clube.papel });
      if (montado.current) ctx.router.push({ pathname: '/partida-compartilhada/[id]', params: { id: String(jogo.id) } });
    } catch { if (montado.current) setErro('Não foi possível abrir a partida. Tente novamente.'); }
    finally { abrindo.current = false; if (montado.current) setAbrindoId(null); }
  }, []);

  const lista = useRef<FlatList<PartidaDescoberta>>(null);
  const [largura, setLargura] = useState(0);
  const tamanhoCard = disponiveis.length === 1 ? largura : Math.min(310, largura * 0.82);
  const medidas = useRef({ largura: 0, conteudo: 0, offset: 0 });
  const [setas, setSetas] = useState({ anterior: false, proximo: false });
  const limitesAtuais = useRef(setas);
  const medir = useCallback(() => {
    const m = medidas.current;
    const limites = limitesCarrossel(m.largura, m.conteudo, m.offset);
    if (limitesAtuais.current.anterior === limites.anterior && limitesAtuais.current.proximo === limites.proximo) return;
    limitesAtuais.current = limites;
    setSetas(limites);
  }, []);
  useEffect(() => {
    const total = disponiveis.length * tamanhoCard + Math.max(0, disponiveis.length - 1) * GAP;
    const offset = Math.min(medidas.current.offset, Math.max(0, total - largura));
    medidas.current = { largura, conteudo: total, offset };
    lista.current?.scrollToOffset({ offset, animated: false });
    medir();
  }, [largura, tamanhoCard, disponiveis.length, medir]);
  const mover = (direcao: number) => {
    const m = medidas.current;
    const offset = Math.max(0, Math.min(m.conteudo - m.largura, m.offset + direcao * (tamanhoCard + GAP)));
    lista.current?.scrollToOffset({ offset, animated: true });
  };

  const renderizarPartida = useCallback<ListRenderItem<PartidaDescoberta>>(({ item }) => (
    <CartaoPartida jogo={item} largura={tamanhoCard} ocupado={abrindoId !== null} abrindo={abrindoId === item.id} onAbrir={abrir} />
  ), [tamanhoCard, abrindoId, abrir]);
  const acompanharDeslize = useCallback((evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    medidas.current.offset = evento.nativeEvent.contentOffset.x;
    medir();
  }, [medir]);

  if (!carregando && !erroConsulta && !disponiveis.length) return null;
  return <View style={styles.secao}>
    <View style={styles.tituloRow}><SinalAoVivo size={17} /><Text accessibilityRole="header" style={styles.titulo}>Ao vivo no Ludora</Text></View>
    <View style={styles.carrossel} onLayout={e => setLargura(e.nativeEvent.layout.width)}>
      {carregando && !disponiveis.length
        ? <View accessibilityLabel="Carregando partidas ao vivo" accessibilityRole="progressbar"><Skeleton height={152} /></View>
        : largura > 0 && <FlatList
          ref={lista} data={disponiveis} horizontal showsHorizontalScrollIndicator={false}
          keyExtractor={j => String(j.id)} initialNumToRender={3} maxToRenderPerBatch={4} windowSize={3}
          extraData={abrindoId} ItemSeparatorComponent={Espaco}
          snapToInterval={tamanhoCard + GAP} snapToAlignment="start" decelerationRate="normal"
          disableIntervalMomentum directionalLockEnabled nestedScrollEnabled
          getItemLayout={(_, index) => ({ length: tamanhoCard + GAP, offset: index * (tamanhoCard + GAP), index })}
          onContentSizeChange={w => { medidas.current.conteudo = w; medir(); }}
          onScroll={acompanharDeslize} scrollEventThrottle={32}
          accessibilityLabel="Carrossel de partidas ao vivo"
          renderItem={renderizarPartida}
        />}
      {setas.anterior && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Partidas ao vivo anteriores" style={[styles.seta, styles.anterior]} onPress={() => mover(-1)}><Icon name="chevron-left" size={20} color={colors.texto} /></TouchableOpacity>}
      {setas.proximo && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Próximas partidas ao vivo" style={[styles.seta, styles.proximo]} onPress={() => mover(1)}><Icon name="chevron-right" size={20} color={colors.texto} /></TouchableOpacity>}
    </View>
    {erroConsulta && <View style={styles.erroRow}><Text style={styles.erroConsulta}>Não foi possível atualizar os jogos ao vivo.</Text><TouchableOpacity accessibilityRole="button" onPress={() => atualizar.current()} style={styles.tentar}><Text style={{ color: colors.primaria }}>Tentar novamente</Text></TouchableOpacity></View>}
    {!!erro && <Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>{erro}</Text>}
  </View>;
}

function Espaco() { return <View style={{ width: GAP }} />; }

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  secao: { gap: 14, marginBottom: 28 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { color: colors.texto, fontSize: 15, fontFamily: typography.fontFamily.corpo.semiBold },
  carrossel: { position: 'relative' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: `${liveBadgeColors.indicador}40`, borderRadius: 10, padding: 14, gap: 14, minHeight: 152 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoria: { color: `${colors.texto}B8`, fontSize: 10, fontFamily: typography.fontFamily.corpo.regular },
  indicador: { width: 6, height: 6, borderRadius: 3, backgroundColor: liveBadgeColors.indicador },
  placarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  equipe: { flex: 1, minWidth: 0, alignItems: 'center', gap: 7 },
  escudo: { width: 38, height: 38, padding: 5, borderRadius: 8, backgroundColor: colors.cardSecundario, alignItems: 'center', justifyContent: 'center' },
  imagem: { width: '100%', height: '100%' },
  inicial: { color: colors.texto, fontSize: 19, fontFamily: typography.fontFamily.corpo.semiBold },
  nome: { width: '100%', textAlign: 'center', color: colors.texto, fontSize: 12, fontFamily: typography.fontFamily.corpo.medium },
  placar: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  gols: { color: colors.texto, fontFamily: typography.fontFamily.corpo.semiBold, fontSize: 28, fontVariant: ['tabular-nums'] },
  separador: { color: colors.textoSecundario, fontSize: 16 },
  rodape: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginTop: 'auto' },
  data: { flex: 1, color: `${colors.texto}B8`, fontSize: 11, fontFamily: typography.fontFamily.corpo.regular },
  seta: { position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.borda, backgroundColor: colors.cardSecundario, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  anterior: { left: 0 }, proximo: { right: 0 },
  erroRow: { gap: 4 }, erroConsulta: { color: colors.textoSecundario, fontSize: 12 },
  tentar: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
