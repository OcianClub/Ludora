import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';
import { useAssistance } from '../contexts/AssistanceContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSessao } from '../contexts/SessaoContext';
import { AppSheet } from './ui/AppSheet';
import { AppButton } from './ui/Controls';
export function AssistanceStatus() {
  const { pauses, replies } = useAssistance(), { colors, tema } = useTheme(), { autenticado } = useSessao();
  const [open, setOpen] = useState(false); const router = useRouter(), pathname = usePathname();
  if (!pauses.length && !replies) return null;
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={pauses.length ? 'Funções em manutenção' : 'Novas respostas do suporte'} onPress={() => setOpen(true)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="alert-circle-outline" size={22} color={pauses.length ? tema === 'light' ? '#A65313' : colors.amarelo : colors.primaria} />
    </TouchableOpacity>
    {open && <AppSheet title="Avisos do Ludora" onClose={() => setOpen(false)}>
      {pauses.map(p => <View key={`${p.operacao}:${p.escopo}`} style={{ gap: 5 }}><Text style={{ color: colors.texto, fontFamily: 'Inter_600SemiBold' }}>{p.label} em manutenção</Text><Text style={{ color: colors.textoSecundario }}>{p.motivo}</Text></View>)}
      {!!replies && <Text style={{ color: colors.texto }}>O Suporte Ludora respondeu ao seu chamado.</Text>}
      {autenticado && <AppButton label="Suporte e ajuda" onPress={() => { setOpen(false); router.push({ pathname: '/suporte', params: { tela: pathname } }); }} />}
    </AppSheet>}
  </>;
}
