import { AboutView } from '@/components/about-view';
import { qlooConfigStatus } from '@/qloo/config';
export const metadata = { title: 'About & data' };
export const dynamic = 'force-dynamic';
export default function AboutPage() { return <AboutView configured={qlooConfigStatus().status === 'configured_unverified'}/>; }
