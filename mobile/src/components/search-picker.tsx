import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from './screen-frame';
import { OptionRow, RadioGroup } from './option-controls';
import { colors, serif } from '@/ui/theme';

// Compact summary row that opens a searchable single-choice list in a modal.
// Keeps long friend/stock lists from flooding the main task form; after a
// pick the task continues with the selection shown as one summary row.
export type PickerOption = { id: string; title: string; subtitle?: string };
export function SearchPicker({ label, value, options, onSelect, emptyText, placeholder = 'Search', action }: {
  label: string; value: string; options: PickerOption[]; onSelect: (id: string) => void; emptyText: string; placeholder?: string; action?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.id === value);
  const name = selected ? (selected.subtitle ? `${selected.title} · ${selected.subtitle}` : selected.title) : '';
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle ? options.filter((option) => `${option.title} ${option.subtitle ?? ''}`.toLocaleLowerCase().includes(needle)) : options;
  return <View style={{ gap: 8 }}>
    <Text style={picker.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={selected ? (action ? `${action}: ${name}` : name) : label} onPress={() => { setQuery(''); setOpen(true); }}
      style={({ pressed }) => [picker.summary, pressed && picker.pressed]}>
      <View style={picker.summaryTexts}>
        <Text style={picker.summaryTitle}>{selected ? selected.title : 'Choose…'}</Text>
        {selected?.subtitle ? <Text style={picker.summarySub}>{selected.subtitle}</Text> : null}
      </View>
      <Text style={picker.chevron} accessibilityElementsHidden>›</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={picker.overlay}><View accessibilityViewIsModal style={picker.dialog}>
        <Text accessibilityRole="header" style={picker.title}>{label}</Text>
        <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={colors.muted}
          value={query} onChangeText={setQuery} style={picker.search} autoCorrect={false} />
        <ScrollView style={picker.list} keyboardShouldPersistTaps="handled">
          <RadioGroup label={label}>
            {filtered.map((option) => <OptionRow key={option.id} label={option.title} description={option.subtitle}
              selected={value === option.id} onPress={() => { onSelect(option.id); setOpen(false); }} />)}
          </RadioGroup>
          {!filtered.length ? <Text style={picker.empty}>{emptyText}</Text> : null}
        </ScrollView>
        <ActionButton label="Cancel" secondary onPress={() => setOpen(false)} />
      </View></View>
    </Modal>
  </View>;
}

const picker = StyleSheet.create({
  label: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  summary: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 10 },
  pressed: { opacity: 0.55 },
  summaryTexts: { flexShrink: 1, gap: 2 },
  summaryTitle: { color: colors.ink, fontSize: 15 },
  summarySub: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 22, lineHeight: 26 },
  overlay: { flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', padding: 22 },
  dialog: { width: '100%', maxWidth: 430, backgroundColor: colors.paper, borderRadius: 18, padding: 24, gap: 16 },
  title: { fontFamily: serif, fontSize: 24, color: colors.ink },
  search: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 10, minHeight: 48, padding: 12, color: colors.ink, fontSize: 16 },
  list: { maxHeight: 320 },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 23, paddingVertical: 8 },
});
