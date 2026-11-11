import { memo, useCallback, useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@ludora/icons';
import type { JogoPaulista } from '../../../../packages/shared-types/src/paulista';
import { agendaProvisoria } from '../../../../packages/shared-types/src/paulistaPresentation/paulistaBracket';
import { useClubeAtivo, type ClubeAtivo } from '../contexts/ClubeAtivoContext';
import { useSessao } from '../contexts/SessaoContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePaulistaPublicacao } from '../hooks/usePaulistaPublicacao';
import { useCategoryPagerMotion } from '../hooks/useCategoryPagerMotion';
import { categoriaPaulista, estadoJogo, eventoDaSelecao, fonteOficialValida, hojePaulista, nomeOficial, numeroSub, resumoClube, snapshotDoClube, type EventoPublicoPaulista } from '../utils/paulista';
import { HeaderClube } from '../components/HeaderClube';
import { CarrosselSubs, SUBS_BASE, SUBS_INICIACAO } from '../components/CarrosselSubs';
import { CategoryPager, type CategoryPagerHandle } from '../components/CategoryPager';
import { ErroCarregamento } from '../components/ErroCarregamento';
import { Skeleton } from '../components/Skeleton';
import { AnchoredMenu } from '../components/ui/AnchoredMenu';
import { AppButton, IconButton, SearchField } from '../components/ui/Controls';
import { AppSheet } from '../components/ui/AppSheet';
import { PaulistaOverview } from '../components/paulista/PaulistaOverview';
import { PaulistaBracket } from '../components/paulista/PaulistaBracket';
import { PaulistaMatchCard } from '../components/paulista/PaulistaMatchCard';
import { PaulistaStandings } from '../components/paulista/PaulistaStandings';
import { AtualizarIcon, ConfrontoOficial, dataOficial, Globo, MenuSelecao, Panel, ResultadoOficial, usePaulistaStyles } from '../components/paulista/PaulistaUI';

const normalizarBusca = (texto: string) => texto.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');

type Aba = 'visao' | 'jogos' | 'classificacao' | 'chaveamento';
const ABAS: { id: Aba; nome: string }[] = [{ id: 'visao', nome: 'Visão geral' }, { id: 'jogos', nome: 'Jogos' }, { id: 'classificacao', nome: 'Classificação' }, { id: 'chaveamento', nome: 'Chaveamento' }];
export default function PaulistaScreen() {
  const { colors } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const { autenticado } = useSessao();
  const publicacao = usePaulistaPublicacao(clubeAtivo?.id, autenticado);
  const { eventos } = publicacao;
  const [selecao, setSelecao] = useState<{ clubeId: number; ano?: number; sub: string }>();
  const [aba, setAba] = useState<Aba>('visao');
  const pagerRef = useRef<CategoryPagerHandle>(null);
  const motion = useCategoryPagerMotion(pagerRef);

  const anos = useMemo(() => [...new Set(eventos.map(e => e.ano))].sort((a, b) => b - a), [eventos]);
  const inicial = useMemo(() => eventos.slice().sort((a, b) => b.ano - a.ano || numeroSub(a.categoria) - numeroSub(b.categoria))[0], [eventos]);
  const selecaoAtiva = selecao?.clubeId === clubeAtivo?.id ? selecao : undefined;
  const ano = selecaoAtiva?.ano && anos.includes(selecaoAtiva.ano)
    ? selecaoAtiva.ano : inicial?.ano ?? new Date().getFullYear();
  const sub = selecaoAtiva?.sub ?? (inicial ? categoriaPaulista(inicial.categoria) : 'SUB-7');
  const tipo = numeroSub(sub) <= 10 ? 'INICIACAO' : 'BASE';
  const subs = tipo === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  const subIndex = Math.max(0, subs.findIndex(item => item.title === sub));
  const opcoesTemporada = useMemo(() => anos.map(value => ({
    value: String(value), label: `Temporada ${value}`,
  })), [anos]);
  const escolherSub = useCallback((novoSub: string) => {
    if (!clubeAtivo) return;
    setSelecao(atual => atual?.clubeId === clubeAtivo.id && atual.sub === novoSub ? atual : {
      clubeId: clubeAtivo.id, ano: selecaoAtiva?.ano, sub: novoSub,
    });
  }, [clubeAtivo?.id, selecaoAtiva?.ano]);
  const escolherAno = useCallback((value: string, sub: string) => {
    if (clubeAtivo) setSelecao({ clubeId: clubeAtivo.id, ano: Number(value), sub });
  }, [clubeAtivo?.id]);
  const onPageSelected = useCallback(({ nativeEvent }: { nativeEvent: { position: number } }) => {
    const destino = subs[nativeEvent.position]?.title;
    if (destino) escolherSub(destino);
  }, [subs, escolherSub]);
  const trocarTipo = useCallback((value: 'INICIACAO' | 'BASE') => {
    escolherSub(value === 'INICIACAO' ? SUBS_INICIACAO[0].title : SUBS_BASE[0].title);
  }, [escolherSub]);

  const s = usePaulistaStyles();
  return (
    <View style={{ flex: 1, backgroundColor: colors.fundo }}>
      <HeaderClube />
      {clubeAtivo ? (
        <>
          <CarrosselSubs
            tipoFiltro={tipo}
            onTrocarTipo={trocarTipo}
            indexAtual={subIndex}
            onChangeIndex={motion.goTo}
            progressoPagina={motion.progress}
            originPagina={motion.origin}
            settlingPagina={motion.settling}
          />
          <CategoryPager
            key={`${clubeAtivo.id}:${tipo}:${ano}:${inicial?.categoria ?? ''}`}
            ref={pagerRef}
            initialPage={subIndex}
            progress={motion.progress}
            origin={motion.origin}
            settling={motion.settling}
            onPageSelected={onPageSelected}
            onSettled={motion.onSettled}
            keyboardDismissMode="on-drag"
          >
            {subs.map(({ title }) => (
              <PaulistaSubPage
                key={title}
                clubeAtivo={clubeAtivo}
                sub={title}
                ano={ano}
                evento={eventoDaSelecao(eventos, ano, title)}
                opcoesTemporada={opcoesTemporada}
                aba={aba}
                escolherAno={escolherAno}
                trocarAba={setAba}
                carregando={publicacao.carregando}
                recebida={publicacao.recebida}
                atualizando={publicacao.atualizando}
                erro={publicacao.erro}
                atualizar={publicacao.atualizar}
              />
            ))}
          </CategoryPager>
        </>
      ) : (
        <View style={s.empty}>
          <Icon name="trophy" size={32} color={colors.textoSecundario} />
          <Text style={[s.muted, { textAlign: 'center' }]}>Acesse um clube para consultar seus campeonatos.</Text>
        </View>
      )}
    </View>
  );
}

type PaulistaSubPageProps = {
  clubeAtivo: ClubeAtivo;
  sub: string;
  ano: number;
  evento?: EventoPublicoPaulista;
  opcoesTemporada: { value: string; label: string }[];
  aba: Aba;
  escolherAno: (value: string, sub: string) => void;
  trocarAba: (aba: Aba) => void;
} & Pick<ReturnType<typeof usePaulistaPublicacao>, 'carregando' | 'recebida' | 'atualizando' | 'erro' | 'atualizar'>;

const PaulistaSubPage = memo(function PaulistaSubPage({
  clubeAtivo, sub, ano, evento, opcoesTemporada, aba, escolherAno, trocarAba,
  carregando, recebida, atualizando, erro, atualizar,
}: PaulistaSubPageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = usePaulistaStyles();
  const [busca, setBusca] = useState('');
  const [faseJogo, setFaseJogo] = useState('');
  const [filtros, setFiltros] = useState(false);
  const [limite, setLimite] = useState(20);
  const [jogoSelecionado, setJogoSelecionado] = useState<{ id: string; scope: string } | null>(null);
  const [linkErro, setLinkErro] = useState('');
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const snapshot = useMemo(() => evento ? snapshotDoClube(evento, clubeAtivo) : null, [evento, clubeAtivo.id, clubeAtivo.nome, clubeAtivo.escudo]);
  const minhas = useMemo(() => new Set(evento?.equipesClube || []), [evento]);
  const resumo = useMemo(() => snapshot ? resumoClube(snapshot, minhas, hojePaulista()) : null, [snapshot, minhas]);
  const chave = resumo?.chaves[0];
  const equipes = useMemo(() => new Map(snapshot?.equipes.map(e => [e.id, e])), [snapshot]);
  const buscaAdiada = useDeferredValue(busca);
  const jogos = useMemo(() => {
    if (aba !== 'jogos' || !resumo) return [];
    const termo = normalizarBusca(buscaAdiada);
    return [...resumo.jogos].reverse().filter(jogo => {
      if (faseJogo && jogo.faseId !== faseJogo) return false;
      if (!termo) return true;
      const mandante = equipes.get(jogo.mandanteId)?.nome ?? '';
      const visitante = equipes.get(jogo.visitanteId)?.nome ?? '';
      return normalizarBusca(`${mandante} ${visitante} ${jogo.local ?? ''}`).includes(termo);
    });
  }, [aba, resumo, faseJogo, buscaAdiada, equipes]);
  const scope = `${clubeAtivo?.id}:${evento?.id}:${ano}:${sub}`;
  const detalhe = jogoSelecionado?.scope === scope ? snapshot?.jogos.find(j => j.id === jogoSelecionado.id) : null;
  const setDetalhe = useCallback((jogo: JogoPaulista | null) => {
    setJogoSelecionado(jogo ? { id: jogo.id, scope } : null);
  }, [scope]);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [aba]);
  useLayoutEffect(() => {
    if (snapshot && faseJogo && !resumo?.jogos.some(jogo => jogo.faseId === faseJogo)) {
      setFaseJogo('');
    }
  }, [snapshot, resumo, faseJogo]);

  async function fonte() {
    if (!fonteOficialValida(evento?.fonte)) { setLinkErro('A fonte oficial ainda não está disponível para esta seleção.'); return; }
    try { await Linking.openURL(evento.fonte); setLinkErro(''); } catch { setLinkErro('Não foi possível abrir a fonte oficial. Tente novamente.'); }
  }
  function localizar(view: View) { view.measureInWindow((_x, y) => scroll.current?.scrollTo({ y: Math.max(0, scrollY.current + y - insets.top - 170), animated: true })); }
  return <>
    <ScrollView ref={scroll} onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} refreshControl={<RefreshControl refreshing={atualizando && !carregando} onRefresh={atualizar} tintColor={colors.primaria} />} contentContainerStyle={{ padding: 12, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 18 }}>
      <View style={[s.between, { alignItems: 'flex-start', gap: 5 }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={[s.title, { fontSize: width < 350 ? 20 : 23, lineHeight: 32 }]}>Campeonato Paulista</Text>{!!evento?.divisao && <Text style={s.tiny}>Divisão {evento.divisao}</Text>}</View>
        <View style={[s.row, { alignItems: 'flex-start', gap: 2 }]}>
          <MenuSelecao label="Selecionar temporada" compact value={String(ano)} options={opcoesTemporada} onChange={value => escolherAno(value, sub)} />
          <AnchoredMenu label="Opções do campeonato" triggerStyle={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }} trigger={() => <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="dots-horizontal" size={20} color={colors.textoSecundario} /></View>}>
            {close => <><TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar dados" disabled={atualizando} onPress={() => { close(); atualizar(); }} style={[s.row, { minHeight: 44, padding: 10, gap: 10 }]}>{atualizando ? <ActivityIndicator size="small" color={colors.texto} /> : <AtualizarIcon />}<Text style={s.text}>Atualizar dados</Text></TouchableOpacity>
              {!!evento && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Consultar fonte oficial" onPress={() => { close(); void fonte(); }} style={[s.row, { minHeight: 44, padding: 10, gap: 10 }]}><Globo /><Text style={[s.text, { flex: 1 }]}>Consultar fonte oficial</Text><Icon name="arrow-right" size={14} color={colors.textoSecundario} /></TouchableOpacity>}
            </>}
          </AnchoredMenu>
        </View>
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.linha }}>{ABAS.map(a => <TouchableOpacity key={a.id} accessibilityRole="tab" accessibilityLabel={a.nome} aria-selected={aba === a.id} onPress={() => trocarAba(a.id)} style={{ flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: aba === a.id ? colors.primaria : 'transparent' }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.88} style={[s.tiny, { color: aba === a.id ? colors.texto : colors.textoSecundario, fontFamily: aba === a.id ? 'Inter_600SemiBold' : 'Inter_400Regular', fontSize: width < 350 ? 10 : 11 }]}>{a.nome}</Text></TouchableOpacity>)}</View>
      {!!linkErro && <Text accessibilityRole="alert" style={s.muted}>{linkErro}</Text>}
      {carregando ? <PaulistaSkeleton aba={aba} /> : erro && !recebida ? <ErroCarregamento titulo="Não foi possível carregar o campeonato" descricao={erro} onTentarNovamente={atualizar} /> : <>
        {!!erro && <ErroCarregamento compacto titulo="Última atualização não concluída" descricao="Os últimos dados continuam visíveis. Confira sua conexão e tente novamente." onTentarNovamente={atualizar} />}
        {!snapshot ? <View style={s.empty}><Icon name="trophy" size={32} color={colors.textoSecundario} /><Text style={[s.muted, { textAlign: 'center' }]}>Nenhuma participação publicada para {sub} na temporada {ano}.</Text></View> : <>
          {aba === 'visao' && <PaulistaOverview key={scope} snapshot={snapshot} minhas={minhas} clubeNome={clubeAtivo.nome} resumo={resumo!} chave={chave} onTab={trocarAba} onOpen={setDetalhe} />}
          {aba === 'classificacao' && <PaulistaStandings key={scope} snapshot={snapshot} minhas={minhas} onLocate={localizar} />}
          {aba === 'jogos' && (
            <View style={{ gap: 16 }}>
              <View style={[s.row, { gap: 8 }]}>
                <SearchField
                  accessibilityLabel="Buscar adversário ou local"
                  placeholder="Adversário ou local"
                  value={busca}
                  onChangeText={value => { setBusca(value); setLimite(20); }}
                />
                <IconButton icon="sliders-horizontal" label="Mais filtros de jogos" dot={!!faseJogo} onPress={() => setFiltros(true)} />
              </View>
              <Text style={s.muted}>{jogos.length} {jogos.length === 1 ? 'jogo' : 'jogos'} do {clubeAtivo.nome}</Text>
              {jogos.slice(0, limite).map(jogo => (
                <PaulistaMatchCard key={jogo.id} jogo={jogo} equipes={equipes} minhas={minhas} onOpen={setDetalhe} />
              ))}
              {!jogos.length && (
                <Text style={[s.muted, { textAlign: 'center', paddingVertical: 32 }]}>Nenhum jogo encontrado para esta seleção.</Text>
              )}
              {jogos.length > limite && (
                <AppButton label={`Carregar mais jogos (${jogos.length - limite})`} onPress={() => setLimite(n => n + 20)} />
              )}
            </View>
          )}
          {aba === 'chaveamento' && <PaulistaBracket key={scope} snapshot={snapshot} chave={chave} equipes={equipes} minhas={minhas} onOpen={setDetalhe} />}
        </>}
      </>}
    </ScrollView>
    {filtros && <AppSheet title="Filtrar jogos" onClose={() => setFiltros(false)}><MenuSelecao label="Selecionar etapa" value={faseJogo} options={[{ value: '', label: 'Todas as etapas' }, ...[...new Map((resumo?.jogos || []).map(j => [j.faseId, j.fase]))].map(([value, label]) => ({ value, label: nomeOficial(label) }))]} onChange={value => { setFaseJogo(value); setLimite(20); setFiltros(false); }} /></AppSheet>}
    {detalhe && snapshot && <AppSheet title="Partida oficial" onClose={() => setDetalhe(null)}><ConfrontoOficial jogo={detalhe} equipes={equipes} minhas={minhas} /><Text style={s.text}>{nomeOficial(detalhe.fase)} · {snapshot.categoria.toUpperCase()}</Text><Text style={s.muted}>{agendaProvisoria(detalhe) ? 'Data e horário a confirmar' : `${dataOficial(detalhe.data)} · ${detalhe.horario?.slice(0, 5) || 'Horário a confirmar'}`}</Text>{!!detalhe.local && <Text style={s.muted}>{detalhe.local}</Text>}<ResultadoOficial jogo={detalhe} minhas={minhas} /><Text style={s.muted}>{estadoJogo(detalhe)}</Text><AppButton label="Consultar fonte oficial" onPress={() => void fonte()} /></AppSheet>}
  </>;
});

function PaulistaSkeleton({ aba }: { aba: Aba }) {
  const s = usePaulistaStyles();
  return <View accessibilityLabel="Carregando campeonato" style={{ gap: 18 }}>
    <Panel style={{ padding: 16, gap: 20 }}><View style={[s.row, { gap: 9 }]}><Skeleton width={30} height={30} /><Skeleton width="60%" height={12} /></View><Skeleton width="40%" height={20} /><Skeleton width="85%" height={30} />{aba === 'classificacao' ? <View style={[s.row, { gap: 12 }]}>{[0, 1, 2].map(i => <Skeleton key={i} width="28%" height={45} />)}</View> : [0, 1, 2, 3].map(i => <View key={i} style={[s.row, { gap: 10 }]}><Skeleton width={25} height={25} radius={13} /><Skeleton width="56%" height={18} /></View>)}</Panel>
    <Panel style={{ padding: 16, gap: 20 }}>{[0, 1, 2, 3, 4].map(i => <View key={i} style={[s.row, { gap: 12 }]}><Skeleton width={24} height={24} /><Skeleton width="58%" height={13} /><Skeleton width={32} height={16} /></View>)}</Panel>
  </View>;
}
