/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const RECAPTCHA_CONTAINER_ID = 'konnects-phone-recaptcha';

/** Maps Firebase phone-auth error codes to messages that do not leak internals. */
export function phoneAuthErrorMessage(err: any): string {
  const code: string = err?.code || '';
  if (code.includes('invalid-phone-number')) return 'Enter the number in international format, e.g. +447700900123.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
  if (code.includes('invalid-verification-code')) return 'That code is not correct. Check the SMS and try again.';
  if (code.includes('code-expired') || code.includes('session-expired')) return 'That code has expired. Request a new one.';
  if (code.includes('quota-exceeded')) return 'SMS limit reached. Please try again later.';
  if (code.includes('operation-not-allowed')) return 'Phone sign-in is not enabled for this app yet.';
  if (code.includes('credential-already-in-use') || code.includes('account-exists')) return 'This number is already linked to another account.';
  if (code.includes('requires-recent-login')) return 'Please sign in again before verifying a number.';
  if (code.includes('captcha')) return 'Could not complete the security check. Reload the page and try again.';
  return 'Phone verification failed. Please try again.';
}

interface PhoneVerificationProps {
  /** Called after the SMS code has been accepted. */
  onVerified?: () => void;
  submitLabel?: string;
}

/**
 * Two-step SMS flow: enter a number in E.164 format, then the 6-digit code.
 * Signed in: the number is linked to the current account. Signed out: it signs the user in.
 */
export function PhoneVerification({ onVerified, submitLabel = 'Verify' }: PhoneVerificationProps) {
  const { sendPhoneCode, confirmPhoneCode } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendPhoneCode(phone, RECAPTCHA_CONTAINER_ID);
      setStep('code');
    } catch (err) {
      console.warn('[PhoneVerification] send failed:', err);
      setError(phoneAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneCode(code);
      onVerified?.();
    } catch (err) {
      console.warn('[PhoneVerification] confirm failed:', err);
      setError(phoneAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {step === 'phone' ? (
        <>
          <div className="relative">
            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+44 7700 900123"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              className="w-full pl-11 pr-4 py-4 bg-white rounded-xl text-xs outline-none font-bold shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={busy || phone.trim().length < 8}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? 'Sending...' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(null); }}
            className="w-full px-4 py-4 bg-white rounded-xl text-center tracking-[0.5em] text-sm outline-none font-black shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          <button
            type="button"
            onClick={confirm}
            disabled={busy || code.length !== 6}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <ShieldCheck size={16} />
            <span>{busy ? 'Checking...' : submitLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => { setStep('phone'); setCode(''); setError(null); }}
            className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline"
          >
            Use a different number
          </button>
        </>
      )}
      {error && <p className="text-rose-500 text-[11px] font-bold leading-tight">{error}</p>}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </div>
  );
}
