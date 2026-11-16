import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { EquipePaulista, JogoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { AppButton } from '../ui/Controls';
import { caminhoPublicado, nomeOficial } from '../../utils/paulista';
import { useTheme } from '../../contexts/ThemeContext';
import { PaulistaBracketCard } from './PaulistaBracketCard';
import { useDestaqueClube, usePaulistaStyles } from './PaulistaUI';

const PRINCIPAIS = [
  { etapa: 1, titulo: 'Quartas' },
  { etapa: 2, titulo: 'Semifinal' },
  { etapa: 3, titulo: 'Final' },
];
const SEM_JOGOS: JogoPaulista[] = [];

export const PaulistaBracket = memo(function PaulistaBracket({ snapshot, chave, equipes, minhas, onOpen, onLocate }: {
  snapshot: SnapshotPaulista;
  chave?: string;
  equipes: Map<number, EquipePaulista>;
  minhas: Set<number>;
  onOpen: (jogo: JogoPaulista) => void;
  onLocate: (view: View) => void;
}) {
  const { colors } = useTheme();
  const s = usePaulistaStyles();
  const destaque = useDestaqueClube();
  const [selecionada, setSelecionada] = useState<number>();
  const cardRef = useRef<View>(null);
  const [localizar, setLocalizar] = useState(false);
  const caminho = useMemo(() => chave ? caminhoPublicado(snapshot, chave) : undefined, [snapshot, chave]);
  const etapas = useMemo(() => {
    if (!chave) return [];
    const colunas = caminho!.colunas;
    const extras = colunas.filter(coluna => coluna.etapa < 1);
    const definicoes = [...extras, ...PRINCIPAIS];
    return definicoes.map(({ etapa, titulo }) => {
      const jogos = colunas.find(coluna => coluna.etapa === etapa)?.jogos ?? SEM_JOGOS;
      return {
        etapa,
        titulo: etapa === 0 ? 'Oitavas' : etapa === -1 ? 'Outras fases' : titulo,
        jogos,
        meuClube: jogos.some(jogo => minhas.has(jogo.mandanteId) || minhas.has(jogo.visitanteId)),
      };
    });
  }, [caminho, chave, minhas]);
  const atual = etapas.find(etapa => etapa.etapa === selecionada)
    ?? [...etapas].reverse().find(etapa => etapa.meuClube)
    ?? etapas.find(etapa => etapa.jogos.length > 0)
    ?? etapas[0];

  useEffect(() => {
    if (localizar && cardRef.current) { onLocate(cardRef.current); setLocalizar(false); }
  }, [localizar, atual, onLocate]);

  if (!chave) {
    return (
      <View style={s.empty}>
        <Text style={s.heading}>Chave a confirmar</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>A federação ainda não publicou a chave eliminatória deste SUB.</Text>
      </View>
    );
  }

  const botoes = (lista: typeof etapas) => (
    <View accessibilityRole="tablist" style={[s.row, { gap: 8 }]}>
      {lista.map(etapa => {
        const ativa = etapa.etapa === atual?.etapa;
        return (
          <TouchableOpacity
            key={etapa.etapa}
            accessibilityRole="tab"
            accessibilityLabel={etapa.titulo}
            accessibilityHint={etapa.meuClube ? 'Seu clube tem confronto publicado nesta etapa' : undefined}
            aria-selected={ativa}
            onPress={() => setSelecionada(etapa.etapa)}
            style={{
              flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center',
              borderRadius: 7, borderWidth: 1,
              borderColor: ativa ? destaque.borda : colors.borda,
              borderLeftWidth: etapa.meuClube ? 2 : 1,
              borderLeftColor: ativa || etapa.meuClube ? destaque.borda : colors.borda,
              backgroundColor: etapa.meuClube ? destaque.fundo : colors.card,
            }}
          >
            <Text style={[s.tiny, { color: colors.texto, textAlign: 'center' }]}>{etapa.titulo}{etapa.jogos.length ? ` · ${etapa.jogos.length}` : ''}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={[s.row, { gap: 8 }]}><Text style={s.heading}>Chave {nomeOficial(chave)}</Text><Text style={s.tiny}>{etapas.reduce((n, e) => n + e.jogos.length, 0)} jogos</Text></View>
      {botoes(etapas.filter(etapa => etapa.etapa >= 1))}
      {etapas.some(etapa => etapa.etapa < 1) && botoes(etapas.filter(etapa => etapa.etapa < 1))}
      {atual?.jogos.length ? atual.jogos.map(jogo => (
        <View key={jogo.id} ref={jogo === atual.jogos.find(j => minhas.has(j.mandanteId) || minhas.has(j.visitanteId)) ? cardRef : undefined} collapsable={false}>
          <PaulistaBracketCard jogo={jogo} equipes={equipes} minhas={minhas} onOpen={onOpen}
            avancou={caminho?.conexoes.find(c => c.de === jogo.id)?.equipeId}
            empate={caminho?.conexoes.find(c => c.de === jogo.id)?.empate}
            avisos={caminho?.avisos.filter(a => a.jogos.includes(jogo.id)) ?? []} />
        </View>
      )) : <Text style={[s.muted, { paddingVertical: 24, textAlign: 'center' }]}>Nenhum confronto publicado nesta etapa.</Text>}
      {etapas.some(e => e.meuClube) && <View style={{ alignItems: 'flex-start' }}><AppButton label="Localizar meu clube" icon="shield" onPress={() => { setSelecionada([...etapas].reverse().find(e => e.meuClube)!.etapa); setLocalizar(true); }} /></View>}
      <Text style={s.tiny}>Jogos da fase selecionada. As fases seguintes podem reordenar os classificados.</Text>
    </View>
  );
});
