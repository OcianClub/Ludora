import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  TextInput, ActivityIndicator, Alert, Pressable, RefreshControl, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { obterPerfisJogadores } from '@/src/services/mlService';
import type { Jogador as JogadorScout, ScoresMl } from '@/src/services/mlService';
import { criarJogador, atualizarJogador, deletarJogador } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import { Header } from '@/src/components/Header';
import { styles as s } from '@/src/styles/ElencoSubStyles';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Categoria { id: number; nome: string; }

interface JogadorSimples {
  id: number;
  nome: string;
  posicao: string;
  numCamisa: number | null;
  categoria_id: number;
  dtNasc?: string;
  ativo?: boolean;
}

interface ElencoSubProps {
  categoria: Categoria;
  jogadores: JogadorSimples[];
  onFechar: () => void;
  onRecarregar: () => void;
}

interface SalvoPayload {
  nome: string;
  subNome: string;
  foiRedirecionado: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COR_PERFIL: Record<string, string> = {
  'Artilheiro': colors.vermelho,
  'Paredão':    colors.azulClaro,
  'Armador':    colors.amarelo,
  'Sem dados':  '#555555',
};

const POSICOES = ['Ala', 'Goleiro'];

const REGRAS_SUB = [
  { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
  { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
  { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
  { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
];

// ─── Helper: calcula sub pela data "DD/MM/AAAA" ───────────────────────────────
function calcularSubPorData(dtFormatada: string): string | null {
  if (dtFormatada.length < 10) return null;
  const [d, m, a] = dtFormatada.split('/');
  if (!d || !m || !a || a.length !== 4) return null;
  const ano = parseInt(a, 10);
  if (isNaN(ano) || ano < 1990 || ano > new Date().getFullYear()) return null;
  const idade = new Date().getFullYear() - ano;
  return REGRAS_SUB.find(r => idade <= r.limite)?.nome ?? null;
}

// ─── HexagonoScout ────────────────────────────────────────────────────────────
function HexagonoScout({ scores, size = 200, corPerfil }: {
  scores: ScoresMl; size?: number; corPerfil: string;
}) {
  const cx = size / 2, cy = size / 2, R = size * 0.34;
  const eixos = [
    { label: 'FINALIZAÇÃO', key: 'finalizacao'   },
    { label: 'VISÃO',       key: 'visao_de_jogo' },
    { label: 'DEFESA',      key: 'defesa'         },
    { label: 'DISCIPLINA',  key: 'disciplina'     },
    { label: 'INTENSIDADE', key: 'intensidade'    },
    { label: 'TÉCNICA',     key: 'tecnica'        },
  ];
  const ang  = (i: number) => (Math.PI / 2) + (2 * Math.PI * i) / 6;
  const base = (i: number, r: number) => ({ x: cx + r * Math.cos(ang(i)), y: cy - r * Math.sin(ang(i)) });
  const grid = (f: number) => eixos.map((_, i) => { const p = base(i, R * f); return `${p.x},${p.y}`; }).join(' ');
  const vals = eixos.map((e, i) => {
    const v = (scores[e.key as keyof ScoresMl] ?? 0) / 100;
    const p = base(i, R * v);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <Svg width={size} height={size}>
      {[0.33, 0.66, 1].map((f, idx) => (
        <Polygon key={idx} points={grid(f)} fill="none"
          stroke={f === 1 ? '#3a3a3a' : '#252525'} strokeWidth={f === 1 ? 1.5 : 1} />
      ))}
      {eixos.map((_, i) => {
        const p = base(i, R);
        return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#252525" strokeWidth={1} />;
      })}
      <Polygon points={vals} fill={corPerfil + '30'} stroke={corPerfil} strokeWidth={2} />
      {eixos.map((e, i) => {
        const p = base(i, R + 20);
        return (
          <SvgText key={i} x={p.x} y={p.y + 3} fill={colors.text_secondary}
            fontSize="7.5" fontWeight="bold" textAnchor="middle">
            {e.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── ModalScout ───────────────────────────────────────────────────────────────

function ModalScout({ jogador, onFechar }: { jogador: JogadorScout; onFechar: () => void }) {
  const corPerfil = COR_PERFIL[jogador.perfil_ml] || '#555555';
  const idade = jogador.dtNasc ? new Date().getFullYear() - new Date(jogador.dtNasc).getFullYear() : null;
  const golsPJ   = jogador.jogos_disputados > 0 ? (jogador.gols / jogador.jogos_disputados).toFixed(2) : '—';
  const assistPJ = jogador.jogos_disputados > 0 ? (jogador.assistencias / jogador.jogos_disputados).toFixed(2) : '—';

  const stats = [
    { label: 'Jogos',     valor: jogador.jogos_disputados,  icone: 'soccer-field' },
    { label: 'Gols',      valor: jogador.gols,              icone: 'soccer'       },
    { label: 'Assist.',   valor: jogador.assistencias,      icone: 'handshake'    },
    { label: 'Defesas',   valor: jogador.defesas ?? 0,      icone: 'shield-check' },
    { label: 'Faltas',    valor: jogador.faltas_cometidas,  icone: 'whistle'      },
    { label: 'Amarelos',  valor: jogador.cartoes_amarelos,  icone: 'card'         },
    { label: 'Vermelhos', valor: jogador.cartoes_vermelhos, icone: 'card'         },
  ];

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onFechar}>
      <View style={s.scoutContainer}>
        <View style={[s.scoutHeader, { borderBottomColor: corPerfil + '40' }]}>
          <TouchableOpacity onPress={onFechar} style={s.btnVoltar}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.scoutTitulo}>FICHA DO ATLETA</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scoutScroll}>
          <View style={[s.identidadeCard, { borderColor: corPerfil + '60' }]}>
            <LinearGradient colors={[corPerfil, 'transparent']} style={s.avatarGradient}>
              <Text style={[s.avatarNum, { color: corPerfil }]}>{jogador.numCamisa ?? '?'}</Text>
            </LinearGradient>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.scoutNome} numberOfLines={1}>{jogador.nome}</Text>
              <Text style={s.scoutPosicao}>{jogador.posicao}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <View style={[s.chip, { backgroundColor: corPerfil + '22', borderColor: corPerfil + '60' }]}>
                  <Text style={[s.chipTxt, { color: corPerfil }]}>{jogador.perfil_ml}</Text>
                </View>
                <View style={s.chip}>
                  <Text style={s.chipTxt}>{jogador.categoria}</Text>
                </View>
                {idade && <View style={s.chip}><Text style={s.chipTxt}>{idade} anos</Text></View>}
              </View>
            </View>

            <View style={s.notaBox}>
              <Text style={s.notaLabel}>NOTA</Text>
              <Text style={[s.notaValor, { color: corPerfil }]}>
                {jogador.nota_geral > 0 ? jogador.nota_geral.toFixed(0) : '—'}
              </Text>
            </View>
          </View>

          {jogador.scores_ml ? (
            <View style={s.secaoCard}>
              <Text style={s.secaoLabel}>RADAR DO ATLETA</Text>
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <HexagonoScout scores={jogador.scores_ml} size={220} corPerfil={corPerfil} />
              </View>
              <View style={{ gap: 10, marginTop: 8 }}>
                {Object.entries(jogador.scores_ml).map(([key, val]) => (
                  <View key={key} style={s.barRow}>
                    <Text style={s.barLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${val}%`, backgroundColor: corPerfil }]} />
                    </View>
                    <Text style={[s.barVal, { color: corPerfil }]}>{(val as number).toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={s.semDados}>
              <MaterialCommunityIcons name="chart-arc" size={44} color="#2a2a2a" />
              <Text style={s.semDadosTxt}>Radar disponível após o primeiro jogo registrado</Text>
            </View>
          )}

          <Text style={[s.secaoLabel, { marginTop: 4 }]}>ESTATÍSTICAS</Text>
          <View style={s.statsGrid}>
            {stats.map(st => (
              <View key={st.label} style={s.statCard}>
                <MaterialCommunityIcons name={st.icone as any} size={18} color={corPerfil} style={{ opacity: 0.85 }} />
                <Text style={s.statValor}>{st.valor}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.secaoLabel, { marginTop: 4 }]}>EFICIÊNCIA POR JOGO</Text>
          <View style={s.eficienciaRow}>
            <View style={s.eficienciaCard}>
              <MaterialCommunityIcons name="soccer" size={20} color={colors.vermelho} />
              <Text style={s.eficienciaValor}>{golsPJ}</Text>
              <Text style={s.eficienciaLabel}>Gols/Jogo</Text>
            </View>
            <View style={s.eficienciaCard}>
              <MaterialCommunityIcons name="handshake" size={20} color={colors.azulClaro} />
              <Text style={s.eficienciaValor}>{assistPJ}</Text>
              <Text style={s.eficienciaLabel}>Assist./Jogo</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── ModalFormJogador ─────────────────────────────────────────────────────────

function ModalFormJogador({
  visivel,
  jogador,
  categoriaAtualId,
  categoriaAtualNome,
  onFechar,
  onSalvo,
}: {
  visivel: boolean;
  jogador: JogadorSimples | null;
  categoriaAtualId: number;
  categoriaAtualNome: string;
  onFechar: () => void;
  onSalvo: (payload: SalvoPayload) => void;
}) {
  const [nome,     setNome]     = useState('');
  const [cpf,      setCpf]      = useState('');
  const [dtNasc,   setDtNasc]   = useState('');
  const [posicao,  setPosicao]  = useState('Ala');
  const [camisa,   setCamisa]   = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setNome(jogador?.nome ?? '');
    setPosicao(jogador?.posicao ?? 'Ala');
    setCamisa(jogador?.numCamisa?.toString() ?? '');
    setCpf('');

    if (jogador?.dtNasc) {
      const fatiada = jogador.dtNasc.slice(0, 10);
      const [ano, mes, dia] = fatiada.split('-');
      setDtNasc(`${dia}/${mes}/${ano}`);
    } else {
      setDtNasc('');
    }
  }, [jogador, visivel]);

  // ── Preview do sub calculado em tempo real ────────────────────────────────
  const subCalculado = calcularSubPorData(dtNasc);
  const subDiferente =
    subCalculado !== null &&
    subCalculado.toLowerCase() !== categoriaAtualNome.toLowerCase();

  // ── Formatters ────────────────────────────────────────────────────────────

  const formatarCPF = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11);
    if (n.length > 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
    if (n.length > 6) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
    if (n.length > 3) return `${n.slice(0, 3)}.${n.slice(3)}`;
    return n;
  };

  const formatarData = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 8);
    if (n.length >= 5) return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
    if (n.length >= 3) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return n;
  };

  const dataParaISO = (v: string): string => {
    const [d, m, a] = v.split('/');
    const pad = (x: string) => x.padStart(2, '0');
    return `${a}-${pad(m)}-${pad(d)}`;
  };

  // ── Salvar ────────────────────────────────────────────────────────────────

  const salvar = async () => {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do atleta.');

    if (!jogador) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      if (!cpfLimpo) return Alert.alert('Atenção', 'CPF é obrigatório para cadastrar um atleta.');
      if (cpfLimpo.length !== 11) return Alert.alert('Atenção', 'CPF inválido. Digite os 11 dígitos.');
    }

    if (!dtNasc.trim() || dtNasc.length < 10)
      return Alert.alert('Atenção', 'Data de nascimento inválida. Use o formato DD/MM/AAAA.');

    setSalvando(true);
    try {
      const dtISO = dataParaISO(dtNasc);

      if (jogador) {
        const atualizado = await atualizarJogador(jogador.id, {
          nome,
          posicao,
          numCamisa: camisa ? Number(camisa) : null,
          dtNasc: dtISO,
        });
        onFechar();
        onSalvo({
          nome,
          subNome: atualizado.categoria?.nome ?? '',
          foiRedirecionado: atualizado.categoria_id !== jogador.categoria_id,
        });
      } else {
        const cpfLimpo = cpf.replace(/\D/g, '');
        const criado = await criarJogador({
          nome,
          cpf: cpfLimpo,
          dtNasc: dtISO,
          posicao,
          numCamisa: camisa ? Number(camisa) : undefined,
        });
        onFechar();
        onSalvo({
          nome,
          subNome: criado.categoria?.nome ?? '',
          foiRedirecionado: criado.categoria_id !== categoriaAtualId,
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="slide">
      <Pressable style={s.overlay} onPress={onFechar}>
        <Pressable style={s.formCard}>
          <View style={s.formHeader}>
            <Text style={s.formTitulo}>{jogador ? 'Editar Atleta' : 'Novo Atleta'}</Text>
            <TouchableOpacity onPress={onFechar}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={s.inputRow}>
            <MaterialCommunityIcons name="account-outline" size={18} color={colors.text_secondary} />
            <TextInput
              style={s.input}
              placeholder="Nome completo"
              placeholderTextColor={colors.text_secondary}
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
            />
          </View>

          {!jogador && (
            <View style={s.inputRow}>
              <MaterialCommunityIcons name="card-account-details-outline" size={18} color={colors.text_secondary} />
              <TextInput
                style={s.input}
                placeholder="CPF obrigatório (somente números)"
                placeholderTextColor={colors.text_secondary}
                value={cpf}
                onChangeText={v => setCpf(formatarCPF(v))}
                keyboardType="number-pad"
                maxLength={14}
              />
            </View>
          )}

          <View style={s.inputRow}>
            <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.text_secondary} />
            <TextInput
              style={s.input}
              placeholder="Data nasc. (DD/MM/AAAA)"
              placeholderTextColor={colors.text_secondary}
              value={dtNasc}
              onChangeText={v => setDtNasc(formatarData(v))}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          {subCalculado && (
            <View style={[
              s.infoBox,
              {
                backgroundColor: subDiferente ? colors.amarelo + '18' : colors.primary + '18',
                borderColor:     subDiferente ? colors.amarelo + '70' : colors.primary + '70',
                marginBottom: 12,
              },
            ]}>
              <MaterialCommunityIcons
                name={subDiferente ? 'alert-circle-outline' : 'check-circle-outline'}
                size={15}
                color={subDiferente ? colors.amarelo : colors.primary}
              />
              <Text style={[s.infoTxt, { color: subDiferente ? colors.amarelo : colors.primary }]}>
                {subDiferente
                  ? `Pela data de nascimento, este atleta será cadastrado no ${subCalculado.toUpperCase()} — não no ${categoriaAtualNome.toUpperCase()}.`
                  : `Atleta dentro da faixa etária do ${subCalculado.toUpperCase()}. ✓`}
              </Text>
            </View>
          )}
          <View style={s.inputRow}>
            <MaterialCommunityIcons name="tshirt-crew-outline" size={18} color={colors.text_secondary} />
            <TextInput
              style={s.input}
              placeholder="Nº camisa (opcional)"
              placeholderTextColor={colors.text_secondary}
              value={camisa}
              onChangeText={setCamisa}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={s.formLabel}>POSIÇÃO</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, marginTop: 8 }}>
            {POSICOES.map(p => (
              <TouchableOpacity
                key={p}
                style={[s.pill, posicao === p && s.pillAtivo]}
                onPress={() => setPosicao(p)}
              >
                <MaterialCommunityIcons
                  name={p === 'Goleiro' ? 'hand-front-right' : 'run-fast'}
                  size={14}
                  color={posicao === p ? colors.primary : colors.text_secondary}
                />
                <Text style={[s.pillTxt, posicao === p && s.pillTxtAtivo]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {jogador && (
            <View style={s.infoBox}>
              <MaterialCommunityIcons name="information-outline" size={14} color={colors.azulClaro} />
              <Text style={s.infoTxt}>
                Ao alterar a data de nascimento, o sub do atleta será recalculado automaticamente.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={s.btnSalvar}
            onPress={salvar}
            disabled={salvando}
            activeOpacity={0.85}
          >
            {salvando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.btnSalvarTxt}>SALVAR ATLETA</Text>
            }
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── CardAtleta ───────────────────────────────────────────────────────────────

function CardAtleta({ jogador, scout, onVerFicha, onEditar, onExcluir }: {
  jogador: JogadorSimples;
  scout: JogadorScout | null;
  onVerFicha: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const perfil    = scout?.perfil_ml || 'Sem dados';
  const corPerfil = COR_PERFIL[perfil] || '#555555';
  const nota      = scout?.nota_geral ?? 0;
  const inativo   = jogador.ativo === false;

  return (
    <TouchableOpacity
      style={[s.cardAtleta, inativo && { opacity: 0.5 }]}
      onPress={onVerFicha}
      activeOpacity={0.85}
    >
      <View style={[s.camisaBox, { borderColor: inativo ? '#333' : corPerfil + '80' }]}>
        <Text style={[s.camisaTxt, { color: inativo ? '#555' : corPerfil }]}>
          {jogador.numCamisa != null ? `#${jogador.numCamisa}` : '—'}
        </Text>
      </View>

      <View style={s.cardInfos}>
        <Text style={s.cardNome} numberOfLines={1}>{jogador.nome}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <MaterialCommunityIcons
            name={jogador.posicao === 'Goleiro' ? 'hand-front-right' : 'run-fast'}
            size={11} color={colors.text_secondary}
          />
          <Text style={s.cardSub}>{jogador.posicao}</Text>
          {inativo && (
            <View style={{
              backgroundColor: '#2a2a2a', borderRadius: 4,
              paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <Text style={{ color: '#666', fontSize: 9, fontFamily: 'Creato-Bold' }}>SÊNIOR</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.cardDireita}>
        {perfil !== 'Sem dados' && !inativo && (
          <View style={[s.badgePerfil, { backgroundColor: corPerfil + '18', borderColor: corPerfil + '50' }]}>
            <Text style={[s.badgePerfilTxt, { color: corPerfil }]}>{perfil}</Text>
          </View>
        )}
        {nota > 0 && !inativo && (
          <Text style={[s.notaTxt, { color: corPerfil }]}>{nota.toFixed(0)}</Text>
        )}
      </View>

      <View style={s.acoes}>
        <TouchableOpacity style={s.btnAcao} onPress={onEditar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.azulClaro} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnAcao, s.btnAcaoDanger]} onPress={onExcluir} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.vermelho} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── ElencoSub (componente principal) ────────────────────────────────────────

export default function ElencoSub({ categoria, jogadores, onFechar, onRecarregar }: ElencoSubProps) {
  const [scouts,           setScouts]           = useState<JogadorScout[]>([]);
  const [carregandoScout,  setCarregandoScout]  = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [modalForm,        setModalForm]        = useState(false);
  const [jogadorEditando,  setJogadorEditando]  = useState<JogadorSimples | null>(null);
  const [jogadorScout,     setJogadorScout]     = useState<JogadorScout | null>(null);
  const [modalConfirmar,   setModalConfirmar]   = useState(false);
  const [jogadorExcluindo, setJogadorExcluindo] = useState<JogadorSimples | null>(null);
  const [excluindo,        setExcluindo]        = useState(false);
  const [busca,            setBusca]            = useState('');
  const [filtroPosicao,    setFiltroPosicao]    = useState<'Todos' | 'Ala' | 'Goleiro'>('Todos');
  const [mostrarSenior,    setMostrarSenior]    = useState(false);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'aviso' } | null>(null);

  const mostrarToast = useCallback((msg: string, tipo: 'sucesso' | 'aviso' = 'sucesso') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3800);
  }, []);

  // ── Scouts ──────────────────────────────────────────────────────────────────

  const carregarScouts = useCallback(async () => {
    setCarregandoScout(true);
    try {
      setScouts(await obterPerfisJogadores(categoria.id));
    } catch {
      setScouts([]);
    } finally {
      setCarregandoScout(false);
    }
  }, [categoria.id]);

  useEffect(() => { carregarScouts(); }, [carregarScouts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    onRecarregar();
    await carregarScouts();
    setRefreshing(false);
  }, [carregarScouts, onRecarregar]);

  const getScout = (id: number) => scouts.find(sc => sc.id_jogador === id) ?? null;

  // ── Filtros ────────────────────────────────────────────────────────────────

  const filtrar = (lista: JogadorSimples[]) =>
    lista.filter(j => {
      const matchBusca   = j.nome.toLowerCase().includes(busca.toLowerCase());
      const matchPosicao = filtroPosicao === 'Todos' || j.posicao === filtroPosicao;
      return matchBusca && matchPosicao;
    });

  const ativosFiltrados  = filtrar(jogadores.filter(j => j.ativo !== false));
  const seniorsFiltrados = filtrar(jogadores.filter(j => j.ativo === false));

  // ── Ações ──────────────────────────────────────────────────────────────────

  const abrirFicha = (jogador: JogadorSimples) => {
    const scout = getScout(jogador.id);
    if (!scout) {
      Alert.alert('Scout indisponível', 'Registre partidas para gerar o perfil deste atleta.');
      return;
    }
    setJogadorScout(scout);
  };

  const confirmarExclusao = (jogador: JogadorSimples) => {
    setJogadorExcluindo(jogador);
    setModalConfirmar(true);
  };

  const excluir = async () => {
    if (!jogadorExcluindo) return;
    setExcluindo(true);
    try {
      await deletarJogador(jogadorExcluindo.id);
      setModalConfirmar(false);
      onRecarregar();
      carregarScouts();
    } catch (e: any) {
      setModalConfirmar(false);
      Alert.alert('Erro', e.message);
    } finally {
      setExcluindo(false);
    }
  };

  // ── Callback do formulário ─────────────────────────────────────────────────

  const handleSalvo = useCallback(({ nome, subNome, foiRedirecionado }: SalvoPayload) => {
    onRecarregar();
    carregarScouts();
    if (foiRedirecionado) {
      mostrarToast(
        `${nome} foi para o ${subNome.toUpperCase()} pela data de nascimento`,
        'aviso',
      );
    } else {
      mostrarToast(`${nome} adicionado com sucesso`, 'sucesso');    
    }
  }, [onRecarregar, carregarScouts, mostrarToast]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <Header
        title={categoria.nome.toUpperCase()}
        showLogo={false} showProfile={false}
        btnVoltar="arrow-left" onBtnVoltar={onFechar}
        semSafeArea={true}
      />

      {/* Busca */}
      <View style={s.topRow}>
        <View style={s.buscaContainer}>
          <MaterialCommunityIcons name="magnify" size={16} color={colors.text_secondary} />
          <TextInput
            style={s.buscaInput}
            placeholder="Buscar atleta..."
            placeholderTextColor={colors.text_secondary}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')}>
              <MaterialCommunityIcons name="close" size={14} color={colors.text_secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.filtrosRow}>
        <View style={s.filtrosPills}>
          {(['Todos', 'Ala', 'Goleiro'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.pill, filtroPosicao === p && s.pillAtivo]}
              onPress={() => setFiltroPosicao(p)}
            >
              <Text style={[s.pillTxt, filtroPosicao === p && s.pillTxtAtivo]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {carregandoScout ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ActivityIndicator size={10} color={colors.primary} />
            <Text style={s.scoutLoadingTxt}>Carregando...</Text>
          </View>
        ) : (
          <Text style={s.counterTxt}>
            {ativosFiltrados.length} atleta{ativosFiltrados.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {ativosFiltrados.length === 0 ? (
          <View style={s.emptyContainer}>
            <MaterialCommunityIcons name="account-group-outline" size={60} color="#222" />
            <Text style={s.emptyTxt}>
              {busca ? 'Nenhum atleta encontrado' : 'Nenhum atleta neste sub.\nAdicione o primeiro!'}
            </Text>
          </View>
        ) : (
          ativosFiltrados.map(j => (
            <CardAtleta
              key={j.id}
              jogador={j}
              scout={getScout(j.id)}
              onVerFicha={() => abrirFicha(j)}
              onEditar={() => { setJogadorEditando(j); setModalForm(true); }}
              onExcluir={() => confirmarExclusao(j)}
            />
          ))
        )}

        {seniorsFiltrados.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingVertical: 10, paddingHorizontal: 4,
              }}
              onPress={() => setMostrarSenior(v => !v)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={mostrarSenior ? 'chevron-down' : 'chevron-right'}
                size={18} color="#555"
              />
              <Text style={{ fontFamily: 'Creato-Bold', color: '#555', fontSize: 11, letterSpacing: 1 }}>
                SÊNIOR / HISTÓRICO ({seniorsFiltrados.length})
              </Text>
            </TouchableOpacity>

            {mostrarSenior && seniorsFiltrados.map(j => (
              <CardAtleta
                key={j.id}
                jogador={j}
                scout={getScout(j.id)}
                onVerFicha={() => abrirFicha(j)}
                onEditar={() => { setJogadorEditando(j); setModalForm(true); }}
                onExcluir={() => confirmarExclusao(j)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={s.fab}
        onPress={() => { setJogadorEditando(null); setModalForm(true); }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
      </TouchableOpacity>

      {toast && (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      bottom: 96,
      left: 16,
      right: 16,
      borderRadius: 16,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    }}
  >
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: '#1c1c1e',
      borderColor: toast.tipo === 'aviso' ? colors.amarelo + '90' : colors.azulClaro + '90',
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: toast.tipo === 'aviso' ? colors.amarelo + '18' : colors.primary + '18',
      }}>
        <MaterialCommunityIcons
          name={toast.tipo === 'aviso' ? 'alert-circle-outline' : 'check-circle-outline'}
          size={20}
          color={toast.tipo === 'aviso' ? colors.amarelo : colors.primary}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{
          fontFamily: 'Creato-Bold',
          fontSize: 10,
          letterSpacing: 1,
          color: toast.tipo === 'aviso' ? colors.amarelo : colors.primary,
        }}>
          {toast.tipo === 'aviso' ? 'ATENÇÃO' : 'SUCESSO'}
        </Text>
        <Text style={{
          fontFamily: 'Creato-Bold',
          fontSize: 13,
          color: colors.text,
          lineHeight: 18,
        }}>
          {toast.msg}
        </Text>
      </View>
    </View>
  </View>
)}

      <ModalFormJogador
        visivel={modalForm}
        jogador={jogadorEditando}
        categoriaAtualId={categoria.id}
        categoriaAtualNome={categoria.nome}
        onFechar={() => setModalForm(false)}
        onSalvo={handleSalvo}
      />

      {jogadorScout && (
        <ModalScout jogador={jogadorScout} onFechar={() => setJogadorScout(null)} />
      )}

      <Modal visible={modalConfirmar} transparent animationType="fade">
        <Pressable style={s.overlay} onPress={() => setModalConfirmar(false)}>
          <View style={s.confirmCard}>
            <MaterialCommunityIcons name="trash-can-outline" size={34} color={colors.vermelho} />
            <Text style={s.formTitulo}>Excluir Atleta</Text>
            <Text style={s.confirmTxt}>
              Tem certeza que deseja excluir{'\n'}
              <Text style={{ color: colors.text }}>{jogadorExcluindo?.nome}</Text>?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <TouchableOpacity
                style={[s.btnSalvar, { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' }]}
                onPress={() => setModalConfirmar(false)}
              >
                <Text style={[s.btnSalvarTxt, { color: colors.text_secondary }]}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSalvar, { flex: 1, backgroundColor: colors.vermelho + '18', borderWidth: 1, borderColor: colors.vermelho }]}
                onPress={excluir}
                disabled={excluindo}
              >
                {excluindo
                  ? <ActivityIndicator color={colors.vermelho} />
                  : <Text style={[s.btnSalvarTxt, { color: colors.vermelho }]}>EXCLUIR</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}