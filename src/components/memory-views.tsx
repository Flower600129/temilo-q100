'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatBirthday, nextBirthday } from '@/domain/dates';
import { copy } from '@/ui/copy';
import { useMemory } from './memory-provider';
import { GiftIllustration, Icon } from './icons';

function useToday() {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setToday(new Date());
    const initial = setTimeout(refresh, 0);
    const interval = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(initial); clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);
  return today;
}
export function StorageState() {
  const { error, retry } = useMemory();
  return <div className="state-card" role={error ? 'alert' : 'status'}><Icon name={error ? 'info' : 'heart'} size={28}/><p>{error || copy.loading}</p>{error && <button className="button secondary" onClick={() => void retry()}>{copy.retry}</button>}</div>;
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={`avatar tone-${index % 4}`} aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase()}</span>;
}
function daysLabel(days: number) { return days === 0 ? copy.today : days === 1 ? copy.tomorrow : `In ${days} days`; }

export function Dashboard() {
  const { snapshot, ready, error, changeMode } = useMemory();
  const today = useToday();
  const birthdays = today ? snapshot.occasions.filter((occasion) => occasion.type === 'birthday' && occasion.recurrence === 'annual').map((occasion) => ({ occasion, person: snapshot.people.find((p) => p.id === occasion.personId)!, next: nextBirthday(occasion.monthDay, today) })).sort((a, b) => a.next.days - b.next.days || a.person.displayName.localeCompare(b.person.displayName)) : [];
  const next = birthdays[0];
  const upcoming = birthdays.filter((item) => item.next.days <= 30);
  return <>
    <div className="page-heading"><div><p className="eyebrow">{copy.homeEyebrow}</p><h1>{copy.homeTitle}</h1><p className="lede">{copy.homeIntro}</p></div><Link className="button primary" href="/people/new"><Icon name="plus" size={18}/>{copy.addPerson}</Link></div>
    {!ready || error || !today ? <StorageState/> : <>
      <section className="hero-card" aria-label={next ? copy.upNext : 'Get started'}>
        <div className="hero-copy"><p className="eyebrow"><Icon name={next ? 'calendar' : 'heart'} size={16}/>{next ? copy.upNext : 'A little reminder. A lot of heart.'}</p>
          {next ? <><h2>{next.person.displayName}’s<br/>birthday</h2><p className="hero-date">{formatBirthday(next.occasion.monthDay)} · {next.next.date.getFullYear()}</p><div className="countdown"><strong>{next.next.days === 0 ? copy.today : next.next.days}</strong>{next.next.days > 0 && <span>{copy.daysAway}</span>}</div>{next.next.adjustedForLeapYear && <p className="small-note">{copy.leapHint}</p>}</> : <><h2>{copy.emptyTitle}</h2><p>{copy.emptyBody}</p><div className="hero-actions"><Link className="button primary" href="/people/new">{copy.addPerson}<Icon name="arrow" size={17}/></Link><button className="text-button" onClick={() => void changeMode('demo')}>{copy.exploreDemo}</button></div></>}
        </div><GiftIllustration/>
      </section>
      <div className="dashboard-grid"><section className="panel upcoming-panel"><div className="section-title"><div><h2>{copy.upcoming}</h2><p>{copy.upcomingHint}</p></div><span className="count-pill">{upcoming.length}</span></div>
        {upcoming.length ? <ul className="person-rows">{upcoming.map((item, index) => <li key={item.occasion.id}><Avatar name={item.person.displayName} index={index}/><div className="person-text"><strong>{item.person.displayName}</strong><span>{copy.birthday} · {formatBirthday(item.occasion.monthDay)}</span></div><span className={`day-pill ${item.next.days <= 7 ? 'near' : ''}`}>{daysLabel(item.next.days)}</span></li>)}</ul> : <div className="quiet-empty"><span className="empty-icon"><Icon name="calendar" size={27}/></span><h3>{copy.emptyUpcoming}</h3><p>{copy.emptyUpcomingHint}</p></div>}
      </section><section className="panel circle-panel"><div className="section-title"><div><h2>{copy.circle}</h2><p>{copy.circleHint}</p></div><Icon name="people"/></div>
        {snapshot.people.length ? <><div className="avatar-stack">{snapshot.people.slice(0, 5).map((person, index) => <Avatar key={person.id} name={person.displayName} index={index}/>)}</div><p className="circle-count">{copy.peopleCount(snapshot.people.length)}</p><Link href="/people" className="text-link">{copy.viewPeople}<Icon name="arrow" size={17}/></Link></> : <><p className="circle-empty">Names you know.<br/>Dates you’ll remember.</p><Link href="/people/new" className="text-link">{copy.addPerson}<Icon name="arrow" size={17}/></Link></>}
      </section></div>
      <div className="privacy-strip"><Icon name="lock" size={17}/><span>{copy.localHint}</span><Link href="/about">How it works <span aria-hidden="true">↗</span></Link></div>
    </>}
  </>;
}

export function PeopleView() {
  const { snapshot, ready, error } = useMemory();
  const today = useToday();
  return <><div className="page-heading"><div><p className="eyebrow">{copy.circle}</p><h1>{copy.peopleTitle}</h1><p className="lede">{copy.peopleIntro}</p></div><Link href="/people/new" className="button primary"><Icon name="plus" size={18}/>{copy.addPerson}</Link></div>
    {!ready || error || !today ? <StorageState/> : !snapshot.people.length ? <div className="panel people-empty"><span className="empty-icon"><Icon name="people" size={35}/></span><h2>{copy.noPeople}</h2><p>{copy.noPeopleHint}</p><Link href="/people/new" className="button primary">{copy.addPerson}</Link></div> : <><p className="list-count">{copy.peopleCount(snapshot.people.length)}</p><div className="people-grid">{snapshot.people.map((person, index) => {
      const birthday = snapshot.occasions.find((o) => o.personId === person.id && o.type === 'birthday' && o.recurrence === 'annual');
      const next = birthday ? nextBirthday(birthday.monthDay, today) : undefined;
      return <article className="person-card panel" key={person.id}><div className="person-card-top"><Avatar name={person.displayName} index={index}/>{next && <span className="day-pill">{daysLabel(next.days)}</span>}</div><h2>{person.displayName}</h2>{person.relationship && <p className="relationship">{person.relationship}</p>}<div className="birthday-line"><Icon name="calendar" size={18}/>{birthday ? formatBirthday(birthday.monthDay) : 'No birthday recorded'}</div>{next?.adjustedForLeapYear && <p className="small-note">{copy.leapHint}</p>}</article>;
    })}</div></>}
  </>;
}
