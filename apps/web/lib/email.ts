import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

export const emailConfig = {
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@medora.buzz',
  fromName: 'MediLocker',
};

export type EmailTemplate = 'welcome' | 'share-document' | 'appointment-reminder';

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
  try {
    const emails = Array.isArray(to) ? to : [to];

    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
      to: emails,
      subject,
      html: getEmailTemplate(template, data),
    };

    if (replyTo) {
      payload.replyTo = replyTo;
    }

    const result = await resend.emails.send(payload);

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error(`Failed to send ${template} email:`, error);
    return { success: false, error: String(error) };
  }
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
