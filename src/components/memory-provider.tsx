'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { emptySnapshot, type Snapshot } from '@/domain/schemas';
import { MemoryRepository, subscribeToChanges, type DataMode } from '@/storage/repository';
import { copy } from '@/ui/copy';

type MemoryContext = {
  snapshot: Snapshot; mode: DataMode; ready: boolean; error: string; notice: string;
  changeMode: (mode: DataMode) => Promise<void>; retry: () => Promise<void>; resetDemo: () => Promise<boolean>;
  addPerson: (input: unknown, operationId: string) => Promise<void>;
};
const Context = createContext<MemoryContext | null>(null);
export function MemoryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [mode, setMode] = useState<DataMode>('personal');
  const modeRef = useRef<DataMode>('personal');
  const sequence = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (next: DataMode) => {
    const current = ++sequence.current;
    try {
      const repository = new MemoryRepository(next);
      const value = await repository.read();
      if (current !== sequence.current) return;
      setSnapshot(value); setMode(next); modeRef.current = next;
      setError('');
      try { sessionStorage.setItem('gift-memory-mode', next); } catch { /* data persistence is independent of this preference */ }
      setReady(true);
    } catch {
      if (current === sequence.current) { setError(copy.storageError); setReady(false); }
    }
  }, []);
  const invalidate = useCallback(() => { ++sequence.current; }, []);

  useEffect(() => {
    let selected: DataMode = 'personal';
    try { if (sessionStorage.getItem('gift-memory-mode') === 'demo') selected = 'demo'; } catch { /* personal is the safe default */ }
    const initialLoad = setTimeout(() => { void load(selected); }, 0);
    const unsubscribe = subscribeToChanges(() => { void load(modeRef.current); });
    const refresh = () => { if (!document.hidden) void load(modeRef.current); };
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(initialLoad); invalidate(); unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [load, invalidate]);

  const changeMode = async (next: DataMode) => {
    setReady(false); setError(''); setNotice('');
    try {
      if (next === 'demo') await new MemoryRepository('demo').ensureDemo();
      await load(next);
    } catch { setError(copy.storageError); }
  };
  const resetDemo = async () => {
    try {
      await new MemoryRepository('demo').resetDemo();
      await load('demo'); setNotice(copy.demoResetSuccess);
      return true;
    } catch { setError(copy.storageError); return false; }
  };
  const addPerson = async (input: unknown, operationId: string) => {
    const person = await new MemoryRepository(modeRef.current).addPerson(input, operationId);
    await load(modeRef.current);
    setNotice(copy.saveSuccess(person.displayName));
  };
  return <Context.Provider value={{ snapshot, mode, ready, error, notice, changeMode, retry: () => load(modeRef.current), resetDemo, addPerson }}>{children}</Context.Provider>;
}
export function useMemory() {
  const context = useContext(Context);
  if (!context) throw new Error('MemoryProvider is required.');
  return context;
}
