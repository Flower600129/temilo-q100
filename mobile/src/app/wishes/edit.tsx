import * as Crypto from 'expo-crypto';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame, ActionButton } from '@/components/screen-frame';
import { Choice, Field, FormCard, optional } from '@/components/form-parts';
import { PersonSelector, SaveAction, useTask } from '@/components/record-parts';
import { ConfirmAction } from '@/components/confirm-action';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import { wishInputSchema, type Wish } from '../../../../src/domain/schemas';
function Editor({ initial, personId, initialOwner }: { initial?: Wish; personId?: string; initialOwner?: string }) {
  const { saveWish, deleteWish } = useMemory(); const task = useTask();
  const [id] = useState(() => initial?.id ?? Crypto.randomUUID()); const [title, setTitle] = useState(initial?.title ?? '');
  const [owner, setOwner] = useState(initial?.owner.kind ?? (personId || initialOwner === 'person' ? 'person' : 'self'));
  const [person, setPerson] = useState(initial?.owner.kind === 'person' ? initial.owner.personId : personId ?? '');
  const [url, setUrl] = useState(initial?.sourceUrl ?? ''); const [note, setNote] = useState(initial?.note ?? '');
  const [status, setStatus] = useState<Wish['status']>(initial?.status ?? 'active');
  const values = JSON.stringify({ title, owner, person, url, note, status }); const baseline = useRef(values).current;
  const guard = useUnsavedChanges(values !== baseline);
  return <>{guard.dialog}<FormCard>
    <Field label="Wish title" value={title} onChangeText={setTitle} maxLength={200} editable={!task.busy} />
    <View style={page.row}><Choice label="For me" selected={owner === 'self'} onPress={() => setOwner('self')} /><Choice label="For a friend" selected={owner === 'person'} onPress={() => setOwner('person')} /></View>
    {owner === 'person' ? <PersonSelector value={person} onChange={setPerson} disabled={task.busy} /> : null}
    <Field label="Link (optional)" hint="Save a reference link. Prices and availability are not fetched." value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" editable={!task.busy} maxLength={2000} />
    {initial?.sourceUrl ? <Link href={initial.sourceUrl as `https://${string}`} target="_blank" style={page.link}>Open saved link ↗</Link> : null}
    <Field label="Source or private note (optional)" value={note} onChangeText={setNote} multiline maxLength={2000} editable={!task.busy} />
    <View style={page.row}>{(['active', 'fulfilled', 'archived'] as const).map((entry) => <Choice key={entry} label={entry === 'active' ? 'Want' : entry === 'fulfilled' ? 'Fulfilled' : 'Archived'} selected={entry === status} onPress={() => setStatus(entry)} />)}</View>
    <SaveAction header task={task} label="Save wish" onSave={async () => { if (owner === 'person' && !person) throw new Error('Choose a friend for this wish.'); await saveWish(wishInputSchema.parse({ owner: owner === 'self' ? { kind: 'self' } : { kind: 'person', personId: person }, title, sourceUrl: optional(url), note: optional(note), status, visibility: 'private' }), id); guard.allowNavigation(() => router.replace({ pathname: '/wishes', params: { personId: owner === 'person' ? person : '', owner, status } })); }} />
  </FormCard>
    {initial?.owner.kind === 'person' ? <ActionButton label="Prepare a gift from this wish →" secondary onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: initial.owner.kind === 'person' ? initial.owner.personId : '', wishId: initial.id } })} /> : null}
    {initial ? <ConfirmAction label="Delete wish" title="Delete this wish?" description="This removes only this private wish. Gift records stay in your history." onConfirm={() => deleteWish(initial.id)} onComplete={() => guard.allowNavigation(() => router.replace('/wishes'))} /> : null}
  </>;
}
export default function WishEditorScreen() {
  const { id, personId, owner } = useLocalSearchParams<{ id?: string; personId?: string; owner?: string }>(); const { snapshot, ready, mode } = useMemory();
  const initial = snapshot.wishes.find((entry) => entry.id === id);
  return <ScreenFrame active="wishes" title={id ? 'A wish, remembered.' : 'Save a little wish.'}>
    
    {!ready ? <Text style={page.body}>Opening your wishes…</Text> : id && !initial ? <Text style={page.body}>This wish is no longer available.</Text> : <Editor key={`${mode}:${id ?? 'new'}`} initial={initial} personId={personId} initialOwner={owner} />}
  </ScreenFrame>;
}
