# KonnectS Support Portal
Vite + React 19 + TS + Tailwind 4, on the **same Firebase project** as KonnectS.
1. `cp .env.example .env` (fill Firebase web config) · `npm i` · `npm run dev` (http://localhost:3100)
2. Merge `firestore.support.rules` into the main app's `firestore.rules`, then `firebase deploy --only firestore:rules`.
3. Grant access in the Console: create `support_agents/{uid}` (any doc body) for agents; `admins/{uid}` (existing) = Super Admin.
4. Deploy `functions/` (resend verification email, account disable). 5. `npm run build && firebase deploy --only hosting` → point `support.konnects.uk` at it.
6. In the Firebase Auth console add the portal domain to Authorized domains.
