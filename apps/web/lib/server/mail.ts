import nodemailer from "nodemailer";

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
}) {
  // 🔍 TEMP DEBUG (REMOVE AFTER IT WORKS)
  console.log("SMTP USER:", process.env.GMAIL_USER);
  console.log(
    "SMTP PASS EXISTS:",
    !!process.env.GMAIL_PASS,
    "LENGTH:",
    process.env.GMAIL_PASS?.length
  );

  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    throw new Error("Missing GMAIL_USER or GMAIL_PASS in env");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const fromHeader = params.fromName
    ? `"${params.fromName} via MediLocker" <${process.env.GMAIL_USER}>`
    : `"MediLocker" <${process.env.GMAIL_USER}>`;

  await transporter.sendMail({
    from: fromHeader,
    to: params.to,
    subject: params.subject,
    html: params.html
  });

  console.log("✅ Mail sent to:", params.to);
}
