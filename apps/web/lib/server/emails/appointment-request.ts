export function getRequestEmailTemplate(params: {
  doctorName: string;
  patientName: string;
  appointmentTime: string;
  acceptUrl: string;
  denyUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "New Appointment Request",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset=\"utf-8\">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
            .action-btn { display: inline-block; padding: 10px 20px; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px; }
            .accept { background: #22c55e; }
            .deny { background: #ef4444; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class=\"header\">
            <h1 style=\"margin: 0; font-size: 28px;\">Appointment Request</h1>
          </div>
          <div class=\"content\">
            <p>Dear Dr. ${params.doctorName},</p>
            <p>Patient <strong>${params.patientName}</strong> has requested an appointment at <strong>${params.appointmentTime}</strong>.</p>
            <p>
              <a href=\"${params.acceptUrl}\" class=\"action-btn accept\">Accept</a>
              <a href=\"${params.denyUrl}\" class=\"action-btn deny\">Deny</a>
            </p>
            <p>Thank you!</p>
            <div class=\"footer\">
              <p>This is an automated message from MediLocker.<br>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}
