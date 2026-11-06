import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Mirrors the safe, shareable part of a profile to /public_profiles/{uid} so other users, listings and the worker
 * directory never have to read /users (which holds email, phone, DOB and documents).
 * Trust fields (rating, reviewCount, verificationStatus, ...) are copied from the user's own document and the
 * Firestore rules reject the write if they differ from the real values.
 */
const BASE_KEYS = [
  'username', 'fullName', 'avatarUrl', 'isWorker', 'rating', 'reviewCount', 'verificationStatus', 'isPremiumWorker', 'featured'
] as const;
// Only published for workers: ordinary users never expose a location, bio or rate.
const WORKER_KEYS = ['workerType', 'skills', 'hourlyRate', 'availabilityStatus', 'bio', 'location'] as const;

const lastMirrored = new Map<string, string>();

export async function ensurePublicProfile(profile: Record<string, any> | null | undefined) {
  if (!profile?.uid || profile.uid === 'guest-user' || typeof profile.username !== 'string') return;

  const keys = profile.isWorker === true ? [...BASE_KEYS, ...WORKER_KEYS] : BASE_KEYS;
  const data: Record<string, any> = { uid: profile.uid };
  for (const key of keys) {
    if (profile[key] !== undefined && profile[key] !== null) data[key] = profile[key];
  }

  const signature = JSON.stringify(data);
  if (lastMirrored.get(profile.uid) === signature) return; // nothing changed

  try {
    await setDoc(doc(db, 'public_profiles', profile.uid), { ...data, updatedAt: serverTimestamp() });
    lastMirrored.set(profile.uid, signature);
  } catch (err) {
    console.warn('[publicProfile] Could not publish public profile:', err);
  }
}
