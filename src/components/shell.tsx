'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { copy } from '@/ui/copy';
import { Icon } from './icons';
import { useMemory } from './memory-provider';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode, ready, error, notice, changeMode } = useMemory();
  const nav = [{ href: '/', label: copy.home, icon: 'home' as const }, { href: '/people', label: copy.people, icon: 'people' as const }, { href: '/about', label: copy.about, icon: 'info' as const }];
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Icon name="gift" size={24}/></span><span>{copy.brand}<small>{copy.tagline}</small></span></Link>
      <div className="nav-label">YOUR MEMORY BOOK</div>
      <nav aria-label="Main navigation">{nav.map((item) => <Link key={item.href} href={item.href} aria-current={(item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) ? 'page' : undefined}><Icon name={item.icon}/>{item.label}</Link>)}</nav>
      <div className="later-nav"><span className="nav-label">GROWING WITH YOU</span><div><Icon name="heart"/>{copy.wishes}<span className="soon">Later</span></div><div><Icon name="gift"/>{copy.inventory}<span className="soon">Later</span></div></div>
      <div className="sidebar-note"><Icon name="spark" size={28}/><p>A little intention<br/>goes a long way.</p><span>A gift companion, made for care.</span></div>
      <div className="sidebar-footer"><Icon name="lock" size={15}/><span>{copy.localLabel}</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span className="space-label"><span className={`status-dot ${mode === 'demo' ? 'demo-dot' : ''}`}/>{mode === 'demo' ? 'Demo space' : copy.personalMode}</span><button className="quiet-button" disabled={!ready || Boolean(error)} onClick={() => void changeMode(mode === 'demo' ? 'personal' : 'demo')}>{mode === 'demo' ? copy.leaveDemo : copy.exploreDemo}<Icon name="arrow" size={16}/></button></header>
      {mode === 'demo' && <div className="demo-banner"><strong>{copy.demoMode}</strong><span>{copy.demoHint}</span></div>}
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="page-footer"><span>Thoughtfulness, one person at a time.</span><Link href="/about"><Icon name="lock" size={13}/>Local & private by default</Link></footer>
    </div>
    <div className="toast" role="status" aria-live="polite" key={notice}>{notice}</div>
  </div>;
}
