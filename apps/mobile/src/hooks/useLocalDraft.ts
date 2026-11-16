import { useEffect, useMemo, useState, useCallback, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const writes = new Map<string, Promise<void>>();
function persist(path: string, value: unknown) {
  const text = JSON.stringify(value);
  const task = (writes.get(path) || Promise.resolve()).catch(() => {}).then(() => FileSystem.writeAsStringAsync(path, text));
  writes.set(path, task);
  void task.finally(() => { if (writes.get(path) === task) writes.delete(path); }).catch(() => {});
  return task;
}
// Private app files, separated by account/club. Never persist credentials.
export function useLocalDraft<T>(key: string, initial: T) {
  const path = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}draft-${key.replace(/[^a-z0-9_-]/gi, '_')}.json` : null;
  const holder = useMemo(() => ({ value: initial, ready: false }), [path]);
  const [state, setState] = useState({ path, value: initial, ready: false }), [saved, setSaved] = useState(false);
  if (state.path === path) { holder.value = state.value; holder.ready = state.ready; }
  useEffect(() => {
    let active = true; setSaved(false);
    (async () => {
      let value = initial;
      try { if (path) {
        await writes.get(path)?.catch(() => {});
        if ((await FileSystem.getInfoAsync(path)).exists) {
          const data = JSON.parse(await FileSystem.readAsStringAsync(path));
          if (data && typeof data === 'object' && Object.keys(initial as object).every(k => typeof data[k] === typeof (initial as any)[k])) value = data;
        }
      } } catch { /* A damaged draft does not block the form. */ }
      if (active) setState({ path, value, ready: true });
    })();
    const flush = () => { if (path && holder.ready) void persist(path, holder.value).catch(() => {}); };
    const listener = AppState.addEventListener('change', s => { if (s !== 'active') flush(); });
    return () => { active = false; listener.remove(); flush(); };
  }, [path, holder]);
  useEffect(() => {
    if (!path || state.path !== path || !state.ready) return;
    let active = true; setSaved(false);
    const timer = setTimeout(() => { void persist(path, state.value).then(() => { if (active) setSaved(true); }).catch(() => { if (active) setSaved(false); }); }, 650);
    return () => { active = false; clearTimeout(timer); };
  }, [state, path]);
  const setValue = useCallback((next: SetStateAction<T>) => setState(old => {
    if (old.path !== path || !old.ready) return old;
    return { ...old, value: typeof next === 'function' ? (next as (v: T) => T)(old.value) : next };
  }), [path]);
  return { value: state.path === path ? state.value : initial, setValue, ready: state.path === path && state.ready, saved };
}
