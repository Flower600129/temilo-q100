import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame, ActionButton, Icon } from '@/components/screen-frame';
import { Choice, Field } from '@/components/form-parts';
import { SearchPicker } from '@/components/search-picker';
import { useViewState } from '@/context/view-state';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
function WishesList({ personId, initialStatus, initialOwner }: { personId?: string; initialStatus?: string; initialOwner?: string }) {
  const { snapshot, ready } = useMemory();
  const [owner, setOwner] = useViewState<'self' | 'person'>(`wishes:${personId ?? ''}:owner`, personId || initialOwner === 'person' ? 'person' : 'self');
  const [status, setStatus] = useViewState(`wishes:${personId ?? ''}:status`, initialStatus && ['active', 'fulfilled', 'archived'].includes(initialStatus) ? initialStatus : 'active'); const [query, setQuery] = useViewState(`wishes:${personId ?? ''}:query`, ''); const [person, setPerson] = useViewState(`wishes:${personId ?? ''}:person`, personId ?? '');
  const wishes = snapshot.wishes.filter((wish) => wish.owner.kind === owner && wish.status === status && (!person || wish.owner.kind === 'person' && wish.owner.personId === person) && wish.title.toLowerCase().includes(query.toLowerCase()));
  return <ScreenFrame active="wishes" title="Little wishes, kept close.">
    <Text style={page.body}>Your own wishes and the things you’ve heard them mention. Private, and always yours to edit.</Text>
    <View style={page.row}><Choice label="My wishes" selected={owner === 'self'} onPress={() => { setOwner('self'); setPerson(''); }} /><Choice label="Friends’ wishes" selected={owner === 'person'} onPress={() => setOwner('person')} /></View>
    <ActionButton label="+ Save a wish" onPress={() => router.push({ pathname: '/wishes/edit', params: { personId: owner === 'person' ? person : '', owner } })} />
    <Field label="Search wishes" value={query} onChangeText={setQuery} placeholder="A book, a place, a little idea…" />
    <View style={page.row}>{(['active', 'fulfilled', 'archived'] as const).map((value) => <Choice key={value} label={value === 'active' ? 'Want' : value === 'fulfilled' ? 'Fulfilled' : 'Archived'} selected={status === value} onPress={() => setStatus(value)} />)}</View>
    {owner === 'person' ? <SearchPicker label="Filter by friend" value={person || '*'} placeholder="Search friends" options={[{ id: '*', title: 'All friends' }, ...snapshot.people.map((p) => ({ id: p.id, title: p.displayName }))]} onSelect={(id) => setPerson(id === '*' ? '' : id)} emptyText="No friends match this search." /> : null}
    {!ready ? <Text style={page.body}>Opening your wishes…</Text> : wishes.length ? wishes.map((wish) => <Pressable key={wish.id} accessibilityRole="button" accessibilityLabel={`Open wish ${wish.title}`} style={page.listRow} onPress={() => router.push({ pathname: '/wishes/edit', params: { id: wish.id } })}>
      <Text style={page.label}>{wish.owner.kind === 'self' ? 'For me' : snapshot.people.find((p) => p.id === (wish.owner.kind === 'person' ? wish.owner.personId : ''))?.displayName}</Text>
      <View style={page.row}><Text style={[page.title, { flex: 1 }]}>{wish.title}</Text><Icon name="chevron-right" size={18} /></View>
      {wish.note ? <Text numberOfLines={2} style={page.body}>{wish.note}</Text> : null}
    </Pressable>) : <View style={page.card}><Text style={page.title}>Room for a little wish.</Text><Text style={page.body}>No wishes match this view. Save a thought whenever one comes to mind.</Text></View>}
  </ScreenFrame>;
}

export default function WishesScreen() {
  const { personId, status, owner } = useLocalSearchParams<{ personId?: string; status?: string; owner?: string }>();
  const { mode } = useMemory();
  return <WishesList key={`${mode}:${personId ?? ""}:${status ?? ""}:${owner ?? ""}`} personId={personId} initialStatus={status} initialOwner={owner} />;
}
