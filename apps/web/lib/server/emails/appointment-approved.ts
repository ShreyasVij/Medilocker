export function getApprovedEmailTemplate(params: {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
}): { subject: string; html: string } {
  return {
    subject: "Appointment Approved ✅",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
              border-radius: 0 0 10px 10px;
            }
            .info-box {
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 10px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              width: 120px;
              color: #6b7280;
            }
            .info-value {
              color: #111827;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="success-icon">✅</div>
            <h1 style="margin: 0; font-size: 28px;">Appointment Approved</h1>
          </div>
          
          <div class="content">
            <p>Dear ${params.patientName},</p>
            
            <p>Great news! Your appointment request has been approved by Dr. ${params.doctorName}.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #059669;">Appointment Details</h3>
              <div class="info-row">
                <div class="info-label">Doctor:</div>
                <div class="info-value">Dr. ${params.doctorName}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Date:</div>
                <div class="info-value">${params.date}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Time:</div>
                <div class="info-value">${params.time}</div>
              </div>
            </div>
            
            <p><strong>Please arrive 10 minutes before your scheduled time.</strong></p>
            
            <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
            
            <p>We look forward to seeing you!</p>
            
            <div class="footer">
              <p>This is an automated message from MediLocker.<br>
              Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}
