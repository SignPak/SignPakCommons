# Phase 6 – Account security (S2, S6, S9, B2, B3, B4, password change)

## Phase and branch

| | |
| --- | --- |
| Phase | 6 – Account security (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-6-account-security` (from `main` @ `fa21968`, Phase 5 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.11 → 1.0.12`, frontend `1.0.13 → 1.0.14` |

The branch's first commit, `a84654b`, is your Phase 5 verification note, added to FIX-PLAN as
**Phase 7 item 5** with a matching test line: `DeletionLog.accountDeleted` must only be written
once `deleteAccount()` has succeeded. It's docs only, and not fixed here, as you asked.

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| S2 | **Fixed, ticked** | 5 wrong passwords lock the account for 15 minutes (SE-4), even against the right password. |
| S6 | **Fixed, ticked** | Logout ends every session of the account; "Log out of all devices" on the profile. |
| S9 | **Fixed, ticked** | Unfinished sign-ups are deleted 24 h after the latest sign-up (TTL index). |
| B2 | **Fixed, ticked** | Public and admin contributor counts include only finished sign-ups. |
| B3 | **Fixed, ticked** | Signing up again with an unfinished email works, and can't be used to take over the account (see below). |
| B4 | **Fixed, ticked** | The consent page survives a reload. |
| Password change while logged in (leftovers) | **Ticked** | `POST /users/me/password` and a profile form. |
| Code expiry | Done | `AUTH_OTP_TTL_MINUTES` defaults to 10. |

## Claims checked against the code first

All confirmed:
- **S2:** login had only the per-IP `authLimiter`.
- **S6:** logout only cleared the cookie.
- **S9:** nothing removed `emailVerified:false` users.
- **B2:** `countByRole` counted everyone.
- **B3:** `register` answered 409 for any existing email.
- **B4:** `Consent.jsx` read only `location.state`.
- **Password change:** there was no route.
- **Code expiry:** the default was 5 minutes.

## Decision taken during the phase: B3 and the account pre-hijack

Implementing B3 exactly as FIX-PLAN words it ("update the names and password hash, resend the
code") opens an **account pre-hijack**:
1. Sara signs up.
2. Someone who knows her email signs up again with their own password.
3. Sara enters the code from her inbox and finishes sign-up.
4. The account goes live with the other person's password, so they can log in as her.

I stopped and asked you. You chose **"Ask for password at verify"**:
- B3 works as FIX-PLAN says.
- `POST /auth/verify-email` now takes `{ email, code, password }`. The code proves the email,
  the password proves it's the person who set it.
- A wrong password is 422 on `password` and uses up one of the 5 code attempts. The code stays
  valid until those run out.
- If someone else's re-signup replaced Sara's password, she simply signs up again with her own
  and finishes.
- The verify page has a Password field, and the E2E sign-up helper fills it in.

## Routes, models and env vars

**Routes:** one added, none renamed.
- **Added:** `POST /users/me/password` (`authLimiter`; 401 for a wrong current password; 422
  for a mismatch, a short password, or the same password; 204 with a fresh cookie).
- **Changed behaviour:**
  - `POST /auth/logout` gains `optionalAuthenticate` and ends every session of the account.
  - `POST /auth/login` adds 429 `ACCOUNT_LOCKED`.
  - `POST /auth/signup`: re-signup for an unfinished account (B3).
  - `POST /auth/verify-email` also takes `password`.

**Model:** `User` gains `failedLoginCount`, `lockedUntil` and `signupExpiresAt` (all
`select: false` and stripped from JSON), plus the TTL index `unfinished_signup_ttl`
(`expireAfterSeconds: 0`, partial filter `{ emailVerified: false, role: 'user' }`).

**Env**
- **Added:** `AUTH_LOCKOUT_ATTEMPTS` (5) and `AUTH_LOCKOUT_MINUTES` (15).
- **Changed:** the `AUTH_OTP_TTL_MINUTES` default from 5 to 10.
- All in `env.js`, both templates and `setup.md`.

**Docs:**
- `docs/API.md` (sessions, lockout, sign-up and verify, the new route);
- `src/docs/openapi.js` (logout, login, signup, `VerifyEmailInput.password`,
  `/users/me/password`);
- `ARCHITECTURE.md`, `MODULE-REFERENCE.md`, `setup.md`, `backend/README.md`;
- `frontend/README.md`, `frontend/docs/architecture.md`, `e2e/README.md`.

## Files changed

**Backend**
- `src/services/authService.js`: lockout in `login`; `logout`; `changePassword`; B3 in
  `register`; the password check in `verifyEmail`; `completeSignup` clears the expiry;
  `resetPassword` ends a lockout.
- `src/repositories/userRepo.js`:
  - `recordFailedLogin`: an atomic `$inc`; a passed lock restarts the count.
  - `clearLoginFailures`, `countVerified` (replaces `countByRole`), and
    `backfillSignupExpiry`, which is idempotent and run at startup from `initialization.js`.
- `src/models/User.js`: the fields, `SIGNUP_TTL_MS` and `SIGNUP_TTL_INDEX`.
- `src/services/publicStatsService.js`, `statsService.js`: `countVerified`.
- `src/middlewares/validators/authSchemas.js`: `verifyEmailSchema.password` and
  `changePasswordSchema`.
- Controllers and routes: `authController.logout`, `userController.changePassword`,
  `authRoutes`, `userRoutes`.
- `src/config/env.js`, `.env.example`, `.env.production.example`.

**Frontend**
- `src/components/AccountSecurity.jsx` (new), on the profile sidebar: the change-password form
  (React Hook Form + Zod) and **Log out of all devices**.
- `src/utils/consentTokenStore.js` (new). `src/pages/VerifyEmail.jsx` gets the Password field
  and saves the token; `src/pages/Consent.jsx` reads the state, then the store, and clears it
  on accept or decline.
- `src/utils/authSchemas.js`, `src/services/api.js`, `apiRoutes.js`,
  `src/context/AuthProvider.jsx`.

## Tests added

| Level | File | Cases | Rows |
| --- | --- | ---: | --- |
| Unit (backend) | `lockout.test.js`: defaults; 4 × 401 then lock; locked refuses the right password; unlock once the time has passed (`mock.timers` fake clock); the count restarts after a lock; success resets; an unknown email runs bcrypt and is never counted | 7 | U-141–U-147 |
| Unit (backend) | `userIndexes.test.js`: the TTL field, expiry and partial filter; an admin can't match it; the fields are never in JSON; `countVerified`'s filter; the 10-minute default | 5 | U-148–U-152 |
| Integration | `api-account-security.test.js` | 17 | I-86–I-102 |
| Security | `jwt.test.js` (FIX-PLAN 4.5): a valid token (control); tampered, wrong-secret, expired and `alg: none` tokens rejected; the old token rejected after logout and after a password change | 6 | S-20–S-25 |
| Security | `access-matrix.test.js`: `POST /users/me/password` | +1 | S-01 |
| Unit (frontend) | `consentTokenStore.test.js`: round trip and expiry, clear, no expiry → not stored, blocked or corrupt storage | 4 | FU-35–FU-38 |
| Unit (frontend) | `VerifyEmail.test.jsx`: the password sent with the code, required, the token saved, the server's field error shown | 4 | FU-39–FU-42 |
| Integration (frontend) | `ConsentReload.test.jsx` (MSW): a reload keeps the visitor on consent, and accepting uses and clears the saved token; decline clears; no token goes to the verify page | 3 | FI-22–FI-24 |
| Integration (frontend) | `AccountSecurity.test.jsx` (MSW): the change succeeds; a wrong current password shows on that field; the server's same-password error; client-side mismatch and short; "Log out of all devices" | 6 | FI-25–FI-30 |
| E2E | `account-security.spec.js` (3 browsers): five wrong passwords → the lockout message, and the right password still refused; forgot password → reset on another device → the first session is logged out; a reload on the consent page keeps the visitor there, and accepting works | 3 × 3 | E-08–E-10 |

The 17 integration tests cover:
- **Lockout:** 5 attempts and the message; unlock after the time; a reset after a successful
  login; a password reset ends a lock.
- **Old token after logout:** a replayed copy of the token is rejected.
- **Logout on one device** ends the other.
- **Anonymous logout:** 204.
- **Password change:**
  - 401 for a wrong current password;
  - 422 for a mismatch, the same password or a short one;
  - success keeps this session, ends the others, and the new password works.
- **S9:** the 24 h expiry, cleared on completion; the backfill (idempotent, never an admin).
- **B3:**
  - a re-signup updates the details and restarts the expiry;
  - no new code within 60 s, a new one after;
  - **the pre-hijack is blocked:** the owner's own password is refused until they sign up
    again with it;
  - a finished account still gets 409.
- **10-minute expiry:** the code's lifetime is checked, and an expired code is refused.
- **B2:** public and admin stats ignore an unfinished sign-up and count a finished one.

**Proof:** with `src/` stashed back to main, **16 of the 23** new integration and security
tests fail. The 7 that pass check behaviour main already had or controls:
- the tampered, expired and `alg: none` token tests, and the valid-token control;
- "a finished account still answers 409";
- "logout without a session still answers 204";
- "a successful login resets the count", which passes trivially without a lockout.

**Existing tests adapted** to the new behaviour. Each is adapted, not weakened:
1. **`/auth/verify-email` now requires `password`.** The three callers that send it now include
   the sign-up password: `tests/support/apiContext.js`, `api-auth.test.js` (2 calls),
   `api-consent.test.js`. Their assertions are unchanged.
2. **`api-auth.test.js` "session, logout and tampered cookies"** logged in as the *shared*
   contributor and logged out. Since S6 that correctly ends the shared contributor's other
   sessions, which the next test still used. The test now uses its own account: the same steps
   and assertions, with "Lena" instead of "Sara".
3. **`access-matrix.test.js`.** Calling `/auth/logout` now ends the shared contributor's and
   admin's sessions for every row after it. The copied cookie jar from Phase 0 can't prevent
   that. After the logout row the runner signs both back in; no expectation changed.
4. **`ProfileDeletion.test.jsx`.** The profile now has two correctly labelled "Current password"
   fields, one in the new form and one in the delete dialog. The query is scoped to the dialog
   the test already holds.
5. **`e2e/tests/cross-host-cookie.spec.js`.** `getByRole('button', { name: 'Log out' })` matches
   substrings and now also found "Log out of all devices". It's now `exact: true`, the same
   button.

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 152, pass 152, fail 0 | 0 |
| backend `test:integration` | tests 102, pass 102, fail 0 | 0 |
| backend `test:security` | tests 78, pass 78, fail 0 | 0 |
| backend `test:coverage` | pass 332, fail 0; overall 93.8% lines / 89.32% branches; "Coverage gate passed." | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 18 passed (18), Tests 77 passed (77) | 0 |
| frontend `test:coverage` | Lines 33.76% (was 29.08%); thresholds passed | 0 |
| frontend `build` | built; main chunk 542.31 kB (gzip 165.42 kB), was 539.09 kB | 0 |
| `e2e` | **30 passed** (2.0 m): 10 tests × Chromium, Firefox, WebKit | 0 |
| `npm audit --omit=dev --audit-level=high` (backend, frontend, e2e) | found 0 vulnerabilities ×3 | 0 |

### Coverage

| Scope | Phase 5 | Phase 6 | Floor |
| --- | --- | --- | --- |
| Backend overall | 93.46% lines / 88.99% branches | **93.8% / 89.32%** | 85 / 75 |
| `src/services` | 88.37% / 87.54% | **89.01% / 88.09%** | 80 / 75 |
| `src/middlewares` | 98.14% / 87.59% | 98.19% / 87.76% | 80 / 75 |
| `src/utils` | 99.44% / 92.77% | 99.44% / 92.77% | 80 / 75 |
| Frontend overall | 29.08% lines | **33.76%** | 18 |

### CI

Filled in below once the PR's run finishes.

## How to verify by hand

```sh
git switch fix/phase-6-account-security
cd backend  && npm ci && npm test && npm run test:coverage
cd ../frontend && npm ci && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
npx playwright test tests/account-security.spec.js --headed --project=chromium
```

In the running app:
1. **Lockout:** log in with a wrong password five times. The fifth attempt, and the right
   password after it, show "Too many failed attempts. Try again in 15 minutes."
2. **Logout everywhere:** sign in on two browsers; log out in one; reload the other, and it's
   signed out.
3. **Password change:** Profile → Security, change the password. This browser stays signed in;
   the other is signed out.
4. **B4:** sign up and verify, then reload the consent page. You stay on it, and accepting works.

## Not done, and deviations from the plan

1. **The verify step also asks for the password** (your decision above). It goes beyond
   FIX-PLAN's B3 text, and it's what makes B3 safe.
2. **S9 uses a TTL on `signupExpiresAt`, not on `createdAt`,** so a B3 re-signup restarts the 24
   hours (Mongoose makes `createdAt` immutable). Old pending accounts are given
   `createdAt + 24 h` at startup.
3. **Lockout answers 429 with code `ACCOUNT_LOCKED`** (FIX-PLAN gives only the message).
4. **The other refusals** for a password change: 422 for the same password as now, and 401
   for a wrong current password, as FIX-PLAN says.

## Known risks

1. **Every logout now logs out all devices** (FIX-PLAN S6: "Log out of all devices" calls *the
   same* logout). Logging out on a phone also signs out the laptop. The profile explains this
   next to the button.
2. **Anyone who knows an email can lock that account for 15 minutes.** This is inherent in
   SE-4. "Forgot password" works straight away and clears the lock.
3. **The lockout message shows that an account exists.** Login already did that ("Verify your
   email", "This account is suspended").
4. **A stolen 30-minute consent token can be reused from sessionStorage** in the same tab after
   a reload. It's only readable by this site's scripts in that tab, and it expires with the token.
5. **Production effect of the S9 backfill:** pending accounts older than 24 hours are deleted by
   MongoDB within about a minute of the first start of this version. That's intended, but it is
   a data removal, so it's worth knowing before deploying.
