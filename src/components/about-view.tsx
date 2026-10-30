'use client';
import { useState, type FormEvent } from 'react';
import { copy } from '@/ui/copy';
import { targetCategories, type QlooEntity, type QlooResult, type ResolveResult } from '@/qloo/contracts';
import { Icon } from './icons';
import { useMemory } from './memory-provider';

export function AboutView({ configured }: { configured: boolean }) {
  const { mode, ready, error, retry, changeMode, resetDemo } = useMemory();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  return <><div className="page-heading"><div><p className="eyebrow">Inside your memory book</p><h1>{copy.aboutTitle}</h1><p className="lede">{copy.aboutIntro}</p></div></div>{error && <div className="form-error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => void retry()}>{copy.retry}</button></div>}<div className="about-grid">
    <section className="panel about-card"><Icon name="lock" size={28}/><h2>{copy.privacyTitle}</h2><p>{copy.localDetail}</p><div className="stage-note"><strong>{copy.p0Label}</strong><p>{copy.p0Detail}</p></div></section>
    <section className="panel about-card"><Icon name="people" size={28}/><h2>{copy.demoTitle}</h2><p>{copy.demoDescription}</p><div className="about-actions"><button className="button secondary" disabled={!ready || resetting} onClick={() => void changeMode(mode === 'demo' ? 'personal' : 'demo')}>{mode === 'demo' ? copy.leaveDemo : copy.exploreDemo}</button>{mode === 'demo' && <button className="text-button" disabled={!ready || resetting} onClick={() => setResetOpen(true)}>{copy.resetDemo}</button>}</div>{resetOpen && <div className="confirmation" role="group" aria-label="Confirm demo reset" aria-busy={resetting}><p>{copy.resetConfirm}</p><div className="about-actions"><button className="button secondary" disabled={resetting} onClick={() => setResetOpen(false)}>{copy.cancel}</button><button className="button primary" disabled={resetting} onClick={async () => { setResetting(true); const done = await resetDemo(); if (done) setResetOpen(false); setResetting(false); }}>{resetting ? copy.resetting : copy.resetDemo}</button></div></div>}</section>
    <QlooCheck configured={configured}/>
  </div></>;
}

function QlooCheck({ configured }: { configured: boolean }) {
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [entities, setEntities] = useState<QlooEntity[]>([]); const [selected, setSelected] = useState('');
  const [category, setCategory] = useState<string>(targetCategories[0]); const [result, setResult] = useState<QlooResult | null>(null);
  const request = async (path: string, body: unknown) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const json = await response.json();
    if (!response.ok) throw new Error(typeof json.reason === 'string' ? json.reason : 'request_failed');
    return json;
  };
  const search = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setEntities([]); setSelected(''); setResult(null);
    try {
      const response: ResolveResult = await request('/api/taste/resolve', { interests: [input.trim()] });
      const matches = response.matches.flatMap((match) => match.result.entities);
      setEntities(matches); if (!matches.length) setError(copy.qlooNone);
    } catch (error) { setError(copy.qlooFailure(error instanceof Error ? error.message : 'request_failed')); }
    finally { setBusy(false); }
  };
  const explore = async () => {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await request('/api/taste/explore', { entityIds: [selected], targetCategory: category })); }
    catch (error) { setError(copy.qlooFailure(error instanceof Error ? error.message : 'request_failed')); }
    finally { setBusy(false); }
  };
  return <section className="panel about-card qloo-card"><div className="qloo-heading"><div><p className="eyebrow">Qloo · API verification</p><h2>{copy.qlooTitle}</h2></div><span className={`connection-badge ${configured ? '' : 'blocked'}`}>{configured ? copy.qlooConfigured : copy.qlooBlocked}</span></div><p>{copy.qlooIntro}</p><div className="connection-note" role="status"><Icon name="info" size={19}/><span>{configured ? copy.qlooConfiguredDetail : copy.qlooBlockedDetail}</span></div>
    {configured && <><form onSubmit={search} className="qloo-form"><label htmlFor="cultural-interest">{copy.qlooInput}</label><div className="search-line"><input id="cultural-interest" required minLength={2} maxLength={120} value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Frédéric Chopin" aria-describedby="qloo-privacy"/><button className="button primary" disabled={busy}>{busy ? copy.qlooSearching : copy.qlooSearch}</button></div><p className="field-hint" id="qloo-privacy">{copy.qlooInputHint}</p></form>
      {entities.length > 0 && <fieldset className="qloo-candidates"><legend>{copy.qlooSelect}</legend>{entities.map((entity) => <label key={entity.entityId}><input type="radio" name="entity" value={entity.entityId} checked={selected === entity.entityId} onChange={() => { setSelected(entity.entityId); setResult(null); }} disabled={busy}/><span><strong>{entity.name}</strong><small>{entity.entityType ?? 'Category unconfirmed'} · {entity.entityId}</small></span></label>)}<label htmlFor="target-category">{copy.qlooTarget}</label><select id="target-category" disabled={busy} value={category} onChange={(event) => { setCategory(event.target.value); setResult(null); }}>{targetCategories.map((value) => <option key={value} value={value}>{value.split(':').at(-1)}</option>)}</select><button className="button secondary" disabled={!selected || busy || entities.find((e) => e.entityId === selected)?.entityType === category} onClick={() => void explore()}>{copy.qlooExplore}</button></fieldset>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <div className="qloo-results"><h3>{copy.qlooEvidence}</h3><p>{result.requestedAt}</p>{!result.entities.length && <p>{copy.qlooNone}</p>}<ul>{result.entities.map((entity) => <li key={entity.entityId}><strong>{entity.name}</strong><span>{entity.entityType ?? 'Category unconfirmed'}</span><code>{entity.entityId}</code>{entity.score !== undefined && <small>{entity.scoreField}: {entity.score}</small>}{entity.explainability && <details><summary>Returned explanation data</summary><pre>{JSON.stringify(entity.explainability, null, 2)}</pre></details>}</li>)}</ul>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}<p className="small-note">{copy.qlooEvidenceHint}</p></div>}
    </>}
  </section>;
}
