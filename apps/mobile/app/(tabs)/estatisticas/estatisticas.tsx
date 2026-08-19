import { Icon } from '@ludora/icons';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ActivityIndicator, TouchableOpacity,
  ScrollView, TextInput, Modal
} from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';

import { calcularResumo, obterPerfisJogadores, Jogador, ScoresMl } from '@/src/services/mlService';
import { Header } from '@/src/components/Header';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import { colors } from '@ludora/design-tokens';
import { styles } from '@/src/styles/estatisticasStyles'; 
import { CardsSkeleton } from '@/src/components/Skeleton';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';

// ── Cores por perfil ──────────────────────────────────────────────────────────
const COR_PERFIL: Record<string, string> = {
  'Artilheiro': colors.vermelhoDestaque,
  'Paredão':    colors.primaria,
  'Armador':    colors.amarelo,
  'Sem dados':  colors.textoSecundario,
};

const DESCRICAO_PERFIL: Record<string, string> = {
  Artilheiro: 'Perfil associado ao grupo com maior índice médio de finalização.',
  Paredão: 'Perfil associado ao grupo com maior índice médio de defesas.',
  Armador: 'Perfil geralmente associado à visão de jogo e à criação de jogadas.',
  'Sem dados': 'Aguardando partidas suficientes para identificar o perfil.',
};

type Ordenacao = 'NOTA' | 'GOLS' | 'ASSISTENCIAS';

const OPCOES_ORDENACAO: { label: string; value: Ordenacao }[] = [
  { label: 'Índice', value: 'NOTA' },
  { label: 'Gols', value: 'GOLS' },
  { label: 'Assistências', value: 'ASSISTENCIAS' },
];

function notaExibida(nota: number): string {
  if (!nota || nota <= 0) return '—';
  return Math.round(nota).toString();
}

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
          stroke={frac === 1 ? colors.borda : colors.linha}
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
            stroke={colors.linha}
            strokeWidth={1}
          />
        );
      })}

      <Polygon
        points={valorPoly}
        fill={colors.primaria + '33'}
        stroke={colors.primaria}
        strokeWidth={2}
      />

      {eixos.map((eixo: any, i: number) => {
        const p = pontoBase(i, R + 20); 
        return (
          <SvgText
            key={`text-${i}`}
            x={p.x}
            y={p.y + 3} 
            fill={colors.textoSecundario}
            fontSize="9"
            fontWeight="bold"
            fontFamily="Inter_600SemiBold"
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
  const corPerfil = COR_PERFIL[jogador.perfil_ml] ?? colors.textoSecundario;
  const idade = jogador.idade ?? null;

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
        <Text style={styles.cardNotaLabel}>NOTA</Text>
        <Text style={styles.cardNota}>
          {notaExibida(jogador.nota_geral)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Modal de Scout ────────────────────────────────────────────────────────────
function ModalScout({ jogador, onFechar }: { jogador: Jogador; onFechar: () => void }) {
  const corPerfil = COR_PERFIL[jogador.perfil_ml] ?? colors.textoSecundario;
  const idade = jogador.idade ?? null;

  const stats = [
    { label: 'Jogos',      valor: jogador.jogos_disputados,  icone: 'soccer-field'       },
    { label: 'Gols',       valor: jogador.gols,              icone: 'soccer'             },
    { label: 'Assist.',    valor: jogador.assistencias,      icone: 'handshake'          },
    { label: 'Defesas',    valor: jogador.defesas,           icone: 'shield-check'       }, 
    { label: 'Faltas',     valor: jogador.faltas_cometidas,  icone: 'whistle'            },
    { label: 'Amarelos',   valor: jogador.cartoes_amarelos,  icone: 'card'               },
    { label: 'Vermelhos',  valor: jogador.cartoes_vermelhos, icone: 'card'               },
  ] as const;

  const eficienciaGol = jogador.jogos_disputados > 0
    ? (jogador.gols / jogador.jogos_disputados).toFixed(2)
    : '0.00';
  const eficienciaAssist = jogador.jogos_disputados > 0
    ? (jogador.assistencias / jogador.jogos_disputados).toFixed(2)
    : '0.00';

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onFechar}>
      <View style={styles.scoutContainer}>
        <Header
          title="FICHA DO ATLETA"
          btnVoltar="arrow-left"
          showLogo={false}
          showProfile={false}
          onBtnVoltar={onFechar}
        />

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
                <View style={styles.scoutChip}>
                  <Text style={styles.scoutChipTxt}>
                    {jogador.jogos_disputados} {jogador.jogos_disputados === 1 ? 'jogo' : 'jogos'}
                  </Text>
                </View>
                {idade && (
                  <View style={styles.scoutChip}>
                    <Text style={styles.scoutChipTxt}>{idade} anos</Text>
                  </View>
                )}
              </View>
              <Text style={styles.scoutPerfilDescricao} numberOfLines={2}>
                {DESCRICAO_PERFIL[jogador.perfil_ml] ?? DESCRICAO_PERFIL['Sem dados']}
              </Text>
            </View>
            <View style={styles.scoutNotaContainer}>
              <Text style={styles.scoutNotaLabel}>NOTA</Text>
              <Text style={[styles.scoutNota, { color: corPerfil }]}>
                {notaExibida(jogador.nota_geral)}
              </Text>
            </View>
          </View>

          {/* Hexágono & Barras */}
          {jogador.scores_ml ? (
            <View style={styles.scoutHexContainer}>
              <Text style={styles.scoutSecaoLabel}>ÍNDICES COMPARATIVOS</Text>
              <HexagonoScout scores={jogador.scores_ml} size={220} />
              <Text style={styles.scoutRadarNota}>
                Escala relativa aos atletas analisados. 100 representa o maior valor observado no conjunto atual.
              </Text>

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
              <Icon name="chart-arc" size={40} color={colors.borda} />
              <Text style={styles.scoutSemDadosTxt}>
                Radar disponível após o primeiro jogo registrado
              </Text>
            </View>
          )}

          <Text style={styles.scoutSecaoLabel}>ESTATÍSTICAS</Text>
          <View style={styles.scoutStatsGrid}>
            {stats.map(s => (
              <View key={s.label} style={styles.scoutStatCard}>
                <Icon name={s.icone} size={22} color={corPerfil} style={{ opacity: 0.8 }} />
                <Text style={styles.scoutStatValor}>{s.valor}</Text>
                <Text style={styles.scoutStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.scoutSecaoLabel}>EFICIÊNCIA POR JOGO</Text>
          <View style={styles.scoutEficienciaRow}>
            <View style={styles.scoutEficienciaCard}>
              <Icon name="soccer" size={24} color={colors.vermelhoDestaque} />
              <Text style={styles.scoutEficienciaValor}>{eficienciaGol}</Text>
              <Text style={styles.scoutEficienciaLabel}>Gols/Jogo</Text>
            </View>
            <View style={styles.scoutEficienciaCard}>
              <Icon name="handshake" size={24} color={colors.primaria} />
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
  const { clubeAtivo, podeGerenciar, carregandoClubeAtivo } = useClubeAtivo();
  const carregouUmaVez = useRef(false);
  const [jogadores, setJogadores]       = useState<Jogador[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState<string | null>(null);
  const [busca, setBusca]               = useState('');
  const [ordenacao, setOrdenacao]       = useState<Ordenacao>('NOTA');
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(null);

  const [subIndex, setSubIndex]     = useState(0);
  const [tipoAtivo, setTipoAtivo]   = useState<'INICIACAO' | 'BASE'>('INICIACAO');

  const subsAtivos = tipoAtivo === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  const categoriaAtual = subsAtivos[subIndex]?.title ?? '';

  const carregarDados = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
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
      carregouUmaVez.current = true;
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (carregandoClubeAtivo || !podeGerenciar) return;
    carregarDados(carregouUmaVez.current);
  }, [carregarDados, carregandoClubeAtivo, podeGerenciar]));

  const jogadoresDaCategoria = jogadores.filter(j => {
    const matchCategoria = normalizarCategoria(j.categoria) === normalizarCategoria(categoriaAtual);
    const matchTipo      = (j.categoria_tipo ?? '') === tipoAtivo;
    return matchCategoria && matchTipo;
  });

  const jogadoresFiltrados = jogadoresDaCategoria.filter(j => {
    const matchBusca     = busca === '' ||
      (j.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      (j.posicao ?? '').toLowerCase().includes(busca.toLowerCase());
    return matchBusca;
  }).sort((a, b) => {
    if (ordenacao === 'GOLS') return b.gols - a.gols || b.nota_geral - a.nota_geral;
    if (ordenacao === 'ASSISTENCIAS') return b.assistencias - a.assistencias || b.nota_geral - a.nota_geral;
    return b.nota_geral - a.nota_geral;
  });

  const resumo = calcularResumo(jogadoresDaCategoria);

  if (carregandoClubeAtivo) {
    return (
      <View style={styles.containerCarregandoPermissao}>
        <ActivityIndicator size="large" color={colors.primaria} />
      </View>
    );
  }

  if (!podeGerenciar) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <Header
        title="ESTATÍSTICAS"
        btnNotificacao="bell"
        showLogo={true}
        logoUrl={clubeAtivo?.escudo ?? null}
        showProfile={true}
        papelUsuario={clubeAtivo?.papel ?? undefined}
      />

      <CarrosselSubs
        tipoFiltro={tipoAtivo}
        onTrocarTipo={setTipoAtivo}
        indexAtual={subIndex}
        onChangeIndex={setSubIndex}
      />

      {carregando ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listaContent}>
          <CardsSkeleton rows={5} />
        </ScrollView>
      ) : erro ? (
        <View style={styles.centralizado}>
          <View style={styles.estadoIcone}>
            <Icon name="wifi-off" size={28} color={colors.tituloErro} />
          </View>
          <Text style={styles.txtErro}>{erro}</Text>
          <TouchableOpacity style={styles.btnRetry} onPress={() => carregarDados()}>
            <Text style={styles.txtBtnRetry}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.telaContent}>
          {jogadoresDaCategoria.length > 0 && (
            <View style={styles.resumoContainer}>
              <View style={styles.resumoHeader}>
                <Text style={styles.resumoTitulo}>DESTAQUES DA CATEGORIA</Text>
                <Text style={styles.resumoSub}>{categoriaAtual}</Text>
              </View>
              <View style={styles.resumoCards}>
                <View style={styles.resumoCard}>
                  <Icon name="soccer" size={19} color={colors.vermelhoDestaque} />
                  <Text style={styles.resumoCardLabel}>ARTILHEIRO</Text>
                  <Text style={styles.resumoCardValor}>{resumo.artilheiro?.gols ?? 0}</Text>
                  <Text style={styles.resumoCardNome} numberOfLines={1}>{resumo.artilheiro?.nome ?? 'Sem dados'}</Text>
                </View>
                <View style={styles.resumoCard}>
                  <Icon name="handshake" size={19} color={colors.primaria} />
                  <Text style={styles.resumoCardLabel}>ASSISTÊNCIAS</Text>
                  <Text style={styles.resumoCardValor}>{resumo.assistente?.assistencias ?? 0}</Text>
                  <Text style={styles.resumoCardNome} numberOfLines={1}>{resumo.assistente?.nome ?? 'Sem dados'}</Text>
                </View>
                <View style={styles.resumoCard}>
                  <Icon name="radar" size={19} color={colors.amarelo} />
                  <Text style={styles.resumoCardLabel}>MAIOR ÍNDICE</Text>
                  <Text style={styles.resumoCardValor}>{resumo.lider?.pontos ?? 0}</Text>
                  <Text style={styles.resumoCardNome} numberOfLines={1}>{resumo.lider?.nome ?? 'Sem dados'}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.infoAnalise}>
            <Icon name="information-outline" size={17} color={colors.primaria} />
            <Text style={styles.infoAnaliseTxt}>
              Perfis e índices são comparativos e atualizados conforme novas partidas são registradas.
            </Text>
          </View>

          <View style={styles.buscaContainer}>
            <Icon name="magnify" size={18} color={colors.textoSecundario} />
            <TextInput
              style={styles.buscaInput}
              placeholder="Buscar atleta..."
              placeholderTextColor={colors.textoSecundario}
              value={busca}
              onChangeText={setBusca}
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca('')}>
                <Icon name="close" size={16} color={colors.textoSecundario} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.listaHeader}>
            <Text style={styles.listaTitulo}>ATLETAS</Text>
            <Text style={styles.listaContador}>{jogadoresFiltrados.length} ENCONTRADOS</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ordenacaoContent}
          >
            {OPCOES_ORDENACAO.map((opcao) => (
              <TouchableOpacity
                key={opcao.value}
                style={[styles.ordenacaoPill, ordenacao === opcao.value && styles.ordenacaoPillAtiva]}
                onPress={() => setOrdenacao(opcao.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.ordenacaoTxt, ordenacao === opcao.value && styles.ordenacaoTxtAtiva]}>
                  {opcao.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {jogadoresFiltrados.length === 0 ? (
            <View style={styles.listaVazia}>
              <View style={styles.estadoIcone}>
                <Icon name="account-off-outline" size={28} color={colors.textoSecundario} />
              </View>
              <Text style={styles.txtErro}>Nenhum atleta encontrado</Text>
            </View>
          ) : jogadoresFiltrados.map(j => (
              <CardJogador
                key={j.id_jogador}
                jogador={j}
                onPress={() => setJogadorSelecionado(j)}
              />
            ))}
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
