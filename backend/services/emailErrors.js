const TIMEOUT_TYPES = new Set(["CONNECT_TIMEOUT", "GREETING_TIMEOUT", "UPGRADE_TIMEOUT", "SOCKET_TIMEOUT"]);
const SMTP_STAGES = new Set(["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO", "DATA"]);

// Never log messages/responses: these can contain credentials, recipients, or mail contents.
export const emailErrorDetails = (error) => {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)
    ? error.code : "EMAIL_DELIVERY_FAILED";
  const details = [code];
  if (TIMEOUT_TYPES.has(error?.timeoutType)) details.push(error.timeoutType);
  if (SMTP_STAGES.has(error?.command)) details.push(`stage=${error.command}`);
  else if (typeof error?.command === "string" && /^AUTH(?: |$)/.test(error.command)) details.push("stage=AUTH");
  if (Number.isInteger(error?.responseCode) && error.responseCode >= 100 && error.responseCode <= 599) {
    details.push(`smtp=${error.responseCode}`);
  }
  return details.join(", ");
};
