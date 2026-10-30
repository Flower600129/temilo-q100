import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, type, radius, touch } from '@/ui/theme';
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={form.field}><Text style={form.label}>{label}</Text>
    {hint ? <Text style={form.hint}>{hint}</Text> : null}
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={[form.input, props.multiline && form.multiline, props.style]} />
  </View>;
}
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[form.choice, selected && form.selected]}>
    <Text style={[form.choiceText, selected && form.selectedText]}>{label}</Text></Pressable>;
}
export const FormCard = ({ children }: { children: ReactNode }) => <View style={form.card}>{children}</View>;
export const FormError = ({ error }: { error: string | null }) => error ? <Text accessibilityRole="alert" style={form.error}>{error}</Text> : null;
export const optional = (value: string) => value.trim() || undefined;
export const labels = (value: string) => [...new Set(value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean))];
export const form = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 20, gap: 18 },
  field: { gap: 7 }, label: { color: colors.ink, fontWeight: '600', fontSize: type.label }, hint: { color: colors.muted, fontSize: type.caption, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.control, minHeight: 50, padding: 13, color: colors.ink, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, column: { flex: 1, minWidth: 70 },
  choice: { borderRadius: radius.control, borderWidth: 1, borderColor: colors.line, padding: 11, minHeight: touch.min, justifyContent: 'center' },
  choiceText: { color: colors.muted, fontSize: type.action }, selected: { backgroundColor: colors.blush, borderColor: colors.terracotta },
  selectedText: { color: colors.terracotta, fontWeight: '700' }, error: { color: '#A52923', lineHeight: 21 },
});
