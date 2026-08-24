import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';
import { Image, Text, View } from 'react-native';

import { conviteStyles as styles } from '@/src/styles/conviteStyles';

import type { CategoriaConvite, ClubeConvite, PapelConvite } from '../types';

interface ConviteClubeCardProps {
  clube: ClubeConvite;
  papel: PapelConvite;
  categorias: CategoriaConvite[];
  acessoTodasCategorias: boolean;
  convidadoPor?: string;
  compacto?: boolean;
}

const ROTULOS_PAPEL: Record<PapelConvite, string> = {
  ADMIN: 'ADMINISTRADOR',
  TECNICO: 'TÉCNICO',
  MESARIO: 'MESÁRIO',
};

export function ConviteClubeCard({
  clube,
  papel,
  categorias,
  acessoTodasCategorias,
  convidadoPor,
  compacto = false,
}: ConviteClubeCardProps) {
  const local = [clube.cidade, clube.estado].filter(Boolean).join(', ');

  return (
    <View style={[styles.clubCard, compacto && styles.clubCardCompacto]}>
      <View style={styles.clubHeader}>
        {clube.escudo ? (
          <Image source={{ uri: clube.escudo }} style={styles.clubShield} resizeMode="contain" />
        ) : (
          <View style={styles.clubShieldFallback}>
            <Icon name="shield-outline" size={28} color={colors.primaria} />
          </View>
        )}

        <View style={styles.clubIdentity}>
          <Text style={styles.clubName} numberOfLines={1}>{clube.nome}</Text>
          {!!local && <Text style={styles.clubLocation}>{local}</Text>}
          {!!convidadoPor && (
            <Text style={styles.invitedBy}>Convite enviado por {convidadoPor}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardDetailsRow}>
        <View style={styles.cardDetailBlock}>
          <Text style={styles.cardDetailLabel}>FUNÇÃO</Text>
          <Text style={styles.roleText}>{ROTULOS_PAPEL[papel]}</Text>
        </View>

        <View style={[styles.cardDetailBlock, styles.categoriesBlock]}>
          <Text style={styles.cardDetailLabel}>CATEGORIAS</Text>
          <View style={styles.categoryList}>
            {acessoTodasCategorias ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>TODAS</Text>
              </View>
            ) : categorias.length > 0 ? (
              categorias.map(categoria => (
                <View key={categoria.id} style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{categoria.nome.toUpperCase()}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyCategories}>Não informadas</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
