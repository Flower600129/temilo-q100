import { useRef, useState } from 'react';
import { FormError } from './form-parts';
import { ActionButton, HeaderSave } from './screen-frame';
import { SearchPicker } from './search-picker';
import { useMemory } from '@/context/memory';
import { z } from 'zod';
export function useTask() {
  const pending = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>) {
    if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof z.ZodError ? cause.issues[0]?.message ?? 'Check the entered details.' : cause instanceof Error ? cause.message : 'Could not save. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return { busy, error, setError, run };
}
export function PersonSelector({ value, onChange, disabled = false }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { snapshot } = useMemory();
  return <SearchPicker label="Choose a friend" value={value} placeholder="Search friends"
    options={snapshot.people.map((person) => ({ id: person.id, title: person.displayName, subtitle: person.relationship }))}
    onSelect={(id) => { if (!disabled) onChange(id); }}
    emptyText={snapshot.people.length ? 'No friend matches this search.' : 'Add a friend first. No account is needed for them.'} />;
}
export function SaveAction({ task, label, onSave, header = false }: { header?: boolean; task: ReturnType<typeof useTask>; label: string; onSave: () => Promise<unknown> }) {
  const Button = header ? HeaderSave : ActionButton;
  return <><FormError error={task.error} /><Button label={task.busy ? 'Saving…' : label} disabled={task.busy} onPress={() => void task.run(onSave)} /></>;
}
