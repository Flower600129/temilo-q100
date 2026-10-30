import { Text, View } from 'react-native';
import { Choice, Field } from './form-parts';
import { page } from '@/ui/page-styles';
export function parseReminders(value: string): number[] {
  if (!value.trim()) return [];
  const tokens = value.split(',').map((entry) => entry.trim());
  if (tokens.length > 20 || tokens.some((entry) => !/^\d+$/.test(entry) || Number(entry) > 365)) throw new Error('Use whole reminder days from 0 to 365, separated by commas.');
  return [...new Set(tokens.map(Number))].sort((a, b) => b - a);
}
export function ReminderPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View style={{ gap: 10 }}><Text style={page.label}>Start preparing in advance</Text>
    <View style={page.row}>{[7, 14, 30, 60].map((day) => <Choice key={day} label={`${day} days`} selected={value.trim() === String(day)} onPress={() => onChange(String(day))} />)}</View>
    <Field label="In-app reminder days" hint="Or choose your own days (0–365). Multiple reminders: 30, 7, 1. Leave blank for the event day only. Cards stay visible throughout your preparation window. No push notifications." value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" maxLength={100} />
  </View>;
}
