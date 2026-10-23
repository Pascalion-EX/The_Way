import { readFileSync } from "node:fs";
import { OTP_TTL_MS } from "./otpPolicy.js";

export const EMAIL_LOGO_CID = "the-way-logo@the-way.invalid";
const logo = readFileSync(new URL("../assets/thewaylogo.svg", import.meta.url));
const styles = {
  welcome: { category: "WELCOME", title: "Welcome to The Way", note: "Thank you for joining our community. Please verify your email to get started." },
  verification: { category: "ACCOUNT VERIFICATION", title: "Verify your email address", introduction: "Thanks for signing up! Enter the verification code below to activate your account.", codeLabel: "YOUR VERIFICATION CODE", note: "If you didn't create an account, you can safely ignore this email." },
  passwordReset: { category: "PASSWORD RESET", title: "Reset your password", introduction: "Enter the code below to choose a new password for your account.", codeLabel: "YOUR PASSWORD RESET CODE", note: "If you didn't request a password reset, you can safely ignore this email. Your password will stay the same." },
  ban: { category: "ACCOUNT NOTICE", title: "Your account has been banned" },
  camp: { category: "TRIP UPDATE", title: "An update about your trip" },
  videoRequest: { category: "VIDEO EDITING REQUEST", title: "New video editing request", introduction: "A new video editing request was submitted through The Way." },
};

export const escapeEmailHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const paragraphs = (value) => String(value || "").trim().split(/\r?\n\s*\r?\n/)
  .filter(Boolean).map((paragraph) => `<p style="margin:0 0 16px;">${escapeEmailHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`).join("");

const detailValue = ({ value, link }) => {
  const text = escapeEmailHtml(value);
  if (link) {
    try {
      const url = new URL(String(value));
      if (["https:", "http:"].includes(url.protocol)) {
        return `<a href="${escapeEmailHtml(url.href)}" style="color:#ffffff;text-decoration:underline;">${text}</a>`;
      }
    } catch { /* Display invalid or non-web links as text. */ }
  }
  return text.replace(/\r?\n/g, "<br />");
};

export function buildBrandedEmail({ kind, title, text = "", code, details = [], year = new Date().getUTCFullYear() }) {
  const content = styles[kind];
  if (!content) throw new Error("Unknown email template");
  const hasCode = Boolean(content.codeLabel && /^\d{6}$/.test(String(code)));
  const heading = title || content.title;
  const preheader = content.introduction || heading;
  const codePanel = hasCode ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px;background:#e5b44d;border-radius:16px;">
      <tr><td align="center" style="padding:24px 16px;">
        <p style="margin:0 0 12px;color:#242424;font-size:13px;line-height:20px;">${content.codeLabel}</p>
        <p style="margin:0 0 12px;color:#ffffff;font-size:34px;font-weight:700;line-height:42px;letter-spacing:6px;font-variant-numeric:tabular-nums;white-space:nowrap;">${escapeEmailHtml(code)}</p>
        <p style="margin:0;color:#242424;font-size:14px;line-height:22px;">Expires in ${OTP_TTL_MS / 60_000} minutes</p>
      </td></tr>
    </table>` : "";
  const statusPanel = kind === "ban" ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px;background:#e5b44d;border-radius:16px;">
      <tr><td align="center" style="padding:24px 16px;">
        <p style="margin:0 0 12px;color:#242424;font-size:13px;">ACCOUNT STATUS</p>
        <p style="margin:0;color:#a62b43;font-size:24px;font-weight:700;">Banned</p>
      </td></tr>
    </table>` : "";
  const detailPanel = details.length ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e5b44d;border-radius:16px;text-align:left;">
      <tr><td style="padding:8px 24px;">${details.map((detail) => `
        <p style="margin:16px 0 4px;color:#242424;font-size:12px;line-height:18px;">${escapeEmailHtml(detail.label)}</p>
        <p style="margin:0 0 16px;color:#172033;font-size:15px;line-height:24px;overflow-wrap:anywhere;word-break:break-word;">${detailValue(detail)}</p>`).join("")}
      </td></tr>
    </table>` : "";
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeEmailHtml(heading)} — The Way</title></head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif;color:#172033;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeEmailHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f4f8">
    <tr><td align="center" style="padding:20px 12px;">
      <!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;">
        <tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:28px 20px 24px;border-radius:18px 18px 0 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px;border-radius:16px;">
            <img src="cid:${EMAIL_LOGO_CID}" width="80" height="77" alt="The Way logo" style="display:block;width:80px;height:77px;border:0;" />
          </td></tr></table>
          <p style="margin:14px 0 8px;color:#242424;font-size:26px;font-weight:700;line-height:32px;">The Way</p>
          <p style="margin:0;color:#a2001c;font-size:12px;letter-spacing:1px;line-height:20px;">${content.category}</p>
        </td></tr>
        <tr><td align="center" style="padding:32px 22px 36px;">
          <h1 style="margin:0 0 20px;color:#172033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(heading)}</h1>
          ${content.introduction ? `<p style="margin:0 0 20px;color:#4c5d78;font-size:16px;line-height:26px;">${escapeEmailHtml(content.introduction)}</p>` : ""}
          ${(!content.codeLabel || !hasCode) && text ? `<div style="color:#4c5d78;font-size:16px;line-height:26px;overflow-wrap:anywhere;word-break:break-word;">${paragraphs(text)}</div>` : ""}
          ${codePanel}${statusPanel}${detailPanel}
          ${content.note ? `<p style="margin:18px 0 0;color:#242424;font-size:14px;line-height:24px;">${escapeEmailHtml(content.note)}</p>` : ""}
        </td></tr>
        <tr><td align="center" style="padding:28px 20px;border-top:1px solid #dfe5f0;">
          <p style="margin:0 0 5px;color:#8a9cba;font-size:12px;line-height:20px;">&copy; ${escapeEmailHtml(year)} The Way. All rights reserved.</p>
          <p style="margin:0;color:#8a9cba;font-size:12px;line-height:20px;">This is an automated email.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return {
    html,
    attachments: [{ filename: "thewaylogo.svg", content: logo, contentType: "image/svg+xml", contentDisposition: "inline", cid: EMAIL_LOGO_CID }],
  };
}
