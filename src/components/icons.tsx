import type { CSSProperties } from 'react';

export function Icon({ name, size = 20, style }: { name: 'home' | 'people' | 'gift' | 'heart' | 'arrow' | 'plus' | 'lock' | 'info' | 'calendar' | 'spark'; size?: number; style?: CSSProperties }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/></>,
    gift: <><path d="M4 11h16v10H4ZM3 7h18v4H3ZM12 7v14"/><path d="M12 7C3 8 4 0 8 3l4 4c9 1 8-7 4-4Z"/></>,
    heart: <path d="M20 5c-3-3-6-1-8 1C5-2-3 8 12 20 27 8 21 4 20 5Z"/>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-12 4h2m3 0h2"/></>,
    spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>;
}

export function GiftIllustration() {
  return <svg className="gift-illustration" aria-hidden="true" viewBox="0 0 260 240" fill="none">
    <circle cx="143" cy="126" r="91" fill="#f8d3be"/>
    <path d="m64 116 132-20 15 100-132 20Z" fill="#fff9ec" stroke="#b35d49" strokeWidth="2"/>
    <path d="m57 97 140-21 5 33-140 21Z" fill="#fdf6e7" stroke="#b35d49" strokeWidth="2"/>
    <path d="m117 89 21-3 18 119-21 3Z" fill="#be654e"/>
    <path d="M127 86C65 87 77 36 101 49c17 9 26 37 26 37Zm0 0c63-20 38-63 20-43-13 15-20 43-20 43Z" stroke="#b35d49" strokeWidth="5"/>
    <path d="m199 42 4 9 9 3-9 4-4 9-3-9-9-4 9-3ZM37 155l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#9d593e"/>
    <circle cx="52" cy="61" r="4" fill="#ad7150"/>
    <path d="m220 150 7 6m-10 14 8 2M78 32l-3-9" stroke="#ad7150" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
