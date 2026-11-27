// `cd functions && npm i firebase-functions firebase-admin`, then `firebase deploy --only functions`
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin'); admin.initializeApp();
const db = admin.firestore(), opts = { region: 'europe-west2' };

async function isSuperAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const [a, s] = await Promise.all([db.doc(`admins/${req.auth.uid}`).get(), db.doc(`support_agents/${req.auth.uid}`).get()]);
  if (!a.exists && !s.exists && !req.auth.token.admin) throw new HttpsError('permission-denied', 'Not support staff.');
  return a.exists || req.auth.token.admin === true;
}
// Agents + admins. Queues a fresh link via the Firebase "Trigger Email" extension (`mail` collection).
exports.resendVerification = onCall(opts, async req => {
  await isSuperAdmin(req);
  const u = await admin.auth().getUser(req.data.uid);
  if (!u.email) throw new HttpsError('failed-precondition', 'User has no email.');
  const link = await admin.auth().generateEmailVerificationLink(u.email);
  await db.collection('mail').add({ to: u.email, message: { subject: 'Verify your KonnectS email', html: `<p><a href="${link}">Verify your email</a></p>` } });
  return { ok: true };
});
// Super Admin only: disable/enable the Auth account (blocks sign-in, not just new listings/bookings).
exports.setDisabled = onCall(opts, async req => {
  if (!(await isSuperAdmin(req))) throw new HttpsError('permission-denied', 'Super Admin only.');
  await admin.auth().updateUser(req.data.uid, { disabled: !!req.data.disabled });
  if (req.data.disabled) await admin.auth().revokeRefreshTokens(req.data.uid);
  return { ok: true };
});
