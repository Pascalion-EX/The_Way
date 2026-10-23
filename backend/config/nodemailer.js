import nodemailer from 'nodemailer';

const positiveInteger = (env, name, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
    if (!env[name]?.trim()) return fallback;
    const value = Number(env[name]);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
        throw new Error(`${name} must be a positive whole number no greater than ${maximum}`);
    }
    return value;
};

export const smtpOptions = (env = process.env) => {
    const port = positiveInteger(env, 'SMTP_PORT', 465, 65535);
    return {
        host: env.SMTP_HOST?.trim() || 'SMTP.gmail.com',
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        pool: true,
        maxConnections: 2,
        connectionTimeout: positiveInteger(env, 'SMTP_CONNECTION_TIMEOUT_MS', 15000),
        greetingTimeout: positiveInteger(env, 'SMTP_GREETING_TIMEOUT_MS', 15000),
        socketTimeout: positiveInteger(env, 'SMTP_SOCKET_TIMEOUT_MS', 30000),
        dnsTimeout: 15000,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    };
};

const transporter = nodemailer.createTransport(smtpOptions());

export default transporter;
