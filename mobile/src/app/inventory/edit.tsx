import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame } from '@/components/screen-frame';
import { Field, FormCard, optional } from '@/components/form-parts';
import { SaveAction, useTask } from '@/components/record-parts';
import { ConfirmAction } from '@/components/confirm-action';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import { inventoryInputSchema, type InventoryItem } from '../../../../src/domain/schemas';
function Editor({ initial }: { initial?: InventoryItem }) {
  const { saveInventory, deleteInventory } = useMemory(); const task = useTask(); const [id] = useState(() => initial?.id ?? Crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title ?? ''); const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [category, setCategory] = useState(initial?.category ?? ''); const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? ''); const [cost, setCost] = useState(initial?.unitCost?.toString() ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? ''); const [expected] = useState(initial?.updatedAt);
  const values = JSON.stringify({ title, quantity, category, location, description, cost, currency }); const baseline = useRef(values).current;
  const guard = useUnsavedChanges(values !== baseline);
  return <>{guard.dialog}<FormCard>
    <Field label="Gift name" value={title} onChangeText={setTitle} maxLength={200} editable={!task.busy} />
    <Field label="Quantity in stock" hint="Enter the total on hand, including a whole batch. Saving a plan does not reserve stock." value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={8} editable={!task.busy} />
    <Field label="Category (optional)" value={category} onChangeText={setCategory} maxLength={200} />
    <Field label="Storage location (optional)" value={location} onChangeText={setLocation} maxLength={200} />
    <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline maxLength={2000} />
    <View style={page.row}><View style={{ flex: 1 }}><Field label="Unit cost (optional)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" maxLength={12} /></View><View style={{ flex: 1 }}><Field label="Currency" hint="Three-letter code" value={currency} onChangeText={(value) => setCurrency(value.toUpperCase())} maxLength={3} placeholder="CNY / USD" /></View></View>
    <SaveAction header task={task} label="Save item" onSave={async () => {
      if (!/^\d+$/.test(quantity)) throw new Error('Quantity must be a whole number, zero or greater.');
      await saveInventory(inventoryInputSchema.parse({ title, quantity: Number(quantity), category: optional(category), location: optional(location), description: optional(description), unitCost: cost.trim() ? Number(cost) : undefined, currency: optional(currency) }), id, expected);
      guard.allowNavigation(() => router.replace('/inventory'));
    }} />
  </FormCard>{initial ? <ConfirmAction label="Delete item" title="Delete this item?" description="Items linked to gift records are kept. You can set their stock to zero instead." onConfirm={() => deleteInventory(initial.id)} onComplete={() => guard.allowNavigation(() => router.replace('/inventory'))} /> : null}</>;
}
export default function InventoryEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { snapshot, mode, ready } = useMemory(); const initial = snapshot.inventory.find((item) => item.id === id);
  return <ScreenFrame active="me" title={id ? 'Keep your gift box in order.' : 'Put a little gift aside.'}>
    
    {!ready ? <Text style={page.body}>Opening your gift box…</Text> : id && !initial ? <Text style={page.body}>This item is no longer available.</Text> : <Editor key={`${mode}:${id ?? 'new'}`} initial={initial} />}
  </ScreenFrame>;
}
