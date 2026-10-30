'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { addPersonSchema } from '@/domain/schemas';
import { copy } from '@/ui/copy';
import { Icon } from './icons';
import { useMemory } from './memory-provider';
import { StorageState } from './memory-views';

export function PersonForm() {
  const { addPerson, ready, error: storageError } = useMemory();
  const router = useRouter();
  const [name, setName] = useState(''); const [month, setMonth] = useState(''); const [day, setDay] = useState('');
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const operation = useRef<{ id: string; input: string } | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const input = { displayName: name, monthDay: `${month}-${day.padStart(2, '0')}` };
    const parsed = addPersonSchema.safeParse(input);
    if (!parsed.success) { setError(copy.invalidForm); return; }
    const signature = JSON.stringify(parsed.data);
    if (!operation.current || operation.current.input !== signature) operation.current = { id: crypto.randomUUID(), input: signature };
    pending.current = true; setSaving(true); setError('');
    try { await addPerson(parsed.data, operation.current.id); router.push('/'); }
    catch { setError(copy.saveError); }
    finally { pending.current = false; setSaving(false); }
  };
  return <><Link className="back-link" href="/people">← {copy.back}</Link><div className="page-heading"><div><p className="eyebrow">{copy.formEyebrow}</p><h1>{copy.formTitle}</h1><p className="lede">{copy.formIntro}</p></div></div>
    {storageError ? <StorageState/> : <div className="form-layout"><form onSubmit={submit} className="panel person-form" aria-label="Add a person" noValidate>
      <label htmlFor="person-name">{copy.name}</label><input autoFocus id="person-name" autoComplete="off" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} aria-describedby="name-hint" disabled={saving}/><p className="field-hint" id="name-hint">{copy.nameHint}</p>
      <fieldset><legend>{copy.birthday}</legend><div className="date-fields"><div><label htmlFor="birth-month">{copy.month}</label><select id="birth-month" value={month} onChange={(event) => setMonth(event.target.value)} required disabled={saving}><option value="">{copy.chooseMonth}</option>{copy.months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}</select></div><div><label htmlFor="birth-day">{copy.day}</label><input id="birth-day" type="number" min="1" max="31" inputMode="numeric" value={day} onChange={(event) => setDay(event.target.value)} placeholder="DD" required disabled={saving}/></div></div><p className="field-hint">{copy.birthdayHint}</p>{month === '02' && day === '29' && <p className="field-hint leap-note">{copy.leapHint}</p>}</fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><Link href="/people" className="button secondary">{copy.cancel}</Link><button type="submit" className="button primary" disabled={!ready || saving}>{saving ? copy.saving : copy.save}<Icon name="arrow" size={17}/></button></div><p className="form-privacy"><Icon name="lock" size={14}/>{copy.localLabel}</p>
    </form><aside className="form-aside"><span className="line-heart"><Icon name="heart" size={52}/></span><h2>{copy.formSideTitle}</h2><p>{copy.formSideBody}</p><span className="handwritten">It’s the remembering that matters.</span></aside></div>}
  </>;
}
