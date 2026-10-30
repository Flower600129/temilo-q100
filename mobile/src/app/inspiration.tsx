import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ScreenFrame, ActionButton } from '@/components/screen-frame';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import { suggestionKey } from '../../../src/domain/gift-sources';
import { entityKey } from '../../../src/domain/gift-ideas';
export default function InspirationScreen() {
  const { snapshot } = useMemory();
  return <ScreenFrame active="me" title="A little inspiration, saved.">
    <Text style={page.body}>Cultural connections are ideas to explore. They are kept separate from someone’s actual wishes.</Text>
    {!snapshot.tasteRuns.length ? <Text style={page.body}>No saved explorations yet. Verified Qloo evidence is required before inspiration can be saved.</Text> : snapshot.tasteRuns.map((run) => <View key={run.id} style={page.card}>
      <Text style={page.label}>{run.personId ? snapshot.people.find((p) => p.id === run.personId)?.displayName : 'Cultural exploration'} · {new Date(run.createdAt).toLocaleDateString('en')}</Text>
      <Text style={page.body}>Request: {run.requestStatus}</Text>
      {run.suggestions.map((suggestion, i) => <View key={i} style={{ gap: 8 }}><Text style={page.title}>{suggestion.title}</Text><Text style={page.body}>{suggestion.rationale}</Text><Text style={page.body}>{suggestion.limitations.join(' ')}</Text>
        <Text selectable style={page.body}>Evidence: {suggestion.evidenceEntityIds.join(', ')}</Text>
        {run.personId ? <ActionButton label="Add to a gift plan →" secondary onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: run.personId!, tasteRunId: run.id, suggestionId: suggestionKey(run, i) } })} /> : null}
      </View>)}
      {run.inputSignals.map((signal, i) => <Text key={i} style={page.body}>Confirmed signal: {signal.original} · {signal.qlooEntityType ?? 'Category not captured in this older record'} · {signal.qlooEntityId ?? 'Unmatched'}</Text>)}
      {run.qlooEvidence.map((evidence) => <Text key={entityKey(evidence)} selectable style={page.body}>{evidence.name} · {evidence.entityType} · {evidence.entityId}</Text>)}
    </View>)}
    <ActionButton label="Explore gift ideas →" onPress={() => router.push('/smart-gifting')} />
  </ScreenFrame>;
}
