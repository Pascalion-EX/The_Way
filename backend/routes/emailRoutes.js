import express from "express";
import userModel from "../models/userModel.js";
import { escapeEmailHtml } from "../services/emailTemplate.js";
import { subscriptionEmailHash, verifyUnsubscribeToken } from "../services/emailSubscriptions.js";

const page = (title, message, token) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeEmailHtml(title)} — The Way</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f8;color:#172033;font:16px/1.6 Arial,sans-serif}main{box-sizing:border-box;width:min(100% - 32px,520px);padding:32px;border-radius:20px;background:white;box-shadow:0 8px 30px #17203312}h1{font-size:26px;line-height:1.3}p{color:#4c5d78}button{width:100%;padding:14px;border:0;border-radius:12px;background:#4f35ef;color:white;font:inherit;font-weight:bold;cursor:pointer}a{color:#4f35ef}.brand{color:#a2001c;font-weight:bold}</style>
</head><body><main><div class="brand">The Way</div><h1>${escapeEmailHtml(title)}</h1>
<p>${escapeEmailHtml(message)}</p>
${token ? `<form method="post" action="/api/email/unsubscribe"><input type="hidden" name="token" value="${escapeEmailHtml(token)}"><button name="confirm" value="unsubscribe" type="submit">Unsubscribe</button></form>` : ""}
<p>Account verification, password resets, and security notices will still be sent.</p>
<a href="${escapeEmailHtml(new URL("/profile", process.env.APP_ORIGIN || "http://localhost:5173").href)}">Manage email preferences in your profile</a></main></body></html>`;

export function createEmailRouter({ users = userModel } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    next();
  });
  router.use(express.urlencoded({ extended: false, limit: "4kb", parameterLimit: 5 }));
  const invalid = (res) => res.status(400).type("html").send(page(
    "This link is invalid or has expired", "Use the unsubscribe link in a recent email, or manage your email preferences in your profile.",
  ));

  // GET/HEAD only show confirmation. Email scanners must not change preferences.
  router.get("/unsubscribe", (req, res) => {
    if (!verifyUnsubscribeToken(req.query.token)) return invalid(res);
    return res.type("html").send(page("Unsubscribe from optional emails?",
      "Stop receiving welcome messages and trip updates from The Way.", req.query.token));
  });
  router.post("/unsubscribe", async (req, res) => {
    const claims = verifyUnsubscribeToken(req.body?.token);
    if (!claims || req.body?.confirm !== "unsubscribe") return invalid(res);
    try {
      const user = await users.findById(claims.sub).select("email");
      if (!user || subscriptionEmailHash(user.email) !== claims.emailHash) return invalid(res);
      // Bind the write to the mailbox checked above, including during a change
      // of email address. Repeated confirmation remains harmless.
      const result = await users.updateOne({ _id: user._id, email: user.email }, {
        $set: { emailUpdatesEnabled: false }, $unset: { "emailJobs.welcome": "" },
      });
      if (!result.matchedCount) return invalid(res);
      return res.type("html").send(page("You’re unsubscribed",
        "You will no longer receive optional emails from The Way. You can turn them back on in your profile."));
    } catch {
      return res.status(503).type("html").send(page("Unable to save your preference",
        "Please try this link again in a few minutes. Your email preference has not been confirmed."));
    }
  });
  return router;
}

export default createEmailRouter();
