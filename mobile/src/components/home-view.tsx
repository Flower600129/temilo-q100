import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, ScreenFrame } from './screen-frame';
import { PaperSurface } from './paper-surface';
import { OccasionMark } from './home-marks';
import { useMemory } from '@/context/memory';
import { colors, serif, softShadow, type, touch } from '@/ui/theme';
import { formatBirthday, localDateKey } from '../../../src/domain/dates';
import { upcomingOccasions, type UpcomingBirthday } from '../../../src/domain/upcoming';

const prepare = (entry: UpcomingBirthday) => router.push({ pathname: '/gift-plan/[personId]', params: { personId: entry.person.id, occasionId: entry.occasion.id, occasionDate: localDateKey(entry.date) } });
function BirthdayDeck({ entries }: { entries: UpcomingBirthday[] }) {
  const [position, setPosition] = useState(0); const [width, setWidth] = useState(342); const [cardHeight, setCardHeight] = useState(372);
  const drag = useRef(new Animated.Value(0)).current; const reduced = useRef(false);
  const index = position % entries.length; const main = entries[index];
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduced.current = value; });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduced.current = value; });
    return () => listener.remove(); }, []);
  function move(direction: number) { setPosition((value) => (value + direction + entries.length) % entries.length); drag.setValue(0); }
  const gesture = PanResponder.create({
    onMoveShouldSetPanResponder: (_, state) => entries.length > 1 && Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.3,
    onMoveShouldSetPanResponderCapture: (_, state) => entries.length > 1 && Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, state) => { if (!reduced.current) drag.setValue(Math.max(-75, Math.min(75, state.dx))); },
    onPanResponderRelease: (_, state) => {
      if (Math.abs(state.dx) > 45 || Math.abs(state.vx) > 0.5) move(state.dx < 0 ? 1 : -1);
      else Animated.timing(drag, { toValue: 0, duration: reduced.current ? 0 : 170, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => drag.setValue(0),
  });
  const cardWidth = Math.min(260, width - 48);
  function face(entry: UpcomingBirthday, side = false) {
    return <View onLayout={side ? undefined : (event) => setCardHeight(event.nativeEvent.layout.height)} style={[styles.face, { width: cardWidth, height: side ? cardHeight * 0.9 : undefined, minHeight: side ? undefined : 372, padding: 18, borderRadius: 22 }]}>
      <PaperSurface tone={side ? 'ivory' : 'rose'} />
      <Text numberOfLines={2} style={[styles.eyebrow, { fontSize: 12, lineHeight: 17 }]}>{entry.person.displayName.toUpperCase()}’S BIRTHDAY</Text>
      <View style={[styles.monogram, { width: 52, height: 52, borderRadius: 26 }]}><Text style={[styles.monogramText, { fontSize: 28 }]}>{entry.person.displayName.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.countRow}><Text style={[styles.count, { fontSize: entry.days === 0 ? 34 : 56, lineHeight: 60 }]}>{entry.days === 0 ? 'Today' : String(entry.days).padStart(2, '0')}</Text>
        {entry.days > 0 ? <Text style={[styles.countLabel, { fontSize: 18, lineHeight: 21 }]}>days{ '\n' }to go</Text> : null}</View>
      <Text style={[styles.cardDate, { fontSize: 14, lineHeight: 20 }]}>{formatBirthday(entry.occasion.monthDay)}, {entry.date.getFullYear()}</Text>
      <View style={styles.cardRule} />
      <View style={styles.reminderRow}><Icon name="bell" size={14} color={colors.accent} /><Text style={[styles.reminderText, { fontSize: type.action, lineHeight: 20 }]}>{Math.max(0, ...entry.occasion.reminderDaysBefore)}-day reminder</Text></View>
      {entry.adjustedForLeapYear ? <Text style={styles.reminderText}>Feb 29 observed on Feb 28</Text> : null}
      {!side ? <Pressable accessibilityRole="button" onPress={() => prepare(entry)} style={[styles.cardButton, { minHeight: touch.min }]}>
        <PaperSurface tone="copper" /><Text style={[styles.cardButtonText, { fontSize: type.action, lineHeight: 20 }]}>Prepare a gift →</Text>
      </Pressable> : null}
    </View>;
  }
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <View testID="birthday-deck" {...gesture.panHandlers} style={[styles.deck, { height: cardHeight + 2 }]}>
      {entries.length > 2 ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.side, { left: width / 2 - cardWidth / 2 - width * 0.25, transform: [{ rotate: '-10deg' }, { scale: 0.9 }] }]}>{face(entries[(index - 1 + entries.length) % entries.length], true)}</View> : null}
      {entries.length > 1 ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.side, { left: width / 2 - cardWidth / 2 + width * 0.25, transform: [{ rotate: '10deg' }, { scale: 0.9 }] }]}>{face(entries[(index + 1) % entries.length], true)}</View> : null}
      <Animated.View testID="birthday-current-card" style={[styles.main, { left: width / 2 - cardWidth / 2, transform: [{ translateX: drag }, { rotate: drag.interpolate({ inputRange: [-75, 75], outputRange: ['-4deg', '4deg'] }) }] }]}>{face(main)}</Animated.View>
    </View>
    {entries.length > 1 ? <View style={styles.pager}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous birthday" onPress={() => move(-1)} style={styles.arrow}><Icon name="arrow-left" /></Pressable>
      <View style={styles.pagerCenter}><Text accessibilityLiveRegion="polite" style={styles.counter}>{String(index + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</Text>
        <View style={styles.dots}>{entries.slice(0, 7).map((entry, i) => <View key={entry.occasion.id} style={[styles.dot, i === index && { backgroundColor: colors.accent }]} />)}</View></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next birthday" onPress={() => move(1)} style={styles.arrow}><Icon name="arrow-right" /></Pressable>
    </View> : null}
  </View>;
}

export default function HomeView() {
  const { snapshot, ready, mode, selectMode } = useMemory(); const [today, setToday] = useState(() => new Date());
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setToday(new Date()), 30_000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') setToday(new Date()); });
    return () => { clearInterval(timer); listener.remove(); }; }, []);
  const upcoming = upcomingOccasions(snapshot, today); const visible = upcoming.filter((entry) => entry.inPreparationWindow);
  const birthdays = visible.filter((entry) => entry.occasion.type === 'birthday');
  const plans = snapshot.gifts.filter((entry) => entry.status === 'planned');
  return <ScreenFrame active="home">
    <View style={styles.introduction}><Text style={styles.heading}>For the people{ '\n' }who matter.</Text><Text style={styles.subtitle}>A little care, a little ahead.</Text></View>
    <View style={[styles.section, styles.birthdaySection]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Upcoming birthdays</Text>
      <Text style={styles.summary}>{birthdays.length ? `${birthdays.length} ${birthdays.length === 1 ? 'reminder' : 'reminders'}` : 'At your chosen reminder times'}</Text>
      {!ready ? <Text style={styles.body}>Opening your memories…</Text> : birthdays.length ? <BirthdayDeck key={mode + birthdays.map((entry) => entry.occasion.id).join()} entries={birthdays} /> : <View style={styles.emptyArea}>
        <View style={styles.emptyStack}>
          <View accessible={false} pointerEvents="none" style={[styles.emptyBack, { transform: [{ rotate: '7deg' }] }]} />
          <LinearGradient colors={['#FBF3F1', colors.blush]} style={styles.empty}>
            <View style={styles.emptySeal}><Icon name="calendar" color={colors.accent} size={22} /></View>
            <Text style={styles.emptyTitle}>{snapshot.people.length ? 'A little time to breathe.' : 'Start with someone special.'}</Text>
            <Text style={[styles.body, styles.emptyBody]}>{snapshot.people.length ? 'No birthdays are in their reminder window. You can still prepare for any friend.' : 'Save a friend, their birthday, and how early you’d like to start preparing.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push(snapshot.people.length ? '/people' : '/people/new')} style={styles.emptyAction}><Text style={styles.emptyActionText}>{snapshot.people.length ? 'View friends →' : '+ Add a person'}</Text></Pressable>
          </LinearGradient>
        </View>
        {mode === 'personal' ? <Pressable accessibilityRole="button" onPress={() => { void selectMode('demo').catch((cause) => setNotice(String(cause))); }} style={styles.demoAction}><Text style={styles.viewAll}>Explore fictional demo →</Text></Pressable> : null}
      </View>}
    </View>
    <View style={[styles.section, styles.ruled, styles.smartSection]}>
      <View style={styles.sectionHead}><Text accessibilityRole="header" style={styles.sectionTitle}>Smart gifting</Text><View style={styles.qloo}><Ionicons name="sparkles-outline" size={14} color={colors.accent} accessible={false} /><Text style={styles.meta}>Qloo Gift Agent</Text></View></View>
      <Text style={styles.body}>Thoughtful ideas, inspired by their interests.</Text>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => router.push('/smart-gifting')} style={styles.ideasAction}><PaperSurface tone="copper" /><Text style={styles.ideasText}>Find gift ideas →</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/smart-gifting?task=check')} style={styles.textAction}><Text style={styles.actionText}>Check a gift →</Text></Pressable></View>
    </View>
    <View style={[styles.section, styles.ruled, styles.datesSection]}>
      <View style={styles.sectionHead}><Text accessibilityRole="header" style={styles.sectionTitle}>Important dates</Text><Pressable accessibilityRole="button" accessibilityLabel="View all important dates" onPress={() => router.push('/dates')} style={styles.smallAction}><Text style={styles.viewAll}>View all →</Text></Pressable></View>
      {visible.length ? visible.slice(0, 2).map((entry) => <Pressable key={entry.occasion.id} accessibilityRole="button" accessibilityLabel={`Prepare for ${entry.person.displayName}: ${entry.occasion.label}`} onPress={() => prepare(entry)} style={styles.dateRow}>
        <View style={styles.calendar}><Text style={styles.month}>{new Intl.DateTimeFormat('en', { month: 'short' }).format(entry.date).toUpperCase()}</Text><Text style={styles.day}>{String(entry.date.getDate()).padStart(2, '0')}</Text></View>
        <OccasionMark birthday={entry.occasion.type === 'birthday'} /><View style={styles.rowWords}><Text style={styles.dateTitle}>{entry.person.displayName}’s {entry.occasion.label.toLowerCase()}</Text><Text style={styles.body}>{entry.days === 0 ? 'Today' : `In ${entry.days} days`}</Text></View><Icon name="chevron-right" size={18} />
      </Pressable>) : <Text style={styles.body}>No important dates are in their reminder window.</Text>}
    </View>
    {plans.length ? <View style={[styles.section, styles.continueSection]}><Text accessibilityRole="header" style={styles.sectionTitle}>Continue preparing</Text>
      {plans.slice(0, 3).map((plan) => <Pressable accessibilityRole="button" key={plan.id} style={styles.plan} onPress={() => router.push({ pathname: '/gift-plan/[personId]', params: { personId: plan.personId, planId: plan.id } })}>
        <View style={styles.planAvatar}><Text style={styles.initial}>{snapshot.people.find((p) => p.id === plan.personId)?.displayName.slice(0, 1)}</Text></View>
        <View style={styles.rowWords}><Text style={styles.dateTitle}>{snapshot.people.find((p) => p.id === plan.personId)?.displayName}{plan.occasionId ? ` · ${snapshot.occasions.find((occasion) => occasion.id === plan.occasionId)?.label ?? 'Gift'}` : ''}</Text><Text style={styles.body}>{plan.giftTitle}</Text></View><Icon name="chevron-right" size={18} />
      </Pressable>)}
    </View> : null}
    <View style={styles.quickActions}>{([{ label: 'Add friend', icon: 'user-plus', href: '/people/new' }, { label: 'Save a wish', icon: 'file-text', href: '/wishes/edit' }, { label: 'Gift box', icon: 'gift', href: '/inventory' }] as const).map((action, i) => <Pressable key={action.label} accessibilityRole="button" onPress={() => router.push(action.href)} style={[styles.quick, i > 0 && styles.quickDivided]}><Icon name={action.icon} size={22} /><Text style={styles.quickLabel}>{action.label}</Text></Pressable>)}</View>
    {notice ? <Text accessibilityRole="alert" style={styles.body}>{notice}</Text> : null}
  </ScreenFrame>;
}
const styles = StyleSheet.create({
  introduction: { paddingTop: 24, paddingBottom: 24, gap: 8 },
  heading: { fontFamily: serif, fontSize: 38, lineHeight: 42, letterSpacing: -0.8, fontWeight: '400', color: '#3F2924' },
  subtitle: { fontFamily: serif, fontSize: 18, color: colors.muted, lineHeight: 24 },
  section: { gap: 2, marginBottom: 20 }, birthdaySection: { gap: 0 }, smartSection: { marginBottom: 12 }, datesSection: { marginBottom: 12 }, continueSection: { marginBottom: 8 },
  sectionTitle: { fontFamily: serif, fontSize: 23, lineHeight: 26, fontWeight: '400', letterSpacing: -0.4, color: '#3F2924', flexShrink: 1 },
  body: { fontSize: type.body, lineHeight: type.bodyLine, color: colors.muted }, summary: { fontSize: type.caption, lineHeight: 20, color: colors.muted },
  ruled: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
  deck: { overflow: 'hidden', paddingTop: 4 },
  main: { position: 'absolute', top: 0, zIndex: 3, borderRadius: 16, shadowColor: '#5C3D30', shadowOffset: { width: 0, height: 11 }, shadowOpacity: 0.16, shadowRadius: 17, elevation: 4 },
  side: { position: 'absolute', top: 14, opacity: 0.93, borderRadius: 16, shadowColor: '#5C3D30', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 1 },
  face: { overflow: 'hidden', borderWidth: 0.8, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { letterSpacing: 0.7, color: '#855547', textAlign: 'center', fontWeight: '500' },
  monogram: { backgroundColor: '#FFFCF9B3', borderWidth: 1.7, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: serif, color: '#865045' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  count: { fontFamily: serif, fontWeight: '400', color: '#62372F' },
  countLabel: { fontFamily: serif, color: '#784A3D' },
  cardDate: { color: colors.primary },
  cardRule: { width: '100%', height: 0.6, backgroundColor: colors.roseEdge },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, reminderText: { color: colors.primary },
  cardButton: { width: '100%', borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  cardButtonText: { color: colors.white, fontWeight: '500' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 3 },
  arrow: { width: touch.min, height: touch.min, margin: 5, borderRadius: 18, borderWidth: 0.7, borderColor: '#D7C6BA', backgroundColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' },
  pagerCenter: { alignItems: 'center', gap: 7 }, counter: { color: colors.muted, fontSize: type.caption, letterSpacing: 1.5 },
  dots: { flexDirection: 'row', gap: 6 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#DED8D1' },
  emptyArea: { paddingTop: 9 }, emptyStack: { alignItems: 'center', paddingVertical: 14 },
  emptyBack: { position: 'absolute', top: 27, bottom: 24, width: '80%', maxWidth: 280, backgroundColor: '#F0EAE5', borderRadius: 22, borderWidth: 1, borderColor: colors.white },
  empty: { width: '86%', maxWidth: 280, minHeight: 245, padding: 23, borderRadius: 22, borderWidth: 1, borderColor: colors.white, gap: 14, alignItems: 'center', ...softShadow },
  emptySeal: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#FFFFFFB3', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: serif, fontSize: 26, lineHeight: 28, textAlign: 'center', letterSpacing: -0.4, color: colors.primary },
  emptyBody: { color: colors.text, textAlign: 'center', fontSize: type.body, lineHeight: type.bodyLine },
  emptyAction: { minHeight: touch.min, paddingHorizontal: 17, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center' },
  emptyActionText: { fontSize: type.action, color: colors.white, fontWeight: '500' },
  demoAction: { minHeight: touch.min, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  qloo: { flexDirection: 'row', gap: 5, alignItems: 'center' }, meta: { fontSize: type.small, color: colors.muted },
  actions: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  ideasAction: { flex: 1.05, minHeight: touch.min, paddingHorizontal: 12, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  ideasText: { color: colors.white, fontSize: type.action, lineHeight: 20 },
  textAction: { flex: 1, minHeight: touch.min, justifyContent: 'center', alignItems: 'center' }, actionText: { color: colors.text, fontSize: type.action },
  smallAction: { minHeight: touch.min, justifyContent: 'center' }, viewAll: { color: colors.muted, fontSize: type.caption },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 0.7, borderColor: colors.line, paddingVertical: 10 },
  calendar: { minWidth: 48, flexShrink: 0, borderRightWidth: 0.7, borderColor: colors.line, paddingRight: 10 },
  month: { color: colors.muted, fontSize: type.small, lineHeight: 16, letterSpacing: 0.9 }, day: { fontFamily: serif, fontSize: 24, color: '#3F2924', lineHeight: 26 },
  rowWords: { flex: 1, gap: 3 }, dateTitle: { fontFamily: serif, color: '#3F2924', fontSize: 18, lineHeight: 24 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFFFFFE8', ...softShadow },
  planAvatar: { width: 35, height: 35, borderRadius: 19, backgroundColor: colors.blush, borderWidth: 1, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: serif, color: '#865045', fontSize: 23 },
  quickActions: { flexDirection: 'row', borderTopWidth: 0.7, borderColor: colors.line, paddingVertical: 6, marginTop: 0 },
  quick: { flex: 1, minHeight: touch.min, gap: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quickDivided: { borderLeftWidth: 0.7, borderColor: colors.line }, quickLabel: { fontSize: type.small, color: colors.text },
});
