import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addPersonSchema, personInputSchema, type Person, type PersonInput } from '../../../src/domain/schemas';
import { HeaderSave } from './screen-frame';
import { Field, FormCard, FormError, form, labels, optional } from './form-parts';
import { copy } from '@/ui/copy';
import { page } from '@/ui/page-styles';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { ReminderPicker, parseReminders } from './reminder-picker';

export function PersonForm({ initial, onSave }: { initial?: Person; onSave: (input: PersonInput, birthday?: string, reminders?: number[]) => Promise<() => void> }) {
  const [name, setName] = useState(initial?.displayName ?? '');
  const [relationship, setRelationship] = useState(initial?.relationship ?? '');
  const [interests, setInterests] = useState(initial?.interests.map((entry) => entry.label).join(', ') ?? '');
  const [dislikes, setDislikes] = useState(initial?.dislikes?.join(', ') ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [month, setMonth] = useState(''); const [day, setDay] = useState('');
  const [reminders, setReminders] = useState('30');
  const [expanded, setExpanded] = useState(Boolean(initial));
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const pending = useRef(false);
  const values = JSON.stringify({ name, relationship, interests, dislikes, notes, month, day, reminders });
  const baseline = useRef(values).current; const guard = useUnsavedChanges(values !== baseline);
  async function save() {
    if (pending.current) return;
    setError(null);
    if (!name.trim()) { setError('Enter a name.'); return; }
    const parsed = personInputSchema.safeParse({ displayName: name, relationship: optional(relationship),
      interests: labels(interests).map((label) => initial?.interests.find((entry) => entry.label === label) ?? { label }),
      dislikes: labels(dislikes), notes: optional(notes) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the person details.'); return; }
    const birthday = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (!initial && (month || day)) {
      const result = addPersonSchema.safeParse({ displayName: name, monthDay: birthday });
      if (!result.success) { setError('Enter a valid birth month and day.'); return; }
    }
    pending.current = true; setSaving(true);
    try { const hasBirthday = !initial && Boolean(month || day); const navigate = await onSave(parsed.data, hasBirthday ? birthday : undefined, hasBirthday ? parseReminders(reminders) : undefined); guard.allowNavigation(navigate); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your input is still here.'); }
    finally { pending.current = false; setSaving(false); }
  }
  return <FormCard>{guard.dialog}
    <Field label={copy.name} value={name} onChangeText={(value) => { setName(value); setError(null); }} placeholder="e.g. Alex" maxLength={80} editable={!saving} autoCapitalize="words" />
    {!initial ? <><Text style={form.label}>{copy.birthday} (optional)</Text><Text style={form.hint}>You can add a birthday later. If entered, both month and day are needed.</Text>
      <View style={form.row}><View style={form.column}><Field label="Birth month" value={month} onChangeText={(v) => setMonth(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="MM" editable={!saving} /></View>
        <View style={form.column}><Field label="Birth day" value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="DD" editable={!saving} /></View></View></> : null}
    {!initial && (month || day) ? <ReminderPicker value={reminders} onChange={setReminders} /> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} disabled={saving} onPress={() => setExpanded(!expanded)}>
      <Text style={page.link}>{expanded ? '− Hide optional details' : '+ Add relationship & interests'}</Text>
    </Pressable>
    {expanded ? <>
      <Field label={copy.relationship} value={relationship} onChangeText={setRelationship} maxLength={200} editable={!saving} placeholder="e.g. Friend" />
      <Field label={copy.interests} hint={copy.interestsHint} value={interests} onChangeText={setInterests} multiline maxLength={2000} editable={!saving} />
      <Field label={copy.dislikes} hint="Comma-separated things to avoid when choosing a gift." value={dislikes} onChangeText={setDislikes} multiline maxLength={2000} editable={!saving} />
      <Field label={copy.notes} hint={copy.privateHint} value={notes} onChangeText={setNotes} multiline maxLength={2000} editable={!saving} />
    </> : null}
    <FormError error={error} />
    <HeaderSave label={saving ? copy.saving : initial ? copy.saveChanges : 'Save person'} disabled={saving} onPress={() => void save()} />
  </FormCard>;
}
