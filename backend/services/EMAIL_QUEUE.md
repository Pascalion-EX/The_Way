# Background authentication emails

All outgoing emails share the white card and gold panels in
`emailTemplate.js`. The existing `frontend/src/assets/Thewaylogo.svg` is also
bundled in `backend/assets/thewaylogo.svg` and attached inline as `image/svg+xml`
using a content ID, so it needs no public image URL or frontend runtime files. OTP
emails show the current six-digit code and ten-minute expiry. All user content
is escaped before insertion into HTML; video links are clickable only for HTTP
and HTTPS URLs. Every email retains a plain-text alternative.

The queue renders HTML when delivering a job, so existing pending jobs receive
the design without a database migration. Generate local previews with sample
content (no delivery): `node backend/scripts/previewEmails.js`. This writes the
six examples and an index to `/tmp/the-way-email-previews` by default; an optional
directory argument overrides the output path.

Registration, verification-code requests, and password-reset requests save email
jobs inside the user document, in the same database write as the account or OTP.
The HTTP response confirms persistence, not delivery. No SMTP operation runs in
these request handlers. Registration queues the first verification code as well
as the welcome email.
Each user must wait 60 seconds before requesting another OTP of the same type.
The request timestamp and new OTP/job are saved in one atomic update. Requests
during the cooldown receive HTTP 429 with `Retry-After` and
`otpResendAvailableAt`; automatic delivery retries do not extend the cooldown.

Verification and password-reset codes expire ten minutes after issuance and
allow at most five submissions per code. MongoDB atomically increments the
attempt counter before comparing the submitted code, including across server
processes. A resend resets the counter and replaces the generation identifier.
Successful verification or password replacement consumes that generation in the
same atomic database write, so concurrent submissions cannot reuse it or erase
a newer resend. Codes issued under the old expiry policy are still limited to
ten minutes from their saved request timestamp; codes without a valid timestamp
must be requested again. OTP routes also enforce shared account/IP abuse limits.
All four request/submission endpoints share a limit of 100 requests per IP per
15-minute window; verification accounts and recovery email addresses each have
a 15-request budget per window. These counters are stored in `authratelimits`
with hashed identifiers and an expiry TTL index. The database must permit writes
and TTL-index creation for this collection. Counter failures reject requests
with HTTP 503 instead of disabling the limits. Express uses the socket peer IP;
configure only actual trusted proxy hops when deploying behind a proxy.

The backend starts the worker after MongoDB connects. No additional service or
package is required. Every two seconds, it claims a due job of each type with an
atomic MongoDB update. A five-minute lease prevents simultaneous claims and lets
another worker recover work after a crash. Completion and retry updates require
the lease token, so an older job cannot erase a newer resend request.
The worker marks its internal date comparisons as trusted so the application's
global Mongoose filter sanitization stays enabled. Empty queues produce no logs.
Database failures log safe error name/code/path metadata and slow subsequent
polls with increasing delays, returning to normal polling after recovery.

SMTP connections are pooled and have explicit DNS, connection, greeting, and
socket timeouts. Delivery failures are retried after 5, 10, 20, 40, 80, and 160
seconds, then every five minutes. Retries continue until expiry: ten minutes for
OTPs and 24 hours for welcome emails. Expired jobs and jobs for verified accounts,
consumed codes, or changed addresses are discarded. Successful delivery removes
the payload. Logs include the job ID and error code, without mail contents.

Delivery is at least once: a crash after SMTP accepts mail but before the database
acknowledgement can cause a duplicate. Retries keep the same message ID and OTP.
No email is sent while the backend is stopped; persisted jobs resume when it
starts. Replacing a pending OTP prevents its future retries, although an email
already being sent cannot be recalled.

## Troubleshooting SMTP timeouts

Run `npm run email:check --prefix backend` from the repository root. This loads
`backend/.env` and checks the SMTP connection, TLS, and login without sending
email. A successful check does not confirm sender permissions or inbox delivery.
No credentials, recipient addresses, or email contents are printed.

An `ETIMEDOUT` retry means the job remains queued; it is not a delivery success.
The worker logs the timeout type and SMTP stage when supplied by Nodemailer:
`CONNECT_TIMEOUT` concerns connection setup, `GREETING_TIMEOUT` the server greeting,
`UPGRADE_TIMEOUT` the STARTTLS handshake, and `SOCKET_TIMEOUT` an inactive connection.
Connection setup includes DNS, TCP, TLS, greeting, and STARTTLS in Nodemailer 10.

For recurring local timeouts, check firewall/VPN rules and try another network.
The default is Gmail on port 465 with TLS. To try Gmail's STARTTLS port, add
`SMTP_PORT=587` to `backend/.env`, then rerun the check and restart the backend.
TLS remains required on port 587. Other providers can set `SMTP_HOST` as well.
If the connection is reachable but login fails with `EAUTH`, check the account
credentials; Gmail requires an App Password for password authentication.

Slow networks can override `SMTP_CONNECTION_TIMEOUT_MS` (default `15000`),
`SMTP_GREETING_TIMEOUT_MS` (default `15000`), and `SMTP_SOCKET_TIMEOUT_MS` (default
`30000`). Increasing timeouts does not fix blocked ports. After restoring email
connectivity, request a fresh OTP if the previous ten-minute code has expired.

Pending delivery can be inspected in `users.emailJobs`: job `status`, `attempts`,
`nextAttemptAt`, `expiresAt`, and `lastError`. These fields and email bodies are
excluded from admin/profile responses. The client receives only a queued flag.

Three cumulative authorization denials ban an account. Restricted page visits
are checked through `POST /api/auth/page-access` before the page renders, and
API permission denials use the same counter. Verification prompts, incorrect
passwords, failed logins, and validation errors do not count. Navigation checks
are deduplicated during React StrictMode effects; denied pages do not mount
their children and therefore do not generate additional API denials.

The third denial atomically stores `isBanned`, `bannedAt`, `banReason`,
`emailFlagged`, the normalized `flaggedEmail`, and a durable `emailJobs.ban`
notification. It also increments `tokenVersion`, clears pending OTPs and normal
authentication emails, and caps `accessDeniedCount` at three. Concurrent denials
cannot queue additional ban notifications. Login, existing sessions, and
password recovery reject banned accounts. Counts have no automatic reset or
expiry; flags remain on the user record and are visible on the admin dashboard.
Deleting that user record also deletes its flag and pending notification.

Ban notifications use the existing SMTP worker and retry for up to seven days.
They require neither an active OTP nor email verification. As with other queued
emails, delivery is at least once, and production SMTP must be configured.

Tests (no real accounts or email delivery):

```sh
node --test backend/tests/authCookie.test.js backend/tests/otpSecurity.test.js
```
