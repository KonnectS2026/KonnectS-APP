import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, Agent } from './lib';
import { Dashboard, Verification, Users, Tickets, Listings, AuditLog } from './views';

const TABS = ['Dashboard', 'Verification', 'Users', 'Tickets', 'Listings', 'Audit log'] as const;

export default function App() {
  const [agent, setAgent] = useState<Agent | null | undefined>(undefined);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Dashboard');
  const [err, setErr] = useState(''); const [em, setEm] = useState(''); const [pw, setPw] = useState('');

  useEffect(() => onAuthStateChanged(auth, async u => {
    if (!u) return setAgent(null);
    const [tok, a, s] = await Promise.all([u.getIdTokenResult(), getDoc(doc(db, 'admins', u.uid)), getDoc(doc(db, 'support_agents', u.uid))]);
    if (a.exists() || tok.claims.admin) setAgent({ uid: u.uid, email: u.email!, role: 'admin' });
    else if (s.exists()) setAgent({ uid: u.uid, email: u.email!, role: 'agent' });
    else { setErr('This account is not authorised for the support portal.'); signOut(auth); }
  }), []);

  if (agent === undefined) return <p className="p-10 text-slate-500">Loading…</p>;
  if (!agent) return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-sm space-y-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl italic text-brand">KonnectS <span className="font-sans text-sm font-semibold not-italic text-slate-500">Support</span></h1>
        <input placeholder="Staff email" value={em} onChange={e => setEm(e.target.value)} />
        <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="w-full rounded-xl bg-brand py-2 font-semibold text-white" onClick={() => { setErr(''); signInWithEmailAndPassword(auth, em, pw).catch(() => setErr('Sign-in failed.')); }}>Sign in</button>
      </div>
    </div>);

  const tabs = TABS.filter(t => t !== 'Audit log' || agent.role === 'admin');
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 space-y-1 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-4 font-display text-2xl italic text-brand">KonnectS</h1>
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${tab === t ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>)}
        <div className="pt-6 text-xs text-slate-500"><p className="truncate">{agent.email}</p><p className="font-semibold">{agent.role === 'admin' ? 'Super Admin' : 'Support Agent'}</p>
          <button className="mt-2 underline" onClick={() => signOut(auth)}>Sign out</button></div>
      </aside>
      <main className="flex-1 p-6">
        <h2 className="mb-4 text-xl font-bold">{tab}</h2>
        {tab === 'Dashboard' && <Dashboard agent={agent} />}
        {tab === 'Verification' && <Verification agent={agent} />}
        {tab === 'Users' && <Users agent={agent} />}
        {tab === 'Tickets' && <Tickets agent={agent} />}
        {tab === 'Listings' && <Listings agent={agent} />}
        {tab === 'Audit log' && <AuditLog />}
      </main>
    </div>);
}
