import type { Metadata } from 'next';
import { MemoryProvider } from '@/components/memory-provider';
import { Shell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gift Memory — Little things. Lasting meaning.', template: '%s · Gift Memory' },
  description: 'A private gift companion for remembering people and birthdays. No account needed.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><MemoryProvider><Shell>{children}</Shell></MemoryProvider></body></html>;
}
