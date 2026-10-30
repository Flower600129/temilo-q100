import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { HeaderSave, ScreenFrame } from '@/components/screen-frame';
import { Choice, Field, FormCard, FormError, form } from '@/components/form-parts';
import { ConfirmAction } from '@/components/confirm-action';
import { useMemory } from '@/context/memory';
import { copy } from '@/ui/copy';
import { page } from '@/ui/page-styles';
import { occasionInputSchema, type Occasion } from '../../../../../src/domain/schemas';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { ReminderPicker } from '@/components/reminder-picker';

function OccasionEditor({ personId, initial }: { personId: string; initial?: Occasion }) {
  const { snapshot, saveOccasion, deleteOccasion } = useMemory();
  const hasBirthday = snapshot.occasions.some((entry) => entry.personId === personId && entry.type === 'birthday' && entry.id !== initial?.id);
  const [id] = useState(() => initial?.id ?? Crypto.randomUUID());
  const [type, setType] = useState<Occasion['type']>(initial?.type ?? (hasBirthday ? 'anniversary' : 'birthday'));
  const [label, setLabel] = useState(initial?.label ?? (hasBirthday ? 'Anniversary' : 'Birthday'));
  const [month, setMonth] = useState(initial?.monthDay.slice(0, 2) ?? '');
  const [day, setDay] = useState(initial?.monthDay.slice(3) ?? '');
  const [year, setYear] = useState(initial?.year?.toString() ?? '');
  const [recurrence, setRecurrence] = useState<Occasion['recurrence']>(initial?.recurrence ?? 'annual');
  const [reminders, setReminders] = useState((initial?.reminderDaysBefore ?? [30]).join(', '));
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const pending = useRef(false);
  const values = JSON.stringify({ type, label, month, day, year, recurrence, reminders }); const baseline = useRef(values).current;
  const guard = useUnsavedChanges(values !== baseline);
  const done = () => guard.allowNavigation(() => router.replace({ pathname: '/people/[id]', params: { id: personId } }));
  async function save() {
    if (pending.current) return;
    setError(null);
    const tokens = reminders.trim() ? reminders.split(',').map((value) => value.trim()) : [];
    if (tokens.some((value) => !/^\d+$/.test(value))) { setError('Use comma-separated whole numbers for reminder days.'); return; }
    const value = occasionInputSchema.safeParse({ type, label, monthDay: `${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      year: recurrence === 'once' ? Number(year) : undefined, recurrence, reminderDaysBefore: tokens.map(Number) });
    if (!value.success) { setError(value.error.issues[0]?.message ?? 'Check the date.'); return; }
    pending.current = true; setSaving(true);
    try { await saveOccasion(personId, value.data, id); done(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the date. Your input is still here.'); }
    finally { pending.current = false; setSaving(false); }
  }
  return <>{guard.dialog}
    <FormCard>
      <Text style={form.label}>Date type</Text><View style={form.row}>
        {(['birthday', 'anniversary', 'other'] as const).filter((entry) => entry !== 'birthday' || !hasBirthday).map((entry) =>
          <Choice key={entry} label={entry[0].toUpperCase() + entry.slice(1)} selected={type === entry} onPress={() => {
            if (saving) return;
            setType(entry); setLabel(entry[0].toUpperCase() + entry.slice(1)); if (entry === 'birthday') setRecurrence('annual');
          }} />)}
      </View>
      <Field label={copy.dateLabel} value={label} onChangeText={setLabel} maxLength={200} editable={!saving} />
      {type !== 'birthday' ? <View style={form.row}><Choice label={copy.annual} selected={recurrence === 'annual'} onPress={() => { if (!saving) setRecurrence('annual'); }} /><Choice label={copy.once} selected={recurrence === 'once'} onPress={() => { if (!saving) setRecurrence('once'); }} /></View> : <Text style={form.hint}>{copy.annual}</Text>}
      <View style={form.row}>
        <View style={form.column}><Field label={copy.month} value={month} onChangeText={(v) => setMonth(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="MM" editable={!saving} /></View>
        <View style={form.column}><Field label={copy.day} value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="DD" editable={!saving} /></View>
        {recurrence === 'once' ? <View style={form.column}><Field label={copy.year} value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="YYYY" editable={!saving} /></View> : null}
      </View>
      {month.padStart(2, '0') === '02' && day.padStart(2, '0') === '29' && recurrence === 'annual' ? <Text style={form.hint}>{copy.leapHint}</Text> : null}
      <ReminderPicker value={reminders} onChange={setReminders} />
      <FormError error={error} /><HeaderSave label={saving ? copy.saving : 'Save date'} disabled={saving} onPress={() => void save()} />
    </FormCard>
    {initial ? <ConfirmAction label={copy.deleteDate} title={`Delete ${initial.label}?`} description="This removes the date and its in-app reminder settings. A date linked to gift history will be kept. This cannot be undone."
      onConfirm={() => deleteOccasion(personId, initial.id)} onComplete={done} /> : null}
  </>;
}
export default function OccasionScreen() {
  const { id, occasionId } = useLocalSearchParams<{ id: string; occasionId?: string }>();
  const { snapshot, ready, mode } = useMemory();
  const person = snapshot.people.find((entry) => entry.id === id);
  const initial = snapshot.occasions.find((entry) => entry.id === occasionId && entry.personId === id);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenFrame hideTabs>
      <Text style={page.heading}>{occasionId ? copy.editDate : copy.addDate}</Text>
      {!ready ? <Text style={page.body}>Opening your memories…</Text> : !person ? <Text style={page.body}>{copy.personMissing}</Text> : occasionId && !initial ? <Text style={page.body}>{copy.dateMissing}</Text> :
        <><Text style={page.body}>For {person.displayName}</Text><OccasionEditor key={`${mode}:${id}:${occasionId ?? 'new'}`} personId={id} initial={initial} /></>}
    </ScreenFrame>
  </KeyboardAvoidingView>;
}
