import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MemoryProvider } from '@/context/memory';
import { ViewStateProvider } from '@/context/view-state';
import { GiftDraftProvider } from '@/context/gift-drafts';
import { colors } from '@/ui/theme';
import { useFonts } from 'expo-font';
import { ActivityIndicator, Text, View } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ TEMILOEditorial: require('../../assets/fonts/LibreCaslonDisplay-Regular.ttf') });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.muted }}>Opening TEMILO…</Text></View>;
  return (
    <MemoryProvider>
      <GiftDraftProvider><ViewStateProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      </ViewStateProvider></GiftDraftProvider>
    </MemoryProvider>
  );
}
