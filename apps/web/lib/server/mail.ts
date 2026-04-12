import nodemailer from "nodemailer";

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
}) {
  console.log("Attempting to send mail...");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS exists:", !!process.env.SMTP_PASS);

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_PORT ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.error("Missing SMTP configuration in env");
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

  try {
    await transporter.sendMail({
      from: fromHeader,
      to: params.to,
      subject: params.subject,
      html: params.html
    });

    console.log("✅ Mail sent to:", params.to);
  } catch (error) {
    console.error("❌ Failed to send mail:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
