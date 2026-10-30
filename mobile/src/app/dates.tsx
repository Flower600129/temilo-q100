import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame, Icon } from '@/components/screen-frame';
import { Choice } from '@/components/form-parts';
import { useMemory } from '@/context/memory';
import { page } from '@/ui/page-styles';
import { upcomingOccasions } from '../../../src/domain/upcoming';
import { formatBirthday, localDateKey } from '../../../src/domain/dates';
export default function DatesScreen() {
  const { snapshot } = useMemory(); const [all, setAll] = useState(false); const dates = upcomingOccasions(snapshot).filter((entry) => all || entry.inPreparationWindow);
  return <ScreenFrame active="home" title="Important dates.">
    <Text style={page.body}>Each date follows its own reminder setting. February 29 is observed on February 28 in non-leap years. Reminders appear while the app is open.</Text>
    <View style={page.row}><Choice label="In reminder window" selected={!all} onPress={() => setAll(false)} /><Choice label="All upcoming dates" selected={all} onPress={() => setAll(true)} /></View>
    {dates.length ? dates.map((entry) => <Pressable key={entry.occasion.id} accessibilityRole="button" style={page.card} onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: entry.person.id, occasionId: entry.occasion.id, occasionDate: localDateKey(entry.date) } })}>
      <View style={page.row}><Icon name="calendar" /><Text style={[page.title, { flex: 1 }]}>{entry.person.displayName} · {entry.occasion.label}</Text></View>
      <Text style={page.body}>{formatBirthday(entry.occasion.monthDay)}, {entry.date.getFullYear()} · {entry.days === 0 ? 'Today' : `${entry.days} days away`}</Text>
      <Text style={page.label}>{entry.inPreparationWindow ? 'In your reminder window' : `Starts ${Math.max(0, ...entry.occasion.reminderDaysBefore)} days before`}</Text>
    </Pressable>) : <Text style={page.body}>No upcoming dates in this view. Add or edit dates from a friend’s profile.</Text>}
  </ScreenFrame>;
}
