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
