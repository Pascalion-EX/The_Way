import assert from "node:assert/strict";
import { test } from "node:test";
import nodemailer from "nodemailer";
import { buildBrandedEmail, EMAIL_LOGO_CID } from "../services/emailTemplate.js";
import { createEmailJob, processNextEmailJob } from "../services/emailQueue.js";
import { OTP_TTL_MS } from "../services/otpPolicy.js";

test("every outgoing email type uses the branded card and embeds the actual logo", () => {
  for (const kind of ["welcome", "verification", "passwordReset", "ban", "camp", "videoRequest"]) {
    const { html, attachments } = buildBrandedEmail({ kind, code: "482913", text: "Test message", year: 2026 });
    assert.match(html, /The Way/);
    assert.match(html, /2026 The Way/);
    assert.match(html, /This is an automated email/);
    assert.match(html, /max-width:640px/);
    assert.match(html, /background:#ffffff/);
    assert.match(html, /role="presentation"/);
    assert.ok(html.includes(`src="cid:${EMAIL_LOGO_CID}"`));
    assert.equal(attachments.length, 1);
    assert.equal(attachments[0].cid, EMAIL_LOGO_CID);
    assert.equal(attachments[0].contentDisposition, "inline");
    assert.equal(attachments[0].filename, "thewaylogo.svg");
    assert.equal(attachments[0].contentType, "image/svg+xml");
    assert.match(attachments[0].content.toString(), /<svg\b/);
  }
});

test("verification and reset emails have distinct instructions, a copyable code and the actual OTP policy", () => {
  for (const [kind, label, title] of [
    ["verification", "YOUR VERIFICATION CODE", "Verify your email address"],
    ["passwordReset", "YOUR PASSWORD RESET CODE", "Reset your password"],
  ]) {
    const { html } = buildBrandedEmail({ kind, code: "012345" });
    assert.ok(html.includes(label));
    assert.ok(html.includes(title));
    assert.match(html, />012345<\/p>/);
    assert.ok(html.includes(`Expires in ${OTP_TTL_MS / 60_000} minutes`));
    assert.match(html, /safely ignore this email/);
    assert.match(html, /background:#e5b44d/);
  }
});

test("user-controlled email content is escaped and unsafe links are never clickable", () => {
  const unsafe = '<img src=x onerror="alert(1)"><script>alert(2)</script> & \'quoted\'';
  const { html } = buildBrandedEmail({
    kind: "camp", title: unsafe, text: `${unsafe}\nSecond line\n\nNext paragraph`,
    details: [
      { label: unsafe, value: unsafe },
      { label: "Unsafe link", value: "javascript:alert(1)", link: true },
      { label: "Data link", value: "data:text/html,<script>bad</script>", link: true },
      { label: "Video link", value: 'https://example.com/video?q="hello"&part=1', link: true },
    ],
  });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes('<img src=x onerror="'), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp; &#039;quoted&#039;"));
  assert.ok(html.includes("<br />Second line"));
  assert.equal(html.includes('href="javascript:'), false);
  assert.equal(html.includes('href="data:'), false);
  assert.ok(html.includes('href="https://example.com/video?q=%22hello%22&amp;part=1"'));
});

for (const kind of ["welcome", "verification", "passwordReset", "ban"]) {
  test(`queued ${kind} mail gains the template at delivery without changing its text or message ID`, async () => {
    const timestamp = Date.UTC(2026, 9, 21, 12);
    const email = "test@example.invalid";
    const job = createEmailJob({ to: email, subject: "Synthetic subject", text: "Original plain text", expiresAt: timestamp + OTP_TTL_MS });
    const user = {
      _id: "6ab26b08171afea3091f04b3", email, emailJobs: { [kind]: job },
      isAccountVerified: false, isBanned: kind === "ban", flaggedEmail: email,
      verifyOtp: "012345", verifyOtpRequestedAt: timestamp, verifyOtpExpireAt: timestamp + OTP_TTL_MS,
      resetOtp: "654321", resetOtpRequestedAt: timestamp, resetOtpExpireAt: timestamp + OTP_TTL_MS,
    };
    const writes = [];
    const users = {
      findOneAndUpdate() { return { select: async () => user }; },
      async updateOne(filter, update) { writes.push(update); },
    };
    let sent;
    await processNextEmailJob(kind, { users, now: () => new Date(timestamp + 1), mailer: { async sendMail(message) { sent = message; } } });
    assert.equal(sent.text, job.text);
    assert.equal(sent.subject, job.subject);
    assert.equal(sent.messageId, `<${job.id}@the-way.invalid>`);
    assert.ok(sent.html.includes(`cid:${EMAIL_LOGO_CID}`));
    assert.equal(sent.attachments[0].contentType, "image/svg+xml");
    if (kind === "verification") assert.match(sent.html, />012345<\/p>/);
    if (kind === "passwordReset") assert.match(sent.html, />654321<\/p>/);
    if (kind === "ban") assert.match(sent.html, /ACCOUNT STATUS/);
    assert.deepEqual(writes, [{ $unset: { [`emailJobs.${kind}`]: "" } }]);
  });
}

test("Nodemailer produces an offline multipart email with text, HTML and a related inline SVG", async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  try {
    const info = await transport.sendMail({
      from: "sender@example.invalid", to: "recipient@example.invalid",
      subject: "The Way verification", text: "Your OTP is 482913",
      ...buildBrandedEmail({ kind: "verification", code: "482913" }),
    });
    const mime = info.message.toString();
    assert.match(mime, /Content-Type: multipart\/alternative/);
    assert.match(mime, /Content-Type: multipart\/related/);
    assert.match(mime, /Content-Type: text\/plain/);
    assert.match(mime, /Content-Type: text\/html/);
    assert.match(mime, /Content-Type: image\/svg\+xml/);
    assert.match(mime, /filename=thewaylogo\.svg/);
    assert.ok(mime.includes(`Content-ID: <${EMAIL_LOGO_CID}>`));
    assert.match(mime, /Content-Disposition: inline/);
    assert.deepEqual(info.envelope.to, ["recipient@example.invalid"]);
  } finally {
    transport.close();
  }
});
