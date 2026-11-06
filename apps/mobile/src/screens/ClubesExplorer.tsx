import { SearchField } from "../components/ui/Controls";
import { Icon, type IconName } from "@ludora/icons";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/contexts/ThemeContext";
import {
  useClubeAtivo,
  type PapelClube,
} from "@/src/contexts/ClubeAtivoContext";
import {
  fetchClubes,
  seguirClube,
  deixarDeSeguirClube,
  type ClubeListado,
} from "@/src/services/api";
import { createStyles } from "@/src/styles/clubesStyles";
import { agruparClubes, contextoAcessoClube } from "@/src/utils/clubesExplorer";
import { HeaderClube } from "@/src/components/HeaderClube";
import { ErroCarregamento } from "@/src/components/ErroCarregamento";
import { SinalAoVivo } from "@/src/components/SinalAoVivo";
import { ListSkeleton } from "@/src/components/Skeleton";

const papeis: Partial<
  Record<NonNullable<ClubeListado["papel"]>, { nome: string; icone: IconName }>
> = {
  ADMIN: { nome: "Administrador", icone: "shield-check" },
  TECNICO: { nome: "Técnico", icone: "clipboard-text-outline" },
  MESARIO: { nome: "Mesário", icone: "calendar" },
  OLHEIRO: { nome: "Olheiro", icone: "eye-outline" },
};
const Escudo = memo(function Escudo({ clube }: { clube: ClubeListado }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [falhou, setFalhou] = useState<string | null>(null);
  const uri = clube.escudo?.trim();
  return (
    <View style={styles.escudo} accessible={false}>
      {uri && falhou !== uri ? (
        <Image
          source={{ uri }}
          style={styles.escudoImagem}
          resizeMode="contain"
          onError={() => setFalhou(uri)}
        />
      ) : (
        <Text style={styles.escudoInicial}>
          {Array.from(clube.nome.trim())[0]?.toUpperCase() || "?"}
        </Text>
      )}
    </View>
  );
});

async function upsertClubeNoCacheLocal(clube: ClubeListado, papel: string) {
  try {
    const raw = await SecureStore.getItemAsync("userData");
    const userData = raw ? JSON.parse(raw) : { clubes: [] };
    const clubesCache: any[] = Array.isArray(userData.clubes)
      ? userData.clubes
      : [];
    const idx = clubesCache.findIndex(
      (c) => String(c.clube_id) === String(clube.id),
    );
    const entrada = {
      clube_id: clube.id,
      nome: clube.nome,
      escudo: clube.escudo,
      papel,
    };
    if (idx >= 0) clubesCache[idx] = entrada;
    else clubesCache.push(entrada);
    await SecureStore.setItemAsync(
      "userData",
      JSON.stringify({ ...userData, clubes: clubesCache }),
    );
  } catch (e) {
    console.error("Erro ao atualizar cache local de clubes:", e);
  }
}

async function removerClubeDoCacheLocal(clubeId: number) {
  try {
    const raw = await SecureStore.getItemAsync("userData");
    if (!raw) return;
    const userData = JSON.parse(raw);
    const clubesCache: any[] = Array.isArray(userData.clubes)
      ? userData.clubes
      : [];
    const filtrados = clubesCache.filter(
      (c) => String(c.clube_id) !== String(clubeId),
    );
    await SecureStore.setItemAsync(
      "userData",
      JSON.stringify({ ...userData, clubes: filtrados }),
    );
  } catch (e) {
    console.error("Erro ao remover clube do cache local:", e);
  }
}

const CartaoClube = memo(function CartaoClube({
  clube,
  descoberta,
  atual,
  desabilitado,
  processando,
  onAcessar,
  onAcompanhar,
}: {
  clube: ClubeListado;
  descoberta: boolean;
  atual: boolean;
  desabilitado: boolean;
  processando: boolean;
  onAcessar: (clube: ClubeListado) => void;
  onAcompanhar: (clube: ClubeListado, seguir: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const papel =
    clube.papel && clube.papel !== "TORCEDOR" ? papeis[clube.papel] : undefined;
  const seguindo = Boolean(clube.isSeguindo || clube.papel);
  const detalhes = papel
    ? contextoAcessoClube(clube)
    : [
        [clube.cidade, clube.estado].filter(Boolean).join(", "),
        `${clube.seguidores} ${clube.seguidores === 1 ? "seguidor" : "seguidores"}`,
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <View key={clube.id} style={styles.clubeCard}>
      <TouchableOpacity
        style={styles.acessar}
        activeOpacity={0.8}
        onPress={() => onAcessar(clube)}
        disabled={desabilitado}
        accessibilityRole="button"
        accessibilityLabel={`Acessar ${clube.nome}`}
      >
        <Escudo clube={clube} />
        <View style={styles.info}>
          <View style={styles.nomeRow}>
            <Text style={styles.nome} numberOfLines={1} ellipsizeMode="tail">
              {clube.nome}
            </Text>
            {atual && <Text style={styles.atual}>Atual</Text>}
          </View>
          <Text style={styles.detalhes} numberOfLines={2}>
            {detalhes}
          </Text>
          {(papel || !!clube.partidasAoVivo) && (
            <View style={styles.tags}>
              {papel && (
                <View style={styles.papel}>
                  <Icon name={papel.icone} size={12} color={colors.primaria} />
                  <Text style={styles.papelText}>{papel.nome}</Text>
                </View>
              )}
              {!!clube.partidasAoVivo && (
                <View
                  style={styles.live}
                  accessibilityLabel={`${clube.partidasAoVivo} partidas ao vivo`}
                >
                  <SinalAoVivo size={13} />
                  <Text style={styles.liveText}>Ao vivo</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <Icon name="chevron-right" size={18} color={colors.textoSecundario} />
      </TouchableOpacity>
      {!papel && (
        <TouchableOpacity
          style={[
            styles.seguir,
            descoberta && styles.seguirDescoberta,
            descoberta && !seguindo && styles.seguirAtivo,
          ]}
          disabled={desabilitado}
          accessibilityRole="button"
          accessibilityLabel={`${seguindo ? "Deixar de seguir" : "Seguir"} ${clube.nome}`}
          onPress={() =>
            seguindo ? onAcompanhar(clube, false) : onAcompanhar(clube, true)
          }
        >
          {processando ? (
            <ActivityIndicator
              size="small"
              color={descoberta && !seguindo ? "#fff" : colors.primaria}
            />
          ) : descoberta ? (
            <Text
              style={[styles.seguirText, !seguindo && styles.seguirTextAtivo]}
            >
              {seguindo ? "Seguindo ✓" : "Seguir"}
            </Text>
          ) : (
            <Icon name="star" size={22} color={colors.primaria} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function ClubesExplorer({
  modo,
}: {
  modo: "entrada" | "trocar";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clubeAtivo, definirClubeAtivo } = useClubeAtivo();
  const atual = useRef(clubeAtivo);
  atual.current = clubeAtivo;
  const [busca, setBusca] = useState("");
  const [clubes, setClubes] = useState<ClubeListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const operando = useRef(false),
    pedido = useRef(0),
    carregou = useRef(false);
  const carregar = useCallback(async () => {
    const id = ++pedido.current;
    setErro("");
    try {
      const lista = await fetchClubes();
      if (pedido.current === id) {
        setClubes(lista);
        carregou.current = true;
      }
    } catch {
      if (pedido.current === id)
        setErro("Não foi possível atualizar os clubes.");
    } finally {
      if (pedido.current === id) setCarregando(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!carregou.current) setCarregando(true);
      void carregar();
      return () => {
        pedido.current++;
      };
    }, [carregar]),
  );
  const grupos = useMemo(
    () => agruparClubes(clubes, clubeAtivo?.id, busca),
    [clubes, clubeAtivo?.id, busca],
  );
  const acessar = useCallback(
    async (clube: ClubeListado) => {
      if (operando.current) return;
      operando.current = true;
      setProcessandoId(clube.id);
      setErro("");
      try {
        await definirClubeAtivo({
          id: clube.id,
          nome: clube.nome,
          escudo: clube.escudo,
          papel: clube.papel,
        });
        if (modo === "trocar") router.navigate("/(tabs)");
        else router.replace("/(tabs)");
      } catch {
        setErro("Não foi possível acessar o clube. Tente novamente.");
      } finally {
        operando.current = false;
        setProcessandoId(null);
      }
    },
    [definirClubeAtivo, modo, router],
  );
  const acompanhar = useCallback(
    async (clube: ClubeListado, seguir: boolean) => {
      if (operando.current || (clube.papel && clube.papel !== "TORCEDOR"))
        return;
      operando.current = true;
      setProcessandoId(clube.id);
      setErro("");
      try {
        const vinculo = seguir
          ? await seguirClube(clube.id)
          : await deixarDeSeguirClube(clube.id);
        const papel =
          seguir && "papel" in vinculo ? (vinculo.papel as PapelClube) : null;
        if (seguir) await upsertClubeNoCacheLocal(clube, papel || "TORCEDOR");
        else await removerClubeDoCacheLocal(clube.id);
        if (atual.current?.id === clube.id)
          await definirClubeAtivo({ ...atual.current, papel });
        setClubes((lista) =>
          lista.map((c) =>
            c.id === clube.id
              ? {
                  ...c,
                  papel,
                  isSeguindo: seguir,
                  seguidores:
                    vinculo.seguidores ??
                    Math.max(0, c.seguidores + (seguir ? 1 : -1)),
                }
              : c,
          ),
        );
      } catch (e) {
        setErro((e as Error).message || "Não foi possível atualizar o clube.");
      } finally {
        operando.current = false;
        setProcessandoId(null);
      }
    },
    [definirClubeAtivo],
  );
  const secoes = useMemo(
    () =>
      carregando
        ? []
        : [
            ...(!grupos.buscaAtiva && grupos.comCargo.length
              ? [{ key: "cargo", titulo: "COM CARGO", data: grupos.comCargo }]
              : []),
            ...(!grupos.buscaAtiva && grupos.seguindo.length
              ? [
                  {
                    key: "seguindo",
                    titulo: "QUE VOCÊ SEGUE",
                    data: grupos.seguindo,
                  },
                ]
              : []),
            { key: "descobrir", titulo: "DESCOBRIR", data: grupos.descobrir },
          ],
    [grupos, carregando],
  );
  return (
    <View style={styles.container}>
      {modo === "trocar" && <HeaderClube />}
      <SectionList
        sections={secoes}
        keyExtractor={(clube) => String(clube.id)}
        stickySectionHeadersEnabled={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.conteudo,
          { gap: 0 },
          modo === "entrada" && {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        ListHeaderComponent={
          <>
            <View style={[styles.intro, { marginBottom: 28 }]}>
              <Text style={styles.tituloMain}>Encontre o seu clube</Text>
              <Text style={styles.subtituloMain}>
                Acesse qualquer clube. Seguir serve para deixar seus favoritos
                salvos aqui.
              </Text>
            </View>
            {!!erro && (
              <ErroCarregamento
                compacto={clubes.length > 0}
                titulo="Não foi possível atualizar clubes"
                descricao={
                  clubes.length
                    ? "Os clubes já exibidos continuam disponíveis."
                    : "Confira sua conexão e tente novamente."
                }
                onTentarNovamente={() => void carregar()}
              />
            )}
            {carregando && <ListSkeleton rows={4} inset={0} />}
          </>
        }
        renderItem={({ item, section }) => (
          <View style={{ marginBottom: 10 }}>
            <CartaoClube
              clube={item}
              descoberta={section.key === "descobrir"}
              atual={item.id === clubeAtivo?.id}
              desabilitado={processandoId !== null}
              processando={processandoId === item.id}
              onAcessar={acessar}
              onAcompanhar={acompanhar}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.secao,
              { marginTop: section === secoes[0] ? 0 : 18, marginBottom: 16 },
            ]}
          >
            <View style={styles.secaoHeading}>
              <Text style={styles.secaoTitulo}>{section.titulo}</Text>
              {section.key !== "descobrir" && (
                <Text style={styles.quantidade}>{section.data.length}</Text>
              )}
            </View>
            {section.key === "descobrir" && (
              <>
                <SearchField
                  value={busca}
                  onChangeText={setBusca}
                  containerStyle={{ flex: 0 }}
                  placeholder="Buscar clube por nome ou cidade..."
                  accessibilityLabel="Buscar clube por nome ou cidade"
                />
                {grupos.buscaAtiva && (
                  <Text
                    style={styles.detalhes}
                    accessibilityLiveRegion="polite"
                  >
                    {grupos.descobrir.length}{" "}
                    {grupos.descobrir.length === 1
                      ? "clube encontrado"
                      : "clubes encontrados"}
                  </Text>
                )}
              </>
            )}
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.key === "descobrir" && !section.data.length && !erro ? (
            <View style={styles.vazio}>
              <Icon
                name="shield-half"
                size={24}
                color={colors.textoSecundario}
              />
              <Text style={styles.vazioText}>
                {!clubes.length
                  ? "Ainda não há clubes cadastrados no Ludora."
                  : grupos.buscaAtiva
                    ? "Nenhum clube encontrado. Tente outro nome ou cidade."
                    : "Você já acompanha todos os clubes disponíveis. Novos clubes aparecerão aqui."}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
