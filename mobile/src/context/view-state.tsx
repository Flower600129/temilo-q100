import { createContext, useContext, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { useMemory } from './memory';
const Context = createContext<Map<string, unknown> | null>(null);
// Session-only navigation state. It is never a business collection or API input.
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const values = useRef(new Map<string, unknown>()).current;
  return <Context.Provider value={values}>{children}</Context.Provider>;
}
export function useViewMemory() {
  const values = useContext(Context); const { mode } = useMemory();
  if (!values) throw new Error('View state provider is missing.');
  return { values, mode };
}
export function useViewState<T>(key: string, initial: T) {
  const { values, mode } = useViewMemory(); const storageKey = `${mode}:${key}`;
  const [value, setValue] = useState<T>(() => values.has(storageKey) ? values.get(storageKey) as T : initial);
  const activeKey = useRef(storageKey);
  // Mode changes remount the keyed list content where applicable. For shared
  // primary screens derive the visible value directly from this space's map.
  const visible = activeKey.current === storageKey ? value : values.has(storageKey) ? values.get(storageKey) as T : initial;
  function set(next: SetStateAction<T>) {
    const result = typeof next === 'function' ? (next as (previous: T) => T)(visible) : next;
    activeKey.current = storageKey; values.set(storageKey, result); setValue(result);
  }
  return [visible, set] as const;
}
