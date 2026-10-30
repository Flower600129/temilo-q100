import * as Crypto from 'expo-crypto';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useMemory } from './memory';
import type { GiftDraft } from '../../../src/domain/gift-context';

type DraftStore = { save: (draft: GiftDraft) => string; read: (id?: string) => GiftDraft | undefined };
const Context = createContext<DraftStore | null>(null);

// Navigation-only memory, not a seventh business collection. A full reload can
// expire an unsaved draft; saved plans remain in the existing repository.
export function GiftDraftProvider({ children }: { children: ReactNode }) {
  const { mode } = useMemory();
  const drafts = useRef(new Map<string, GiftDraft>());
  return <Context.Provider value={{
    save(draft) {
      const id = Crypto.randomUUID();
      drafts.current.set(`${mode}:${id}`, JSON.parse(JSON.stringify(draft)));
      return id;
    },
    read(id) { return id ? drafts.current.get(`${mode}:${id}`) : undefined; },
  }}>{children}</Context.Provider>;
}
export function useGiftDrafts() {
  const context = useContext(Context);
  if (!context) throw new Error('Gift draft provider is missing.');
  return context;
}
