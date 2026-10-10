# Background authentication emails

Registration, verification-code requests, and password-reset requests save email
jobs inside the user document, in the same database write as the account or OTP.
The HTTP response confirms persistence, not delivery. No SMTP operation runs in
these request handlers. Registration queues the first verification code as well
as the welcome email.
Each user must wait 60 seconds before requesting another OTP of the same type.
The request timestamp and new OTP/job are saved in one atomic update. Requests
during the cooldown receive HTTP 429 with `Retry-After` and
`otpResendAvailableAt`; automatic delivery retries do not extend the cooldown.

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
seconds, then every five minutes. Retries continue until expiry: 12 hours for
OTPs and 24 hours for welcome emails. Expired jobs and jobs for verified accounts,
consumed codes, or changed addresses are discarded. Successful delivery removes
the payload. Logs include the job ID and error code, without mail contents.

Delivery is at least once: a crash after SMTP accepts mail but before the database
acknowledgement can cause a duplicate. Retries keep the same message ID and OTP.
No email is sent while the backend is stopped; persisted jobs resume when it
starts. Replacing a pending OTP prevents its future retries, although an email
already being sent cannot be recalled.

Pending delivery can be inspected in `users.emailJobs`: job `status`, `attempts`,
`nextAttemptAt`, `expiresAt`, and `lastError`. These fields and email bodies are
excluded from admin/profile responses. The client receives only a queued flag.

Tests (no real accounts or email delivery):

```sh
node backend/tests/emailQueue.test.js
node backend/tests/emailVerification.test.js
node backend/tests/adminRoles.test.js
```
