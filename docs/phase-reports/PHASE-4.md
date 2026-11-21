# Phase 4 – Contact form and deletion requests (C2, S4, D4)

## Phase and branch

| | |
| --- | --- |
| Phase | 4 – Contact form and deletion requests (`docs/FIX-PLAN.md`) |
| Branch | `fix/phase-4-contact-deletion-requests` (from `main` @ `411d08b`, Phase 3 merged) |
| Commits / PR | listed in the PR; a commit cannot contain its own hash |
| Versions | backend `1.0.9 → 1.0.10`, frontend `1.0.11 → 1.0.12` |

Also in this phase, at your request: **react-snap removal added to Phase 9's clean-up list** in
`docs/FIX-PLAN.md` (item 5). Nothing was removed now.

## Checklist items

| Item | Status | Summary |
| --- | --- | --- |
| C2 | **Fixed, ticked** | The landing-page form sends through `api.contact.send`, offers the topics that fit the visitor, shows field and server errors, and sends a signed-out deletion request on to the new verify page. Proven in E2E on Chromium, Firefox and WebKit. |
| S4 | **Fixed, ticked** | Nothing in the contact flow blocks a device or IP any more. Signed-out deletion requests have their own per-IP and per-device limit and are confirmed with an emailed code (D4). |
| FR13.13 | User side works | The checklist's FR13 table now says so. Acting on a request (deleting recordings) is C3, Phase 5. |

## Claims checked against the code first

- **C2: confirmed.** `ContactForm.submit()` in `frontend/src/pages/Landing.jsx` set "Sending…"
  and returned. The topic `<select>` and the deletion explanation were commented out, and
  `api.contact.send` existed but nothing called it.
- **S4: confirmed.** `contactService.send` called
  `accessRestrictionService.temporarilyRestrictRequest` in three places, each blocking the
  device (or IP) for `CONTACT_ABUSE_BLOCK_MINUTES` (10):
  - an email that didn't match the signed-in account;
  - a signed-out visitor choosing any topic other than deletion;
  - **whoever happened to hit the site-wide cap.**

  Signed-out deletion requests were accepted without any check that the sender owns the
  account.

## The rules now (FIX-PLAN section 0, D4, and your answer during planning)

| Sender | Topics | Limits | Deletion request |
| --- | --- | --- | --- |
| Signed in | all three; the email must match the account (else **403**) | one general/partnership message per UTC day (**409**); deletion requests don't count | verified at once |
| Signed out | deletion only (anything else **403**) | **2 per IP and 2 per device** per UTC day (`CONTACT_SENDER_DAILY_LIMIT`, **429**) | verified by a six-digit code emailed to the account |

- **Site-wide cap:** general and partnership messages share `CONTACT_DAILY_LIMIT` (25 a day,
  **429**). Deletion requests are **exempt** (your planning answer), so nobody can use up the
  cap to stop others asking for their data to be deleted.
- **No refusal blocks anyone.** `temporarilyRestrictRequest` and `CONTACT_ABUSE_BLOCK_MINUTES`
  had no other callers and are removed. Admin restrictions (FR13.12) are a separate code path
  and are unchanged.
- **Codes** use the sign-up OTP rules:
  - an HMAC hash with `JWT_SECRET`, bound to purpose and message;
  - expiry after `AUTH_OTP_TTL_MINUTES`, and the code dies after `AUTH_OTP_MAX_ATTEMPTS` (5)
    wrong tries;
  - resend at most every `AUTH_OTP_RESEND_SECONDS` (60).

  The helpers moved from `authService.js` to `src/utils/otp.js` with no change in behaviour (all
  auth suites pass unchanged).
- **No account guessing:**
  - The code is emailed *after* the response, in the background, and only if an account uses
    the email. Send, verify and resend answer with the same status, body and (measured) time
    band either way.
  - A request for an email with no account stays **unverified** for the team to check by hand,
    and the verify page says so.
- **Per-sender quota keys** are an HMAC of `ip:<address>` / `device:<id>`, so neither is stored
  in the clear and the IPv4 space can't simply be hashed and looked up. Rows expire after two
  days.
- The Web3Forms subject now shows "(verified)" or "(verification pending)" on deletion requests.

## Routes, models and env vars

**Routes:** two added, none renamed.
- `POST /api/v1/contact/:id/verify` `{ code }` → 200 `{ verified: true }`, or one generic 400
  for an unknown id or a wrong, expired or used-up code.
- `POST /api/v1/contact/:id/resend` → 202 `{ message }`; 429 within a minute; 400 when no code
  is needed.
- Both use the new `contactCodeLimiter` (20 per 15 minutes) and `idParams`.

**`POST /contact`:** now returns `{ received, id, verificationRequired }`. The existing
`received` key is kept.

**Models:**
- `ContactMessage` gains `verified` and `status` (`open`, `done`, `rejected`), plus
  `handledAt`/`handledBy` for Phase 5.
- It also gains the hidden `verification*` fields. These are `select: false` and stripped in
  `toJSON`; a test proves the admin inbox never returns them.
- New `ContactSenderQuota` (`{ key, day, count }`, unique, with a 2-day TTL).

**Env vars:**
- **Added:** `CONTACT_SENDER_DAILY_LIMIT` (default 2), in `env.js`, both `.env` templates and
  `setup.md`.
- **Removed:** `CONTACT_ABUSE_BLOCK_MINUTES`. An old `.env` that still sets it keeps working;
  unknown keys are ignored.

**Docs updated:**
- `docs/API.md` and `src/docs/openapi.js` (two new paths, plus the `ContactReceipt`,
  `ContactCodeInput` and `ContactMessage` schemas);
- `ARCHITECTURE.md`, `MODULE-REFERENCE.md`, `backend/README.md`;
- `frontend/README.md`, `frontend/docs/architecture.md`, `e2e/README.md`.

## Files changed

**Backend**
- `src/services/contactService.js`: rewritten (rules above; `send`, `issueCode`, `verify`,
  `resend`).
- `src/utils/otp.js` (new): `generateOtp`, `hashOtp`, `matchesOtp`; `authService.js` uses it.
- `src/models/ContactMessage.js`, `src/models/ContactSenderQuota.js` (new).
- `src/repositories/contactQuotaRepo.js` (`claimSender`/`releaseSender`), `messageRepo.js`
  (`findForVerification`, `save`).
- `src/routes/contactRoutes.js`, `src/controllers/contactController.js`,
  `src/middlewares/validators/miscSchemas.js` (`contactCodeSchema`),
  `src/middlewares/rateLimiter.js` (`contactCodeLimiter`).
- `src/services/external/sendOTPBrevo.js`: a `deletion-request` email (subject "Confirm your
  SignPak Commons deletion request").
- `src/services/external/sendContactWeb3Forms.js`: the verification state in the subject.
- `src/services/accessRestrictionService.js`: `temporarilyRestrictRequest` removed.
- `src/config/env.js`, `.env.example`, `.env.production.example`.
- `scripts/e2e-server.js`:
  - contact messages are saved but never forwarded to Web3Forms;
  - the per-sender limit is raised to 50, because every browser connects from 127.0.0.1.

**Frontend**
- `src/components/ContactForm.jsx` (new; moved out of `Landing.jsx` so it can be tested on its
  own).
- `src/pages/ContactVerify.jsx` (new) at `/contact/verify?id=`, outside the auth guards; the id
  is checked with the existing `safeRouteId`.
- `src/pages/Landing.jsx`: uses the component; **loads the session** (see "Found during the
  phase").
- `src/services/api.js` and `apiRoutes.js` (`contact.verify`, `contact.resend`),
  `src/routes/appRoutes.js` (`paths.contactVerify`, `contactVerifyUrl`), `src/App.jsx`,
  `src/styles/landing.css` (`.contact-note`).

**Tests, docs:** listed below; `docs/FIX-PLAN.md` (Phase 9 item), the checklist,
`backend/docs/TEST-CASES.md`.

## Tests added

| Level | File | Cases | Rows |
| --- | --- | ---: | --- |
| Unit (backend) | `otp.test.js` | 4 | U-92–U-95 |
| Unit (backend) | `contactRules.test.js`: repositories, email and Web3Forms replaced with `mock.method`, no database | 17 | U-96–U-112 |
| Unit (backend) | `contactSchemas.test.js` | 5 | U-113–U-117 |
| Integration | `api-contact.test.js` | 13 | I-57–I-69 |
| Integration | `api-admin-stats-contact.test.js` (I-39, adjusted, see below) | — | I-39 |
| Security | `contact-verification.test.js`: enumeration (status, body and median time), NoSQL `{ "$gt": "" }` → 422, limiter wiring | 4 | S-14–S-17 |
| Security | `access-matrix.test.js`: the two new routes | +2 | S-01 |
| Unit (frontend) | `ContactForm.test.jsx` | 4 | FU-25–FU-28 |
| Integration (frontend) | `Contact.test.jsx` (MSW) | 8 | FI-05–FI-10 |
| Integration (frontend) | `ContactVerify.test.jsx` (MSW) | 9 | FI-11–FI-16 |
| E2E | `contact.spec.js`: "C2: a signed-in contributor sends a contact message from the landing page" and "D4: a signed-out deletion request is confirmed with the emailed code" | 2 × 3 browsers | E-05, E-06 |

**I-39 changed on purpose.** It asserted the old behaviour that S4 removes: after each of three
refusals, `/health` for that device answered **403** (blocked). Those three assertions now
expect **200**, each with an `S4 (Phase 4)` comment. The test title changed from "…and blocks
abusive devices" to "…; S4: refusals never block the device". Every other assertion in I-39
(422, 500 on provider failure, 201, 409, the 403 and 429 answers themselves, the admin inbox) is
unchanged. This makes the test stricter about the new rule, not weaker, but it is a change to an
existing test, so I'm flagging it.

**Proof the tests catch the bugs:**
- I ran the new integration and security files against main's `contactService.js` and
  `accessRestrictionService.js`: **13 of 17 failed**, every S4 "not blocked" test and every D4
  test. The 4 that still passed check things the old code also did, or new wiring that is
  independent of the service: the 422 for a NoSQL code, the limiter on the new routes, the
  rollback test (old code had no sender quota) and the enumeration timing.
- The frontend regression test for the session bug failed with the fix removed and passes with
  it.
- C2's form tests are on the new component, so they can't run against the old one; the old
  `submit()` made no request at all, and the E2E C2 test needs a real one.

**Traceability:** all rows validated by `tests/unit/traceability.test.js` (pass). They map to
FR13.13; the schema and NoSQL tests also map to SE-10, the landing-page test also to UI 3.1.1.3,
and the OTP helper to FR13.1 and FR13.13. The Checklist column is C2 or S4 (D4 is the decision
under S4).

## Found during the phase

**A signed-in contributor got the signed-out form after a full page load.** The new E2E test
caught it on all three engines: after sign-up, `page.goto('/#contact')` showed only the deletion
topic.

- **Cause** (older than this phase): the session is loaded lazily, by the route guards only. The
  landing page is public and has no guard, so `user` stays `null` there until some guarded page
  is visited.
- **Fix:** `Landing.jsx` calls `ensureSession()` on mount, as the guards do, and the form keeps
  its send button disabled ("Checking your session…") until the check finishes. Signed out,
  `/auth/session` answers 200 with no user, so this costs one request and never errors. The
  header on the landing page benefits too.
- **Regression tests:** FI-05 ("C2: a signed-in contributor who opens the landing page directly
  gets the signed-in form", the real `Landing` and `AuthProvider`, with MSW) and FU-27 ("C2:
  sending waits until the session check has finished").

## Test gate results

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 117, pass 117, fail 0 | 0 |
| backend `test:integration` | tests 69, suites 14, pass 69, fail 0 | 0 |
| backend `test:security` | tests 65, suites 6, pass 65, fail 0 | 0 |
| backend `test:coverage` | pass 251, fail 0; 92.82% lines / 88.03% branches; "Coverage gate passed." | 0 |
| frontend `lint` | clean | 0 |
| frontend `test` | Test Files 12 passed (12), Tests 49 passed (49) | 0 |
| frontend `test:coverage` | Lines 24.62% (was 18.9%); thresholds passed | 0 |
| frontend `build` | built; main chunk 530.68 kB (gzip 162.60 kB), was 526.16 kB | 0 |
| `e2e` | **18 passed** (57.3 s): 6 tests × Chromium, Firefox, WebKit | 0 |
| backend `npm audit --omit=dev --audit-level=high` | found 0 vulnerabilities | 0 |
| frontend `npm audit --omit=dev --audit-level=high` | found 0 vulnerabilities | 0 |
| e2e `npm audit --omit=dev --audit-level=high` | found 0 vulnerabilities | 0 |

### Coverage

| Scope | Phase 3 | Phase 4 | Floor |
| --- | --- | --- | --- |
| Backend overall | 91.98% lines / 87.17% branches | **92.83% / 88.04%** | 85 / 75 |
| `src/services` | 85.65% / 84.45% | **87.24% / 86.33%** | 80 / 75 |
| `src/middlewares` | 97.91% / 87.41% | 97.94% / 87.41% | 80 / 75 |
| `src/utils` | 99.35% / 92.11% | 99.4% / 92.45% | 80 / 75 |
| Frontend overall | 18.9% lines | **24.62%** | 18 |

(The overall row comes from `check-coverage.js` over `src/` only, hence 92.83% against c8's
92.82% for all files.)

### CI

Run [44882629999](https://github.com/SignPak/SignPakCommons/actions/runs/44882629999) on
`aae4e6b` (PR #34): overall **success**, all five jobs green.
- **Backend:** "pass 117 / 69 / 65", 251 under coverage, "Coverage gate passed.".
- **Frontend:** lint, test, coverage and build pass.
- **End-to-end:** "18 passed (51.5s)" on Linux, where WebKit runs the cross-host negative
  control too.
- **Dependency audit** (required): "found 0 vulnerabilities".
- **Deploy files:** pass.

## How to verify by hand

```sh
git switch fix/phase-4-contact-deletion-requests
cd backend  && npm ci && npm test && npm run test:coverage
cd ../frontend && npm ci && npm test && npm run build
cd ../e2e && npm ci && npm run e2e
```

In a browser: run the backend and frontend with `npm run dev`, using a `.env` with a real
`BREVO_API_KEY` so the code email arrives. To watch it without email, run the E2E spec in a
visible browser: `cd e2e && npx playwright test tests/contact.spec.js --headed --project=chromium`.

1. **Signed out:** open `/#contact`. Only "Request recording/data deletion" is offered, with the
   explanation. Send it for your account's email, and you land on `/contact/verify`.
2. **Code:** enter the code from the email to see "Request verified." The resend button counts
   down from 60.
3. **Signed in:** the form offers three topics and the email is read-only. A second general
   message the same day shows "You can send one contact message per day."; a deletion request
   still goes through.
4. **No blocks:** after any refusal, the site keeps working from the same browser.

## Not done, and deviations from the plan

1. **Found and fixed outside the plan:** the landing-page session bug above. It was needed for
   C2 to work for a signed-in contributor who opens the site directly.
2. **`ContactForm` moved to `src/components/ContactForm.jsx`.** The plan said "in
   `Landing.jsx`"; I moved it so it can be tested on its own. The markup and classes are the
   same.
3. **The forwarded subject's verification label is passed as its own field** (`verification`),
   not appended to `topic`. Appending broke an existing I-39 assertion on the topic label; a
   separate field keeps the label unchanged.
4. **Phase 5 work not started:** the admin messages page, acting on deletion requests (C3), and
   setting `status`/`handledBy`. The fields exist for it.
5. **The real Brevo email** for `deletion-request` hasn't been seen in an inbox: the server
   (D1) doesn't exist yet. It uses the same Brevo call and template as the verification emails,
   with its own subject and wording. **Pending go-live check:** on the live site, send a
   signed-out deletion request for a real account and confirm the code email arrives from
   `no-reply@signpak.tech`.

## Known risks

1. **Timing uniformity is best-effort.** The code is sent after the response, so neither path
   waits on Brevo. The security test checks that median times over 6 rounds differ by less than
   100 ms, not to the millisecond. It passed with a much smaller gap locally; on a loaded CI
   runner it could, in principle, be flaky.
2. **Shared IPs.** Two deletion requests a day per IP could stop a third person behind the same
   university or mobile NAT. They get a 429 telling them to try tomorrow or sign in, and a
   signed-in request has no such limit. `CONTACT_SENDER_DAILY_LIMIT` can be raised without a
   code change.
3. **The first resend waits 60 s for everyone**, because every signed-out request records a send
   time, account or not. This keeps the two cases identical.
4. **A request for an email with no account can never be verified by code.** By design (D4) it
   waits for the manual check in Phase 5.

## Fixes after verification

### Issue 1: code emails for deletion requests had no overall limit

**What verification found.** `resend()` only enforced 60 s per request and `contactCodeLimiter`
(20 per 15 minutes per IP). One person could create two requests for a victim's email and resend
each one indefinitely: about 1,900 code emails a day from one IP. That floods the victim's inbox
and can use up the Brevo daily quota, which would stop sign-up and password-reset codes for
everyone. The 60 s check was also a read followed by a separate write, so two simultaneous
resends could both pass.

**Fix**
- **Per-request cap: 5 codes, the first one included** (`CODES_PER_REQUEST` in
  `contactService.js`).
  - New hidden field `ContactMessage.verificationSendCount`, set to 1 when a signed-out
    deletion request is saved and incremented on each resend. It is never returned by the API.
  - After the cap, resend answers **429 "This request has had too many codes. Send a new
    request tomorrow."**
  - The count is kept for requests with no account too, so the answers are identical.
- **Per-recipient cap: `CONTACT_CODE_EMAILS_PER_DAY` (default 5)** code emails per address per
  UTC day, across all requests and senders.
  - It reuses `ContactSenderQuota` with the key `HMAC("contact-sender:email:" + address)`, the
    same keyed hash as the IP and device keys, so addresses aren't stored in the clear.
  - At the cap, `issueCode` doesn't send (it logs a warning) and stores no new code. The
    visitor's answer is exactly the same, because the code is always sent after the response.
  - A failed Brevo send gives its place in the cap back.
- **Atomic resend claim.** `messageRepo.claimResend()` is one `findOneAndUpdate`. It matches
  only an unverified, signed-out deletion request whose `verificationSentAt` is null or older
  than 60 s and whose send count is below 5. It sets the send time and increments the count in
  the same update. A losing simultaneous request gets the usual 429 "Wait a minute…".
- **Setting:** `CONTACT_CODE_EMAILS_PER_DAY` is in `env.js`, both env templates and `setup.md`.
  The per-request cap is a fixed 5, as specified, not a setting.
- **Docs:** `docs/API.md`, `src/docs/openapi.js` (resend description), `ARCHITECTURE.md`,
  `backend/README.md`.

**Resulting worst case from one IP:** 2 requests a day × 5 codes = 10 code emails, and never
more than 5 a day to any one address, however many IPs are used.

**Tests added** (all named "S4:"; rows in `TEST-CASES.md`):

| Level | Rows | Tests |
| --- | --- | --- |
| Unit, `contactRules.test.js` | U-118–U-123 | a signed-out request starts with one code counted; at most five codes per request, then the 429; the per-request cap counts and answers the same without an account; a resend that loses the race answers "wait a minute"; at most `CONTACT_CODE_EMAILS_PER_DAY` code emails per address, with an HMAC key; a failed email gives its place back |
| Integration, `api-contact.test.js` | I-70 | the 6th code for one request is refused (429), and no 6th email is captured |
| Integration, `api-contact.test.js` | I-71 | 7 requests for one address, each from a fresh IP and device, produce exactly 5 emails, and all 7 answers are identical |
| Integration, `api-contact.test.js` | I-72 | two simultaneous resends: one 202 and one 429, and exactly one extra email (send count 2) |

The unit tests replace the repositories, so they include a fake `claimResend` that applies the
same conditions as the MongoDB filter. The real filter is exercised by I-70–I-72. **No
existing test was changed**: the 17 earlier unit tests in `contactRules.test.js` pass as they
were.

**Proof:** with the pre-fix `contactService.js`, `messageRepo.js`, `ContactMessage.js` and
`env.js` put back (plus only the two new exports, so the test file can import), **I-70, I-71
and I-72 all fail**. I-72 failing shows the race was real: both simultaneous resends sent a
code. All three pass on the fix.

**How I-71 simulates different IPs:** every test request comes from 127.0.0.1, and the API
doesn't trust forwarded headers in tests. Before each request the test deletes every
`ContactSenderQuota` row except the address's own. That is exactly the state a new IP and
device would see.

### Test gate after the fix

Run on this branch, Windows 11, Node v24.13.1, 21 Nov 2026. Pasted from real output.

| Gate | Result | Exit |
| --- | --- | --- |
| backend `test:unit` | tests 123, pass 123, fail 0 | 0 |
| backend `test:integration` | tests 72, pass 72, fail 0 | 0 |
| backend `test:security` | tests 65, pass 65, fail 0 | 0 |
| backend `test:coverage` | pass 260, fail 0; overall 92.92% lines / 88.2% branches, `src/services` 87.42% / 86.68%; floors passed | 0 |
| frontend `lint` / `test` / `test:coverage` / `build` | clean / 49 passed / 24.62% lines / built | 0 |
| `e2e` | 18 passed (1.2 m) | 0 |
| `npm audit --omit=dev --audit-level=high` (backend, frontend, e2e) | found 0 vulnerabilities ×3 | 0 |

No version bump: FIX-PLAN asks for one per phase, and Phase 4 already has it (backend
1.0.10, frontend 1.0.12).
