import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame, Icon } from '@/components/screen-frame';
import { page } from '@/ui/page-styles';
import { useMemory } from '@/context/memory';
export default function MeScreen() {
  const { mode } = useMemory();
  return <ScreenFrame active="me" title="A space for your thoughtfulness.">
    <Text style={page.body}>{mode === 'demo' ? 'Your fictional demo space.' : 'Your private memory book.'} No account needed.</Text>
    {([{ title: 'My gift box', detail: 'What you’ve put aside · stock & storage', icon: 'gift', href: '/inventory' }, { title: 'Gift records', detail: 'Plans, gifts given & cancellations', icon: 'book-open', href: '/gifts' }, { title: 'Saved inspiration', detail: 'Cultural connections and their evidence', icon: 'sun', href: '/inspiration' }, { title: 'Data & help', detail: 'Personal / demo space, privacy & storage', icon: 'shield', href: '/about' }] as const).map((entry) => <Pressable key={entry.href} accessibilityRole="button" accessibilityLabel={entry.title} style={[page.listRow, { flexDirection: 'row', alignItems: 'center', gap: 16 }]} onPress={() => router.push(entry.href)}>
      <Icon name={entry.icon} size={24} /><View style={{ flex: 1, gap: 5 }}><Text style={page.title}>{entry.title}</Text><Text style={page.body}>{entry.detail}</Text></View><Icon name="chevron-right" size={18} />
    </Pressable>)}
  </ScreenFrame>;
}
