import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';
const palettes = {
  page: ['#FCFAF7', '#FAF8F4', '#FCFAF7'],
  rose: ['#F5E6E3', '#F3E3E6', '#F6EAE7'],
  ivory: ['#FFFCF9', '#FAF6F1', '#FDF9F6'],
  copper: ['#8A513F', '#774333', '#81503E'],
} as const;
export function PaperSurface({ tone = 'page' }: { tone?: keyof typeof palettes }) {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fill}>
    <LinearGradient colors={palettes[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.9 }} style={styles.fill} />
    <Image source={require('../../assets/textures/paper-grain.png')} resizeMode="repeat" accessible={false} style={[styles.fill, { opacity: tone === 'copper' ? 0.55 : 0.23 }]} />
  </View>;
}
const styles = StyleSheet.create({ fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } });
