import { Icon } from '@ludora/icons';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Header } from '@/src/components/Header';
import { ConfirmacaoConta } from '@/src/components/ConfirmacaoConta';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import { Skeleton } from '@/src/components/Skeleton';
import { CalendarioPartida } from '@/src/components/CalendarioPartida';
import { SeletoresOrganizarPartida } from '@/src/components/SeletoresOrganizarPartida';
import TeamSelectorCard from '@/src/components/TeamSelectorCard';
import MandoCampo from '@/src/components/mandoCampo';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  criarPartida,
  fetchCategorias,
  fetchCompeticoes,
  fetchTimes,
} from '@/src/services/api';
import { createStyles } from '@/src/styles/organizarPartidasStyles';
import { criarControleRequisicoes, ErroConexao } from '@/src/utils/request';
import { dataPartidaISO } from '@/src/utils/validarPartida';
import {
  errosOrganizarPartida,
  mascaraDataPartida,
  mascaraHorarioPartida,
  normalizarBuscaPartida,
  rascunhoPartidaAlterado,
  type CampoPartida,
  type CategoriaPartida,
  type CompeticaoPartida,
  type TimePartida,
} from '@/src/utils/organizarPartida';

type Props = {
  onFechar?: () => void;
  onCriada?: (dataISO: string) => void;
  noModal?: boolean;
  categoriaInicial?: string;
};

export type OrganizarPartidasRef = { solicitarFechamento: () => void };
type Selecao = 'competicao' | 'mandante' | 'visitante' | 'data' | null;

const OrganizarPartidas = forwardRef<OrganizarPartidasRef, Props>(
  function OrganizarPartidas(
    { onFechar, onCriada, noModal = false, categoriaInicial },
    ref
  ) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { clubeAtivo, podeGerenciar } = useClubeAtivo();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scroll = useRef<ScrollView>(null);
    const horarioInput = useRef<TextInput>(null);
    const posicoes = useRef<Partial<Record<CampoPartida, number>>>({});
    const categoriaPadrao = useRef<number | null>(null);
    const controle = useRef(criarControleRequisicoes()).current;
    const envioEmAndamento = useRef(false);
    const clubeAtual = useRef(clubeAtivo?.id);
    clubeAtual.current = clubeAtivo?.id;

    const [times, setTimes] = useState<TimePartida[]>([]);
    const [competicoes, setCompeticoes] = useState<CompeticaoPartida[]>([]);
    const [categorias, setCategorias] = useState<CategoriaPartida[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroDados, setErroDados] = useState('');
    const [erroSalvar, setErroSalvar] = useState('');
    const [categoriaId, setCategoriaId] = useState<number | null>(null);
    const [competicao, setCompeticao] = useState<
      CompeticaoPartida | null | undefined
    >();
    const [mandante, setMandante] = useState<TimePartida | null>(null);
    const [visitante, setVisitante] = useState<TimePartida | null>(null);
    const [data, setData] = useState('');
    const [horario, setHorario] = useState('');
    const [local, setLocal] = useState('');
    const [emCasa, setEmCasa] = useState(true);
    const [painel, setPainel] = useState<Selecao>(null);
    const [salvando, setSalvando] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [tentouEnviar, setTentouEnviar] = useState(false);
    const [tocados, setTocados] = useState<
      Partial<Record<CampoPartida, boolean>>
    >({});
    const campos = {
      categoriaId,
      competicao,
      mandante,
      visitante,
      data,
      horario,
      local,
      emCasa,
    };
    const erros = errosOrganizarPartida(campos);
    const alterado = rascunhoPartidaAlterado(campos, categoriaPadrao.current);
    const categoriaAtual = categorias.find(
      (categoria) => categoria.id === categoriaId
    );
    const bloqueado = carregando || salvando || !!erroDados || !podeGerenciar;

    const fecharDireto = useCallback(() => {
      if (onFechar) onFechar();
      else router.back();
    }, [onFechar, router]);

    const solicitarFechamento = useCallback(() => {
      if (envioEmAndamento.current) return;
      Keyboard.dismiss();
      if (alterado) setConfirmarSaida(true);
      else fecharDireto();
    }, [alterado, fecharDireto]);

    useImperativeHandle(ref, () => ({ solicitarFechamento }), [
      solicitarFechamento,
    ]);

    useFocusEffect(
      useCallback(() => {
        if (noModal) return;
        const listener = BackHandler.addEventListener(
          'hardwareBackPress',
          () => {
            solicitarFechamento();
            return true;
          }
        );
        return () => listener.remove();
      }, [noModal, solicitarFechamento])
    );

    const carregarDados = useCallback(async () => {
      const pedido = controle.iniciar();
      const clubeId = clubeAtivo?.id;
      setCarregando(true);
      setErroDados('');
      if (!clubeId || !podeGerenciar) {
        setCarregando(false);
        return;
      }
      try {
        const [listaTimes, listaCompeticoes, listaCategorias] =
          await Promise.all([
            fetchTimes(clubeId),
            fetchCompeticoes(clubeId),
            fetchCategorias(clubeId),
          ]);
        if (!controle.atual(pedido) || clubeAtual.current !== clubeId) return;
        if (
          ![listaTimes, listaCompeticoes, listaCategorias].every(Array.isArray)
        ) {
          throw new Error('Não foi possível confirmar os dados do clube.');
        }
        const ordenadas = [...listaCategorias].sort(
          (a: CategoriaPartida, b: CategoriaPartida) =>
            a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
        );
        const inicial =
          ordenadas.find(
            (categoria: CategoriaPartida) =>
              normalizarBuscaPartida(categoria.nome).replace(/ /g, '-') ===
              normalizarBuscaPartida(categoriaInicial ?? '').replace(/ /g, '-')
          ) ?? ordenadas[0];
        categoriaPadrao.current = inicial?.id ?? null;
        setTimes(listaTimes);
        setCompeticoes(listaCompeticoes);
        setCategorias(ordenadas);
        setCategoriaId((atual) =>
          ordenadas.some(
            (categoria: CategoriaPartida) => categoria.id === atual
          )
            ? atual
            : (inicial?.id ?? null)
        );
      } catch (erro) {
        if (controle.atual(pedido))
          setErroDados(
            erro instanceof Error
              ? erro.message
              : 'Não foi possível carregar os dados.'
          );
      } finally {
        if (controle.atual(pedido)) setCarregando(false);
      }
    }, [clubeAtivo?.id, podeGerenciar, categoriaInicial, controle]);

    useEffect(() => {
      setTimes([]);
      setCompeticoes([]);
      setCategorias([]);
      setCategoriaId(null);
      categoriaPadrao.current = null;
      setCompeticao(undefined);
      setMandante(null);
      setVisitante(null);
      setData('');
      setHorario('');
      setLocal('');
      setEmCasa(true);
      setTocados({});
      setTentouEnviar(false);
      setErroSalvar('');
      setPainel(null);
      setConfirmarSaida(false);
      void carregarDados();
      return () => controle.invalidar();
    }, [carregarDados, controle]);

    const abrirPainel = (selecao: Selecao) => {
      if (bloqueado) return;
      Keyboard.dismiss();
      setPainel(selecao);
    };
    const fecharPainel = () => {
      setPainel(null);
    };
    const tocar = (campo: CampoPartida) =>
      setTocados((atuais) => ({ ...atuais, [campo]: true }));
    const mensagem = (campo: CampoPartida) =>
      tentouEnviar || tocados[campo] ? erros[campo] : undefined;
    const exibirErro = (campo: CampoPartida) =>
      mensagem(campo) ? (
        <Text style={styles.fieldError} accessibilityRole="alert">
          {mensagem(campo)}
        </Text>
      ) : null;
    const registrarPosicao = (campo: CampoPartida, y: number) => {
      posicoes.current[campo] = y;
    };

    const salvar = async () => {
      if (bloqueado || envioEmAndamento.current || !clubeAtivo?.id) return;
      setTentouEnviar(true);
      Keyboard.dismiss();
      const primeiroErro = Object.keys(erros)[0] as CampoPartida | undefined;
      if (primeiroErro) {
        scroll.current?.scrollTo({
          y: Math.max(0, (posicoes.current[primeiroErro] ?? 0) - 12),
          animated: true,
        });
        return;
      }
      if (!mandante || !visitante || !categoriaId) return;
      const clubeId = clubeAtivo.id;
      const pedido = controle.iniciar();
      const dataISO = dataPartidaISO(data)!;
      envioEmAndamento.current = true;
      setSalvando(true);
      setErroSalvar('');
      try {
        await criarPartida(
          {
            mandante_id: mandante.id,
            visitante_id: visitante.id,
            categoria_id: categoriaId,
            competicao_id: competicao?.id,
            data: dataISO,
            horario,
            local: local.trim() || 'Local não definido',
            emCasa,
          },
          clubeId
        );
        if (!controle.atual(pedido) || clubeAtual.current !== clubeId) return;
        if (onCriada) onCriada(dataISO);
        else fecharDireto();
      } catch (erro) {
        if (controle.atual(pedido)) {
          setErroSalvar(
            erro instanceof ErroConexao
              ? 'Não foi possível confirmar a criação. Confira a lista de Jogos antes de tentar novamente.'
              : erro instanceof Error
                ? erro.message
                : 'Não foi possível criar a partida. Os dados foram mantidos.'
          );
        }
      } finally {
        envioEmAndamento.current = false;
        if (controle.atual(pedido)) setSalvando(false);
      }
    };

    const selecionarTime = (time: TimePartida) => {
      if (painel === 'mandante') setMandante(time);
      else setVisitante(time);
      fecharPainel();
      tocar('confronto');
    };

    const selecionarCategoria = (id: number) => {
      if (id === categoriaId || bloqueado) return;
      setCategoriaId(id);
      setMandante(null);
      setVisitante(null);
      setTocados((atual) => ({ ...atual, confronto: false }));
      setErroSalvar('');
    };

    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Header
            title="Organizar partida"
            showLogo={false}
            showProfile={false}
            btnVoltar="arrow-left"
            onBtnVoltar={solicitarFechamento}
            semSafeArea
          />
          <ScrollView
            ref={scroll}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.clubContext}>
              <Icon
                name="shield-outline"
                size={16}
                color={colors.textoSecundario}
              />
              <Text style={styles.clubText}>
                {clubeAtivo?.nome || 'Nenhum clube selecionado'}
              </Text>
            </View>

            {!podeGerenciar ? (
              <View style={styles.empty}>
                <Icon
                  name="lock-outline"
                  size={30}
                  color={colors.textoSecundario}
                />
                <Text style={styles.emptyTitle}>
                  Acesso de gestão necessário
                </Text>
                <Text style={styles.emptyDescription}>
                  Somente gestores autorizados podem organizar partidas neste
                  clube.
                </Text>
              </View>
            ) : carregando ? (
              <View style={styles.skeletons}>
                <Skeleton height={44} />
                <Skeleton height={58} />
                <View style={styles.skeletonTeams}>
                  <View style={styles.skeletonTeam}>
                    <Skeleton height={160} />
                  </View>
                  <View style={styles.skeletonTeam}>
                    <Skeleton height={160} />
                  </View>
                </View>
                <Skeleton height={52} />
              </View>
            ) : erroDados ? (
              <ErroCarregamento
                titulo="Não foi possível preparar a partida"
                descricao={erroDados}
                onTentarNovamente={() => void carregarDados()}
              />
            ) : (
              <>
                <View
                  style={styles.section}
                  onLayout={(evento) =>
                    registrarPosicao('categoria', evento.nativeEvent.layout.y)
                  }
                >
                  <Text style={styles.sectionTitle}>Categoria</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pillRow}
                  >
                    {categorias.map((categoria) => (
                      <TouchableOpacity
                        key={categoria.id}
                        style={[
                          styles.pill,
                          categoriaId === categoria.id && styles.pillActive,
                        ]}
                        onPress={() => selecionarCategoria(categoria.id)}
                        disabled={salvando}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: categoriaId === categoria.id,
                          disabled: salvando,
                        }}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            categoriaId === categoria.id &&
                              styles.pillTextActive,
                          ]}
                        >
                          {categoria.nome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {categorias.length === 0 && (
                    <Text style={styles.hint}>
                      Nenhuma categoria disponível para seu acesso. Peça ao
                      administrador para conferir o cadastro e suas permissões.
                    </Text>
                  )}
                  {exibirErro('categoria')}
                </View>

                <View
                  style={styles.section}
                  onLayout={(evento) =>
                    registrarPosicao('competicao', evento.nativeEvent.layout.y)
                  }
                >
                  <Text style={styles.sectionTitle}>Competição</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      mensagem('competicao') && styles.invalidField,
                    ]}
                    onPress={() => abrirPainel('competicao')}
                    disabled={bloqueado}
                    accessibilityRole="button"
                    accessibilityLabel={
                      'Competição: ' +
                      (competicao === null
                        ? 'Amistoso, sem competição'
                        : (competicao?.nome ?? 'selecionar'))
                    }
                  >
                    <Icon
                      name="trophy-outline"
                      size={21}
                      color={colors.primaria}
                    />
                    <View style={styles.selectionText}>
                      <Text
                        style={[
                          styles.selectionTitle,
                          competicao === undefined && styles.placeholder,
                        ]}
                      >
                        {competicao === null
                          ? 'Amistoso'
                          : (competicao?.nome ?? 'Selecionar competição')}
                      </Text>
                      {competicao !== undefined && (
                        <Text style={styles.muted}>
                          {competicao
                            ? 'Temporada ' + competicao.ano
                            : 'Sem vínculo com competição'}
                        </Text>
                      )}
                    </View>
                    <Icon
                      name="chevron-down"
                      size={20}
                      color={colors.textoSecundario}
                    />
                  </TouchableOpacity>
                  {exibirErro('competicao')}
                </View>

                <View
                  style={styles.section}
                  onLayout={(evento) =>
                    registrarPosicao('confronto', evento.nativeEvent.layout.y)
                  }
                >
                  <Text style={styles.sectionTitle}>Confronto</Text>
                  <View style={styles.confrontation}>
                    <TeamSelectorCard
                      time={mandante}
                      tipo="MANDANTE"
                      onPress={() => abrirPainel('mandante')}
                      disabled={bloqueado || !categoriaId}
                    />
                    <TeamSelectorCard
                      time={visitante}
                      tipo="VISITANTE"
                      onPress={() => abrirPainel('visitante')}
                      disabled={bloqueado || !categoriaId}
                    />
                    <View style={styles.vs} pointerEvents="none">
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                  </View>
                  {exibirErro('confronto')}
                  <Text style={[styles.label, styles.mandoLabel]}>
                    Onde o clube joga?
                  </Text>
                  <View pointerEvents={salvando ? 'none' : 'auto'}>
                    <MandoCampo emCasa={emCasa} onChange={setEmCasa} />
                  </View>
                  <Text style={styles.hint}>
                    Em casa ou fora considera o clube {clubeAtivo?.nome}.
                  </Text>
                </View>

                <View
                  style={styles.section}
                  onLayout={(evento) => {
                    registrarPosicao('data', evento.nativeEvent.layout.y);
                    registrarPosicao('horario', evento.nativeEvent.layout.y);
                    registrarPosicao('local', evento.nativeEvent.layout.y);
                  }}
                >
                  <Text style={styles.sectionTitle}>Data e local</Text>
                  <View style={styles.fieldRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.label}>Data</Text>
                      <View
                        style={[
                          styles.field,
                          mensagem('data') && styles.invalidField,
                        ]}
                      >
                        <TextInput
                          style={styles.input}
                          value={data}
                          onChangeText={(texto) =>
                            setData(mascaraDataPartida(texto))
                          }
                          onBlur={() => tocar('data')}
                          placeholder="DD/MM/AAAA"
                          placeholderTextColor={colors.textoSecundario}
                          maxLength={10}
                          keyboardType="number-pad"
                          editable={!salvando}
                          accessibilityLabel="Data da partida, dia mês e ano"
                          returnKeyType="next"
                          onSubmitEditing={() => horarioInput.current?.focus()}
                        />
                        <TouchableOpacity
                          style={styles.calendarButton}
                          onPress={() => abrirPainel('data')}
                          disabled={bloqueado}
                          accessibilityRole="button"
                          accessibilityLabel="Escolher data no calendário"
                        >
                          <Icon
                            name="calendar-outline"
                            size={19}
                            color={colors.primaria}
                          />
                        </TouchableOpacity>
                      </View>
                      {exibirErro('data')}
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.label}>Horário</Text>
                      <View
                        style={[
                          styles.field,
                          mensagem('horario') && styles.invalidField,
                        ]}
                      >
                        <Icon
                          name="clock-outline"
                          size={17}
                          color={colors.textoSecundario}
                        />
                        <TextInput
                          ref={horarioInput}
                          style={styles.input}
                          value={horario}
                          onChangeText={(texto) =>
                            setHorario(mascaraHorarioPartida(texto))
                          }
                          onBlur={() => tocar('horario')}
                          placeholder="HH:MM"
                          placeholderTextColor={colors.textoSecundario}
                          maxLength={5}
                          keyboardType="number-pad"
                          editable={!salvando}
                          accessibilityLabel="Horário da partida"
                        />
                      </View>
                      {exibirErro('horario')}
                    </View>
                  </View>
                  <View style={styles.localField}>
                    <Text style={styles.label}>
                      Local <Text style={styles.optionalLabel}>· opcional</Text>
                    </Text>
                    <View
                      style={[
                        styles.field,
                        mensagem('local') && styles.invalidField,
                      ]}
                    >
                      <Icon
                        name="map-marker-outline"
                        size={19}
                        color={colors.textoSecundario}
                      />
                      <TextInput
                        style={styles.input}
                        value={local}
                        onChangeText={setLocal}
                        onBlur={() => tocar('local')}
                        placeholder="Ginásio, campo ou endereço"
                        placeholderTextColor={colors.textoSecundario}
                        maxLength={160}
                        autoCapitalize="words"
                        editable={!salvando}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        accessibilityLabel="Local da partida, opcional"
                      />
                    </View>
                    {exibirErro('local')}
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: noModal ? Math.max(insets.bottom, 12) : 12 },
            ]}
          >
            {!!erroSalvar && (
              <Text style={styles.fieldError} accessibilityRole="alert">
                {erroSalvar}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.saveButton, bloqueado && styles.disabled]}
              onPress={() => void salvar()}
              disabled={bloqueado}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: bloqueado, busy: salvando }}
            >
              {salvando ? (
                <ActivityIndicator
                  size="small"
                  color={colors.textoSobrePrimaria}
                />
              ) : (
                <Icon
                  name="check"
                  size={19}
                  color={colors.textoSobrePrimaria}
                />
              )}
              <Text style={styles.saveText}>
                {salvando ? 'Criando partida…' : 'Criar partida'}
              </Text>
            </TouchableOpacity>
          </View>

          {painel === 'data' && (
            <CalendarioPartida
              data={data}
              onFechar={fecharPainel}
              onSelecionar={(valor) => {
                setData(valor);
                tocar('data');
                fecharPainel();
              }}
            />
          )}

          {(painel === 'competicao' ||
            painel === 'mandante' ||
            painel === 'visitante') && (
            <SeletoresOrganizarPartida
              key={painel}
              painel={painel}
              competicoes={competicoes}
              times={times}
              categoriaAtual={categoriaAtual}
              mandante={mandante}
              visitante={visitante}
              competicao={competicao}
              onSelecionarTime={selecionarTime}
              onSelecionarCompeticao={(valor) => {
                setCompeticao(valor);
                tocar('competicao');
                fecharPainel();
              }}
              onFechar={fecharPainel}
            />
          )}

          <ConfirmacaoConta
            visible={confirmarSaida}
            titulo="Descartar esta partida?"
            descricao="Os dados preenchidos ainda não foram salvos."
            confirmarTexto="Descartar e sair"
            carregandoTexto="Fechando…"
            icone="close"
            onConfirmar={() => {
              setConfirmarSaida(false);
              fecharDireto();
            }}
            onFechar={() => setConfirmarSaida(false)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
);

export default OrganizarPartidas;
