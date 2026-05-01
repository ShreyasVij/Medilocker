// Helper hooks to send different types of emails from your components/routes

import { sendEmail } from './email';

export async function sendWelcomeEmail(email: string, name?: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to MediLocker!',
    template: 'welcome',
    data: {
      name,
      loginUrl: `${process.env.NEXTAUTH_URL || 'https://medora.buzz'}/auth`,
    },
  });
}

export async function sendDocumentSharedEmail({
  recipientEmail,
  recipientName,
  sharedByName,
  documentName,
  documentType,
  shareToken,
}: {
  recipientEmail: string;
  recipientName?: string;
  sharedByName?: string;
  documentName?: string;
  documentType?: string;
  shareToken: string;
}) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://medora.buzz';
  const accessUrl = `${baseUrl}/documents`;

  return sendEmail({
    to: recipientEmail,
    subject: `${sharedByName || 'Someone'} shared a medical document with you`,
    template: 'share-document',
    data: {
      recipientName,
      sharedByName,
      documentName,
      documentType,
      accessUrl,
    },
  });
}

export async function sendAppointmentReminderEmail({
  patientEmail,
  patientName,
  doctorName,
  appointmentDate,
  appointmentTime,
  appointmentId,
}: {
  patientEmail: string;
  patientName?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentId: string;
}) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://medora.buzz';
  const appointmentUrl = `${baseUrl}/appointments/${appointmentId}`;

  return sendEmail({
    to: patientEmail,
    subject: `Appointment Reminder: ${doctorName || 'Your Healthcare Provider'}`,
    template: 'appointment-reminder',
    data: {
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      appointmentUrl,
    },
  });
}

/**
 * Send NFC OTP email to patient
 * @param to Recipient email address
 * @param patientName Patient name for personalization
 * @param otpCode 6-digit OTP code
 * @param responderInfo Optional doctor/responder information
 * @param expiresInMinutes OTP expiry time
 */
export async function sendNfcOtpEmail({
  to,
  patientName,
  otpCode,
  responderInfo,
  expiresInMinutes = 10,
}: {
  to: string;
  patientName?: string;
  otpCode: string;
  responderInfo?: { name?: string; organization?: string };
  expiresInMinutes?: number;
}): Promise<boolean> {
  try {
    // Validate email
    if (!to || !to.includes('@')) {
      console.error('Invalid recipient email:', to);
      return false;
    }

    // Build responder context
    const responderText = responderInfo?.name
      ? `${responderInfo.name}${responderInfo.organization ? ` at ${responderInfo.organization}` : ''}`
      : 'A healthcare provider';

    // Send using sendEmail helper with template
    await sendEmail({
      to: to,
      subject: '🔐 Emergency Profile Access Request - OTP Code Inside',
      template: 'nfc-otp',
      data: {
        patientName: patientName || 'User',
        otpCode,
        responderName: responderInfo?.name,
        responderOrganization: responderInfo?.organization,
        responderText,
        expiresInMinutes,
      },
    });

    console.log(`OTP email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

/**
 * Send notification to patient about emergency profile access
 */
export async function sendNfcAccessNotificationEmail({
  to,
  patientName,
  responderInfo,
  dataAccessLevel,
  accessTime,
}: {
  to: string;
  patientName?: string;
  responderInfo?: { name?: string; organization?: string };
  dataAccessLevel: string;
  accessTime: Date;
}): Promise<boolean> {
  try {
    if (!to || !to.includes('@')) {
      console.error('Invalid recipient email:', to);
      return false;
    }

    const dataLevelText =
      dataAccessLevel === 'full'
        ? 'complete medical records'
        : 'public emergency profile (blood group, allergies, conditions)';

    await sendEmail({
      to: to,
      subject: '🔔 Your Emergency Medical Profile Was Accessed',
      template: 'nfc-access-notification',
      data: {
        patientName: patientName || 'User',
        responderName: responderInfo?.name,
        responderOrganization: responderInfo?.organization,
        dataAccessLevel: dataLevelText,
        accessTime: accessTime.toLocaleString(),
      },
    });

    console.log(`Access notification email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending access notification:', error);
    return false;
  }
}
