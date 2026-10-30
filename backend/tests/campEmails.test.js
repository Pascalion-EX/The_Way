import assert from "node:assert/strict";
import { test } from "node:test";
import User from "../models/userModel.js";
import Camp from "../models/campsModel.js";
import transporter from "../config/nodemailer.js";
import { notifyCampApplicants } from "../controllers/campController.js";
import { subscriptionEmailHash, verifyUnsubscribeToken } from "../services/emailSubscriptions.js";
import { withEmailEnvironment } from "./helpers/emailEnvironment.js";

const participant = (index, options = {}) => ({
  _id: index.toString(16).padStart(24, "0"), email: `person${index}@example.invalid`, ...options,
});

function setup(t, participants) {
  withEmailEnvironment(t);
  const state = { sent: [], failEmail: null, active: 0, peak: 0 };
  t.mock.method(User, "findById", () => ({ select: async () => ({ role: ["admin"] }) }));
  t.mock.method(Camp, "findById", () => ({ populate: async (path, fields) => {
    assert.equal(path, "applicants.user");
    assert.ok(fields.includes("emailUpdatesEnabled"));
    return { title: "Trip", applicants: participants.map((user) => ({ user })) };
  } }));
  t.mock.method(transporter, "sendMail", async (message) => {
    state.active++;
    state.peak = Math.max(state.active, state.peak);
    await new Promise((resolve) => setImmediate(resolve));
    state.active--;
    if (message.to === state.failEmail) throw new Error("Private SMTP details");
    state.sent.push(message);
  });
  state.notify = async () => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await notifyCampApplicants({ userId: participant(99)._id, params: { id: participant(98)._id }, body: { subject: "Trip update", message: "Our meeting time has changed." } }, res);
    return res;
  };
  return state;
}

test("trip mail skips opt-outs, banned/deleted accounts and invalid addresses, and deduplicates recipients", async (t) => {
  const state = setup(t, [participant(1), participant(2, { emailUpdatesEnabled: false }),
    participant(3, { isBanned: true }), null, participant(4, { email: "a@example.invalid,b@example.invalid" }),
    participant(1, { email: " PERSON1@EXAMPLE.INVALID " })]);
  const result = await state.notify();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.sentCount, 1);
  assert.equal(result.body.skippedCount, 5);
  assert.equal(state.sent[0].to, participant(1).email);
  assert.equal(state.sent[0].bcc, undefined);
  assert.equal(state.sent[0].cc, undefined);
});

test("every recipient gets a distinct unsubscribe link and SMTP concurrency stays bounded", async (t) => {
  const participants = Array.from({ length: 5 }, (_, index) => participant(index + 1));
  const state = setup(t, participants);
  assert.equal((await state.notify()).body.sentCount, 5);
  assert.equal(state.peak, 2);
  const links = new Set();
  for (const mail of state.sent) {
    const target = participants.find((entry) => entry.email === mail.to);
    const url = mail.list.unsubscribe;
    links.add(url);
    const claims = verifyUnsubscribeToken(new URL(url).searchParams.get("token"));
    assert.equal(claims.sub, target._id);
    assert.equal(claims.emailHash, subscriptionEmailHash(target.email));
    assert.ok(mail.html.includes(url));
    assert.ok(mail.text.startsWith("Trip\n\nOur meeting time has changed."));
    assert.ok(mail.text.includes(url));
    for (const other of participants.filter((entry) => entry !== target)) assert.ok(!mail.html.includes(other.email));
  }
  assert.equal(links.size, 5);
});

test("an all-unsubscribed trip sends no mail and reports the outcome accurately", async (t) => {
  const state = setup(t, [participant(1, { emailUpdatesEnabled: false })]);
  const result = await state.notify();
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.sentCount, 0);
  assert.equal(state.sent.length, 0);
  assert.match(result.body.message, /No emails were sent/);
});

test("partial SMTP failures do not report full delivery or expose recipients and private errors", async (t) => {
  const state = setup(t, [participant(1), participant(2), participant(3)]);
  state.failEmail = participant(2).email;
  const result = await state.notify();
  assert.equal(result.statusCode, 502);
  assert.equal(result.body.success, false);
  assert.equal(result.body.sentCount, 2);
  assert.equal(result.body.failedCount, 1);
  assert.doesNotMatch(JSON.stringify(result.body), /Private SMTP|example\.invalid/);
});
