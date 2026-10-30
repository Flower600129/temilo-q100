import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame, ActionButton } from '@/components/screen-frame';
import { Choice, Field, FormCard, labels } from '@/components/form-parts';
import { PersonSelector, SaveAction, useTask } from '@/components/record-parts';
import { useMemory } from '@/context/memory';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { useGiftDrafts } from '@/context/gift-drafts';
import { GiftCheckForm } from '@/components/gift-check-form';
import { ConfirmDialog } from '@/components/confirm-action';
import { Expandable, OptionRow, RadioGroup, StatusTag } from '@/components/option-controls';
import { SearchPicker } from '@/components/search-picker';
import { giftContextFor, readGiftContext, resolveGiftTask } from '../../../src/domain/gift-context';
import { giftInputFromRecord, suggestionKey } from '../../../src/domain/gift-sources';
import { directionBlockReason, entityKey, giftDirections, uniqueEntities } from '../../../src/domain/gift-ideas';
import { tasteRequest } from '@/lib/taste-api';
import { page } from '@/ui/page-styles';
import { colors } from '@/ui/theme';
import { candidateToGiftInput, decisionSummary, exploreReadiness, localCandidates, type LocalCandidate } from '../../../src/domain/gift-decision';
import { formatBirthday } from '../../../src/domain/dates';
import { tasteRunSchema, type Person, type TasteRun } from '../../../src/domain/schemas';
import { exploreInput, resolveInput, resolveResultSchema, qlooResultSchema, targetCategories, type ResolveResult, type QlooEntity } from '../../../src/qloo/contracts';

// One gift task, four logical steps: recipient & occasion → known facts →
// candidate & check (manual or cultural exploration) → review & save plan.
// Steps share one task context; each shows what is known, what happens next,
// and keeps results bound to the inputs that produced them.
function ForPerson({ person, task: taskName, initial }: { person: Person; task: string; initial: ReturnType<typeof resolveGiftTask> }) {
  const { snapshot, saveTasteRun } = useMemory(); const work = useTask();
  const drafts = useGiftDrafts();
  const [input, setInput] = useState(initial.input);
  const initialSignals = useRef(person.interests.slice(0, 3).map((entry) => entry.label).join('\n')).current;
  const [signals, setSignals] = useState(initialSignals);
  const [cleanSignals, setCleanSignals] = useState(initialSignals);
  const [consent, setConsent] = useState(false); const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({}); const [category, setCategory] = useState<(typeof targetCategories)[number]>('urn:entity:book');
  const [run, setRun] = useState<TasteRun | null>(null); const [runFacts, setRunFacts] = useState<string | null>(null);
  const [saved, setSaved] = useState(false); const [message, setMessage] = useState('');
  const [cleared, setCleared] = useState(false); const [checkDirty, setCheckDirty] = useState(false);
  const [pendingPerson, setPendingPerson] = useState<string | null>(null);
  // Guards in-flight Qloo responses: any input change bumps the sequence, so a
  // late answer for old signals/entities/category can never cover the new task.
  const requestSeq = useRef(0);
  useEffect(() => () => { requestSeq.current += 1; }, []);
  const summary = decisionSummary(snapshot, person.id);
  const candidates = localCandidates(snapshot, person.id);
  const occasions = snapshot.occasions.filter((entry) => entry.personId === person.id);
  const occasion = occasions.find((entry) => entry.id === input.occasionId);
  const readiness = exploreReadiness(summary.recordedInterests, labels(signals));
  // Person-relevant facts the exploration results were computed against.
  // Another tab can change these while a response is in flight, so handlers
  // read the latest values through a ref instead of their stale closure.
  const factsFingerprint = JSON.stringify({
    dislikes: person.dislikes ?? [],
    interests: person.interests,
    wishes: snapshot.wishes.filter((wish) => wish.owner.kind === 'person' && wish.owner.personId === person.id && wish.status === 'active').map((wish) => [wish.id, wish.title]),
    gifts: snapshot.gifts.filter((gift) => gift.personId === person.id).map((gift) => [gift.id, gift.status, gift.giftTitle, gift.inventoryItemId ?? null, gift.tasteSnapshot?.suggestion.evidenceEntityIds ?? []]),
    stock: snapshot.inventory.map((item) => [item.id, item.title, item.quantity, item.unitCost, item.currency]),
  });
  const latest = useRef({ snapshot, facts: factsFingerprint });
  latest.current = { snapshot, facts: factsFingerprint };
  const runStale = Boolean(run && runFacts !== null && runFacts !== factsFingerprint);
  // Real edit comparison, not draft existence: interests, occasion/candidate
  // input (against the saved plan or an empty task), check-form edits and
  // unsaved exploration results. A saved run no longer counts as unsaved.
  const savedPlan = snapshot.gifts.find((gift) => gift.id === initial.planId);
  const baseInput = useRef(savedPlan ? giftInputFromRecord(savedPlan) : { personId: person.id, occasionId: initial.input.occasionId, occasionDate: initial.input.occasionDate, itemSource: 'external', quantity: 1, giftTitle: '' }).current;
  const inputDirty = (['giftTitle', 'note', 'itemSource', 'inventoryItemId', 'quantity', 'occasionId', 'occasionDate', 'wishId', 'tasteRunId', 'suggestionId'] as const)
    .some((key) => JSON.stringify((input as Record<string, unknown>)[key] ?? null) !== JSON.stringify((baseInput as Record<string, unknown>)[key] ?? null));
  const hasUnsaved = signals !== cleanSignals || inputDirty || checkDirty || Boolean((resolved || run) && !saved);

  const guard = useUnsavedChanges(hasUnsaved);

  async function requestCurrent<T>(action: () => Promise<T>, seq: number, facts: string): Promise<T | undefined> {
    try {
      const result = await action();
      if (seq !== requestSeq.current) return undefined;
      if (latest.current.facts !== facts) { setMessage('Saved records changed while exploring. Run the exploration again for current directions.'); return undefined; }
      return result;
    } catch (error) {
      // Failures are bound to the same context as successes. A late error must
      // never replace the status of a newer task or changed saved records.
      if (seq === requestSeq.current && latest.current.facts === facts) throw error;
      return undefined;
    }
  }

  function open(task: 'ideas' | 'check' | 'plan') {
    const draftId = drafts.save({ input, planId: initial.planId, expectedUpdatedAt: initial.expectedUpdatedAt, check: initial.check });
    const context = giftContextFor(input, { planId: initial.planId, draftId });
    if (task === 'plan') guard.allowNavigation(() => router.push({ pathname: '/gift-plan/[personId]', params: context }));
    else guard.allowNavigation(() => router.replace({ pathname: '/smart-gifting', params: { ...context, task } }));
  }
  function chooseOccasion(id?: string) {
    const next = resolveGiftTask(snapshot, { personId: person.id, occasionId: id }).input;
    setInput((current) => ({ ...current, occasionId: next.occasionId, occasionDate: next.occasionDate }));
  }
  function invalidateExploration() {
    requestSeq.current += 1;
    const hadResults = Boolean(resolved) || Boolean(run) || Object.keys(chosen).length > 0;
    setResolved(null); setChosen({}); setRun(null); setRunFacts(null); setSaved(false); setMessage('');
    if (hadResults) setCleared(true);
  }
  function invalidateRun() {
    requestSeq.current += 1;
    if (run) setCleared(true);
    setRun(null); setRunFacts(null); setSaved(false); setMessage('');
  }
  function switchPerson(id: string) {
    setPendingPerson(null);
    guard.allowNavigation(() => router.replace({ pathname: '/smart-gifting', params: { personId: id, task: taskName } }));
  }
  function pickCandidate(candidate: LocalCandidate) {
    void work.run(async () => {
      const next = candidateToGiftInput(candidate, input);
      setInput(next);
      const draftId = drafts.save({ input: next, planId: initial.planId, expectedUpdatedAt: initial.expectedUpdatedAt, check: initial.check });
      guard.allowNavigation(() => router.replace({ pathname: '/smart-gifting', params: { ...giftContextFor(next, { planId: initial.planId, draftId }), task: 'check' } }));
    });
  }

  return <>{guard.dialog}
    <View style={page.card}>
      <Text style={page.label}>1 · RECIPIENT & OCCASION</Text>
      <Text style={page.title}>For {person.displayName}{occasion ? ` · ${occasion.label}` : ''}</Text>
      {input.occasionDate ? <><Text style={page.body}>Preparing for {input.occasionDate}</Text><Text style={page.body}>The occasion year stays with this task.</Text></>
        : <Text style={page.body}>No occasion selected — this will be a just-because gift.</Text>}
      <SearchPicker label="Recipient" action="Change recipient" value={person.id} placeholder="Search friends"
        options={snapshot.people.map((entry) => ({ id: entry.id, title: entry.displayName, subtitle: entry.relationship }))}
        onSelect={(id) => { if (id !== person.id && !work.busy) { if (hasUnsaved) setPendingPerson(id); else switchPerson(id); } }}
        emptyText={snapshot.people.length ? 'No friend matches this search.' : 'Add a friend first. No account is needed for them.'} />
      <Expandable title="Change occasion">
        <RadioGroup label={`Occasion for ${person.displayName}`}>
          <OptionRow label="Just because" description="No specific occasion" selected={!input.occasionId} onPress={() => chooseOccasion()} />
          {occasions.map((entry) => <OptionRow key={entry.id} label={`${entry.label} · ${formatBirthday(entry.monthDay)}`}
            description={resolveGiftTask(snapshot, { personId: person.id, occasionId: entry.id }).input.occasionDate}
            selected={input.occasionId === entry.id} onPress={() => chooseOccasion(entry.id)} />)}
        </RadioGroup>
      </Expandable>
    </View>
    <View style={page.card}>
      <Text style={page.label}>2 · WHAT YOU ALREADY KNOW</Text>
      <Text style={page.title}>Start with recorded facts.</Text>
      <Text style={page.body}>Active wishes: {summary.activeWishes.slice(0, 3).join(' · ') || 'None recorded'}{summary.activeWishes.length > 3 ? ` · +${summary.activeWishes.length - 3} more` : ''}</Text>
      <Text style={page.body}>Avoid: {summary.avoids.join(' · ') || 'Not recorded'}</Text>
      <Text style={page.body}>Gift box: {summary.stockCount} item(s) with stock available</Text>
      <Expandable title={`Previously given (${summary.givenTitles.length})`}>
        {summary.givenTitles.length ? summary.givenTitles.map((title, index) => <Text key={index} style={page.body}>• {title}</Text>)
          : <Text style={page.body}>No completed gifts recorded.</Text>}
      </Expandable>
      <Text style={page.label}>CANDIDATES FROM YOUR RECORDS</Text>
      {candidates.length ? candidates.map((candidate) => <Pressable key={candidate.id} accessibilityRole="button" accessibilityLabel={candidate.title}
        disabled={work.busy} onPress={() => pickCandidate(candidate)} style={({ pressed }) => [page.divider, pressed && { opacity: 0.55 }]}>
        <View style={page.row}><StatusTag status={candidate.status} />
          <Text style={page.body}>{candidate.kind === 'inventory' ? 'From your gift box' : candidate.kind === 'wish-with-stock' ? 'Their wish · in your gift box' : 'Their recorded wish'}</Text></View>
        <Text style={page.title}>{candidate.title}</Text>
        {candidate.facts.map((fact) => <Text key={fact} style={page.body}>• {fact}</Text>)}
        {candidate.cautions.map((caution) => <Text key={caution} style={[page.body, { color: colors.danger }]}>• {caution}</Text>)}
        {candidate.unknowns.map((unknown) => <Text key={unknown} style={page.body}>• {unknown}</Text>)}
        <Text style={page.link}>Check this candidate →</Text>
      </Pressable>) : <Text style={page.body}>No wish or stock candidates yet. Record a wish for them, add stock, check a specific gift, or explore cultural connections below.</Text>}
      {taskName !== 'check' ? <>
        <ActionButton label="Continue with a gift plan →" secondary onPress={() => open('plan')} />
        <ActionButton label="Check a gift" onPress={() => open('check')} />
      </> : null}
    </View>
    {taskName === 'check' ? <GiftCheckForm initial={{ ...initial, input }} onDirtyChange={setCheckDirty} /> : <FormCard>
      <Text style={page.label}>3 · OPTIONAL CULTURAL EXPLORATION</Text>
      <Text style={page.title}>Explore cultural connections.</Text>
      <Text style={page.body}>Optional — the wishes and stock above already complete a gift plan without it. Only the cultural interests you confirm are sent; names, dates, notes and records stay on this device.</Text>
      {!readiness.ok ? <Text accessibilityLiveRegion="polite" style={[page.body, { color: colors.terracotta }]}>{readiness.hint}</Text> : null}
      {!readiness.ok && !summary.recordedInterests.length ? <ActionButton label="Add interests on their profile →" secondary onPress={() => router.push({ pathname: '/people/[id]/edit', params: { id: person.id } })} /> : null}
      <Field label="Cultural interests to send" hint="Separate with new lines or commas. Up to three public artists, works or brands — never personal names or private details." value={signals} onChangeText={(value) => { setSignals(value); invalidateExploration(); work.setError(null); }} multiline maxLength={365} />
      <Choice label="I confirm these are cultural interests and agree to query Qloo" selected={consent} onPress={() => { if (!work.busy) setConsent(!consent); }} />
      <SaveAction task={work} label="1. Find verified entities" onSave={async () => {
        if (!consent) throw new Error('Confirm the cultural signals before querying Qloo.');
        const parsed = resolveInput.safeParse({ interests: labels(signals) });
        if (!parsed.success) throw new Error('Enter one to three cultural interests, each 2–120 characters.');
        const seq = requestSeq.current;
        setResolved(null); setChosen({}); setRun(null); setRunFacts(null); setSaved(false); setMessage(''); setCleared(false);
        const response = await requestCurrent(async () => resolveResultSchema.parse(await tasteRequest('resolve', parsed.data)), seq, latest.current.facts);
        if (!response) return;
        setResolved(response);
        if (response.status === 'no_match') setMessage('No verified entity match. Try a more specific work, artist or brand.');
      }} />
      {cleared && !resolved && !run ? <Text accessibilityLiveRegion="polite" style={page.body}>Input changed. Previous results, if any, are no longer shown for this task.</Text> : null}
      {resolved ? <View style={{ gap: 16 }}><Text style={page.title}>2. Confirm the right entities.</Text>
        {resolved.matches.map((match) => <View key={match.input} style={{ gap: 8 }}><Text style={page.label}>{match.input}</Text>
          <RadioGroup label={`Verified entities for ${match.input}`}>
            {uniqueEntities(match.result.entities).map((entity) => <OptionRow key={entityKey(entity)} label={entity.name}
              description={entity.entityType?.replace('urn:entity:', '') ?? 'category unknown'}
              selected={chosen[match.input] === entityKey(entity)}
              onPress={() => { if (!work.busy) { setChosen({ ...chosen, [match.input]: entityKey(entity) }); invalidateRun(); } }} />)}
          </RadioGroup>
          {!match.result.entities.length ? <Text style={page.body}>No verified match for this signal.</Text> : null}
        </View>)}
        <Text style={page.body}>Choose one target category. You choose the interpretation; Qloo provides cross-domain associations.</Text>
        <RadioGroup label="Target cultural category">
          {targetCategories.map((entry) => <OptionRow key={entry} label={entry.replace('urn:entity:', '')} selected={category === entry}
            onPress={() => { if (!work.busy && category !== entry) { setCategory(entry); invalidateRun(); } }} />)}
        </RadioGroup>
        <ActionButton label={work.busy ? 'Exploring…' : '3. Explore cultural connections'} disabled={work.busy} onPress={() => void work.run(async () => {
          const sources = resolved.matches.flatMap((match) => match.result.entities.filter((entity) => chosen[match.input] === entityKey(entity)));
          const parsed = exploreInput.safeParse({ entityIds: [...new Set(sources.map((entity) => entity.entityId))], targetCategory: category });
          if (!parsed.success) throw new Error('Confirm at least one verified entity above.');
          if (sources.length && sources.every((entity) => entity.entityType === category)) throw new Error('Choose a different category to explore across domains.');
          const seq = requestSeq.current;
          const factsAtRequest = latest.current.facts;
          setRun(null); setRunFacts(null); setSaved(false); setMessage(''); setCleared(false);
          const response = await requestCurrent(async () => qlooResultSchema.parse(await tasteRequest('explore', parsed.data)), seq, factsAtRequest);
          if (!response) return;
          if (!response.entities.length) { setMessage('Qloo returned no cultural connections. Try another category or signal.'); return; }
          const suggestions = giftDirections(latest.current.snapshot, person.id, response.entities);
          // Identity is type+ID: a returned entity sharing an ID with a source
          // keeps both entries instead of overwriting the user's confirmed
          // category; the request itself still sends plain entity IDs.
          const evidence = [...new Map([...sources, ...response.entities].map((entry: QlooEntity) => [entityKey(entry), entry])).values()];
          const nextRun = tasteRunSchema.parse({ id: Crypto.randomUUID(), personId: person.id, inputSignals: resolved.matches.map((match) => { const confirmed = sources.find((entity) => entityKey(entity) === chosen[match.input]); return { original: match.input, matched: Boolean(chosen[match.input]), qlooEntityId: confirmed?.entityId, qlooEntityType: confirmed?.entityType }; }), requestStatus: response.warnings.length || resolved.status !== 'success' ? 'partial' : 'success', qlooEvidence: evidence.map(({ entityId, entityType, name, score, scoreField, explainability }) => ({ entityId, entityType, name, score, scoreField, explainability })), suggestions, requestedAt: response.requestedAt, createdAt: new Date().toISOString() });
          setRun(nextRun); setRunFacts(latest.current.facts); setMessage(response.warnings.join(' '));
        })} />
      </View> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={page.body}>{message}</Text> : null}
      {work.error ? <Text style={page.body}>You can retry, choose another category, or continue manually with the wishes and stock above.</Text> : null}
      {run ? <View style={{ gap: 20 }}>
        <Text style={page.body}>Steps executed: interests resolved → entities confirmed by you → explored {category.replace('urn:entity:', '')} connections.</Text>
        <Text style={page.body}>Using a direction in a plan also saves this exploration and its evidence.</Text>
        {runStale ? <Text accessibilityRole="alert" style={[page.body, { color: colors.danger }]}>Saved records for this friend changed after these results were produced. Explore again before using a direction; the actions below are disabled.</Text> : null}
        <Text style={page.title}>Directions to explore.</Text>
        <Text style={page.body}>Each direction separates the Qloo association, what to check yourself, and the recorded evidence. Titles, prices and availability are not verified facts.</Text>
        {run.suggestions.length ? run.suggestions.map((suggestion, index) => <View key={suggestion.id ?? index} style={page.divider}>
          <Text style={page.title}>{suggestion.title}</Text>
          <Text style={page.label}>QLOO ASSOCIATION</Text>
          <Text style={page.body}>{suggestion.rationale}</Text>
          <Text style={page.label}>CHECK BEFORE DECIDING</Text>
          {suggestion.limitations.map((limit) => <Text key={limit} style={page.body}>• {limit}</Text>)}
          <Expandable title="Evidence & raw scores">
            {run.qlooEvidence.filter((entry) => suggestion.evidenceEntityIds.includes(entry.entityId)).map((entry) => <Text key={entityKey(entry)} selectable style={page.body}>
              {entry.name} · {entry.entityType?.replace('urn:entity:', '') ?? 'category unknown'} · {entry.entityId}{entry.score !== undefined ? ` · ${entry.scoreField}=${entry.score} (association strength, not a liking probability)` : ''}
            </Text>)}
          </Expandable>
          <ActionButton label="Use in a gift plan →" secondary disabled={work.busy || runStale} onPress={() => void work.run(async () => {
            if (runFacts !== latest.current.facts) throw new Error('Saved records changed. Explore again before using this direction.');
            // Final re-check against the records as they are right now: avoids
            // or history may have changed since the results were produced.
            const entity = run.qlooEvidence.find((entry) => entityKey(entry) === suggestion.id) ?? run.qlooEvidence.find((entry) => suggestion.evidenceEntityIds.includes(entry.entityId));
            const blocked = entity ? directionBlockReason(latest.current.snapshot, person.id, entity) : 'This direction no longer has stored evidence.';
            if (blocked) throw new Error(blocked);
            await saveTasteRun(run); setSaved(true); setCleanSignals(signals);
            const next = { ...input, itemSource: 'external' as const, inventoryItemId: undefined, giftTitle: suggestion.title, tasteRunId: run.id, suggestionId: suggestionKey(run, index) };
            const draftId = drafts.save({ input: next, planId: initial.planId, expectedUpdatedAt: initial.expectedUpdatedAt });
            router.push({ pathname: '/gift-plan/[personId]', params: giftContextFor(next, { planId: initial.planId, draftId }) });
          })} />
        </View>) : <Text style={page.body}>No directions passed the title checks. You can review the returned evidence or continue manually.</Text>}
        <ActionButton label={saved ? 'Exploration saved' : 'Save this exploration'} disabled={work.busy || saved || runStale} onPress={() => void work.run(async () => { if (runFacts !== latest.current.facts) throw new Error('Saved records changed. Explore again before saving.'); await saveTasteRun(run); setSaved(true); setCleanSignals(signals); })} />
        <Expandable title={`All returned evidence (${run.qlooEvidence.length})`}>
          {run.qlooEvidence.map((entity) => <Text key={entityKey(entity)} selectable style={page.body}>{entity.name} · {entity.entityType ?? 'Unknown category'} · {entity.entityId}</Text>)}
        </Expandable>
      </View> : null}
    </FormCard>}
    <ConfirmDialog open={pendingPerson !== null} title="Leave this gift task?"
      description="This task has unsaved edits — interests, occasion, a candidate, or exploration results. Switching friends discards them; saved plans and records are kept."
      confirmLabel="Discard & switch" onConfirm={() => pendingPerson && switchPerson(pendingPerson)} onCancel={() => setPendingPerson(null)} />
  </>;
}
export default function SmartGiftingScreen() {
  const params = useLocalSearchParams();
  const { snapshot, mode } = useMemory();
  const drafts = useGiftDrafts();
  const personId = typeof params.personId === 'string' ? params.personId : '';
  const task = params.task === 'check' ? 'check' : 'ideas';
  const person = snapshot.people.find((entry) => entry.id === personId);
  let initial: ReturnType<typeof resolveGiftTask> | undefined;
  let error: string | undefined;
  try {
    if (personId) {
      const context = readGiftContext(params);
      initial = resolveGiftTask(snapshot, context, drafts.read(context.draftId));
      if (initial.readOnly) throw new Error('This plan has already been completed or cancelled. Reopen its record.');
    }
  } catch (cause) { error = cause instanceof Error ? cause.message : 'This gift task is unavailable.'; }
  return <ScreenFrame active="home" title="A little help, choosing well.">
    <Text style={page.body}>Smart gifting · your known wishes, past gifts and available stock come first.</Text>
    {!personId ? <View style={page.row}>
      <Choice label="Find gift ideas" selected={task === 'ideas'} onPress={() => router.replace('/smart-gifting')} />
      <Choice label="Check a gift" selected={task === 'check'} onPress={() => router.replace('/smart-gifting?task=check')} />
    </View> : null}
    {!personId ? <><PersonSelector value={personId} onChange={(id) => router.replace({ pathname: '/smart-gifting', params: { personId: id, task } })} />
      {!snapshot.people.length ? <ActionButton label="+ Add a person" onPress={() => router.push('/people/new')} /> : null}</>
      : null}
    {error ? <><Text accessibilityRole="alert" style={page.body}>{error}</Text><ActionButton label="Start a new task" onPress={() => router.replace({ pathname: '/smart-gifting', params: { personId, task } })} /></>
      : person && initial ? <ForPerson key={`${mode}:${JSON.stringify(readGiftContext(params))}`} person={person} task={task} initial={initial} />
        : !personId ? null : <Text style={page.body}>Choose a friend to begin.</Text>}
  </ScreenFrame>;
}
