import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';
import {
  normalizarBuscaPartida,
  type CategoriaPartida,
  type CompeticaoPartida,
  type TimePartida,
} from '@/src/utils/organizarPartida';
import { PainelOrganizarPartida } from './PainelOrganizarPartida';

function EscudoOpcao({ time }: { time: TimePartida }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imagemComErro, setImagemComErro] = useState<string | null>(null);
  return (
    <View style={styles.selectionIcon}>
      {time.escudo && time.escudo !== imagemComErro ? (
        <Image
          source={{ uri: time.escudo }}
          onError={() => setImagemComErro(time.escudo)}
          style={styles.crest}
        />
      ) : (
        <Text style={styles.initial}>
          {Array.from(time.nome.trim())[0]?.toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}

type Props = {
  painel: 'competicao' | 'mandante' | 'visitante';
  competicoes: CompeticaoPartida[];
  times: TimePartida[];
  categoriaAtual?: CategoriaPartida;
  mandante: TimePartida | null;
  visitante: TimePartida | null;
  competicao: CompeticaoPartida | null | undefined;
  onSelecionarTime: (time: TimePartida) => void;
  onSelecionarCompeticao: (competicao: CompeticaoPartida | null) => void;
  onFechar: () => void;
};

export function SeletoresOrganizarPartida({
  painel,
  competicoes,
  times,
  categoriaAtual,
  mandante,
  visitante,
  competicao,
  onSelecionarTime,
  onSelecionarCompeticao,
  onFechar,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [busca, setBusca] = useState('');
  const categoriaId = categoriaAtual?.id ?? null;
  const timesDaCategoria = useMemo(
    () => times.filter((time) => time.categoria_id === categoriaId),
    [times, categoriaId]
  );
  const timesDisponiveis = useMemo(
    () =>
      timesDaCategoria.filter(
        (time) =>
          time.id !== (painel === 'mandante' ? visitante?.id : mandante?.id)
      ),
    [timesDaCategoria, painel, mandante?.id, visitante?.id]
  );
  const timesFiltrados = useMemo(
    () =>
      timesDisponiveis.filter((time) =>
        normalizarBuscaPartida(time.nome).includes(
          normalizarBuscaPartida(busca)
        )
      ),
    [timesDisponiveis, busca]
  );
  const competicoesFiltradas = useMemo(
    () =>
      competicoes.filter((item) =>
        normalizarBuscaPartida(item.nome + ' ' + item.ano).includes(
          normalizarBuscaPartida(busca)
        )
      ),
    [competicoes, busca]
  );

  return (
    <PainelOrganizarPartida
      titulo={
        painel === 'competicao'
          ? 'Selecionar competição'
          : painel === 'mandante'
            ? 'Selecionar mandante'
            : 'Selecionar visitante'
      }
      subtitulo={
        painel === 'competicao'
          ? 'Escolha uma competição ou organize um amistoso.'
          : categoriaAtual?.nome
      }
      onFechar={onFechar}
    >
      <View style={styles.searchField}>
        <Icon name="magnify" size={19} color={colors.textoSecundario} />
        <TextInput
          style={styles.input}
          value={busca}
          onChangeText={setBusca}
          placeholder={
            painel === 'competicao' ? 'Buscar competição ou ano' : 'Buscar time'
          }
          placeholderTextColor={colors.textoSecundario}
          autoCorrect={false}
          accessibilityLabel={
            painel === 'competicao' ? 'Buscar competição' : 'Buscar time'
          }
        />
        {!!busca && (
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => setBusca('')}
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
          >
            <Icon name="close" size={18} color={colors.textoSecundario} />
          </TouchableOpacity>
        )}
      </View>
      {painel === 'competicao' ? (
        <FlatList
          data={competicoesFiltradas}
          keyExtractor={(item) => String(item.id)}
          style={styles.selectorList}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.selectionItem}
              onPress={() => {
                onSelecionarCompeticao(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: competicao === null }}
            >
              <View
                style={[
                  styles.selectionIcon,
                  competicao === null && styles.selectedIcon,
                ]}
              >
                <Icon name="soccer" size={21} color={colors.primaria} />
              </View>
              <View style={styles.selectionText}>
                <Text style={styles.selectionTitle}>Amistoso</Text>
                <Text style={styles.muted}>Sem competição</Text>
              </View>
              {competicao === null && (
                <Icon name="check" size={21} color={colors.primaria} />
              )}
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <Text style={[styles.hint, styles.listHint]}>
              {busca
                ? 'Nenhuma competição encontrada para essa busca.'
                : 'Nenhuma competição cadastrada. Você pode criar um amistoso.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.selectionItem}
              onPress={() => {
                onSelecionarCompeticao(item);
              }}
              accessibilityRole="radio"
              accessibilityState={{
                checked: competicao?.id === item.id,
              }}
            >
              <View
                style={[
                  styles.selectionIcon,
                  competicao?.id === item.id && styles.selectedIcon,
                ]}
              >
                <Icon name="trophy-outline" size={21} color={colors.primaria} />
              </View>
              <View style={styles.selectionText}>
                <Text style={styles.selectionTitle}>{item.nome}</Text>
                <Text style={styles.muted}>{'Temporada ' + item.ano}</Text>
              </View>
              {competicao?.id === item.id && (
                <Icon name="check" size={21} color={colors.primaria} />
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={timesFiltrados}
          keyExtractor={(item) => String(item.id)}
          style={styles.selectorList}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon
                name="shield-outline"
                size={30}
                color={colors.textoSecundario}
              />
              <Text style={styles.emptyTitle}>
                {busca
                  ? 'Nenhum resultado para essa busca'
                  : timesDisponiveis.length === 0 && timesDaCategoria.length > 0
                    ? 'Nenhum outro time disponível'
                    : 'Nenhum time nesta categoria'}
              </Text>
              <Text style={styles.emptyDescription}>
                {busca
                  ? 'Tente outro nome ou limpe a busca.'
                  : 'Confira o cadastro dos times e suas permissões no clube.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selecionado =
              (painel === 'mandante' ? mandante : visitante)?.id === item.id;
            return (
              <TouchableOpacity
                style={styles.selectionItem}
                onPress={() => onSelecionarTime(item)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selecionado }}
              >
                <EscudoOpcao time={item} />
                <View style={styles.selectionText}>
                  <Text style={styles.selectionTitle}>{item.nome}</Text>
                  <Text style={styles.muted}>{categoriaAtual?.nome}</Text>
                </View>
                {selecionado && (
                  <Icon name="check" size={21} color={colors.primaria} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </PainelOrganizarPartida>
  );
}
