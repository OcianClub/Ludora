import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/src/components/Header';
import { colors } from '@/src/theme/colors';
import {
  fetchClassificacaoCampeonato,
  ClassificacaoItem,
  FiltrosCampeonato,
} from '@/src/services/api';

import { styles as s } from '@/src/styles/placarStyles';

// ── Filtros estáticos ─────────────────────────────────────────────────────────

const DIVISOES   = ['a1', 'a2', 'a3'] as const;
const CATEGORIAS = ['sub7','sub8','sub9','sub10','sub12','sub14','sub16','sub18'] as const;

type Divisao   = typeof DIVISOES[number];
type Categoria = typeof CATEGORIAS[number];

const LABEL_DIVISAO: Record<Divisao, string> = {
  a1: 'Div. A1', a2: 'Div. A2', a3: 'Div. A3',
};
const LABEL_CATEGORIA: Record<Categoria, string> = {
  sub7: 'Sub-7', sub8: 'Sub-8', sub9: 'Sub-9', sub10: 'Sub-10',
  sub12: 'Sub-12', sub14: 'Sub-14', sub16: 'Sub-16', sub18: 'Sub-18',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const GERAL = '__GERAL__';

function formatSaldo(s: number): string {
  return s > 0 ? `+${s}` : String(s);
}

function tempoDesde(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

function labelDoGrupo(tipoTabela: string): string {
  if (tipoTabela === 'GERAL') return 'Geral';
  const m = tipoTabela.match(/\b([A-Z])\s*$/);
  if (m) return m[1];
  return tipoTabela;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <View style={[s.tableRow, s.rowBorder]}>
      <View style={[s.skeleton, { width: 24, marginRight: 10 }]} />
      <View style={[s.skeleton, { flex: 1, marginRight: 8 }]} />
      <View style={[s.skeleton, { width: 22 }]} />
      <View style={[s.skeleton, { width: 22, marginHorizontal: 4 }]} />
      <View style={[s.skeleton, { width: 22 }]} />
      <View style={[s.skeleton, { width: 28, marginLeft: 4 }]} />
    </View>
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────
function CampeonatoBanner({ divisao, categoria }: { divisao: Divisao; categoria: Categoria }) {
  return (
    <View style={s.banner}>
      <View style={s.bannerIconWrap}>
        <Ionicons name="trophy" size={20} color={colors.azulClaro} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.bannerCampeonato}>PAULISTA 2026</Text>
        <Text style={s.bannerSub}>
          {LABEL_DIVISAO[divisao]} · {LABEL_CATEGORIA[categoria]}
        </Text>
      </View>
    </View>
  );
}

// ── Card do Ocian ─────────────────────────────────────────────────────────────
function OcianCard({ time }: { time: ClassificacaoItem }) {
  const stats = [
    { label: 'PTS', value: String(time.pontos) },
    { label: 'J',   value: String(time.jogos) },
    { label: 'GP',  value: String(time.golsPro) },
    { label: 'GC',  value: String(time.golsContra) },
    { label: 'SG',  value: formatSaldo(time.saldo) },
  ];
  return (
    <View style={s.ocianCard}>
      <View style={s.ocianHeader}>
        <View style={s.ocianIcone}>
          <Text style={s.ocianIniciais}>OPC</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ocianNome}>{time.clube}</Text>
          <Text style={s.ocianPos}>{time.posicao}º Lugar · {time.grupo}</Text>
        </View>
        <View style={s.ocianBadge}>
          <Text style={s.ocianBadgeText}>DESTAQUE</Text>
        </View>
      </View>
      <View style={s.ocianStats}>
        {stats.map(({ label, value }) => (
          <View key={label} style={s.ocianStatItem}>
            <Text style={s.ocianStatValue}>{value}</Text>
            <Text style={s.ocianStatLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Linha da tabela ───────────────────────────────────────────────────────────
function ClassificacaoRow({ time, isLast }: { time: ClassificacaoItem; isLast: boolean }) {
  const iniciais = time.clube.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 3);
  return (
    <View style={[s.tableRow, !isLast && s.rowBorder, time.destaque && s.tableRowOcian]}>
      {time.destaque && <View style={s.ocianBorda} />}
      <Text style={[s.colPosText, time.destaque && s.ocianColor]}>{time.posicao}</Text>
      <View style={s.clubeContainer}>
        <View style={[s.clubeIcone, time.destaque && s.clubeIconeOcian]}>
          <Text style={[s.clubeIniciais, time.destaque && s.clubeIniciaisOcian]}>{iniciais}</Text>
        </View>
        <Text style={[s.tdText, s.clubeText, time.destaque && s.ocianTextBold]}>
          {time.clube}
        </Text>
      </View>
      <Text style={[s.tdText, s.colStat, s.colDestaque, time.destaque && s.ocianColor]}>
        {time.pontos}
      </Text>
      <Text style={[s.tdText, s.colStat]}>{time.jogos}</Text>
      <Text style={[s.tdText, s.colStat]}>{time.vitorias}</Text>
      <Text style={[s.tdText, s.colStat, s.colDestaque, time.destaque && s.ocianColor]}>
        {formatSaldo(time.saldo)}
      </Text>
    </View>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OcianCardVazio() {
  return (
    <View style={s.ocianCard}>
      <View style={s.ocianHeader}>
        <View style={s.ocianIcone}>
          <Text style={s.ocianIniciais}>OPC</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.ocianNome}>CFA OCIAN</Text>
          <Text style={s.ocianPos}>Não participa desta categoria</Text>
        </View>
        <View style={s.ocianBadge}>
          <Text style={s.ocianBadgeText}>DESTAQUE</Text>
        </View>
      </View>
      <View style={s.ocianStats}>
        {['PTS','J','GP','GC','SG'].map(label => (
          <View key={label} style={s.ocianStatItem}>
            <Text style={s.ocianStatValue}>—</Text>
            <Text style={s.ocianStatLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────────
function Tabela({ times }: { times: ClassificacaoItem[] }) {
  if (times.length === 0) return null;
  return (
    <View style={s.tableContainer}>
      <View style={s.tableHeader}>
        <Text style={[s.thText, s.colPosHeader]}>POS</Text>
        <Text style={[s.thText, { flex: 1 }]}>CLUBE</Text>
        <Text style={[s.thText, s.colStatHeader]}>P</Text>
        <Text style={[s.thText, s.colStatHeader]}>J</Text>
        <Text style={[s.thText, s.colStatHeader]}>V</Text>
        <Text style={[s.thText, s.colStatHeader]}>SG</Text>
      </View>
      {times.map((time, idx) => (
        <ClassificacaoRow
          key={`${time.grupo}-${time.posicao}-${idx}`}
          time={time}
          isLast={idx === times.length - 1}
        />
      ))}
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function Campeonato() {
const [divisao,   setDivisao]   = useState<Divisao>('a3');
const [categoria, setCategoria] = useState<Categoria>('sub12');

  const [grupoAtivo, setGrupoAtivo] = useState<string>(GERAL);
  const [grupos,     setGrupos]     = useState<string[]>([]);

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [tabela,       setTabela]       = useState<ClassificacaoItem[]>([]);
  const [erro,         setErro]         = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async (viaPull = false) => {
    if (viaPull) setRefreshing(true);
    else         setLoading(true);
    setErro(null);

    try {
      const filtros: FiltrosCampeonato = {
        temporada: '2026',
        titulo:    'paulista',
        divisao,
        categoria,
      };
      const dados = await fetchClassificacaoCampeonato(filtros);
      setTabela(dados);

      const gruposUnicos = [...new Set(
        dados
          .filter(t => t.tipoTabela !== 'GERAL' && !t.tipoTabela.includes('UNIC'))
          .map(t => t.tipoTabela)
          .filter(Boolean)
      )];
      setGrupos(gruposUnicos);
      setAtualizadoEm(new Date());

      const grupoOcian = dados.find(t => t.destaque && t.tipoTabela !== 'GERAL')?.tipoTabela;
      setGrupoAtivo(grupoOcian ?? GERAL);
    } catch (e) {
        console.error('[Campeonato] Erro ao carregar:', e);
        setErro('Não foi possível carregar a classificação. Verifique sua conexão.');
      } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [divisao, categoria]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Dados filtrados pelo grupo ativo ─────────────────────────────────────────
  const timesVisiveis: ClassificacaoItem[] =
  grupoAtivo === GERAL
    ? tabela.filter(t => t.tipoTabela === 'GERAL')
    : tabela.filter(t => t.tipoTabela === grupoAtivo);

  const ocianReal = timesVisiveis.find(t => t.destaque) ?? tabela.find(t => t.destaque) ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <Header
        title="PLACAR"
        icon="trophy-outline"
        showLogo={false}
        showProfile={true}
        btnNotificacao="bell"
      />

      <CampeonatoBanner divisao={divisao} categoria={categoria} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow} style={s.chipScroll}>
        {DIVISOES.map(d => (
          <Chip key={d} label={LABEL_DIVISAO[d]} active={divisao === d} onPress={() => setDivisao(d)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow} style={s.chipScroll}>
        {CATEGORIAS.map(c => (
          <Chip key={c} label={LABEL_CATEGORIA[c]} active={categoria === c} onPress={() => setCategoria(c)} />
        ))}
      </ScrollView>

      {!loading && grupos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.grupoRow} style={s.grupoScroll}>
          {grupos.map(g => (
            <TouchableOpacity
            key={g}
            style={[s.grupoTab, grupoAtivo === g && s.grupoTabAtivo]}
            onPress={() => setGrupoAtivo(g)}
            activeOpacity={0.75}
          >
            <Text style={[s.grupoTabText, grupoAtivo === g && s.grupoTabTextAtivo]}>
              {labelDoGrupo(g)}
            </Text>
          </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.grupoTab, grupoAtivo === GERAL && s.grupoTabAtivo]}
            onPress={() => setGrupoAtivo(GERAL)}
            activeOpacity={0.75}
          >
            <Text style={[s.grupoTabText, grupoAtivo === GERAL && s.grupoTabTextAtivo]}>
              Geral
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => carregar(true)} tintColor={colors.primary} />
        }
      >
        {atualizadoEm && (
          <Text style={s.atualizadoText}>Atualizado {tempoDesde(atualizadoEm)}</Text>
        )}

        {loading ? (
          <>
            <View style={[s.ocianCard, { opacity: 0.4 }]}>
              <View style={[s.skeleton, { width: 200, height: 18, marginBottom: 10 }]} />
              <View style={[s.skeleton, { width: 120, height: 13, marginBottom: 18 }]} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0,1,2,3,4].map(i => (
                  <View key={i} style={[s.skeleton, { flex: 1, height: 44, borderRadius: 10 }]} />
                ))}
              </View>
            </View>
            <View style={s.tableContainer}>
              {[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </View>
          </>
        ) : erro ? (
          <View style={s.emptyState}>
            <Ionicons name="warning-outline" size={48} color={colors.text_secondary} style={{ marginBottom: 16 }} />
            <Text style={s.emptyTitle}>Ops!</Text>
            <Text style={s.emptyText}>{erro}</Text>
          </View>
        ) : tabela.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.text_secondary} style={{ marginBottom: 16 }} />
            <Text style={s.emptyTitle}>Classificação não disponível</Text>
            <Text style={s.emptyText}>Puxe para baixo para atualizar ou tente outra categoria.</Text>
          </View>
        ) : (
          <>
            {ocianReal ? (
                <OcianCard time={ocianReal} />
              ) : (
                <OcianCardVazio />
              )}
            <Tabela times={timesVisiveis} />
            <View style={{ height: 8 }} />
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}