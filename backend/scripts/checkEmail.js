import "dotenv/config";
import transporter from "../config/nodemailer.js";
import { emailErrorDetails } from "../services/emailErrors.js";

const missing = ["SMTP_USER", "SMTP_PASS", "SENDER_EMAIL"].filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.error(`Missing email settings: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const startedAt = Date.now();
  console.log(`Checking SMTP on port ${transporter.options.port} (${transporter.options.secure ? "TLS" : "STARTTLS"})...`);
  try {
    // verify checks connection, TLS, and authentication without sending a message.
    await transporter.verify();
    console.log(`SMTP connection and login succeeded in ${Date.now() - startedAt} ms. No email was sent.`);
    console.log("This check does not confirm sender permission or delivery to an inbox.");
  } catch (error) {
    console.error(`SMTP check failed (${emailErrorDetails(error)}).`);
    if (error.code === "ETIMEDOUT") {
      console.error("Check the network, VPN, and firewall. If port 465 is blocked, try SMTP_PORT=587 with Gmail.");
    } else if (["EAUTH", "ENOAUTH"].includes(error.code)) {
      console.error("Check SMTP_USER and SMTP_PASS. Gmail password authentication requires an App Password.");
    } else if (error.code === "EDNS") {
      console.error("Check SMTP_HOST and the computer's DNS connection.");
    }
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
