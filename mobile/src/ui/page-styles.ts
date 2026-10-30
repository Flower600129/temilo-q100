import { StyleSheet } from 'react-native';
import { colors, serif, type, space, radius } from './theme';
export const page = StyleSheet.create({
  heading: { fontFamily: serif, color: colors.ink, fontSize: 34, lineHeight: 41 },
  title: { fontFamily: serif, color: colors.ink, fontSize: 24, lineHeight: 30 },
  body: { color: colors.muted, fontSize: type.body, lineHeight: type.bodyLine },
  label: { color: colors.sage, fontSize: type.caption, fontWeight: '500' },
  card: { borderRadius: radius.surface, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: space.lg, gap: space.md },
  listRow: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: space.lg, gap: space.sm, minHeight: 72 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  divider: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 16, gap: 10 },
  link: { color: colors.terracotta, fontWeight: '500', fontSize: 14, lineHeight: 24, minHeight: 48, paddingVertical: 12 },
  badge: { backgroundColor: colors.blush, color: colors.terracotta, borderRadius: 9, padding: 8, overflow: 'hidden', fontSize: 12 },
});
