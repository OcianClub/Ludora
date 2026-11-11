import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Share, Switch, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { G, Image as SvgImage, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MATCH_METRICS } from '../../../../packages/shared-types/src/matchInsights';
import type { GestaoPartida } from '../services/partidasCompartilhadas';
import { resultadoCompartilhavel, linhasTexto } from '../utils/compartilharPartida';
import { AppSheet } from './ui/AppSheet';
import { AppButton } from './ui/Controls';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/sumulaPartidaStyles';
import LudoraLogo from '../../assets/logo.svg';

const C = { bg: '#0B0D12', card: '#14171F', shirt: '#212531', text: '#F2E9D8', muted: '#8B8D94', blue: '#0E78FF', line: '#2A3040' };
export default function CompartilharPartida({ data, link, onClose }: { data: GestaoPartida; link: string; onClose: () => void }) {
  const { colors } = useTheme(); const s = useMemo(() => createStyles(colors), [colors]);
  const [nomes, setNomes] = useState(false), [destaques, setDestaques] = useState(true), [mensagem, setMensagem] = useState(false);
  const [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [aviso, setAviso] = useState('');
  const [imagens, setImagens] = useState<Record<number, string>>({}), [carregando, setCarregando] = useState(true);
  const svg = useRef<Svg>(null), operando = useRef(false), mounted = useRef(true);
  const p = data.partida;
  const { width } = useWindowDimensions();
  const [previewWidth, setPreviewWidth] = useState(Math.min(width - 48, 560));
  const conteudo = useMemo(() => resultadoCompartilhavel(data, nomes, destaques, link), [data, nomes, destaques, link]);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    async function escudos() {
      const downloads = Promise.all([p.mandante, p.visitante].map(async time => {
        if (!time.escudo || !/^https?:\/\//.test(time.escudo)) return null;
        const path = `${FileSystem.cacheDirectory}escudo-share-${p.id}-${time.id}-${Date.now()}.img`;
        try {
          const result = await FileSystem.downloadAsync(time.escudo, path);
          if (result.status !== 200) return null;
          const info = await FileSystem.getInfoAsync(path);
          if (!info.exists || info.size > 4_000_000) return null;
          const base = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
          const mime = result.headers?.['Content-Type'] || result.headers?.['content-type'] || 'image/png';
          return [time.id, `data:${mime};base64,${base}`] as const;
        } catch { return null; }
        finally { void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {}); }
      }));
      let timer: ReturnType<typeof setTimeout> | undefined;
      // The result can still be shared with initials when image servers are slow.
      const pares = await Promise.race([downloads, new Promise<null[]>(resolve => { timer = setTimeout(() => resolve([]), 5000); })]);
      if (timer) clearTimeout(timer);
      if (active) { setImagens(Object.fromEntries(pares.flatMap(x => x ? [x] : []))); setCarregando(false); }
    }
    void escudos();
    return () => { active = false; mounted.current = false; };
  }, [p.id, p.mandante.escudo, p.visitante.escudo]);
  const txt = (value: string | number, x: number, y: number, size = 25, fill = C.text, anchor: 'start' | 'middle' | 'end' = 'start', weight = '400') => <SvgText x={x} y={y} fill={fill} fontSize={size} fontFamily="sans-serif" fontWeight={weight} textAnchor={anchor}>{value}</SvgText>;
  const divider = (y: number) => <Line x1={54} x2={1026} y1={y} y2={y} stroke={C.line} />;
  function crest(id: number, nome: string, x: number, y: number) {
    return <G><Rect x={x - 48} y={y} width={96} height={96} rx={18} fill={C.shirt} />{imagens[id] ? <SvgImage href={imagens[id]} x={x - 39} y={y + 9} width={78} height={78} preserveAspectRatio="xMidYMid meet" /> : txt(nome.slice(0, 1), x, y + 64, 48, C.text, 'middle', '600')}</G>;
  }
  let cursor = 165;
  const nomeLinhas = [p.mandante.nome, p.visitante.nome].map(n => linhasTexto(n, 24));
  const nomeAltura = Math.max(...nomeLinhas.map(n => n.length)) * 30;
  const resultadoLinhas = linhasTexto(p.gols_mandante === p.gols_visitante ? 'Empate entre as equipes' : `Vitória do ${p.gols_mandante > p.gols_visitante ? p.mandante.nome : p.visitante.nome}!`, 58);
  const metaLinhas = linhasTexto([p.competicao?.nome, p.local].filter(Boolean).join(' · '), 70).filter(Boolean);
  const placarAltura = 242 + nomeAltura + resultadoLinhas.length * 29 + metaLinhas.length * 25;
  const placar = <G><Rect x={32} y={cursor} width={1016} height={placarAltura} rx={18} fill={C.card} />{txt(`${p.categoria.nome.toUpperCase()} · ${p.data.slice(0, 10).split('-').reverse().join('/')} · ${p.horario}`, 540, cursor + 42, 24, C.muted, 'middle')}
    {crest(p.mandante_id, p.mandante.nome, 245, cursor + 65)}{crest(p.visitante_id, p.visitante.nome, 835, cursor + 65)}
    {txt(`${p.gols_mandante}  –  ${p.gols_visitante}`, 540, cursor + 143, 78, C.text, 'middle', '700')}
    {nomeLinhas.map((lines, lado) => lines.map((n, i) => <G key={`${lado}-${i}`}>{txt(n, lado ? 835 : 245, cursor + 200 + i * 30, 27, C.text, 'middle', '600')}</G>))}
    {resultadoLinhas.map((line, i) => <G key={`res-${i}`}>{txt(line, 540, cursor + 230 + nomeAltura + i * 29, 26, C.blue, 'middle', '600')}</G>)}{metaLinhas.map((line, i) => <G key={`meta-${i}`}>{txt(line, 540, cursor + 238 + nomeAltura + resultadoLinhas.length * 29 + i * 25, 21, C.muted, 'middle')}</G>)}
  </G>;
  cursor += placarAltura + 28;
  const metricY = cursor;
  const stats = <G><Rect x={32} y={metricY} width={1016} height={490} rx={18} fill={C.card} />{txt('REGISTROS DA PARTIDA', 540, metricY + 45, 23, C.muted, 'middle')}{MATCH_METRICS.map(([key, label], i) => <G key={key}>
    <Line x1={58} x2={1022} y1={metricY + 67 + i * 57} y2={metricY + 67 + i * 57} stroke={C.line} />
    {txt(conteudo.times[0].totals[key], 68, metricY + 106 + i * 57, 30, C.text, 'start', '600')}{txt(label, 552, metricY + 106 + i * 57, 25, C.muted, 'middle')}{txt(conteudo.times[1].totals[key], 1012, metricY + 106 + i * 57, 30, C.text, 'end', '600')}
    {i >= 4 ? <Rect x={400} y={metricY + 83 + i * 57} width={12} height={22} rx={3} fill={['#F0B84E', '#FF4D00', C.blue][i - 4]} /> : <G transform={`translate(392, ${metricY + 82 + i * 57})`}><Path d={i === 0 ? 'M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 5 5 4-2 6H9l-2-6z' : i === 2 ? 'M12 1 2 5v8c0 6 10 10 10 10s10-4 10-10V5zm-5 11 4 4 7-8' : 'm2 16 6-4 3-9 6 3 4 10-5 6H5z'} fill="none" stroke={C.blue} strokeWidth={2} /></G>}
  </G>)}</G>;
  cursor += 526;
  const autores: React.JSX.Element[] = [];
  if (nomes) {
    autores.push(<G key="titulo">{txt('AUTORES DOS GOLS', 52, cursor, 27, C.text, 'start', '600')}</G>); cursor += 45;
    const bases = cursor;
    const alturas = [p.mandante_id, p.visitante_id].map((timeId, lado) => {
      let y = bases; const x = lado ? 568 : 52;
      autores.push(<G key={`time-${timeId}`}>{txt(lado ? p.visitante.nome : p.mandante.nome, x, y, 24, C.muted)}</G>); y += 36;
      const goals = data.eventos.filter(e => e.tipo === 'GOL' && e.time_id === timeId);
      const grouped = new Map<string, number>();
      for (const gol of goals) { const label = `${gol.jogador?.nome || 'Autor a identificar'}${gol.gol_contra ? ' (contra)' : ''}`; grouped.set(label, (grouped.get(label) || 0) + 1); }
      for (const [name, total] of grouped) { for (const line of linhasTexto(`${total}× ${name}`, 31)) { autores.push(<G key={`${lado}-${y}`}>{txt(line, x, y, 23)}</G>); y += 30; } y += 6; }
      return y;
    }); cursor = Math.max(...alturas) + 36;
  }
  const highlights: React.JSX.Element[] = [];
  if (destaques) {
    highlights.push(<G key="titulo">{txt('DESTAQUES NOS REGISTROS · LUDORA', 52, cursor, 25, C.text, 'start', '600')}</G>); cursor += 25;
    conteudo.grupos.forEach((grupo, index) => {
      const start = cursor + 8; let y = start + 45;
      const children: React.JSX.Element[] = [<G key="titulo">{txt(grupo.titulo, 74, y, 25, C.blue, 'start', '600')}</G>]; y += 43;
      for (const player of grupo.jogadores) {
        const lines = linhasTexto(nomes ? player.name : `Camisa ${String(player.shirt).padStart(2, '0')}`, 51);
        children.push(<G key={`${player.id}-shirt`}><Rect x={72} y={y - 25} width={48} height={44} rx={7} fill={C.shirt} />{txt(String(player.shirt).padStart(2, '0'), 96, y + 5, 25, C.text, 'middle', '600')}</G>);
        for (const line of lines) { children.push(<G key={`${player.id}-${y}`}>{txt(line, 137, y, 25, C.text, 'start', '600')}</G>); y += 30; }
        for (const line of linhasTexto(`${player.team} · ${grupo.key === 'attack' ? `${player.goals} gols · ${player.assists} assist.` : `${player.saves} defesas`}`, 64)) {
          children.push(<G key={`${player.id}-dados-${y}`}>{txt(line, 137, y, 22, C.muted)}</G>); y += 27;
        }
        y += 16;
      }
      if (!grupo.jogadores.length) { children.push(<G key="empty">{txt('Sem registros com autoria.', 74, y, 24, C.muted)}</G>); y += 35; }
      highlights.push(<G key={index}><Rect x={32} y={start} width={1016} height={y - start + 10} rx={16} fill={C.card} />{children}</G>); cursor = y + 32;
    });
  }
  const totalHeight = cursor + 90;
  async function arquivo() {
    if (!svg.current) throw new Error('A prévia ainda está carregando.');
    const base64 = await new Promise<string>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Não foi possível gerar a imagem. Tente novamente.')), 15000); svg.current!.toDataURL(base => { clearTimeout(timer); resolve(base); }, { width: 1080, height: totalHeight }); });
    const uri = `${FileSystem.cacheDirectory}ludora-resultado-${p.id}.png`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return { uri, base64 };
  }
  async function enviar(salvar = false) {
    if (operando.current || carregando) return;
    operando.current = true; setBusy(true); setErro('');
    try {
      const { uri, base64 } = await arquivo();
      if (salvar && Platform.OS === 'android') {
        const permissao = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissao.granted) { const dest = await FileSystem.StorageAccessFramework.createFileAsync(permissao.directoryUri, `ludora-resultado-${p.id}.png`, 'image/png'); await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 }); if (mounted.current) setAviso('Imagem salva na pasta escolhida.'); }
      } else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: salvar ? 'Salvar imagem do resultado' : 'Compartilhar resultado' });
      else throw new Error('Compartilhamento de imagem indisponível neste dispositivo. Use a versão em texto.');
    } catch (e) { if (mounted.current) setErro((e as Error).message); }
    finally { operando.current = false; if (mounted.current) setBusy(false); }
  }
  return <AppSheet title="Compartilhar resultado" onClose={() => { if (!busy) onClose(); }} footer={<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><AppButton label="Salvar PNG" icon="arrow-down-circle" onPress={() => void enviar(true)} disabled={busy || carregando} /><AppButton label="Compartilhar imagem" icon="share" variant="primary" onPress={() => void enviar()} disabled={busy || carregando} /></View>}>
    <View onLayout={event => setPreviewWidth(event.nativeEvent.layout.width)}><Svg ref={svg} width="100%" height={Math.round(totalHeight * previewWidth / 1080)} viewBox={`0 0 1080 ${totalHeight}`}><Rect width={1080} height={totalHeight} fill={C.bg} /><G transform="translate(52,48)"><LudoraLogo width={48} height={48} /></G>{txt('LUDORA', 120, 85, 40, C.text, 'start', '700')}{txt('RESULTADO FINAL', 1026, 80, 23, C.muted, 'end')}{placar}{stats}{autores}{highlights}{txt('LUDORA · Acompanhe a súmula completa no site', 540, totalHeight - 32, 23, C.muted, 'middle')}</Svg></View>
    {(carregando || busy) && <ActivityIndicator color={colors.primaria} />}
    {[["Incluir nomes dos jogadores", nomes, setNomes], ["Incluir destaques", destaques, setDestaques]].map(([label, value, set]) => <View key={String(label)} style={s.between}><Text style={[s.name, s.flex]}>{String(label)}</Text><Switch accessibilityLabel={String(label)} value={Boolean(value)} onValueChange={set as (v: boolean) => void} trackColor={{ false: colors.cardSecundario, true: colors.primaria }} thumbColor="#fff" disabled={busy} /></View>)}
    <TouchableOpacity accessibilityRole="button" onPress={() => setMensagem(v => !v)}><Text style={s.link}>{mensagem ? 'Ocultar texto' : 'Ver versão em texto'}</Text></TouchableOpacity>{mensagem && <Text selectable style={s.text}>{conteudo.texto}</Text>}
    <AppButton label="Compartilhar texto" icon="share" onPress={() => void Share.share({ message: conteudo.texto }).catch(() => setErro('Não foi possível abrir o compartilhamento.'))} />
    <AppButton label="Copiar link da partida" icon="clipboard-text-outline" onPress={() => void Clipboard.setStringAsync(link).then(() => setAviso('Link copiado.')).catch(() => setErro('Não foi possível copiar o link.'))} />
    {!!erro && <Text accessibilityRole="alert" style={s.error}>{erro}</Text>}{!!aviso && <Text accessibilityLiveRegion="polite" style={s.text}>{aviso}</Text>}
  </AppSheet>;
}
