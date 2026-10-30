import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Field, FormCard } from './form-parts';
import { ActionButton } from './screen-frame';
import { SaveAction, useTask } from './record-parts';
import { SearchPicker } from './search-picker';
import { useMemory } from '@/context/memory';
import { useGiftDrafts } from '@/context/gift-drafts';
import { page } from '@/ui/page-styles';
import { colors } from '@/ui/theme';
import { checkGift, giftCheckFingerprint, type GiftCheck } from '../../../src/domain/gift-check';
import { giftContextFor, type resolveGiftTask } from '../../../src/domain/gift-context';

export function GiftCheckForm({ initial, onDirtyChange }: { initial: ReturnType<typeof resolveGiftTask>; onDirtyChange?: (dirty: boolean) => void }) {
  const { snapshot } = useMemory();
  const drafts = useGiftDrafts();
  const work = useTask();
  const item = snapshot.inventory.find((entry) => entry.id === initial.input.inventoryItemId);
  const [title, setTitle] = useState(initial.input.giftTitle);
  const [inventoryId, setInventoryId] = useState(initial.input.inventoryItemId ?? '');
  const [source, setSource] = useState(initial.input.itemSource);
  const [quantity, setQuantity] = useState(String(initial.input.quantity));
  const [price, setPrice] = useState(initial.check?.price ?? item?.unitCost?.toString() ?? '');
  const [currency, setCurrency] = useState(initial.check?.currency ?? item?.currency ?? '');
  const [budget, setBudget] = useState(initial.check?.budget ?? '');
  const [budgetCurrency, setBudgetCurrency] = useState(initial.check?.budgetCurrency ?? '');
  const [checked, setChecked] = useState<{ fingerprint: string; results: GiftCheck[] } | null>(null);
  const candidate = { title, inventoryItemId: inventoryId || undefined, quantity: Number(quantity),
    price: price.trim() ? Number(price) : undefined, currency, budget: budget.trim() ? Number(budget) : undefined, budgetCurrency,
    evidenceEntityIds: initial.sources.tasteSnapshot?.suggestion.evidenceEntityIds };
  const fingerprint = giftCheckFingerprint(snapshot, initial.input.personId, candidate);
  const results = checked?.fingerprint === fingerprint ? checked.results : null;
  const pristine = { price: initial.check?.price ?? item?.unitCost?.toString() ?? '', currency: initial.check?.currency ?? item?.currency ?? '',
    budget: initial.check?.budget ?? '', budgetCurrency: initial.check?.budgetCurrency ?? '' };
  const dirty = title !== initial.input.giftTitle || inventoryId !== (initial.input.inventoryItemId ?? '') || source !== initial.input.itemSource
    || quantity !== String(initial.input.quantity) || price !== pristine.price || currency !== pristine.currency
    || budget !== pristine.budget || budgetCurrency !== pristine.budgetCurrency;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  function navigate(target: 'plan' | 'ideas') {
    void work.run(async () => {
      if (!/^\d+$/.test(quantity) || Number(quantity) < 1) throw new Error('Use a positive whole quantity.');
      const input = { ...initial.input, giftTitle: title, itemSource: source, inventoryItemId: inventoryId || undefined, quantity: Number(quantity) };
      const draftId = drafts.save({ input, planId: initial.planId, expectedUpdatedAt: initial.expectedUpdatedAt, check: { price, currency, budget, budgetCurrency } });
      const context = giftContextFor(input, { planId: initial.planId, draftId });
      if (target === 'plan') router.push({ pathname: '/gift-plan/[personId]', params: context });
      else router.replace({ pathname: '/smart-gifting', params: { ...context, task: 'ideas' } });
    });
  }

  return <FormCard>
    <Text style={page.label}>3 · CHECK A CANDIDATE</Text>
    <Text style={page.title}>Check a candidate gift.</Text>
    {initial.input.occasionDate ? <Text style={page.body}>Preparing for {initial.input.occasionDate}</Text> : null}
    <Text style={page.body}>A check of your saved facts, not a liking score. Nothing in this form is sent to Qloo.</Text>
    <SearchPicker label="From your gift box (optional)" value={inventoryId} placeholder="Search your gift box"
      options={snapshot.inventory.map((entry) => ({ id: entry.id, title: entry.title, subtitle: `${entry.quantity} left` }))}
      onSelect={(id) => {
        const picked = snapshot.inventory.find((entry) => entry.id === id);
        if (!picked) return;
        setInventoryId(id); setTitle(picked.title); setSource('inventory');
        setPrice(picked.unitCost?.toString() ?? ''); setCurrency(picked.currency ?? '');
      }}
      emptyText={snapshot.inventory.length ? 'No stock item matches this search.' : 'Your gift box is empty. Add stock first if you want to check a stored item.'} />
    <Field label="Candidate gift" hint="Editing a stock item's title switches it to an external candidate." value={title} onChangeText={(value) => { setTitle(value); setInventoryId(''); if (source === 'inventory') setSource('external'); }} maxLength={200} />
    <Field label="Candidate quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={7} />
    <View style={page.row}>
      <View style={{ flex: 1 }}><Field label="Known price (optional)" hint="Unit price; the check uses your requested quantity." value={price} onChangeText={setPrice} keyboardType="decimal-pad" maxLength={12} /></View>
      <View style={{ flex: 1 }}><Field label="Price currency" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} maxLength={3} placeholder="CNY / USD" /></View>
    </View>
    <View style={page.row}>
      <View style={{ flex: 1 }}><Field label="Budget (optional)" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" maxLength={12} /></View>
      <View style={{ flex: 1 }}><Field label="Budget currency" value={budgetCurrency} onChangeText={(value) => setBudgetCurrency(value.toUpperCase())} maxLength={3} placeholder="CNY / USD" /></View>
    </View>
    <SaveAction task={work} label="Check against my records" onSave={async () => {
      if (!/^\d+$/.test(quantity) || Number(quantity) < 1) throw new Error('Use a positive whole quantity.');
      if ([price, budget].some((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0))) throw new Error('Enter a valid nonnegative price and budget.');
      setChecked({ fingerprint, results: checkGift(snapshot, initial.input.personId, candidate) });
    }} />
    {checked && !results ? <Text accessibilityLiveRegion="polite" style={page.body}>Details or saved records changed. Check again before using these results.</Text> : null}
    {results ? <View style={{ gap: 13 }}>{results.map((check, index) => <Text key={index} style={[page.body, check.kind === 'conflict' && { color: colors.danger }]}>{check.kind === 'known' ? 'Known' : check.kind === 'conflict' ? 'Check carefully' : 'Unverified'} · {check.message}</Text>)}
      <Text style={page.body}>4 · Review the recipient, source and quantity, then save the plan. Giving is confirmed separately and never deducts stock on save.</Text>
      <ActionButton label="Prepare this gift →" onPress={() => navigate('plan')} />
    </View> : null}
    <ActionButton label="Return to gift plan" secondary onPress={() => navigate('plan')} />
  </FormCard>;
}
