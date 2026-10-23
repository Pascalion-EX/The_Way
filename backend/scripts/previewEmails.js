import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBrandedEmail, EMAIL_LOGO_CID } from "../services/emailTemplate.js";

const directory = resolve(process.argv[2] || "/tmp/the-way-email-previews");
await mkdir(directory, { recursive: true });
const examples = [
  { kind: "verification", code: "482913" },
  { kind: "passwordReset", code: "905127" },
  { kind: "welcome", text: "Welcome to The Way! Your account has been created with email address: member@example.com." },
  { kind: "ban", text: "Your account on The Way (member@example.com) has been banned after three denied attempts to access restricted pages or resources.\n\nIf you believe this was a mistake, please contact an administrator." },
  { kind: "camp", title: "Our next service trip", text: "Hello everyone,\nWe look forward to seeing you on Saturday!\n\nPlease arrive at the church by 8:30 AM." },
  { kind: "videoRequest", details: [
    { label: "Requested by", value: "The Way team" },
    { label: "Title", value: "Sunday service highlights" },
    { label: "Description", value: "Please edit the opening and closing clips.\nAdd the title at the beginning." },
    { label: "Video link", value: "https://example.com/video", link: true },
    { label: "Priority", value: "Normal" },
    { label: "Status", value: "Pending" },
  ] },
];
for (const example of examples) {
  const { html, attachments } = buildBrandedEmail(example);
  const logo = attachments[0];
  await writeFile(resolve(directory, `${example.kind}.html`), html.replace(`cid:${EMAIL_LOGO_CID}`, logo.filename));
  if (example === examples[0]) await writeFile(resolve(directory, logo.filename), logo.content);
}
await writeFile(resolve(directory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Way email previews</title></head>
<body style="margin:0;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif;color:#172033;">
<main style="max-width:1100px;margin:32px auto;padding:0 16px;">
<h1>The Way email previews</h1><p>Sample content only. No emails are sent.</p>
<div style="display:flex;flex-wrap:wrap;gap:24px;">${examples.map(({ kind }) => `<section style="flex:1 1 360px;min-width:0;"><h2 style="font-size:18px;"><a style="color:#2450e8;" href="${kind}.html">${kind}</a></h2><iframe title="${kind} email" src="${kind}.html" style="width:100%;height:820px;border:1px solid #dfe5f0;border-radius:18px;"></iframe></section>`).join("")}</div>
</main></body></html>`);
console.log(`Email previews: ${resolve(directory, "index.html")}`);
