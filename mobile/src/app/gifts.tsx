import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame } from '@/components/screen-frame';
import { GiftRecordCard } from '@/components/gift-record-card';
import { Choice } from '@/components/form-parts';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
export default function GiftsScreen() {
  const { personId } = useLocalSearchParams<{ personId?: string }>(); const { snapshot } = useMemory(); const [status, setStatus] = useState('all');
  const gifts = snapshot.gifts.filter((gift) => (!personId || gift.personId === personId) && (status === 'all' || gift.status === status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <ScreenFrame active="me" title="Thoughtfulness, remembered.">
    <Text style={page.body}>Plans stay separate from gifts actually given. Confirming an inventory gift deducts stock once; undoing restores it once.</Text>
    <View style={page.row}>{['all', 'planned', 'given', 'cancelled'].map((entry) => <Choice key={entry} label={entry[0].toUpperCase() + entry.slice(1)} selected={entry === status} onPress={() => setStatus(entry)} />)}</View>
    {gifts.length ? gifts.map((gift) => <GiftRecordCard key={gift.id} gift={gift} />) : <Text style={page.body}>No gift records in this view. Start preparing from a friend or an important date.</Text>}
  </ScreenFrame>;
}
