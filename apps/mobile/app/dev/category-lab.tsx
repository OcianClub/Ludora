import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import PagerView from 'react-native-pager-view';
import Animated from 'react-native-reanimated';
import { useCategoryPagerMotion } from '@/src/hooks/useCategoryPagerMotion';
import { CategoryPageMotion } from '@/src/components/CategoryPageMotion';
import { CarrosselSubs } from '@/src/components/CarrosselSubs';
import { PositionLabel } from '@/src/components/PositionIcon';
import { useTheme } from '@/src/contexts/ThemeContext';
import { CategoryPager, type CategoryPagerHandle } from '@/src/components/CategoryPager';
const NativePager = Animated.createAnimatedComponent(PagerView);

// Development-only fixture: exercises the real components without accounts or database writes.
export default function CategoryLab() {
  const { colors, alternarTema, tema } = useTheme();
  const [engine, setEngine] = useState<'native' | 'spring'>('native');
  const nativeRef = useRef<PagerView>(null);
  const ref = useRef<CategoryPagerHandle | null>(null);
  const motion = useCategoryPagerMotion(engine === 'native' ? nativeRef : ref);
  const [selected, setSelected] = useState(0), [taps, setTaps] = useState(0);
  if (!__DEV__) return <Redirect href="/"/>;
  const pages = [0,1,2,3].map(index=><View key={index} style={{flex:1}} collapsable={false}><CategoryPageMotion index={index} progress={motion.progress} origin={motion.origin} settling={motion.settling}>
    <ScrollView contentContainerStyle={{padding:20,gap:14}}><Text style={{color:colors.texto,fontSize:32}}>Conteúdo SUB {index+1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Botão do SUB ${index+1}`} onPress={()=>setTaps(n=>n+1)} style={{padding:20,backgroundColor:colors.primaria,borderRadius:8}}><Text style={{color:colors.textoSobrePrimaria}}>Testar botão</Text></Pressable>
      {Array.from({length:18},(_,row)=><View key={row} style={{padding:28,backgroundColor:colors.card,borderRadius:8}}><Text style={{color:colors.texto}}>SUB {index+1} · linha {row+1}</Text></View>)}
    </ScrollView>
  </CategoryPageMotion></View>);
  return <View style={{ flex:1, paddingTop:36, backgroundColor:colors.fundo }}>
    <Text style={{ color:colors.texto, padding:12 }} accessibilityLabel={`Categoria selecionada ${selected + 1}`}>Laboratório · SUB {selected + 1} · toques {taps} · tema: {tema}</Text>
    <Pressable onPress={alternarTema} accessibilityRole="button" accessibilityLabel="Alternar tema"><Text style={{ color:colors.primaria, padding:12 }}>Alternar tema</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Trocar motor" onPress={()=>{setSelected(0);motion.progress.value=0;motion.origin.value=0;setEngine(value=>value==='native'?'spring':'native');}}><Text style={{color:colors.primaria,padding:12}}>Motor: {engine}</Text></Pressable>
    <View style={{ flexDirection:'row',justifyContent:'space-around' }}>{['Goleiro','Fixo','Ala','Pivô'].map(position=><PositionLabel key={position} position={position} textStyle={{ color:colors.texto,fontSize:11 }}/>)}</View>
    <CarrosselSubs tipoFiltro="INICIACAO" onTrocarTipo={()=>{}} indexAtual={selected} onChangeIndex={motion.goTo} progressoPagina={motion.progress} originPagina={motion.origin} settlingPagina={motion.settling}/>
    {engine==='native' ? <NativePager key="native" ref={nativeRef} style={{flex:1}} onPageScroll={motion.onScroll} onPageScrollStateChanged={motion.onState} onPageSelected={e=>setSelected(e.nativeEvent.position)}>{pages}</NativePager>
      : <CategoryPager key="spring" ref={ref} style={{flex:1}} progress={motion.progress} origin={motion.origin} settling={motion.settling} onSettled={motion.onSettled} onPageSelected={e=>setSelected(e.nativeEvent.position)}>{pages}</CategoryPager>}
  </View>;
}
