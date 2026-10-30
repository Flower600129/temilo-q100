import { Text, View } from 'react-native';
import { ConfirmAction } from './confirm-action';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import type { GiftRecord } from '../../../src/domain/schemas';
import { useState } from 'react';
import { Field } from './form-parts';
import { SaveAction, useTask } from './record-parts';
import { router } from 'expo-router';
import { ActionButton } from './screen-frame';
import { Expandable } from './option-controls';
import { entityKey } from '../../../src/domain/gift-ideas';
export function GiftRecordCard({ gift }: { gift: GiftRecord }) {
  const { snapshot, confirmGift, cancelGift, updateGiftFeedback } = useMemory(); const task = useTask();
  const [feedback, setFeedback] = useState(gift.feedback ?? ''); const [saved, setSaved] = useState(false);
  return <View testID={`gift-record-${gift.id}`} style={page.card}>
    <Text style={page.label}>{snapshot.people.find((person) => person.id === gift.personId)?.displayName} · {gift.status === 'given' ? 'Given' : gift.status === 'planned' ? 'Planned' : 'Cancelled'}</Text>
    <Text style={page.title}>{gift.giftTitle}</Text>
    <Text style={page.body}>{gift.quantity} × {gift.itemSource === 'inventory' ? 'From your gift box' : gift.itemSource === 'experience' ? 'Experience' : 'Sourced elsewhere'}{gift.giftedAt ? ` · Given ${gift.giftedAt}` : ''}</Text>
    {gift.occasionDate ? <Text style={page.body}>Prepared for {gift.occasionDate}</Text> : null}
    {gift.note ? <><Text style={page.label}>Saved note</Text><Text style={page.body}>{gift.note}</Text></> : null}
    {gift.wishSnapshot ? <Text style={page.body}>Recorded wish: {gift.wishSnapshot.title}</Text> : null}
    {gift.tasteSnapshot ? <View style={{ gap: 6 }}><Text style={page.label}>Saved inspiration</Text><Text style={page.body}>{gift.tasteSnapshot.suggestion.title}</Text><Text style={page.body}>{gift.tasteSnapshot.suggestion.rationale}</Text><Text selectable style={page.body}>Evidence: {gift.tasteSnapshot.suggestion.evidenceEntityIds.join(', ')}</Text>
      <Expandable title="Saved source evidence">{gift.tasteSnapshot.evidence.map((entry) => <Text key={entityKey(entry)} selectable style={page.body}>{entry.name} · {entry.entityType ?? 'Category not captured'} · {entry.entityId}{entry.score === undefined ? '' : ` · ${entry.scoreField}=${entry.score}`}</Text>)}</Expandable>
    </View> : null}
    {gift.status === 'given' ? <><Field label="Gift feedback (optional)" hint="Saved separately from the preparation note." value={feedback} onChangeText={(value) => { setFeedback(value); setSaved(false); }} multiline maxLength={2000} />
      <SaveAction task={task} label={saved ? 'Feedback saved' : 'Save feedback'} onSave={async () => { await updateGiftFeedback(gift.id, feedback); setSaved(true); }} /></> : null}
    {gift.status === 'cancelled' && gift.feedback ? <Text style={page.body}>Gift feedback: {gift.feedback}</Text> : null}
    {gift.status === 'planned' ? <ActionButton label="Continue this plan →" secondary onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: gift.personId, planId: gift.id } })} /> : null}
    {gift.status === 'planned' ? <ConfirmAction label="Confirm given" title="Have you given this gift?" description={`${gift.quantity} × ${gift.giftTitle}. ${gift.itemSource === 'inventory' ? 'Stock is checked and deducted only when you confirm.' : 'This gift does not change your gift-box stock.'}`} confirmLabel="Mark as given" onConfirm={async () => { await confirmGift(gift.id); }} /> : null}
    {gift.status !== 'cancelled' ? <ConfirmAction label={gift.status === 'given' ? 'Undo gift' : 'Cancel plan'} title={gift.status === 'given' ? 'Undo this gift record?' : 'Cancel this plan?'} description={gift.status === 'given' && gift.itemSource === 'inventory' ? 'Its quantity will be restored to your gift box once. Only undo if the item is back in your possession.' : 'The record will be marked cancelled. No stock will be deducted.'} confirmLabel={gift.status === 'given' ? 'Undo & restore' : 'Cancel plan'} onConfirm={async () => { await cancelGift(gift.id); }} /> : null}
  </View>;
}
