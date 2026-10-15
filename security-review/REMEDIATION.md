# Security remediation — F01 through F05

Implemented on 14 October 2026 following [the original review](../SECURITY_REVIEW.md).

## Changes and resulting behavior

| Finding | Resolution |
|---|---|
| F01: child profile access | Both `/api/children` and `/api/childProfile` require a verified staff account for every read/write. Parents, `unAssigned`, anonymous, unverified, deleted, or revoked accounts are denied. |
| F02: attendance access | Every `/api/attendance` read/write requires verified staff. |
| F03: notification administration | Creation, role broadcasts, role clearing, and deletion of shared notices require verified staff. Ordinary verified users retain notification reads and seen actions. |
| F04: OTP guessing | Codes expire after ten minutes and allow five attempts. MongoDB atomically admits attempts and consumes a specific generation with verification/password changes. Resend, concurrent requests, expiry during work, and replay cannot reuse an old generation. |
| F05: dependency advisories | All three locked package trees now return zero npm advisory entries. Compatible upgrades and unnecessary-tool removal replace forced historical downgrades. |

Staff roles are the existing `admin`, `leader`, `pascal`, and `pamela` roles. The
shared permission middleware reads current database roles and verification,
ignoring request-body or JWT role claims. Scope follows the existing staff UI;
guardian/class-specific relationships remain a future policy extension.

OTP request/submission routes also enforce MongoDB-backed fixed-window budgets:
100 requests per IP, 15 per verification account, and 15 per recovery email in
15 minutes. Keys are hashed; expiry-index cleanup bounds retention. Counter
failures fail closed with HTTP 503. Per-code counters persist across processes
and restarts, and successful account changes clear the consumed code/email job
in the same update. Internal attempt/generation fields are excluded from profile
and admin responses.

Existing codes issued under the twelve-hour policy expire no later than ten
minutes after their stored issuance timestamp. Codes lacking that timestamp must
be requested again. The email worker discards expired/exhausted codes. Recovery
preserves exact legacy stored email identities; throttle keys are normalized
separately. This avoids breaking mixed-case legacy accounts.

## Dependency and packaging changes

| Component | Previous locked version | New locked version |
|---|---|---|
| Mongoose | 9.1.3 | 9.11.2 |
| Nodemailer | 7.0.12 | 10.1.0 |
| Express | 5.2.1 | 5.3.0 |
| Vite | 7.3.1 | 7.3.7 |
| Axios | 1.13.2 | 1.20.0 |
| react-router-dom | 7.13.0 | 7.18.4 |
| PostCSS | 8.5.6 | 8.5.30 |
| DOMPurify | 3.4.2 | 3.4.17 |
| fflate | 0.8.2 | 0.8.3 |
| concurrently | 9.2.1 | 9.2.5 |

Additional patched transitives include `path-to-regexp` 8.4.2, `proxy-addr` 2.0.8,
`body-parser` 2.3.0, `qs` 6.16.0, and `shell-quote` 1.12.0.

- Removed `nodemon`; `npm run server` uses native `node --watch server.js`.
- Removed the `shadcn` CLI and kept its required stylesheet locally with the MIT
  license. The runtime UI still uses its existing Radix components.
- Removed unused root FullCalendar, html2pdf, temporal-polyfill, frontend
  temporal-polyfill, and autoprefixer dependencies. The used `jspdf` dependency is
  now declared by the frontend; `concurrently` is declared by the root.
- Build tools are frontend development dependencies. All three lockfiles were
  refreshed without `--force`; package lifecycle scripts were disabled during
  installation.
- Removed 7,217 previously committed dependency files from Git's index, retaining
  local installed dependencies. `.gitignore` already excludes these folders.
- Added Node >=20.19.0 engine declarations and `npm test` scripts.

Fresh full-tree audit evidence:

| Tree | Before: reported package entries | After |
|---|---:|---:|
| Root | 2 | [0](npm-audit-root-after.json) |
| Backend | 12 | [0](npm-audit-backend-after.json) |
| Frontend | 38 | [0](npm-audit-frontend-after.json) |

Counts are registry dependency-graph entries and can overlap, rather than counts
of independent exploitable application flaws. Zero known registry advisories is
not a guarantee that all application or deployment risks are resolved.

## Validation

- **67 tests passed across eight files**, including 46 new security
  regression cases and 21 existing cases. Direct file execution confirmed the
  inner test counts; `npm test` also passed all eight test files.
- Permission tests exercised 207 denied route requests, 92 successful staff
  requests, both child aliases, current-role revocation, unverified accounts,
  forged request/JWT role claims, and lookup failures.
- OTP tests exercised concurrent guesses/consumption, five-attempt lockout,
  one-time use, resend races, legacy expiry, email-worker discard/delivery, exact
  legacy mailbox handling, and malformed/absent bodies.
- Rate tests exercised two simulated workers sharing a counter, duplicate
  first-insert races, rollover, isolated scopes/subjects, unavailable counters,
  all four route caps, and forwarded-header spoofing without trusted proxies.
- Mongoose tests verified nested-selector sanitization and absence of shared
  prototype mutation during event update casting. Nodemailer generated the
  current message formats with offline stream transport and retained configured
  SMTP/TLS/pool/timeouts.
- Frontend production build passed with Vite 7.3.7. The pre-existing four CSS
  optimization warnings and large-bundle warning remain; legacy controllers
  using Mongoose's deprecated `new` option may also emit warnings.
- All three fresh full-lockfile audits returned zero advisories.

Tests retained actual Express routing/JWT/Mongoose casting where useful and
stubbed database/SMTP I/O. No production database records were changed and no
email was delivered. Production connectivity and deployed infrastructure were
not exercised.

## Operational notes and remaining scope

Deploy with Node 20.19.0 or newer and recreate dependencies with `npm ci` in all
three package directories. The MongoDB user needs access to the new
`authratelimits` collection and its TTL index. Configure only known proxy hops
before relying on forwarded IP addresses; with default proxy trust, a reverse
proxy's clients share its socket-IP budget.

This document records the initial F01–F05 remediation. Subsequent changes are
documented separately:

- F09: [authentication and email abuse limits](AUTH_ABUSE_REMEDIATION.md).
- F10: [password/mailbox validation](AUTH_VALIDATION_REMEDIATION.md).
- F11: [camp response privacy](CAMP_PRIVACY_REMEDIATION.md).
- F12: [event update validation and protected metadata](EVENT_UPDATE_REMEDIATION.md).

These code changes do not deploy the application or configure production
HTTPS/CORS/CSRF/header policy. The original report describes the reviewed
snapshot; current regression tests and the subsequent remediation notes describe
the repaired behavior.

The original `proof-*.mjs` files are historical demonstrations of unsafe behavior
at the reviewed commit. They intentionally assert that vulnerabilities exist and
should not be used as post-fix acceptance tests. Use the tests under
`backend/tests` and `frontend/tests` to validate this remediation.
