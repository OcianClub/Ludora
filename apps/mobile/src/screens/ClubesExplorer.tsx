// Caminho sugerido: src/screens/ClubesExplorer.tsx
//
// Componente compartilhado entre:
//  - app/clubes/index.tsx        (tela pós-login, fora das tabs, "modo=entrada")
//  - app/(tabs)/clubes/clubes.tsx (aba "Clubes" dentro do app, "modo=trocar")
//
// Ele busca a lista real de clubes no backend (GET /clubes), separa em
// "Seus clubes" (que o usuário já segue) e "Descobrir clubes" (os demais),
// permite seguir/deixar de seguir, e ao "acessar" um clube grava o
// clube ativo no SecureStore e navega para (tabs) — de onde tudo (Header,
// Home, estatísticas etc.) passa a ler dinamicamente.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@ludora/design-tokens';
import { styles } from '@/src/styles/clubesStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Header } from '@/src/components/Header';
import {
  fetchClubes,
  seguirClube,
  deixarDeSeguirClube,
  ClubeListado,
} from '@/src/services/api';

// ==========================================
// HELPERS DE CACHE LOCAL (userData no SecureStore)
// ==========================================
// O app guarda uma cópia de "meus clubes" em SecureStore (userData.clubes)
// pra montar telas rápido sem depender de rede. Precisamos manter esse
// cache em sincronia sempre que seguir/deixar de seguir um clube por aqui.

async function upsertClubeNoCacheLocal(clube: ClubeListado, papel: string) {
  try {
    const raw = await SecureStore.getItemAsync('userData');
    const userData = raw ? JSON.parse(raw) : { clubes: [] };
    const clubesCache: any[] = Array.isArray(userData.clubes) ? userData.clubes : [];
    const idx = clubesCache.findIndex((c) => String(c.clube_id) === String(clube.id));
    const entrada = { clube_id: clube.id, nome: clube.nome, escudo: clube.escudo, papel };
    if (idx >= 0) clubesCache[idx] = entrada;
    else clubesCache.push(entrada);
    await SecureStore.setItemAsync('userData', JSON.stringify({ ...userData, clubes: clubesCache }));
  } catch (e) {
    console.error('Erro ao atualizar cache local de clubes:', e);
  }
}

async function removerClubeDoCacheLocal(clubeId: number) {
  try {
    const raw = await SecureStore.getItemAsync('userData');
    if (!raw) return;
    const userData = JSON.parse(raw);
    const clubesCache: any[] = Array.isArray(userData.clubes) ? userData.clubes : [];
    const filtrados = clubesCache.filter((c) => String(c.clube_id) !== String(clubeId));
    await SecureStore.setItemAsync('userData', JSON.stringify({ ...userData, clubes: filtrados }));
  } catch (e) {
    console.error('Erro ao remover clube do cache local:', e);
  }
}

// ==========================================
// COMPONENTE
// ==========================================

interface ClubesExplorerProps {
  // 'entrada' = primeira tela pós-login (fora das tabs, ainda sem clube ativo)
  // 'trocar'  = aba "Clubes" dentro do app (já existe um clube ativo)
  modo: 'entrada' | 'trocar';
}

// Espaçamento "de respiro" usado no lugar do Header quando a tela é
// acessada em modo "entrada" (sem Header, sem navbar). O headerContainer
// (clubesStyles.ts) não tem paddingTop nenhum, porque normalmente é o
// próprio Header quem cuida da safe area + respiro do topo (ver
// Header.tsx: paddingTop = insets.top + 20). Sem Header, replicamos o
// mesmo cálculo aqui pra manter a mesma distância visual do topo nos
// dois casos.
const ESPACO_TOPO_SEM_HEADER = 20;

export default function ClubesExplorer({ modo }: ClubesExplorerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [busca, setBusca] = useState('');
  const [clubes, setClubes] = useState<ClubeListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  const [clubeAtivoId, setClubeAtivoId] = useState<string | null>(null);
  const [nomeClubeAtivo, setNomeClubeAtivo] = useState(
    modo === 'trocar' ? 'CLUBES' : 'ESCOLHA SEU CLUBE'
  );
  const [escudoClubeAtivo, setEscudoClubeAtivo] = useState<string | null>(null);

  const carregarClubes = useCallback(async (termo?: string) => {
    try {
      setErro('');
      const lista = await fetchClubes(termo);
      setClubes(lista);
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar clubes');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Recarrega sempre que a tela ganha foco (ex: voltar de "seguir")
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        setCarregando(true);
        if (modo === 'trocar') {
          const nomeAtivo = await SecureStore.getItemAsync('clubeAtivoNome');
          const escudoAtivo = await SecureStore.getItemAsync('clubeAtivoEscudo');
          if (ativo && nomeAtivo) setNomeClubeAtivo(nomeAtivo);
          if (ativo && escudoAtivo) setEscudoClubeAtivo(escudoAtivo);
        }
        const idAtivo = await SecureStore.getItemAsync('clubeAtivoId');
        if (ativo) setClubeAtivoId(idAtivo);
        await carregarClubes();
      })();
      return () => {
        ativo = false;
      };
    }, [modo, carregarClubes])
  );

  // Busca com um pequeno debounce pra não disparar request a cada letra
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarClubes(busca.trim() || undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [busca, carregarClubes]);

  const meusClubes = clubes.filter((c) => c.isSeguindo);
  const outrosClubes = clubes.filter((c) => !c.isSeguindo);

  const acessarClube = async (clube: ClubeListado) => {
    await SecureStore.setItemAsync('clubeAtivoId', String(clube.id));
    await SecureStore.setItemAsync('clubeAtivoNome', clube.nome || 'MEU CLUBE');
    await SecureStore.setItemAsync('clubeAtivoEscudo', clube.escudo || '');
    // Papel é por clube (ADMIN/MESARIO/TECNICO/TORCEDOR). Telas de gestão
    // (jogos, organizar partida, detalhes da partida) leem essa chave pra
    // decidir o que mostrar — em vez do antigo "userRole" global, que não
    // fazia sentido agora que o mesmo usuário pode ter papéis diferentes
    // em clubes diferentes.
    await SecureStore.setItemAsync('clubeAtivoPapel', clube.papel || '');
    router.replace('/(tabs)');
  };

  // Só segue (sem navegar) — usado pelo botão "SEGUIR"
  const handleSeguir = async (clube: ClubeListado) => {
    setProcessandoId(clube.id);
    try {
      const vinculo = await seguirClube(clube.id);
      await upsertClubeNoCacheLocal(clube, vinculo.papel);
      setClubes((prev) =>
        prev.map((c) =>
          c.id === clube.id
            ? { ...c, isSeguindo: true, papel: vinculo.papel as any, seguidores: c.seguidores + 1 }
            : c
        )
      );
    } catch (e: any) {
      setErro(e.message || 'Erro ao seguir clube');
    } finally {
      setProcessandoId(null);
    }
  };

  // Botão "DEIXAR DE SEGUIR" (só aparece pra vínculos TORCEDOR)
  const handleDeixarDeSeguir = async (clube: ClubeListado) => {
    setProcessandoId(clube.id);
    try {
      await deixarDeSeguirClube(clube.id);
      await removerClubeDoCacheLocal(clube.id);
      setClubes((prev) =>
        prev.map((c) =>
          c.id === clube.id
            ? { ...c, isSeguindo: false, papel: null, seguidores: Math.max(0, c.seguidores - 1) }
            : c
        )
      );
      if (clubeAtivoId === String(clube.id)) {
        await SecureStore.deleteItemAsync('clubeAtivoId');
        await SecureStore.deleteItemAsync('clubeAtivoNome');
        await SecureStore.deleteItemAsync('clubeAtivoEscudo');
        await SecureStore.deleteItemAsync('clubeAtivoPapel');
        setClubeAtivoId(null);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao deixar de seguir clube');
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <View style={styles.container}>
      {modo === 'trocar' ? (
        <Header
          title={nomeClubeAtivo}
          logoUrl={escudoClubeAtivo}
          btnNotificacao="bell"
          showLogo={true}
          showProfile={true}
        />
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.headerContainer,
            // Quando não existe Header acima (modo "entrada"), a tela fica
            // colada na status bar/notch. Compensamos somando a safe area
            // do dispositivo ao espaçamento que já existe no style. Quando
            // existe Header, ele já cuida da safe area, então não
            // duplicamos o espaço aqui.
            modo === 'entrada' && { paddingTop: insets.top + ESPACO_TOPO_SEM_HEADER },
          ]}
        >
          <Text style={styles.tituloMain}>
            {modo === 'entrada' ? 'Escolha o seu clube' : 'Encontre o seu clube'}
          </Text>
          <Text style={styles.subtituloMain}>
            {modo === 'entrada'
              ? 'Toque em um clube pra acessar. Seguir é opcional, só pra deixar ele salvo aqui.'
              : 'Toque em um clube pra acessar, ou siga os que você quer acompanhar de perto.'}
          </Text>
        </View>

        {erro !== '' && (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ color: '#D64545', fontFamily: 'Creato-Medium' }}>{erro}</Text>
          </View>
        )}

        {/* Busca */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textoSecundario} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar clube por nome..."
              placeholderTextColor={colors.textoSecundario}
              value={busca}
              onChangeText={setBusca}
            />
          </View>
        </View>

        {carregando ? (
          <ActivityIndicator size="large" color="#0E78FF" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Seus clubes */}
            {meusClubes.length > 0 && (
              <View style={styles.seusClubesContainer}>
                <Text style={styles.sectionTitle}>SEUS CLUBES</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seusClubesScroll}
                >
                  {meusClubes.map((clube) => (
                    <TouchableOpacity
                      key={clube.id}
                      style={styles.clubeAtalhoContainer}
                      onPress={() => acessarClube(clube)}
                      disabled={processandoId === clube.id}
                    >
                      <Image
                        source={clube.escudo ? { uri: clube.escudo } : require('@/assets/images/SóPreto.png')}
                        style={styles.clubeAtalhoLogo}
                      />
                      <Text style={styles.clubeAtalhoNome} numberOfLines={1}>
                        {clube.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Descobrir clubes */}
            <View style={styles.listaContainer}>
              <View style={styles.locationHeader}>
                <MaterialCommunityIcons name="shield-search" size={16} color={colors.textoSecundario} />
                <Text style={styles.locationText}>
                  {meusClubes.length > 0 ? 'DESCOBRIR CLUBES' : 'TODOS OS CLUBES'}
                </Text>
              </View>

              {outrosClubes.length === 0 && !carregando && (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ fontFamily: 'Creato-Medium', color: '#666' }}>
                    {busca ? 'Nenhum clube encontrado.' : 'Você já segue todos os clubes cadastrados.'}
                  </Text>
                </View>
              )}

              {outrosClubes.map((clube) => (
                <TouchableOpacity
                  key={clube.id}
                  style={styles.clubeCard}
                  activeOpacity={0.8}
                  onPress={() => acessarClube(clube)}
                  disabled={processandoId === clube.id}
                >
                  <Image
                    source={clube.escudo ? { uri: clube.escudo } : require('@/assets/images/SóPreto.png')}
                    style={styles.clubeCardLogo}
                  />

                  <View style={styles.clubeCardInfo}>
                    <View style={styles.clubeCardNomeRow}>
                      <Text style={styles.clubeCardNome} numberOfLines={1}>
                        {clube.nome}
                      </Text>
                    </View>
                    <Text style={styles.clubeCardSub}>
                      {[clube.cidade, clube.estado].filter(Boolean).join(' - ') || 'Local não informado'}
                      {'   '}
                      {clube.seguidores} seguidores
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.btnSeguir}
                    activeOpacity={0.7}
                    onPress={() => handleSeguir(clube)}
                    disabled={processandoId === clube.id}
                  >
                    {processandoId === clube.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.txtBtnSeguir}>SEGUIR</Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>

            {/* Clubes que já sigo, com opção de deixar de seguir (só quando modo=trocar) */}
            {modo === 'trocar' && meusClubes.length > 0 && (
              <View style={[styles.listaContainer, { marginTop: 8 }]}>
                <View style={styles.locationHeader}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.textoSecundario} />
                  <Text style={styles.locationText}>GERENCIAR CLUBES SEGUIDOS</Text>
                </View>

                {meusClubes.map((clube) => (
                  <TouchableOpacity
                    key={clube.id}
                    style={styles.clubeCard}
                    activeOpacity={0.8}
                    onPress={() => acessarClube(clube)}
                    disabled={processandoId === clube.id}
                  >
                    <Image
                      source={clube.escudo ? { uri: clube.escudo } : require('@/assets/images/SóPreto.png')}
                      style={styles.clubeCardLogo}
                    />

                    <View style={styles.clubeCardInfo}>
                      <View style={styles.clubeCardNomeRow}>
                        <Text style={styles.clubeCardNome} numberOfLines={1}>
                          {clube.nome}
                        </Text>
                        {String(clube.id) === clubeAtivoId && (
                          <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primaria} />
                        )}
                        {clube.papel && clube.papel !== 'TORCEDOR' && (
                          <View style={styles.badgeTecnico}>
                            <Text style={styles.badgeTecnicoTxt}>{clube.papel}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.clubeCardSub}>{clube.seguidores} seguidores</Text>
                    </View>

                    {clube.papel === 'TORCEDOR' && (
                      <TouchableOpacity
                        style={[styles.btnSeguir, styles.btnSeguindo]}
                        activeOpacity={0.7}
                        onPress={() => handleDeixarDeSeguir(clube)}
                        disabled={processandoId === clube.id}
                      >
                        {processandoId === clube.id ? (
                          <ActivityIndicator size="small" color={colors.primaria} />
                        ) : (
                          <Text style={[styles.txtBtnSeguir, styles.txtBtnSeguindo]}>SEGUINDO</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}