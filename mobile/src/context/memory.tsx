import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { emptySnapshot, type CreatePersonInput, type Person, type PersonInput, type Occasion, type OccasionInput, type Snapshot, type GiftInput, type GiftRecord, type WishInput, type Wish, type InventoryInput, type InventoryItem, type TasteRun } from '../../../src/domain/schemas';
import { type DataMode } from '../../../src/domain/snapshot-repository';
import { nativeRepository, readDataMode, saveDataMode, subscribeToChanges } from '@/storage/native';
type MemoryState = {
  mode: DataMode; snapshot: Snapshot; ready: boolean; error: string | null;
  reload: () => Promise<void>; selectMode: (mode: DataMode) => Promise<void>;
  addPerson: (input: CreatePersonInput, operationId: string) => Promise<Person>;
  updatePerson: (id: string, input: PersonInput) => Promise<Person>; deletePerson: (id: string) => Promise<void>;
  saveOccasion: (personId: string, input: OccasionInput, id: string) => Promise<Occasion>;
  deleteOccasion: (personId: string, id: string) => Promise<void>; resetDemo: () => Promise<void>;
  saveWish: (input: WishInput, id: string) => Promise<Wish>; deleteWish: (id: string) => Promise<void>;
  saveInventory: (input: InventoryInput, id: string, expected?: string) => Promise<InventoryItem>; deleteInventory: (id: string) => Promise<void>;
  createGift: (input: GiftInput, id: string) => Promise<GiftRecord>; confirmGift: (id: string, date?: string) => Promise<GiftRecord>;
  cancelGift: (id: string) => Promise<GiftRecord>; saveTasteRun: (run: TasteRun) => Promise<TasteRun>;
  updateGiftFeedback: (id: string, note: string) => Promise<GiftRecord>;
  updateGiftPlan: (id: string, input: GiftInput, expected: string) => Promise<GiftRecord>;
};
const MemoryContext = createContext<MemoryState | null>(null);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not read data saved on this device.';
export function MemoryProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataMode>('personal'); const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false); const [error, setError] = useState<string | null>(null);
  const modeRef = useRef<DataMode>('personal'); const initialized = useRef(false); const requestId = useRef(0);
  const loadError = useRef<string | null>(null);
  const reload = useCallback(async () => {
    const current = ++requestId.current;
    try {
      const selected = initialized.current ? modeRef.current : await readDataMode();
      const stored = await nativeRepository(selected).read();
      if (current === requestId.current) {
        initialized.current = true; modeRef.current = selected;
        setMode(selected); setSnapshot(stored); setError(null); loadError.current = null; setReady(true);
      }
    } catch (cause) { if (current === requestId.current) { const message = errorMessage(cause); loadError.current = message; setError(message); setReady(initialized.current); } }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void reload(); }, 0);
    const stop = subscribeToChanges(() => { void reload(); });
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void reload(); });
    return () => { clearTimeout(timer); stop(); listener.remove(); };
  }, [reload]);
  const selectMode = useCallback(async (selected: DataMode) => {
    const current = ++requestId.current;
    if (selected === 'demo') await nativeRepository('demo').ensureDemo();
    const stored = await nativeRepository(selected).read();
    await saveDataMode(selected);
    if (current === requestId.current) {
      initialized.current = true; modeRef.current = selected;
      setMode(selected); setSnapshot(stored); setError(null); loadError.current = null; setReady(true);
    }
  }, []);
  async function mutate<T>(action: () => Promise<T>): Promise<T> {
    if (!initialized.current || loadError.current) throw new Error('Reload saved data before making changes. Existing records have been kept.');
    const result = await action(); await reload(); return result;
  }
  const value: MemoryState = {
    mode, snapshot, ready, error, reload, selectMode,
    addPerson: (input, id) => mutate(() => nativeRepository(modeRef.current).addPerson(input, id)),
    updatePerson: (id, input) => mutate(() => nativeRepository(modeRef.current).updatePerson(id, input)),
    deletePerson: (id) => mutate(() => nativeRepository(modeRef.current).deletePerson(id)),
    saveOccasion: (personId, input, id) => mutate(() => nativeRepository(modeRef.current).saveOccasion(personId, input, id)),
    deleteOccasion: (personId, id) => mutate(() => nativeRepository(modeRef.current).deleteOccasion(personId, id)),
    saveWish: (input, id) => mutate(() => nativeRepository(modeRef.current).saveWish(input, id)),
    deleteWish: (id) => mutate(() => nativeRepository(modeRef.current).deleteWish(id)),
    saveInventory: (input, id, expected) => mutate(() => nativeRepository(modeRef.current).saveInventory(input, id, expected)),
    deleteInventory: (id) => mutate(() => nativeRepository(modeRef.current).deleteInventory(id)),
    createGift: (input, id) => mutate(() => nativeRepository(modeRef.current).createGift(input, id)),
    confirmGift: (id, date) => mutate(() => nativeRepository(modeRef.current).confirmGift(id, date)),
    cancelGift: (id) => mutate(() => nativeRepository(modeRef.current).cancelGift(id)),
    saveTasteRun: (run) => mutate(() => nativeRepository(modeRef.current).saveTasteRun(run)),
    updateGiftFeedback: (id, feedback) => mutate(() => nativeRepository(modeRef.current).updateGiftFeedback(id, feedback)),
    updateGiftPlan: (id, input, expected) => mutate(() => nativeRepository(modeRef.current).updateGiftPlan(id, input, expected)),
    resetDemo: () => mutate(() => nativeRepository('demo').resetDemo()),
  };
  return <MemoryContext.Provider value={value}>{children}</MemoryContext.Provider>;
}
export function useMemory(): MemoryState {
  const context = useContext(MemoryContext);
  if (!context) throw new Error('MemoryProvider is missing.');
  return context;
}
