import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame, ActionButton } from './screen-frame';
import { Field, FormCard, optional } from './form-parts';
import { SaveAction, useTask } from './record-parts';
import { OptionRow, RadioGroup } from './option-controls';
import { SearchPicker } from './search-picker';
import { GiftRecordCard } from './gift-record-card';
import { useMemory } from '@/context/memory';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useGiftDrafts } from '@/context/gift-drafts';
import { page } from '@/ui/page-styles';
import { formatBirthday } from '../../../src/domain/dates';
import { giftInputSchema, type GiftInput } from '../../../src/domain/schemas';
import { giftInputFromRecord } from '../../../src/domain/gift-sources';
import { giftContextFor, readGiftContext, resolveGiftTask } from '../../../src/domain/gift-context';

type Task = ReturnType<typeof resolveGiftTask>;
function PlanForm({ initial }: { initial: Task }) {
  const { snapshot, createGift, updateGiftPlan } = useMemory();
  const drafts = useGiftDrafts();
  const work = useTask();
  const [id] = useState(() => Crypto.randomUUID());
  const [expected] = useState(initial.expectedUpdatedAt);
  const [source, setSource] = useState(initial.input.itemSource);
  const [itemId, setItemId] = useState(initial.input.inventoryItemId ?? '');
  const [title, setTitle] = useState(initial.input.giftTitle);
  const [quantity, setQuantity] = useState(String(initial.input.quantity));
  const [note, setNote] = useState(initial.input.note ?? '');
  const [occasionId, setOccasionId] = useState(initial.input.occasionId);
  const [occasionDate, setOccasionDate] = useState(initial.input.occasionDate);
  const [wishId, setWishId] = useState(initial.input.wishId);
  const [tasteRunId, setTasteRunId] = useState(initial.input.tasteRunId);
  const [suggestionId, setSuggestionId] = useState(initial.input.suggestionId);
  const personId = initial.input.personId;
  const wishes = snapshot.wishes.filter((wish) => wish.owner.kind === 'person' && wish.owner.personId === personId && wish.status === 'active');

  const values = JSON.stringify({ source, itemId, title, quantity, note, occasionId, occasionDate, wishId, tasteRunId, suggestionId });
  const savedPlan = snapshot.gifts.find((gift) => gift.id === initial.planId);
  const clean = savedPlan ? giftInputFromRecord(savedPlan) : { ...initial.input, itemSource: 'external', inventoryItemId: undefined, giftTitle: '', quantity: 1, note: undefined, wishId: undefined, tasteRunId: undefined, suggestionId: undefined };
  const baseline = useRef(JSON.stringify({ source: clean.itemSource, itemId: clean.inventoryItemId ?? '', title: clean.giftTitle, quantity: String(clean.quantity), note: clean.note ?? '', occasionId: clean.occasionId, occasionDate: clean.occasionDate, wishId: clean.wishId, tasteRunId: clean.tasteRunId, suggestionId: clean.suggestionId })).current; const guard = useUnsavedChanges(values !== baseline);
  function input(): GiftInput {
    if (!/^\d+$/.test(quantity) || Number(quantity) < 1) throw new Error('Use a positive whole quantity.');
    if (source === 'inventory' && !itemId) throw new Error('Choose an item from your gift box.');
    return { personId, occasionId, occasionDate, itemSource: source, inventoryItemId: source === 'inventory' ? itemId : undefined,
      quantity: Number(quantity), giftTitle: title, note: optional(note), wishId, tasteRunId, suggestionId };
  }
  function chooseOccasion(id?: string) {
    const next = resolveGiftTask(snapshot, { personId, occasionId: id }).input;
    setOccasionId(next.occasionId); setOccasionDate(next.occasionDate);
  }
  function openSmart(task: 'ideas' | 'check') {
    void work.run(async () => {
      const value = input();
      const draftId = drafts.save({ input: value, planId: initial.planId, expectedUpdatedAt: expected, check: initial.check });
      guard.allowNavigation(() => router.push({ pathname: '/smart-gifting', params: { ...giftContextFor(value, { planId: initial.planId, draftId }), task } }));
    });
  }

  return <FormCard>{guard.dialog}
    <Text style={page.title}>{initial.planId ? 'Continue this gift plan.' : 'Choose a gift.'}</Text>
    <Text style={page.body}>Saving a plan keeps stock unchanged. Mark it as given only after you have handed it over.</Text>
    <Text style={page.body}>Unsaved edits stay in this session. Save the plan before refreshing or closing the app.</Text>
    <Text style={page.label}>OCCASION</Text>
    <RadioGroup label="Occasion">
      <OptionRow label="Just because" description="No specific occasion" selected={!occasionId} onPress={() => chooseOccasion()} />
      {snapshot.occasions.filter((entry) => entry.personId === personId).map((entry) => <OptionRow key={entry.id}
        label={`${entry.label} · ${formatBirthday(entry.monthDay)}`} selected={occasionId === entry.id} onPress={() => chooseOccasion(entry.id)} />)}
    </RadioGroup>
    {occasionDate ? <Text style={page.body}>Preparing for {occasionDate}</Text> : null}
    {wishes.length ? <><Text style={page.label}>RECORDED WISHES</Text>
      <RadioGroup label="Recorded wishes">
        {wishes.map((wish) => <OptionRow key={wish.id} label={`Use wish: ${wish.title}`} selected={wishId === wish.id} onPress={() => {
          setWishId(wish.id); setTasteRunId(undefined); setSuggestionId(undefined); setTitle(wish.title); setSource('external'); setItemId('');
        }} />)}
      </RadioGroup></> : null}
    {wishId ? <Text style={page.body}>Recorded wish: {wishId === initial.input.wishId ? initial.sources.wishSnapshot?.title : wishes.find((wish) => wish.id === wishId)?.title}</Text> : null}
    {tasteRunId ? <Text style={page.body}>Saved direction: {initial.sources.tasteSnapshot?.suggestion.title}</Text> : null}
    {wishId || tasteRunId ? <ActionButton label="Clear source reference" secondary onPress={() => { setWishId(undefined); setTasteRunId(undefined); setSuggestionId(undefined); }} /> : null}
    <Text style={page.label}>GIFT SOURCE</Text>
    <RadioGroup label="Gift source">
      {([{ key: 'inventory', label: 'From gift box' }, { key: 'external', label: 'Sourced elsewhere' }, { key: 'experience', label: 'An experience' }] as const).map((entry) =>
        <OptionRow key={entry.key} label={entry.label} selected={source === entry.key} onPress={() => { setSource(entry.key); setItemId(''); }} />)}
    </RadioGroup>
    {source === 'inventory' ? <View style={{ gap: 12 }}>
      <SearchPicker label="From your gift box" value={itemId} placeholder="Search your gift box"
        options={snapshot.inventory.map((entry) => ({ id: entry.id, title: entry.title, subtitle: `${entry.quantity} left` }))}
        onSelect={(id) => { setItemId(id); setTitle(snapshot.inventory.find((entry) => entry.id === id)!.title); }}
        emptyText={snapshot.inventory.length ? 'No stock item matches this search.' : 'Your gift box is empty. Add stock first.'} />
      <ActionButton label="Manage gift box →" secondary onPress={() => router.push('/inventory')} />
    </View> : null}
    <Field label="Gift title" value={title} onChangeText={setTitle} maxLength={200} editable={!work.busy && source !== 'inventory'} />
    <Field label="Gift quantity" value={quantity} onChangeText={setQuantity} maxLength={7} keyboardType="number-pad" editable={!work.busy} />
    <Field label="Gift note (optional)" hint="Preparation note; feedback is saved separately after giving." value={note} onChangeText={setNote} maxLength={2000} multiline editable={!work.busy} />
    <ActionButton label="Find thoughtful gift ideas →" secondary onPress={() => openSmart('ideas')} disabled={work.busy} />
    <ActionButton label="Check a gift →" secondary onPress={() => openSmart('check')} disabled={work.busy} />
    <SaveAction task={work} label="Save gift plan" onSave={async () => {
      const value = giftInputSchema.parse(input());
      const saved = initial.planId ? await updateGiftPlan(initial.planId, value, expected!) : await createGift(value, id);
      guard.allowNavigation(() => router.replace({ pathname: '/gift-plan/[personId]', params: giftContextFor(value, { planId: saved.id }) }));
    }} />
  </FormCard>;
}

export default function GiftPlanView() {
  const params = useLocalSearchParams();
  const { snapshot, mode } = useMemory();
  const drafts = useGiftDrafts();
  let initial: Task | undefined;
  let error: string | undefined;
  try {
    const context = readGiftContext(params);
    initial = resolveGiftTask(snapshot, context, drafts.read(context.draftId));
  } catch (cause) { error = cause instanceof Error ? cause.message : 'This gift task is unavailable.'; }
  const personId = typeof params.personId === 'string' ? params.personId : '';
  const person = snapshot.people.find((entry) => entry.id === personId);
  const wishes = snapshot.wishes.filter((entry) => entry.owner.kind === 'person' && entry.owner.personId === personId && entry.status === 'active');
  const gifts = snapshot.gifts.filter((entry) => entry.personId === personId);
  const selected = gifts.find((entry) => entry.id === initial?.planId);
  return <ScreenFrame active="people">
    
    {error ? <><Text accessibilityRole="alert" style={page.body}>{error}</Text><ActionButton label="Start a new gift plan" onPress={() => router.replace({ pathname: '/gift-plan/[personId]', params: { personId } })} /></> : initial && person ? <>
      <Text style={page.heading}>A little care for {person.displayName}.</Text>
      <View style={page.card}>
        <Text style={page.title}>What you already know</Text>
        <Text style={page.body}>Interests: {person.interests.map((entry) => entry.label).join(' · ') || 'Not recorded'}</Text>
        <Text style={page.body}>Avoid: {person.dislikes?.join(' · ') || 'Not recorded'}</Text>
        <Text style={page.label}>Known wishes</Text>
        {wishes.length ? wishes.map((wish) => <Text key={wish.id} style={page.body}>• {wish.title}</Text>) : <Text style={page.body}>No active wishes recorded.</Text>}
        <ActionButton label="View & record wishes →" secondary onPress={() => router.push({ pathname: '/wishes', params: { personId } })} />
        <Text style={page.label}>Previously given</Text>
        {gifts.some((gift) => gift.status === 'given') ? gifts.filter((gift) => gift.status === 'given').map((gift) => <Text key={gift.id} style={page.body}>{gift.giftTitle} · {gift.giftedAt}</Text>) : <Text style={page.body}>No completed gifts recorded.</Text>}
      </View>
      {!initial.readOnly ? <PlanForm key={`${mode}:${JSON.stringify(params)}`} initial={initial} /> : <ActionButton label="Start a new gift plan" onPress={() => router.replace({ pathname: '/gift-plan/[personId]', params: { personId } })} />}
      {selected ? <GiftRecordCard key={selected.id} gift={selected} /> : null}
      {gifts.filter((gift) => gift.id !== selected?.id).slice(-5).reverse().map((gift) => <GiftRecordCard key={gift.id} gift={gift} />)}
      <ActionButton label="All gift records →" secondary onPress={() => router.push({ pathname: '/gifts', params: { personId } })} />
    </> : null}
  </ScreenFrame>;
}
