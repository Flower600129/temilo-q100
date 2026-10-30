import { StyleSheet, View } from 'react-native';
import { colors } from '@/ui/theme';
export function OccasionMark({ birthday }: { birthday: boolean }) {
  return <View accessible={false} style={styles.mark}>{birthday ? <>
    <View style={styles.cake} />
    {[7, 13, 19].map((left) => <View key={left} style={[styles.candle, { left }]} />)}
    {[7, 13, 19].map((left) => <View key={left} style={[styles.flame, { left }]} />)}
    <View style={styles.plate} />
  </> : <><View style={[styles.ring, { left: 2 }]} /><View style={[styles.ring, { left: 11 }]} /><View style={styles.jewel} /></>}</View>;
}
const styles = StyleSheet.create({
  mark: { width: 29, height: 29 }, ring: { position: 'absolute', width: 16, height: 19, borderRadius: 10, borderWidth: 1.2, borderColor: colors.accent, top: 8 }, jewel: { position: 'absolute', width: 5, height: 5, borderRadius: 1, borderWidth: 1, borderColor: colors.accent, left: 17, top: 3, transform: [{ rotate: '45deg' }] },
  cake: { position: 'absolute', width: 23, height: 14, borderWidth: 1.2, borderColor: colors.accent, left: 3, top: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, candle: { position: 'absolute', top: 6, height: 7, width: 1, backgroundColor: colors.accent }, flame: { position: 'absolute', top: 2, width: 2, height: 3, borderRadius: 2, backgroundColor: colors.accent }, plate: { position: 'absolute', left: 0, right: 0, height: 1, bottom: 2, backgroundColor: colors.accent },
});
