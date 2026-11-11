import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { criarFilaPublicacao, type ItemPublicacao } from '../utils/filaPublicacao';
const gravacoes = new Map<string, Promise<void>>();
const encerrando = new Map<string, { aguardarOciosa: () => Promise<void> }>();

/** Rascunhos cifrados, restritos à conta, clube e partida; nunca publicados em segundo plano. */
export function useFilaSumula<T>(id: number, clubeId: number, executar: (item: ItemPublicacao<T>) => Promise<void>) {
  const [pendentes, setPendentes] = useState<ItemPublicacao<T>[]>([]);
  const [restaurando, setRestaurando] = useState(true);
  const [erroPersistencia, setErroPersistencia] = useState('');
  const navigation = useNavigation();
  const executor = useRef(executar); executor.current = executar;
  const fila = useMemo(() => {
    let owner: string | null = null, active = true, ready = false;
    const key = `sumula_fila_${clubeId}_${id}`;
    const anterior = encerrando.get(key);
    const fila = criarFilaPublicacao<T>({
      executar: item => executor.current(item),
      atualizar: itens => {
        if (active) setPendentes(itens);
        if (ready && owner) {
          const serialized = JSON.stringify({ owner, itens });
          const gravacao = (gravacoes.get(key) || Promise.resolve()).catch(() => {}).then(() => SecureStore.setItemAsync(key, serialized)).catch(() => {
            if (active) setErroPersistencia('Não foi possível salvar os lançamentos no dispositivo. Aguarde a publicação ou cancele antes de sair.');
          });
          gravacoes.set(key, gravacao);
          void gravacao.then(() => { if (gravacoes.get(key) === gravacao) gravacoes.delete(key); });
        }
      },
    });
    return Object.assign(fila, {
      async carregar() {
        active = true;
        await anterior?.aguardarOciosa();
        await gravacoes.get(key)?.catch(() => {});
        owner = await SecureStore.getItemAsync('userToken');
        const saved = await SecureStore.getItemAsync(key);
        ready = true;
        if (owner && saved) {
          const value = JSON.parse(saved);
          if (value.owner === owner && Array.isArray(value.itens) && value.itens.length) {
            fila.restaurar(value.itens.filter((item: ItemPublicacao<T>) => typeof item.id === 'string' && item.dados));
          }
        }
      },
      desanexar() {
        fila.pausar(); active = false; encerrando.set(key, fila);
        void fila.aguardarOciosa().then(async () => {
          await gravacoes.get(key);
          if (encerrando.get(key) === fila) encerrando.delete(key);
        });
      },
    });
  }, [id, clubeId]);
  useEffect(() => {
    let active = true;
    setRestaurando(true);
    void fila.carregar().catch(() => { if (active) setErroPersistencia('Não foi possível recuperar os lançamentos salvos. Confira a súmula antes de registrar novamente.'); }).finally(() => { if (active) setRestaurando(false); });
    const state = AppState.addEventListener('change', value => {
      if (value !== 'active') fila.pausar();
      else if (!fila.pendentes().length) fila.retomar();
    });
    const blur = navigation.addListener('blur', () => fila.pausar());
    const focus = navigation.addListener('focus', () => { if (!fila.pendentes().length) fila.retomar(); });
    return () => { active = false; state.remove(); blur(); focus(); fila.desanexar(); };
  }, [fila, navigation]);
  return { fila, pendentes, restaurando, erroPersistencia };
}
