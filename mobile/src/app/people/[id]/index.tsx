import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ActionButton, ScreenFrame, SectionLabel } from '@/components/screen-frame';
import { ConfirmAction } from '@/components/confirm-action';
import { useMemory } from '@/context/memory';
import { copy } from '@/ui/copy';
import { page } from '@/ui/page-styles';
import { formatBirthday } from '../../../../../src/domain/dates';
import { upcomingOccasions } from '../../../../../src/domain/upcoming';
export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, ready, deletePerson } = useMemory();
  const person = snapshot.people.find((entry) => entry.id === id);
  const dates = snapshot.occasions.filter((entry) => entry.personId === id);
  const upcoming = upcomingOccasions(snapshot);
  return <ScreenFrame active="people">
    
    {!ready ? <Text style={page.body}>Opening your memories…</Text> : !person ? <Text style={page.body}>{copy.personMissing}</Text> : <>
      <SectionLabel>Your circle</SectionLabel><Text style={page.heading}>{person.displayName}</Text>
      <View style={page.card}>
        <Text style={page.label}>{person.relationship ?? 'Relationship not recorded'}</Text>
        <Text style={page.title}>Known interests</Text><Text style={page.body}>{person.interests.map((entry) => entry.label).join(' · ') || 'No interests recorded yet.'}</Text>
        {person.dislikes?.length ? <><Text style={page.label}>Avoid</Text><Text style={page.body}>{person.dislikes.join(' · ')}</Text></> : null}
        {person.notes ? <><Text style={page.label}>Private notes</Text><Text style={page.body}>{person.notes}</Text></> : null}
        <ActionButton label={copy.editPerson} secondary onPress={() => router.push({ pathname: '/people/[id]/edit', params: { id } })} />
      </View>
      <ActionButton label={copy.prepare} onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: id } })} />
      <ActionButton label="Find thoughtful gift ideas →" secondary onPress={() => router.push({ pathname: '/smart-gifting', params: { personId: id } })} />
      <View style={page.card}><Text style={page.title}>Their wishes</Text>
        {snapshot.wishes.filter((wish) => wish.owner.kind === 'person' && wish.owner.personId === id && wish.status === 'active').map((wish) => <Text key={wish.id} style={page.body}>• {wish.title}</Text>)}
        <ActionButton label="View & record wishes →" secondary onPress={() => router.push({ pathname: '/wishes', params: { personId: id } })} />
      </View>
      <View style={page.card}><Text style={page.title}>Gift history</Text>
        {snapshot.gifts.some((gift) => gift.personId === id && gift.status === 'given') ? snapshot.gifts.filter((gift) => gift.personId === id && gift.status === 'given').map((gift) => <Text key={gift.id} style={page.body}>{gift.giftTitle} · {gift.giftedAt}</Text>) : <Text style={page.body}>No completed gifts recorded yet.</Text>}
        <ActionButton label="View gift records →" secondary onPress={() => router.push({ pathname: '/gifts', params: { personId: id } })} />
      </View>
      <Text style={page.title}>{copy.dates}</Text>
      {dates.length ? dates.map((occasion) => {
        const next = upcoming.find((entry) => entry.occasion.id === occasion.id);
        return <View key={occasion.id} style={page.card}>
          <Text style={page.title}>{occasion.label}</Text>
          <Text style={page.body}>{formatBirthday(occasion.monthDay)}{occasion.recurrence === 'once' ? `, ${occasion.year}` : ' · Every year'}</Text>
          <Text style={page.label}>{next ? (next.days === 0 ? 'Today' : `In ${next.days} days`) : 'Past one-time date'}</Text>
          {occasion.monthDay === '02-29' && occasion.recurrence === 'annual' ? <Text style={page.body}>{copy.leapHint}</Text> : null}
          <Text style={page.body}>{occasion.reminderDaysBefore.length ? `Remind in app: ${occasion.reminderDaysBefore.join(', ')} days before` : 'No early reminders'}</Text>
          <ActionButton label={`Edit ${occasion.label}`} secondary onPress={() => router.push({ pathname: '/people/[id]/occasion', params: { id, occasionId: occasion.id } })} />
        </View>;
      }) : <Text style={page.body}>{copy.noDates}</Text>}
      <ActionButton label={`+ ${copy.addDate}`} secondary onPress={() => router.push({ pathname: '/people/[id]/occasion', params: { id } })} />
      <ConfirmAction label={copy.deletePerson} title={`Delete ${person.displayName}?`}
        description="This removes this person, their dates and their recorded wishes from this data space. People with gift or taste history cannot be deleted. Inventory quantities are not changed. This cannot be undone."
        onConfirm={() => deletePerson(id)} onComplete={() => router.replace('/people')} />
    </>}
  </ScreenFrame>;
}
