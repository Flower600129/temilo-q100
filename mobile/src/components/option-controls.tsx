import { createContext, createElement, useContext, useId, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, touch } from '@/ui/theme';

// Standard single-choice rows, disclosure and status tags for the gift task
// flow. They fix control semantics (real radio rows with checked state inside
// named groups, expandable detail, text-backed status); R2 folds them into the
// shared token set.

const GroupName = createContext<string | undefined>(undefined);
export function OptionRow({ label, description, selected, onPress, disabled = false }: { label: string; description?: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const name = useContext(GroupName);
  // Browser-native radios provide one tab stop per named group, arrow-key
  // selection and Space activation, as well as checked/disabled semantics.
  if (Platform.OS === 'web') return createElement('label', { style: {
    display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, boxSizing: 'border-box',
    padding: '10px 14px', border: `1px solid ${selected ? colors.primary : colors.line}`,
    borderRadius: 12, background: selected ? colors.blush : colors.white,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
  } }, createElement('input', { type: 'radio', name, checked: selected, disabled,
    'aria-label': description ? `${label} · ${description}` : label,
    onChange: onPress, style: { accentColor: colors.primary, width: 20, height: 20, flexShrink: 0, margin: 0 },
  }), <View style={option.texts}><Text style={option.label}>{label}</Text>{description ? <Text style={option.description}>{description}</Text> : null}</View>);
  return <Pressable accessibilityRole="radio" accessibilityLabel={description ? `${label} · ${description}` : label}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [option.row, selected && option.selected, (pressed || disabled) && option.dimmed]}>
    <View style={option.marker} accessibilityElementsHidden><View style={[option.dot, selected && option.dotOn]} /></View>
    <View style={option.texts}>
      <Text style={option.label}>{label}</Text>
      {description ? <Text style={option.description}>{description}</Text> : null}
    </View>
  </Pressable>;
}

// Named group wrapper for a list of OptionRows (radiogroup semantics).
export function RadioGroup({ label, children }: { label: string; children: ReactNode }) {
  const name = useId();
  return <GroupName.Provider value={name}><View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>{children}</View></GroupName.Provider>;
}

export function Expandable({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 9 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={option.toggle}>
      <Text style={option.toggleText}>{title}</Text>
      <Text style={option.toggleArrow} accessibilityElementsHidden>{open ? 'Hide' : 'Show'}</Text>
    </Pressable>
    {open ? <View style={{ gap: 9 }}>{children}</View> : null}
  </View>;
}

export function StatusTag({ status }: { status: 'ready' | 'needs-review' | 'unknown' }) {
  const text = status === 'ready' ? 'Known' : status === 'needs-review' ? 'Needs review' : 'Unknown';
  return <View style={[option.tag, status === 'needs-review' && option.tagCaution]}><Text style={option.tagText}>{text}</Text></View>;
}

const option = StyleSheet.create({
  row: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  selected: { borderColor: colors.terracotta, backgroundColor: colors.blush },
  dimmed: { opacity: 0.55 },
  marker: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 }, dotOn: { backgroundColor: colors.terracotta },
  texts: { flexShrink: 1, gap: 2 },
  label: { color: colors.ink, fontSize: 15 },
  description: { color: colors.muted, fontSize: 13 },
  toggle: { minHeight: touch.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggleText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  toggleArrow: { color: colors.muted, fontSize: 13 },
  tag: { backgroundColor: colors.blush, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  tagCaution: { backgroundColor: '#F6E3DF' },
  tagText: { color: colors.terracotta, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
});
