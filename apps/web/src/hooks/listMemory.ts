import { useState } from 'react';

const states = new Map<string, unknown>();

export function readListState<T>(key: string, fallback: T): T {
  return (states.get(key) as T | undefined) ?? fallback;
}

export function rememberListState<T>(key: string, value: T) {
  states.delete(key);
  states.set(key, value);
  if (states.size > 120) states.delete(states.keys().next().value!);
}

export function useListState<T>(key: string, fallback: T) {
  const [, render] = useState(0);
  const value = readListState(key, fallback);
  const setValue = (update: T | ((previous: T) => T)) => {
    const previous = readListState(key, fallback);
    rememberListState(key, typeof update === 'function' ? (update as (previous: T) => T)(previous) : update);
    render(version => version + 1);
  };
  return [value, setValue] as const;
}
