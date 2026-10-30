import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { ScreenFrame, SectionLabel } from '@/components/screen-frame';
import { PersonForm } from '@/components/person-form';
import { useMemory } from '@/context/memory';
import { copy } from '@/ui/copy';
import { page } from '@/ui/page-styles';
export default function NewPersonScreen() {
  const { addPerson, mode, ready } = useMemory();
  const [operationId] = useState(() => Crypto.randomUUID());
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenFrame hideTabs>
      
      <SectionLabel>Someone special</SectionLabel><Text style={page.heading}>{copy.addPerson}</Text>
      <Text style={page.body}>Start with a name. Add a birthday now or whenever you know it.</Text>
      {!ready ? <Text style={page.body}>Opening your memories…</Text> : <PersonForm key={mode} onSave={async (input, birthday, reminders) => {
        const saved = await addPerson({ ...input, monthDay: birthday, reminderDaysBefore: reminders }, operationId);
        return () => router.replace({ pathname: '/people/[id]', params: { id: saved.id } });
      }} />}
      <Text style={page.body}>{copy.privateHint}</Text>
    </ScreenFrame>
  </KeyboardAvoidingView>;
}
