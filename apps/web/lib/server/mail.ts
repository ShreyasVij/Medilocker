import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// NOTE: You must verify a domain with Resend to use a custom `from` address.
// For testing, Resend allows sending from a default address like "onboarding@resend.dev".
// Replace "onboarding@resend.dev" with your verified domain email in production.
const fromAddress = process.env.MAIL_FROM || "onboarding@resend.dev";

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  fromName?: string | null;
}) {
  console.log("Attempting to send mail via Resend...");

  if (!process.env.RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY in env");
    throw new Error("Missing RESEND_API_KEY in env");
  }

  try {
    const fromHeader = params.fromName
      ? `${params.fromName} <${fromAddress}>`
      : `MediLocker <${fromAddress}>`;

    const { data, error } = await resend.emails.send({
      from: fromHeader,
      to: params.to,
      subject: params.subject,
      html: params.html
    });

    if (error) {
      console.error("❌ Failed to send mail via Resend:", error);
      throw error;
    }

    console.log("✅ Mail sent to:", params.to, "ID:", data?.id);
  } catch (error) {
    console.error("❌ An unexpected error occurred while sending mail:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
