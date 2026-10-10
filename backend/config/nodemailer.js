import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: 'SMTP.gmail.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    dnsTimeout: 15000,
    auth:{
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
});

export default transporter;
