import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, collection, writeBatch, serverTimestamp, onSnapshot, Query, WriteBatch } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { useEffect, useState } from 'react';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app), db = getFirestore(app), fns = getFunctions(app, 'europe-west2');
export type Agent = { uid: string; email: string; role: 'agent' | 'admin' };

/** Atomic audit: the log entry and the target writes share ONE batch. Firestore rules (getAfter)
 *  reject any support write whose batch does not also contain the log entry. */
export async function audited(
  agent: Agent, a: { targetUserId: string; actionTaken: string; reason: string },
  writes: (b: WriteBatch, auditId: string) => void,
) {
  if (!a.reason.trim()) throw new Error('A reason is required.');
  const b = writeBatch(db), log = doc(collection(db, 'support_audit_logs'));
  b.set(log, { agentId: agent.uid, targetUserId: a.targetUserId, actionTaken: a.actionTaken, reason: a.reason.trim(), timestamp: serverTimestamp() });
  writes(b, log.id);
  await b.commit();
}

/** Realtime query hook. `key` must change whenever the query changes. */
export function useLive(key: string, mk: () => Query | null) {
  const [rows, set] = useState<any[]>([]);
  useEffect(() => {
    const q = mk(); if (!q) { set([]); return; }
    return onSnapshot(q, s => set(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => console.error(key, e));
  }, [key]);
  return rows;
}
