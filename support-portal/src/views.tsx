import { useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, fns, audited, useLive, Agent } from './lib';

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const btn = 'rounded-xl px-3 py-1.5 text-sm font-semibold text-white';
const ask = (m: string) => window.prompt(m + ' (required)')?.trim() || null;
const fmt = (t: any) => t?.toDate?.().toLocaleString('en-GB') ?? '';
const run = async (p: Promise<unknown>) => { try { await p; } catch (e: any) { alert(e.message); } };
type P = { agent: Agent };
const PENDING = () => query(collection(db, 'users'), where('verificationStatus', 'in', ['pending', 'in_progress']));

export function Dashboard({ agent }: P) {
  const sos = useLive('sos', () => query(collection(db, 'sos_alerts'), where('status', '==', 'active')));
  const open = useLive('open', () => query(collection(db, 'support_tickets'), where('status', '==', 'Open')));
  const ver = useLive('ver', PENDING);
  const resolve = (a: any) => { const reason = ask('Resolution note'); if (reason) run(audited(agent, { targetUserId: a.userId, actionTaken: 'sos_resolved', reason },
    (b, id) => b.update(doc(db, 'sos_alerts', a.id), { status: 'resolved', resolvedBy: agent.uid, resolvedAt: serverTimestamp(), lastSupportAuditId: id }))); };
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-4">{([['Active SOS', sos.length], ['Open tickets', open.length], ['Pending verifications', ver.length]] as const).map(([l, n]) =>
      <div key={l} className={card}><p className="text-sm text-slate-500">{l}</p><p className="text-3xl font-bold">{n}</p></div>)}</div>
    {sos.map(a => <div key={a.id} className={`${card} flex items-center justify-between border-rose-300 bg-rose-50`}>
      <div><p className="font-bold text-rose-700">🚨 SOS — {a.userName ?? a.userId}</p><p className="text-sm">{a.address} · contact {a.contactName} {a.contactPhone}</p>
        <p className="text-xs text-slate-500">{fmt(a.triggeredAt) || a.triggeredAt}</p></div>
      <button className={`${btn} bg-rose-600`} onClick={() => resolve(a)}>Resolve</button></div>)}
  </div>;
}

export function Verification({ agent }: P) {
  const rows = useLive('ver', PENDING);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = (u: any, status: 'verified' | 'rejected') => { const note = notes[u.id]?.trim();
    if (!note) return alert('Feedback note is required.');
    run(audited(agent, { targetUserId: u.id, actionTaken: `verification_${status}`, reason: note }, (b, id) => b.update(doc(db, 'users', u.id),
      { verificationStatus: status, verificationNote: note, verifiedBy: agent.uid, verifiedAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSupportAuditId: id }))); };
  return <div className="space-y-3">{!rows.length && <p className="text-slate-500">Queue is empty 🎉</p>}
    {rows.map(u => <div key={u.id} className={card}>
      <p className="font-semibold">{u.fullName || u.username} <span className="text-xs text-slate-500">{u.workerType} · {u.email}</span></p>
      <div className="my-2 flex flex-wrap gap-2 text-sm">{[...(u.documents ?? []), u.verificationPhoto].filter(Boolean).map((d: string, i: number) =>
        /^https:/.test(d) ? <a key={i} className="text-brand underline" href={d} target="_blank" rel="noreferrer noopener">Document {i + 1}</a> : <span key={i}>{d}</span>)}</div>
      <textarea placeholder="Feedback note (required)" value={notes[u.id] ?? ''} onChange={e => setNotes({ ...notes, [u.id]: e.target.value })} />
      <div className="mt-2 flex gap-2"><button className={`${btn} bg-emerald-600`} onClick={() => decide(u, 'verified')}>Approve</button>
        <button className={`${btn} bg-rose-600`} onClick={() => decide(u, 'rejected')}>Reject</button></div></div>)}</div>;
}

const EDIT = ['fullName', 'username', 'firstName', 'lastName', 'workerType'] as const;
export function Users({ agent }: P) {
  const [q, setQ] = useState(''); const [u, setU] = useState<any>(null); const [msg, setMsg] = useState('');
  const search = async () => { setU(null); setMsg(''); const v = q.trim(); let d: any;
    if (v.includes('@')) d = (await getDocs(query(collection(db, 'users'), where('email', '==', v), limit(1)))).docs[0];
    else if (/^\+?\d{6,}$/.test(v)) d = (await getDocs(query(collection(db, 'users'), where('mobileNumber', '==', v), limit(1)))).docs[0];
    else d = await getDoc(doc(db, 'users', v));
    d && d.exists() ? setU({ id: d.id, ...d.data() }) : setMsg('No match'); };
  const act = (action: string, patch: any, pre?: () => Promise<unknown>) => { const reason = ask('Reason'); if (!reason) return;
    run((async () => { await pre?.(); await audited(agent, { targetUserId: u.id, actionTaken: action, reason }, (b, id) =>
      b.update(doc(db, 'users', u.id), { ...patch, updatedAt: serverTimestamp(), lastSupportAuditId: id })); setU({ ...u, ...patch }); })()); };
  const setState = (s: 'active' | 'temp_blocked' | 'perm_blocked') => act(`account_${s}`, { moderationStatus: s },
    () => httpsCallable(fns, 'setDisabled')({ uid: u.id, disabled: s !== 'active' }));
  return <div className="space-y-3"><div className="flex gap-2"><input placeholder="UID, email or phone (+44…)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run(search())} />
    <button className={`${btn} bg-brand`} onClick={() => run(search())}>Search</button></div>{msg && <p className="text-slate-500">{msg}</p>}
    {u && <div className={`${card} space-y-3`}>
      <p className="text-sm text-slate-500">{u.id} · {u.email} · {u.mobileNumber || 'no phone'} · verification: <b>{u.verificationStatus ?? 'none'}</b> · status: <b>{u.moderationStatus ?? 'active'}</b></p>
      <div className="grid grid-cols-2 gap-2">{EDIT.map(f => <label key={f} className="text-xs text-slate-500">{f}<input value={u[f] ?? ''} onChange={e => setU({ ...u, [f]: e.target.value })} /></label>)}</div>
      <div className="flex flex-wrap gap-2">
        <button className={`${btn} bg-brand`} onClick={() => act('profile_edit', Object.fromEntries(EDIT.filter(f => u[f] !== undefined).map(f => [f, u[f]])))}>Save edits</button>
        <button className={`${btn} bg-amber-600`} onClick={() => act('verification_reset', { verificationStatus: 'pending' })}>Reset verification</button>
        <button className={`${btn} bg-slate-700`} onClick={() => act('resend_verification_email', {}, () => httpsCallable(fns, 'resendVerification')({ uid: u.id }))}>Resend verification email</button>
        <button className={`${btn} bg-orange-600`} onClick={() => { const m = ask('Warning message'); if (m) run(audited(agent, { targetUserId: u.id, actionTaken: 'user_warning', reason: m }, (b, id) =>
          b.set(doc(collection(db, 'user_warnings')), { userId: u.id, agentId: agent.uid, message: m, auditId: id, createdAt: serverTimestamp() }))); }}>Send warning</button>
        {agent.role === 'admin' && <>
          <button className={`${btn} bg-rose-500`} onClick={() => setState('temp_blocked')}>Suspend</button>
          <button className={`${btn} bg-rose-700`} onClick={() => setState('perm_blocked')}>Ban</button>
          <button className={`${btn} bg-emerald-600`} onClick={() => setState('active')}>Reinstate</button></>}
      </div></div>}</div>;
}

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
export function Tickets({ agent }: P) {
  const rows = useLive('tix', () => query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'), limit(100)));
  const [sel, setSel] = useState<string | null>(null); const [text, setText] = useState('');
  const t = rows.find(r => r.id === sel);
  const replies = useLive('rep' + sel, () => sel ? query(collection(db, 'support_tickets', sel, 'replies'), orderBy('createdAt')) : null);
  const setStatus = (status: string) => { const reason = ask(`Reason for → ${status}`); if (reason) run(audited(agent, { targetUserId: t!.userId, actionTaken: `ticket_${status}`, reason },
    (b, id) => b.update(doc(db, 'support_tickets', t!.id), { status, updatedAt: serverTimestamp(), lastSupportAuditId: id }))); };
  const reply = () => text.trim() && run(audited(agent, { targetUserId: t!.userId, actionTaken: 'ticket_reply', reason: text }, (b, id) => {
    b.set(doc(collection(db, 'support_tickets', t!.id, 'replies')), { authorId: agent.uid, authorRole: 'support', text, auditId: id, createdAt: serverTimestamp() });
    b.update(doc(db, 'support_tickets', t!.id), { status: t!.status, updatedAt: serverTimestamp(), lastSupportAuditId: id }); }).then(() => setText('')));
  return <div className="grid grid-cols-5 gap-4"><div className="col-span-2 space-y-2">{rows.map(r => <button key={r.id} onClick={() => setSel(r.id)} className={`${card} block w-full text-left ${sel === r.id ? 'border-brand' : ''}`}>
      <p className="text-xs uppercase text-slate-500">{r.kind} · {r.status}</p><p className="font-semibold">{r.subject ?? r.message?.slice(0, 60)}</p></button>)}</div>
    <div className="col-span-3">{t && <div className={`${card} space-y-3`}><p className="font-semibold">{t.subject}</p><p className="text-sm">{t.message}</p>
      <select value={t.status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      {replies.map(r => <p key={r.id} className={`rounded-xl p-2 text-sm ${r.authorRole === 'support' ? 'bg-indigo-50' : 'bg-slate-100'}`}>{r.text}</p>)}
      <textarea placeholder="Reply to user…" value={text} onChange={e => setText(e.target.value)} /><button className={`${btn} bg-brand`} onClick={reply}>Send reply</button></div>}</div></div>;
}

export function Listings({ agent }: P) {
  const rows = useLive('items', () => query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(150)));
  const [f, setF] = useState('');
  const toggle = (i: any) => { const hide = i.status !== 'hidden'; const reason = ask(hide ? 'Reason for hiding' : 'Reason for restoring'); if (reason)
    run(audited(agent, { targetUserId: i.sellerId, actionTaken: hide ? 'listing_hidden' : 'listing_restored', reason }, (b, id) => b.update(doc(db, 'items', i.id),
      { status: hide ? 'hidden' : 'available', previousStatus: i.status, moderatedBy: agent.uid, moderationReason: reason, updatedAt: serverTimestamp(), lastSupportAuditId: id }))); };
  return <div className="space-y-3"><input placeholder="Filter by title / seller UID" value={f} onChange={e => setF(e.target.value)} />
    {rows.filter(i => (i.title + i.sellerId).toLowerCase().includes(f.toLowerCase())).map(i => <div key={i.id} className={`${card} flex items-center justify-between`}>
      <div><p className="font-semibold">{i.title} <span className="text-xs text-slate-500">£{i.price} · {i.status}</span></p><p className="text-xs text-slate-500">{i.sellerId}</p></div>
      <button className={`${btn} ${i.status === 'hidden' ? 'bg-emerald-600' : 'bg-rose-600'}`} onClick={() => toggle(i)}>{i.status === 'hidden' ? 'Restore' : 'Hide'}</button></div>)}</div>;
}

export function AuditLog() {
  const rows = useLive('audit', () => query(collection(db, 'support_audit_logs'), orderBy('timestamp', 'desc'), limit(200)));
  return <div className={`${card} overflow-x-auto`}><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{['When', 'Agent', 'Target', 'Action', 'Reason'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="p-2">{fmt(r.timestamp)}</td><td className="p-2">{r.agentId}</td><td className="p-2">{r.targetUserId}</td><td className="p-2 font-semibold">{r.actionTaken}</td><td className="p-2">{r.reason}</td></tr>)}</tbody></table></div>;
}
