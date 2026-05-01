import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const emailConfig = {
  fromName: process.env.RESEND_FROM_NAME || "Medora",
  fromEmail: process.env.RESEND_FROM_EMAIL || "noreply@medora.buzz",
};

export type EmailTemplate = 'welcome' | 'share-document' | 'appointment-reminder' | 'nfc-otp' | 'nfc-access-notification';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data?: Record<string, any>;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  template,
  data = {},
  replyTo,
}: SendEmailParams) {
  console.log("--- New Email Sending Attempt ---");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Mask the API key for security, showing only the last 4 characters
  const apiKey = process.env.RESEND_API_KEY;
  const maskedApiKey = apiKey ? `...${apiKey.slice(-4)}` : "Not set";
  console.log(`Using Resend API Key (masked): ${maskedApiKey}`);

  console.log("RESEND_FROM_EMAIL env var:", process.env.RESEND_FROM_EMAIL);
  console.log("Using email config:", emailConfig);

  const emails = Array.isArray(to) ? to : [to];

  const payload: any = {
    from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
    to: emails,
    subject,
    html: getEmailTemplate(template, data),
  };

  if (replyTo) {
    payload.replyTo = replyTo;
  }

  console.log("Sending payload to Resend:", { from: payload.from, to: payload.to, subject: payload.subject });

  const { data: resultData, error } = await resend.emails.send(payload);

  if (error) {
    console.error("❌ Failed to send mail via Resend:", error);
    console.log("--- End of Email Sending Attempt ---");
    return { success: false, error: error.message };
  }

  console.log("✅ Successfully sent mail via Resend. Message ID:", resultData?.id);
  console.log("--- End of Email Sending Attempt ---");
  return { success: true, messageId: resultData?.id };
}

// Get HTML template for each email type
function getEmailTemplate(template: EmailTemplate, data: Record<string, any>): string {
  switch (template) {
    case 'welcome':
      return getWelcomeTemplate(data);
    case 'share-document':
      return getShareDocumentTemplate(data);
    case 'appointment-reminder':
      return getAppointmentReminderTemplate(data);
    case 'nfc-otp':
      return getNfcOtpTemplate(data);
    case 'nfc-access-notification':
      return getNfcAccessNotificationTemplate(data);
    default:
      return '';
  }
}

function getWelcomeTemplate(data: {
  name?: string;
  loginUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MediLocker! 👋</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name || 'there'},</p>
            <p>Welcome to MediLocker – your secure health records companion. We're excited to have you on board!</p>
            <p>With MediLocker, you can:</p>
            <ul>
              <li>Securely store and organize all your medical documents</li>
              <li>Share access with trusted doctors and family members</li>
              <li>Track your health trends with AI-powered insights</li>
              <li>Keep your health history organized in one place</li>
            </ul>
            <p>Ready to get started?</p>
            <a href="${data.loginUrl || 'https://medora.buzz'}" class="cta-button">Go to MediLocker</a>
            <p style="margin-top: 30px; color: #666;">If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>© 2026 MediLocker. All rights reserved.</p>
            <p>medora.buzz</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getShareDocumentTemplate(data: {
  sharedByName?: string;
  recipientName?: string;
  documentName?: string;
  documentType?: string;
  accessUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
          .document-card { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Document Shared with You</h1>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName || 'there'},</p>
            <p><strong>${data.sharedByName || 'Someone'}</strong> has shared a medical document with you in MediLocker.</p>
            <div class="document-card">
              <p><strong>Document:</strong> ${data.documentName || 'Medical Record'}</p>
              <p><strong>Type:</strong> ${data.documentType || 'Healthcare Document'}</p>
            </div>
            <p>Access the shared document now:</p>
            <a href="${data.accessUrl || 'https://medora.buzz'}" class="cta-button">View Document</a>
            <p style="margin-top: 30px; color: #666;">This document was shared securely and only accessible to you.</p>
          </div>
          <div class="footer">
            <p>© 2026 MediLocker. All rights reserved.</p>
            <p>medora.buzz</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getAppointmentReminderTemplate(data: {
  patientName?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
          .appointment-card { background: white; padding: 20px; border-radius: 6px; border-left: 4px solid #667eea; margin: 20px 0; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Appointment Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${data.patientName || 'there'},</p>
            <p>This is a reminder about your upcoming appointment in MediLocker.</p>
            <div class="appointment-card">
              <p><strong>Doctor:</strong> ${data.doctorName || 'Your Healthcare Provider'}</p>
              <p><strong>Date:</strong> ${data.appointmentDate || 'TBA'}</p>
              <p><strong>Time:</strong> ${data.appointmentTime || 'TBA'}</p>
            </div>
            <p>View and manage your appointment:</p>
            <a href="${data.appointmentUrl || 'https://medora.buzz'}" class="cta-button">View Appointment</a>
            <p style="margin-top: 30px; color: #666;">If you need to reschedule, please contact your healthcare provider directly.</p>
          </div>
          <div class="footer">
            <p>© 2026 MediLocker. All rights reserved.</p>
            <p>medora.buzz</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getNfcOtpTemplate(data: Record<string, any>): string {
  const { patientName, otpCode = '', responderName, responderOrganization, responderText, expiresInMinutes = 10 } = data;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; border: 2px solid #2563eb; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2563eb; font-family: monospace; }
          .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin: 15px 0; border-radius: 4px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Emergency Profile Access Request</h1>
          </div>
          <div class="content">
            <p>Hi${patientName ? ' ' + patientName.split(' ')[0] : ''},</p>

            <p>${responderText || 'A healthcare provider'} is requesting access to your emergency medical profile.</p>

            <p><strong>If you approve this access:</strong></p>
            <ol>
              <li>Copy the 6-digit code below</li>
              <li>Provide it to ${responderName || 'the healthcare provider'}</li>
              <li>They will use it to access your emergency information</li>
            </ol>

            <div class="otp-box">
              <p style="margin: 0 0 10px 0; color: #666;">Your OTP Code</p>
              <div class="otp-code">${otpCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                Valid for ${expiresInMinutes} minutes
              </p>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notes:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                <li>Never share this code via email or chat</li>
                <li>Only provide it directly to the healthcare provider</li>
                <li>This code expires in ${expiresInMinutes} minutes</li>
                <li>If you did not request this, please ignore</li>
              </ul>
            </div>

            <p><strong>What data will be shared:</strong></p>
            <ul>
              <li>Full medical history</li>
              <li>Current medications</li>
              <li>Lab results</li>
              <li>Allergies and conditions</li>
              <li>Insurance information</li>
            </ul>

            <p>If you have questions, contact your healthcare provider directly.</p>

            <p>— MediLocker Emergency Access Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>MediLocker © 2026 | All rights reserved</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getNfcAccessNotificationTemplate(data: Record<string, any>): string {
  const { patientName, responderName, responderOrganization, dataAccessLevel, accessTime } = data;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 40px 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 40px; border-radius: 0 0 8px 8px; }
          .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; border-radius: 4px; }
          .details { background: #f3f4f6; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Emergency Profile Access Alert</h1>
          </div>
          <div class="content">
            <div class="alert">
              <p><strong>Your emergency medical profile was accessed at ${accessTime || new Date().toLocaleString()}</strong></p>
            </div>

            <h3>Who accessed your profile?</h3>
            <div class="details">
              <p><strong>${responderName || 'A healthcare provider'}</strong>${responderOrganization ? ` at ${responderOrganization}` : ''}</p>
            </div>

            <h3>What information was accessed?</h3>
            <p>${dataAccessLevel || 'Your emergency profile'}</p>

            <p>This was an <strong>emergency access</strong> to potentially save your life.</p>

            <h3>What you can do:</h3>
            <ul>
              <li>Review access logs in your MediLocker dashboard</li>
              <li>Revoke emergency NFC cards if lost or stolen</li>
              <li>Limit pre-authorized doctors if needed</li>
              <li>Contact us if this access was unauthorized</li>
            </ul>

            <p>— MediLocker Emergency Team</p>
          </div>
          <div class="footer">
            <p>© 2026 MediLocker. All rights reserved.</p>
            <p>medora.buzz</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
