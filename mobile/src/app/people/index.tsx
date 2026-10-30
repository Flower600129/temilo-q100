import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, ScreenFrame, SectionLabel } from '@/components/screen-frame';
import { Choice, Field, form } from '@/components/form-parts';
import { useViewState } from '@/context/view-state';
import { useMemory } from '@/context/memory';
import { copy } from '@/ui/copy';
import { page } from '@/ui/page-styles';
import { formatBirthday } from '../../../../src/domain/dates';
import { upcomingOccasions } from '../../../../src/domain/upcoming';
export default function PeopleScreen() {
  const { snapshot, ready, mode } = useMemory();
  const [query, setQuery] = useViewState('people:query', ''); const [sort, setSort] = useViewState<'date' | 'name'>('people:sort', 'date');
  const upcoming = upcomingOccasions(snapshot);
  const people = snapshot.people.filter((person) => `${person.displayName} ${person.relationship ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (sort === 'date' ? (upcoming.find((e) => e.person.id === a.id)?.days ?? Infinity) - (upcoming.find((e) => e.person.id === b.id)?.days ?? Infinity) : 0) || a.displayName.localeCompare(b.displayName));
  return <ScreenFrame active="people">
    <SectionLabel>Your circle</SectionLabel><Text style={page.heading}>The people you care about.</Text>
    <ActionButton label={`+ ${copy.addPerson}`} onPress={() => router.push('/people/new')} />
    <Field label="Search people" value={query} onChangeText={setQuery} placeholder="Name or relationship" />
    <View style={form.row}><Choice label="Next date" selected={sort === 'date'} onPress={() => setSort('date')} /><Choice label="Name A–Z" selected={sort === 'name'} onPress={() => setSort('name')} /></View>
    <Text style={page.title}>Saved people · {people.length}</Text>
    {!ready ? <Text style={page.body}>Opening your memories…</Text> : people.length ? people.map((person) => {
      const next = upcoming.find((entry) => entry.person.id === person.id);
      return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`View ${person.displayName}`} style={page.listRow}
        onPress={() => router.push({ pathname: '/people/[id]', params: { id: person.id } })}>
        <Text style={page.title}>{person.displayName}</Text>
        {person.relationship ? <Text style={page.label}>{person.relationship}</Text> : null}
        <Text style={page.body}>{next ? `${next.occasion.label} · ${formatBirthday(next.occasion.monthDay)} · ${next.days === 0 ? 'Today' : `${next.days} days`}` : copy.noDates}</Text>
        <Text style={page.link}>View details →</Text>
      </Pressable>;
    }) : <View style={page.card}><Text style={page.body}>{query ? 'No people match this search.' : 'Add someone to begin your memory book.'}</Text></View>}
    {mode === 'demo' ? <Text style={page.body}>Demo people are fictional and saved separately from your own people.</Text> : null}
  </ScreenFrame>;
}
