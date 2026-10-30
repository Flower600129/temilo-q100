import { Link, router, useFocusEffect, usePathname } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemory } from '@/context/memory';
import { colors, serif, space, touch, type } from '@/ui/theme';
import { PageActions, usePageActions, type HeaderAction, type LeaveHandler } from '@/context/page-actions';
import { useViewMemory } from '@/context/view-state';
import { PaperSurface } from './paper-surface';
export type IconName = keyof typeof Feather.glyphMap;
export function Icon({ name, size = 20, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
type Tab = 'home' | 'wishes' | 'people' | 'me' | 'about';
const tabs = [
  { key: 'home', href: '/', label: 'Home', filled: 'home', outline: 'home-outline' },
  { key: 'wishes', href: '/wishes', label: 'Wishlist', filled: 'heart', outline: 'heart-outline' },
  { key: 'people', href: '/people', label: 'Friends', filled: 'people', outline: 'people-outline' },
  { key: 'me', href: '/me', label: 'Me', filled: 'person', outline: 'person-outline' },
] as const;
export function ScreenFrame({ children, active, title, hideTabs = false }: { children: ReactNode; active?: Tab; title?: string; hideTabs?: boolean }) {
  const { mode, error, ready, reload } = useMemory();
  const pathname = usePathname();
  const topLevel = ['/', '/people', '/wishes', '/me'].includes(pathname);
  const editorialHome = pathname === '/';
  const { values } = useViewMemory();
  const scroll = useRef<ScrollView>(null);
  const scrollKey = `${mode}:${pathname}:scroll`;
  const restoreY = useRef(Number(values.get(scrollKey) ?? 0));
  useFocusEffect(useCallback(() => {
    restoreY.current = Number(values.get(scrollKey) ?? 0);
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: restoreY.current, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [values, scrollKey]));
  const [save, setSave] = useState<HeaderAction | null>(null);
  const leave = useRef<LeaveHandler | null>(null);
  const context = useMemo(() => ({ setSave, leave }), []);
  function go(action: () => void) { if (leave.current) leave.current(action); else action(); }
  const shortTitle = pathname.includes('/occasion') ? 'Important date' : pathname.includes('/gift-plan') ? 'Gift plan' : pathname.includes('/smart-gifting') ? 'Smart gifting' : pathname.includes('/inventory') ? 'Gift box' : pathname.includes('/wishes') ? 'Wish' : pathname.includes('/people') ? 'Friend' : pathname.includes('/inspiration') ? 'Saved inspiration' : pathname.includes('/gifts') ? 'Gift records' : 'Data & help';
  function back() {
    if (router.canGoBack()) router.back();
    else if (pathname.startsWith('/gift-plan/') || /^\/people\/[^/]+\/(edit|occasion)$/.test(pathname)) router.replace({ pathname: '/people/[id]', params: { id: pathname.split('/')[2] } });
    else router.replace(pathname.includes('/people/') ? '/people' : pathname.includes('/wishes/') ? '/wishes' : pathname.includes('/inventory/') ? '/inventory' : active === 'home' ? '/' : '/me');
  }
  return <PageActions.Provider value={context}><SafeAreaView style={[styles.safe, Platform.OS === 'web' && styles.webFrame]} edges={['top', 'bottom']}>
    {editorialHome ? <PaperSurface /> : null}
    {!topLevel ? <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => go(back)} style={styles.toolbarAction}><Icon name="chevron-left" /><Text style={styles.toolbarText}>Back</Text></Pressable>
        <Text accessibilityRole="header" style={styles.toolbarTitle}>{shortTitle}</Text>
        {save ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: save.disabled }} disabled={save.disabled} onPress={save.run} style={styles.toolbarAction}><Text style={[styles.toolbarSave, save.disabled && styles.pressed]}>{save.label}</Text></Pressable> : <View style={{ width: 48 }} />}
      </View> : null}
    <ScrollView ref={scroll} testID={editorialHome ? 'home-scroll' : undefined} style={styles.scroll} contentContainerStyle={[styles.content, editorialHome && styles.homeContent]} keyboardShouldPersistTaps="handled"
      scrollEventThrottle={100} onScroll={(event) => { if (topLevel && ready) { restoreY.current = event.nativeEvent.contentOffset.y; values.set(scrollKey, restoreY.current); } }}
      onContentSizeChange={() => { if (topLevel) scroll.current?.scrollTo({ y: restoreY.current, animated: false }); }}>
      {topLevel ? <View style={[styles.header, editorialHome && styles.homeHeader]}>
        <Link href="/" accessibilityLabel="TEMILO home" onPress={(event) => { event.preventDefault(); go(() => router.navigate('/')); }}><Text style={styles.brand}>TEMILO</Text></Link>
        <View style={styles.headerRight}>
          <Text style={styles.date}>{new Intl.DateTimeFormat('en', { month: editorialHome ? 'long' : 'short', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()}</Text>
          {!editorialHome || mode === 'demo' ? <Text style={styles.mode}>{mode === 'demo' ? 'FICTIONAL DEMO' : 'PRIVATE SPACE'}</Text> : null}
        </View>
      </View> : null}
      {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
      {error ? <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.errorBox}>
        <Text style={styles.errorTitle}>{ready ? 'Saved data could not be refreshed' : 'Saved data could not be loaded'}</Text><Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorText}>{ready ? 'Your last loaded records are kept. Editing is paused until reload succeeds.' : 'Existing records are kept. This is not an empty data space.'}</Text><Text style={styles.retry}>Tap to retry</Text>
      </Pressable> : null}
      {!ready && !error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>Opening saved data…</Text> : null}
      {ready ? <View style={{ gap: editorialHome ? 0 : 20, display: error ? 'none' : 'flex' }}>{children}</View> : null}
    </ScrollView>
    {!hideTabs ? <View testID="bottom-navigation" style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = active === tab.key || active === 'about' && tab.key === 'me';
        return <Link key={tab.key} href={tab.href} onPress={(event) => { event.preventDefault(); go(() => router.navigate(tab.href)); }} asChild><Pressable accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} style={styles.tab}>
          <View testID={`nav-${tab.key}-${selected ? 'filled' : 'outline'}`}><Ionicons name={selected ? tab.filled : tab.outline} size={25} color={selected ? colors.primary : colors.muted} accessible={false} /></View>
          <Text style={[styles.tabText, selected && styles.tabSelected]}>{tab.label}</Text>
        </Pressable></Link>;
      })}
    </View> : null}
  </SafeAreaView></PageActions.Provider>;
}
export function HeaderSave({ label, disabled = false, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const actions = usePageActions(); const latest = useRef(onPress); latest.current = onPress;
  const setSave = actions?.setSave;
  useEffect(() => {
    if (!setSave) return;
    setSave({ label, disabled, run: () => latest.current() });
    return () => setSave(null);
  }, [setSave, label, disabled]);
  return actions ? null : <ActionButton label={label} disabled={disabled} onPress={onPress} />;
}
export function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled) && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text></Pressable>;
}
export function SectionLabel({ children }: { children: ReactNode }) { return <Text style={styles.sectionLabel}>{children}</Text>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, webFrame: { width: '100%', maxWidth: 430, alignSelf: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line },
  scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingBottom: 36, gap: 20 },
  homeContent: { gap: 0, paddingHorizontal: 27, paddingBottom: 0 }, homeHeader: { borderBottomWidth: 0, paddingTop: 18, paddingBottom: 0, marginBottom: 0 },
  header: { paddingVertical: 25, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.line, marginBottom: 8, gap: 12 },
  brand: { fontFamily: serif, color: colors.primary, fontSize: 30, lineHeight: 44, minHeight: touch.min, letterSpacing: 0.7 }, headerRight: { alignItems: 'flex-end', gap: 5, flexShrink: 1 },
  date: { color: colors.muted, fontSize: type.small, letterSpacing: 0.2 }, mode: { color: colors.muted, fontSize: type.small, letterSpacing: 0.3 },
  toolbar: { minHeight: 64, marginHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, borderBottomWidth: 1, borderColor: colors.line, marginBottom: space.lg },
  toolbarAction: { minHeight: touch.min, minWidth: touch.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  toolbarText: { color: colors.primary, fontSize: type.action }, toolbarTitle: { flex: 1, color: colors.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' }, toolbarSave: { color: colors.primary, fontSize: type.action, fontWeight: '700', maxWidth: 112 },
  title: { fontFamily: serif, color: colors.primary, fontSize: 34, lineHeight: 40 },
  errorBox: { backgroundColor: colors.blush, borderRadius: 14, padding: 16, gap: 6 }, errorTitle: { color: colors.danger, fontWeight: '600' }, errorText: { color: colors.danger }, retry: { color: colors.primary, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line, paddingTop: 10, paddingBottom: 9 }, tab: { flex: 1, alignItems: 'center', gap: 5, minHeight: touch.min, justifyContent: 'center' },
  tabText: { width: '100%', textAlign: 'center', flexShrink: 1, fontSize: type.small, color: colors.muted }, tabSelected: { color: colors.primary, fontWeight: '600' },
  button: { minHeight: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 }, buttonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line }, secondaryButtonText: { color: colors.primary }, pressed: { opacity: 0.55 },
  sectionLabel: { color: colors.muted, fontSize: type.small, letterSpacing: 1.2, textTransform: 'uppercase' },
});
