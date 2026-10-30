import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { ScreenFrame } from '@/components/screen-frame';
import { PersonForm } from '@/components/person-form';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import { copy } from '@/ui/copy';
export default function EditPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, ready, mode, updatePerson } = useMemory();
  const person = snapshot.people.find((entry) => entry.id === id);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenFrame hideTabs>
      <Text style={page.heading}>{copy.editPerson}</Text>
      {!ready ? <Text style={page.body}>Opening your memories…</Text> : !person ? <Text style={page.body}>{copy.personMissing}</Text> :
        <PersonForm key={`${mode}:${person.id}`} initial={person} onSave={async (input) => { await updatePerson(id, input); return () => router.replace({ pathname: '/people/[id]', params: { id } }); }} />}
    </ScreenFrame>
  </KeyboardAvoidingView>;
}
