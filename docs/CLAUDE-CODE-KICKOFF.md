# Claude Code kickoff prompt – SignPakCommons

Paste everything between the two lines into Claude Code once, opened in the `SignPakCommons` folder.

---

You are the developer on **SignPakCommons**, the community video contribution site of our Final Year Project SignPAK (NUST MCS, BESE-29). Volunteers watch Pakistan Sign Language reference videos, record themselves copying the sign, trim and submit the recording, and the recordings become the training dataset for our sign recognition model.

**Stack:**
- **Frontend:** React 19 + Vite + Tailwind (`frontend/`), hosted on Vercel.
- **Backend:** Express on Node 22 + MongoDB (Mongoose) (`backend/`).
- **Storage:** recordings on Google Drive through an OAuth refresh token; emails through Brevo; contact messages through Web3Forms.
- **Existing tests:** node:test + mongodb-memory-server in the backend, Vitest + Testing Library in the frontend.

### Your task

Fix every item in `docs/SignPakCommons review checklist.md` by following `docs/FIX-PLAN.md`, **one phase at a time** (Phase 0 to Phase 10).

**Read these first, in this order, before planning anything:**
1. `docs/FIX-PLAN.md`, all of it. Pay special attention to:
   - section 0: decisions, already settled
   - section 1: rules
   - section 4: testing strategy
   - section 5: phase completion and verification
2. `docs/SignPakCommons review checklist.md`, which explains each problem (IDs C1–C5, S1–S10, B1–B8).
3. `backend/AGENTS.md`, `frontend/AGENTS.md`, `backend/docs/ARCHITECTURE.md`, `frontend/docs/architecture.md`, `backend/docs/TEST-CASES.md`.
4. The code those documents point to. Check every claim in the checklist against the actual code before you change anything. If the checklist is wrong about something, say so in your plan instead of "fixing" a non-problem.

### How we work

1. **One phase at a time.** For each phase:
   - Create the branch `fix/phase-N-<short-name>` from the latest `main`.
   - Start in **plan mode**. Your plan must list:
     - the checklist items covered
     - every file you'll create or change
     - new routes, models and environment variables
     - the tests you'll add at each level (unit / integration / E2E / security)
     - anything in the plan you think is wrong or risky
   - Wait for my approval before writing code.
2. **Decisions are settled.** Follow section 0 of FIX-PLAN.md exactly. If the code makes a decision impossible, stop and ask me; don't choose an alternative yourself.
3. **Tests are part of the work, not extra.** The project must have **unit tests, integration tests, end-to-end tests (Playwright) and security tests**, set up in Phase 0 exactly as section 4 describes. In every phase:
   - Write tests at every level the change touches.
   - Give each checklist item at least one regression test named with its ID, for example `C5: removes the temp file after a Drive upload`.
   - Write the failing test first where practical, then the fix.
   - Never delete, skip (`.skip`, `.only`, `todo`) or weaken an existing test to make the suite pass. If a test is wrong, explain why in the phase report and fix it properly.
   - Don't lower the coverage thresholds.
   - Update `backend/docs/TEST-CASES.md` (the traceability table, section 4.7).
4. **Full test gate before you say a phase is finished** (section 4.6):
   - backend: `npm run test:unit`, `npm run test:integration`, `npm run test:security`, `npm run test:coverage`
   - frontend: `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`
   - e2e: `npm run e2e`
   - both: `npm audit --omit=dev --audit-level=high` (allowed to fail only until Phase 3)
   - All must pass. Paste the real output summary (pass/fail counts and coverage) into the phase report. Don't summarise from memory.
5. **Code rules:**
   - Keep the existing layering (routes → Zod validators → controllers → services → repositories → models).
   - Keep the `{ data }` / `{ error: { code, message, fields } }` response shapes and the existing routes; add routes, don't rename them.
   - Don't change features that already work (FR13.1–FR13.12) unless the phase says to.
   - No secrets in the repo. New environment variables go into `backend/.env.example`, `backend/src/config/env.js` and `backend/docs/setup.md`.
   - Update the API docs and `src/docs/openapi.js` for every route change.
   - Bump the `package.json` version once per phase.
6. **End of every phase:**
   - Write `docs/phase-reports/PHASE-N.md` using the template in section 5 of FIX-PLAN.md.
   - Tick the finished items in `docs/SignPakCommons review checklist.md`.
   - Commit everything (no uncommitted changes left), push the branch, open the PR, and then **stop**.
   - Tell me: "Phase N is ready for verification", with the branch name, the last commit hash and the PR link.
7. **Verification.** After you stop, I'll have the phase checked independently: the reviewer reads the report and diff, re-runs the test gate on the branch, and checks the plan and decisions were followed.
   - You will then get either "verified", or a numbered list of issues.
   - For issues: fix them on the same branch, add or adjust tests, re-run the full test gate, add a "Fixes after verification" section to the phase report, push, and stop again.
   - Never merge a PR or start the next phase until I tell you the phase is verified.
8. **Be honest in reports.** If something is unfinished, a test is flaky, or you deviated from the plan, write it under "Not done or deviations from the plan" and "Known risks". A report that says everything passed when it didn't fails verification.
9. **Ask, don't guess,** for anything you need from me: real domain names, server access, credentials, or Google Cloud settings. Use placeholders such as `<DOMAIN>` in code and docs until I give the real values.

### Start now

Begin with **Phase 0 – Baseline and test infrastructure**. Read the documents above, run the current tests to record the baseline, and then show me your Phase 0 plan in plan mode. Don't change any files until I approve the plan.

---
