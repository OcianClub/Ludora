import React, { useState, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity,
  ScrollView, TextInput, Modal
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';

import { obterPerfisJogadores, Jogador, ScoresMl } from '@/src/services/mlService';
import { Header } from '@/src/components/Header';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import { colors } from '@/src/theme/colors';
import { styles } from '@/src/styles/estatisticasStyles'; 

// ── Cores por perfil ──────────────────────────────────────────────────────────
const COR_PERFIL: Record<string, string> = {
  'Artilheiro': colors.vermelho,
  'Paredão':    colors.azulClaro,
  'Armador':    colors.amarelo,
  'Sem dados':  '#555',
};

// ── Hexágono SVG ─────────────────────────────────────────────────────────────
interface HexProps { scores: ScoresMl; size?: number; }

function HexagonoScout({ scores, size = 140 }: HexProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.32; 

  const eixos = [
    { label: 'FINALIZAÇÃO', key: 'finalizacao'   },
    { label: 'VISÃO',       key: 'visao_de_jogo' },
    { label: 'DEFESA',      key: 'defesa'         },
    { label: 'DISCIPLINA',  key: 'disciplina'     },
    { label: 'INTENSIDADE', key: 'intensidade'    },
    { label: 'TÉCNICA',     key: 'tecnica'        },
  ];

  const angulo = (i: number) => (Math.PI / 2) + (2 * Math.PI * i) / 6;

  const pontoBase = (i: number, r: number) => ({
    x: cx + r * Math.cos(angulo(i)),
    y: cy - r * Math.sin(angulo(i)),
  });

  const pontoValor = (i: number) => {
    const val = (scores[eixos[i].key as keyof ScoresMl] ?? 0) / 100;
    return pontoBase(i, R * val);
  };

  const gridPoly = (frac: number) =>
    eixos.map((_, i) => {
      const p = pontoBase(i, R * frac);
      return `${p.x},${p.y}`;
    }).join(' ');

  const valorPoly = eixos.map((_, i) => {
    const p = pontoValor(i);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <View style={{ alignItems: 'center', width: size, height: size }}>
      <HexSVG
        cx={cx} cy={cy} R={R}
        eixos={eixos} angulo={angulo}
        pontoBase={pontoBase} gridPoly={gridPoly}
        valorPoly={valorPoly} size={size}
      />
    </View>
  );
}

function HexSVG({ cx, cy, R, eixos, pontoBase, gridPoly, valorPoly, size }: any) {
  return (
    <Svg width={size} height={size}>
      {[0.33, 0.66, 1].map((frac, idx) => (
        <Polygon
          key={`grid-${idx}`}
          points={gridPoly(frac)}
          fill="none"
          stroke={frac === 1 ? '#3a3a3a' : '#2a2a2a'}
          strokeWidth={frac === 1 ? 1.5 : 1}
        />
      ))}

      {eixos.map((_: any, i: number) => {
        const p = pontoBase(i, R);
        return (
          <Line
            key={`line-${i}`}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke="#2a2a2a"
            strokeWidth={1}
          />
        );
      })}

      <Polygon
        points={valorPoly}
        fill={colors.primary + '40'}
        stroke={colors.primary}
        strokeWidth={2}
      />

      {eixos.map((eixo: any, i: number) => {
        const p = pontoBase(i, R + 20); 
        return (
          <SvgText
            key={`text-${i}`}
            x={p.x}
            y={p.y + 3} 
            fill={colors.text_secondary}
            fontSize="9"
            fontWeight="bold"
            fontFamily="Creato-Bold"
            textAnchor="middle"
          >
            {eixo.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Card da Lista ─────────────────────────────────────────────────────────────
function CardJogador({ jogador, onPress }: { jogador: Jogador; onPress: () => void }) {
  const corPerfil = COR_PERFIL[jogador.perfil_ml] ?? '#555';
  const idade = jogador.dtNasc
    ? new Date().getFullYear() - new Date(jogador.dtNasc).getFullYear()
    : null;

  return (
    <TouchableOpacity style={styles.cardJogador} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardNumCamisa, { borderColor: corPerfil }]}>
        <Text style={[styles.cardNumCamisaTxt, { color: corPerfil }]}>
          {jogador.numCamisa ? `#${jogador.numCamisa}` : '—'}
        </Text>
      </View>

      <View style={styles.cardInfos}>
        <Text style={styles.cardNome} numberOfLines={1}>{jogador.nome}</Text>
        <Text style={styles.cardSub}>
          {jogador.posicao}
          {idade ? ` • ${idade} anos` : ''}
        </Text>
      </View>

      <View style={styles.cardDireita}>
        <View style={[styles.cardBadgePerfil, { backgroundColor: corPerfil + '22', borderColor: corPerfil }]}>
          <Text style={[styles.cardBadgePerfilTxt, { color: corPerfil }]}>
            {jogador.perfil_ml}
          </Text>
        </View>
        <Text style={styles.cardNota}>
          {jogador.nota_geral > 0 ? jogador.nota_geral.toFixed(0) : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Modal de Scout ────────────────────────────────────────────────────────────
function ModalScout({ jogador, onFechar }: { jogador: Jogador; onFechar: () => void }) {
  const corPerfil = COR_PERFIL[jogador.perfil_ml] ?? '#555';
  const idade = jogador.dtNasc
    ? new Date().getFullYear() - new Date(jogador.dtNasc).getFullYear()
    : null;

  const stats = [
    { label: 'Jogos',      valor: jogador.jogos_disputados,  icone: 'soccer-field'       },
    { label: 'Gols',       valor: jogador.gols,              icone: 'soccer'             },
    { label: 'Assist.',    valor: jogador.assistencias,      icone: 'handshake'          },
    { label: 'Defesas',    valor: jogador.defesas,           icone: 'shield-check'       }, 
    { label: 'Faltas',     valor: jogador.faltas_cometidas,  icone: 'whistle'            },
    { label: 'Amarelos',   valor: jogador.cartoes_amarelos,  icone: 'card'               },
    { label: 'Vermelhos',  valor: jogador.cartoes_vermelhos, icone: 'card'               },
  ];

  const eficienciaGol = jogador.jogos_disputados > 0
    ? (jogador.gols / jogador.jogos_disputados).toFixed(2)
    : '0.00';
  const eficienciaAssist = jogador.jogos_disputados > 0
    ? (jogador.assistencias / jogador.jogos_disputados).toFixed(2)
    : '0.00';

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onFechar}>
      <View style={styles.scoutContainer}>
        <View style={styles.scoutHeader}>
          <TouchableOpacity onPress={onFechar} style={styles.scoutBtnVoltar}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.scoutHeaderTitulo}>FICHA DO ATLETA</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scoutContent}>
          <View style={[styles.scoutIdentidade, { borderColor: corPerfil }]}>
            <View style={[styles.scoutAvatarNum, { backgroundColor: corPerfil + '22', borderColor: corPerfil }]}>
              <Text style={[styles.scoutAvatarNumTxt, { color: corPerfil }]}>
                {jogador.numCamisa ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoutNome} numberOfLines={1}>{jogador.nome}</Text>
              <Text style={styles.scoutPosicao}>{jogador.posicao}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={[styles.scoutChip, { backgroundColor: corPerfil + '22', borderColor: corPerfil }]}>
                  <Text style={[styles.scoutChipTxt, { color: corPerfil }]}>{jogador.perfil_ml}</Text>
                </View>
                <View style={styles.scoutChip}>
                  <Text style={styles.scoutChipTxt}>{jogador.categoria}</Text>
                </View>
                {idade && (
                  <View style={styles.scoutChip}>
                    <Text style={styles.scoutChipTxt}>{idade} anos</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.scoutNotaContainer}>
              <Text style={styles.scoutNotaLabel}>NOTA</Text>
              <Text style={[styles.scoutNota, { color: corPerfil }]}>
                {jogador.nota_geral > 0 ? jogador.nota_geral.toFixed(0) : '—'}
              </Text>
            </View>
          </View>

          {/* Hexágono & Barras */}
          {jogador.scores_ml ? (
            <View style={styles.scoutHexContainer}>
              <Text style={styles.scoutSecaoLabel}>RADAR DO ATLETA</Text>
              <HexagonoScout scores={jogador.scores_ml} size={220} />

              <View style={styles.scoutScoresGrid}>
                {Object.entries(jogador.scores_ml).map(([key, val]) => (
                  <View key={key} style={styles.scoutScoreItem}>
                    <Text style={styles.scoutScoreLabel} numberOfLines={1}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <View style={styles.scoutScoreBarBg}>
                      <View style={[styles.scoutScoreBar, { width: `${val}%`, backgroundColor: corPerfil }]} />
                    </View>
                    <Text style={[styles.scoutScoreVal, { color: corPerfil }]}>{val.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.scoutSemDados}>
              <MaterialCommunityIcons name="chart-arc" size={40} color="#333" />
              <Text style={styles.scoutSemDadosTxt}>
                Radar disponível após o primeiro jogo registrado
              </Text>
            </View>
          )}

          <Text style={styles.scoutSecaoLabel}>ESTATÍSTICAS</Text>
          <View style={styles.scoutStatsGrid}>
            {stats.map(s => (
              <View key={s.label} style={styles.scoutStatCard}>
                <MaterialCommunityIcons name={s.icone as any} size={22} color={corPerfil} style={{ opacity: 0.8 }} />
                <Text style={styles.scoutStatValor}>{s.valor}</Text>
                <Text style={styles.scoutStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.scoutSecaoLabel}>EFICIÊNCIA POR JOGO</Text>
          <View style={styles.scoutEficienciaRow}>
            <View style={styles.scoutEficienciaCard}>
              <MaterialCommunityIcons name="soccer" size={24} color={colors.vermelho} />
              <Text style={styles.scoutEficienciaValor}>{eficienciaGol}</Text>
              <Text style={styles.scoutEficienciaLabel}>Gols/Jogo</Text>
            </View>
            <View style={styles.scoutEficienciaCard}>
              <MaterialCommunityIcons name="handshake" size={24} color={colors.azulClaro} />
              <Text style={styles.scoutEficienciaValor}>{eficienciaAssist}</Text>
              <Text style={styles.scoutEficienciaLabel}>Assist./Jogo</Text>
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const normalizarCategoria = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().replace(/\s+/g, '-');

// ── Tela Principal ────────────────────────────────────────────────────────────
export default function Estatisticas() {
  const [jogadores, setJogadores]       = useState<Jogador[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState<string | null>(null);
  const [busca, setBusca]               = useState('');
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(null);

  const [subIndex, setSubIndex]     = useState(0);
  const [tipoAtivo, setTipoAtivo]   = useState<'INICIACAO' | 'BASE'>('INICIACAO');

  const subsAtivos = tipoAtivo === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  const categoriaAtual = subsAtivos[subIndex]?.title ?? '';

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const todos = await obterPerfisJogadores();
      setJogadores(todos);
      if (todos.length > 0) {
        const primeiro = todos[0];
        if (primeiro.categoria_tipo) setTipoAtivo(primeiro.categoria_tipo);

        const subsDoTipo = primeiro.categoria_tipo === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
        
        const idxSub = subsDoTipo.findIndex(s =>
          normalizarCategoria(s.title) === normalizarCategoria(primeiro.categoria)
        );
        
        if (idxSub >= 0) setSubIndex(idxSub);
      }
    } catch (e: any) {
      setErro(e?.message ?? 'Erro na conexão');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregarDados(); }, [carregarDados]));

  const jogadoresFiltrados = jogadores.filter(j => {
    const matchCategoria = normalizarCategoria(j.categoria) === normalizarCategoria(categoriaAtual);
    const matchTipo      = (j.categoria_tipo ?? '') === tipoAtivo;
    const matchBusca     = busca === '' ||
      (j.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      (j.posicao ?? '').toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchTipo && matchBusca;
  });

  return (
    <View style={styles.container}>
      <Header title="SCOUT" btnNotificacao="bell" showLogo={false} showProfile={true} />

      <CarrosselSubs
        tipoFiltro={tipoAtivo}
        onTrocarTipo={setTipoAtivo}
        indexAtual={subIndex}
        onChangeIndex={setSubIndex}
      />

      <View style={styles.buscaContainer}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.text_secondary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar atleta..."
          placeholderTextColor={colors.text_secondary}
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <MaterialCommunityIcons name="close" size={16} color={colors.text_secondary} />
          </TouchableOpacity>
        )}
      </View>

      {carregando ? (
        <View style={styles.centralizado}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.txtCarregando}>Calculando perfis...</Text>
        </View>
      ) : erro ? (
        <View style={styles.centralizado}>
          <MaterialCommunityIcons name="wifi-off" size={48} color="#333" />
          <Text style={styles.txtErro}>{erro}</Text>
          <TouchableOpacity style={styles.btnRetry} onPress={carregarDados}>
            <Text style={styles.txtBtnRetry}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : jogadoresFiltrados.length === 0 ? (
        <View style={styles.centralizado}>
          <MaterialCommunityIcons name="account-off-outline" size={48} color="#333" />
          <Text style={styles.txtErro}>Nenhum atleta encontrado</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listaContent}>
          {jogadoresFiltrados.map(j => (
            <CardJogador
              key={j.id_jogador}
              jogador={j}
              onPress={() => setJogadorSelecionado(j)}
            />
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {jogadorSelecionado && (
        <ModalScout
          jogador={jogadorSelecionado}
          onFechar={() => setJogadorSelecionado(null)}
        />
      )}
    </View>
  );
}