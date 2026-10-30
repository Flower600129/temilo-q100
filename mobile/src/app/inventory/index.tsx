import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame, ActionButton, Icon } from '@/components/screen-frame';
import { Field } from '@/components/form-parts';
import { useViewState } from '@/context/view-state';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
export default function InventoryScreen() {
  const { snapshot, ready } = useMemory(); const [query, setQuery] = useViewState('inventory:query', '');
  const items = snapshot.inventory.filter((item) => `${item.title} ${item.category ?? ''} ${item.location ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <ScreenFrame active="me" title="Your gift box.">
    <Text style={page.body}>Little things you’ve put aside, ready for the right person.</Text>
    <ActionButton label="+ Add to gift box" onPress={() => router.push('/inventory/edit')} />
    <Field label="Search gift box" value={query} onChangeText={setQuery} placeholder="Gift, category or storage location" />
    {!ready ? <Text style={page.body}>Opening your gift box…</Text> : items.length ? items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open item ${item.title}`} style={page.listRow} onPress={() => router.push({ pathname: '/inventory/edit', params: { id: item.id } })}>
      <View style={page.row}><Icon name="gift" /><Text style={[page.title, { flex: 1 }]}>{item.title}</Text><Text style={page.badge}>{item.quantity ? `${item.quantity} left` : 'Out of stock'}</Text></View>
      {item.category || item.location ? <Text style={page.body}>{[item.category, item.location].filter(Boolean).join(' · ')}</Text> : null}
      {item.unitCost !== undefined ? <Text style={page.body}>{item.currency} {item.unitCost.toFixed(2)} per item</Text> : null}
    </Pressable>) : <View style={page.card}><Text style={page.title}>A little space for future gifts.</Text><Text style={page.body}>Add an item and its quantity. Sending it will update your stock automatically.</Text></View>}
  </ScreenFrame>;
}
