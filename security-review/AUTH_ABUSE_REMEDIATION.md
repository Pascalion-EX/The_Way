# Authentication and email abuse limits — F09

Implemented on 14 October 2026 following [the original review](../SECURITY_REVIEW.md).

Login, registration, and all four OTP request/submission routes now reserve
shared MongoDB counters before controller work. Account and recipient keys use
trimmed, lowercase mailbox identities; raw addresses and IPs are not stored in
the counter collection. The existing TTL index cleans up expired buckets.

| Budget | Limit |
|---|---|
| All six sensitive routes, per IP | 100 requests / 15 minutes |
| All six sensitive routes, service-wide | 1,000 requests / minute |
| Login, per IP | 30 attempts / 15 minutes |
| Login, per email across IPs | 10 attempts / 15 minutes |
| Registration, per IP | 5 requests / hour; 20 / day |
| Registration, per email | 3 requests / hour |
| Registration, service-wide | 100 requests / hour; 500 / day |
| Email requests, per IP | 20 message reservations / hour; 50 / day |
| Email requests, per recipient across IPs and flows | 5 message reservations / hour; 10 / day |
| Email requests, service-wide | 200 message reservations / hour; 1,000 / day |

Email reservations cover registration, verification resend, and password-reset
requests together. Registration reserves two messages (welcome and verification);
each resend/recovery request reserves one. Requests that fail later still retain
their reservations until the window ends. Existing OTP cooldowns and five-attempt
code budgets remain in force. SMTP retries use the existing queue and are not
new message reservations; these are admission quotas, not provider delivery
accounting or quotas for staff camp mail.

Limits apply to all attempts, including successful logins and unknown accounts.
A successful login does not reset counters. Requests exceeding a budget return
HTTP 429 with a matching `Retry-After` header and `retryAfter` JSON field.
Unavailable/invalid counters fail closed with HTTP 503 before hashing, account
creation, or mail queueing. Denied requests from an exhausted IP do not consume
the service-wide request allowance. No permanent account lock is created.

Counters are atomic across workers/restarts, including concurrent first-insert
collisions. Windows align to UTC boundaries; adjacent windows can admit a burst
of up to twice the quota. Hour/day limits provide additional sustained caps.
Thresholds are centralized in `backend/middleware/authRateLimit.js` for tuning
against legitimate traffic; sustained distributed attacks can still exhaust
shared budgets and require deployment monitoring/edge controls.

IPv4-mapped IPv6 addresses share the IPv4 identity. Native IPv6 peers share their
/64 budget to prevent interface-address rotation. Express retains its default
`trust proxy = false`; client-supplied forwarding headers cannot change a budget.
If deployed behind a proxy, explicitly configure only the actual trusted proxy
IP/CIDR addresses in Express before the routes. Without that deployment change,
clients behind the same proxy share its socket-IP limits. Never blindly enable
`trust proxy = true` for an internet-accessible backend.

New registrations store a normalized single mailbox. Authentication inputs and
email admission reject recipient lists, display names, injected headers, and
oversized/invalid mailboxes. The email worker also discards unsafe legacy queued
destinations before SMTP. Verification admission reads the current database
mailbox, ignores a body-supplied destination, and rejects mailbox changes between
quota reservation and queueing. Recovery uses normalized lookups with an exact
legacy-mailbox fallback while normalizing its quota identity; no migration of
existing accounts is required. The subsequent [F10 remediation](AUTH_VALIDATION_REMEDIATION.md)
extends the shared validation to profile updates, password policy, normalized
recovery lookups, and email-job creation.

## Validation

All 12 test files passed with `npm test`, including 18 new regression cases in
`backend/tests/authAbuse.test.js` covering concurrent account guesses across
IPs, successful login, spraying across accounts, forged forwarding headers,
IPv6 rotation, registration caps, hourly/daily rollover, shared message costs,
recipient/IP/global mail caps, service-wide authentication/registration caps,
counter outages, mailbox races, and legacy unsafe queue discard.

`npm test` runs the full backend/frontend regression suite, including the
existing OTP counter concurrency, duplicate-insert, expiry, session, and
authorization tests. These tests retain Express/JWT/Mongoose behavior and stub
database/SMTP I/O. They do not connect to production services or send email.

Design reference: [OWASP Authentication Cheat Sheet — Login Throttling](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).
