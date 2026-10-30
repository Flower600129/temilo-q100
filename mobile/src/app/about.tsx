import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton, ScreenFrame, SectionLabel } from '@/components/screen-frame';
import { useMemory } from '@/context/memory';
import { colors } from '@/ui/theme';
import { ConfirmAction } from '@/components/confirm-action';
import { demoReferenceTime } from '../../../src/storage/demo-seed';

export default function AboutScreen() {
  const { mode, snapshot, selectMode, resetDemo } = useMemory();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function switchMode(next: 'personal' | 'demo') {
    if (busy || next === mode) return;
    setBusy(true);
    setNotice(null);
    try { await selectMode(next); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Could not open saved data.'); }
    finally { setBusy(false); }
  }

  return (
    <ScreenFrame active="about">
      <SectionLabel>Your space</SectionLabel>
      <Text style={styles.heading}>Private by design.</Text>
      <Text style={styles.intro}>TEMILO · Time & Light. Remember people, keep their wishes close and prepare thoughtful gifts.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>On this device</Text>
        <Text style={styles.body}>People, important dates, wishes, inventory, gift records and saved inspiration are stored locally. No account is needed.</Text>
        <Text style={styles.body}>This storage is not an encrypted backup. Removing the app or clearing its data can remove your records.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your data space</Text>
        <Text style={styles.body}>Current space: {mode === 'demo' ? 'fictional demo' : 'personal'}. {snapshot.people.length} people saved.</Text>
        {mode === 'demo' ? <Text style={styles.body}>Fictional sample dates are fixed. Reference screenshots use {demoReferenceTime.slice(0, 10)}. This app uses today’s date, so reminder counts can change over time.</Text> : null}
        <ActionButton label="Personal space" secondary={mode !== 'personal'} disabled={busy || mode === 'personal'} onPress={() => void switchMode('personal')} />
        <ActionButton label="Explore demo" secondary={mode !== 'demo'} disabled={busy || mode === 'demo'} onPress={() => void switchMode('demo')} />
        {mode === 'demo' ? <ConfirmAction label="Reset fictional demo" title="Reset demo?" description="This replaces only fictional demo data. Your personal records stay as they are."
          confirmLabel="Reset demo" onConfirm={resetDemo} onComplete={() => setNotice('Demo data has been restored.')} /> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Qloo taste insights</Text>
        <Text style={styles.body}>Live results require a server key and real API verification. No recommendations are shown without evidence.</Text>
        <Text style={styles.body}>Names, birthdays and private notes are never used as Qloo search signals.</Text>
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: 'Georgia', color: colors.ink, fontSize: 36, lineHeight: 41, marginTop: -7 },
  intro: { color: colors.muted, lineHeight: 23, fontSize: 15, marginTop: -8 },
  card: { backgroundColor: colors.paper, borderRadius: 18, borderColor: colors.line, borderWidth: 1, padding: 19, gap: 13 },
  cardTitle: { fontFamily: 'Georgia', color: colors.ink, fontSize: 24 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  notice: { color: colors.sage, fontWeight: '700', lineHeight: 20 },
});
