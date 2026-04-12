import nodemailer from "nodemailer";

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
}) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error("Missing SMTP configuration in env");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const fromHeader = params.fromName
    ? `"${params.fromName} via MediLocker" <${process.env.SMTP_USER}>`
    : `"MediLocker" <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from: fromHeader,
    to: params.to,
    subject: params.subject,
    html: params.html
  });

  console.log("✅ Mail sent to:", params.to);
}
