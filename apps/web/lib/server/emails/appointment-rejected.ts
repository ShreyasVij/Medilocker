export function getRejectedEmailTemplate(params: {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
}): { subject: string; html: string } {
  return {
    subject: "Appointment Update - Unable to Confirm",
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
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
            .alert-box {
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              color: #991b1b;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Appointment Update</h1>
          </div>
          
          <div class="content">
            <p>Dear ${params.patientName},</p>
            
            <div class="alert-box">
              <strong>We regret to inform you that your appointment request could not be confirmed.</strong>
            </div>
            
            <p>Dr. ${params.doctorName} is unable to accommodate the requested appointment at this time.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #dc2626;">Requested Appointment</h3>
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
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Try booking a different time slot with the same doctor</li>
              <li>Contact our support team for assistance in finding an alternative</li>
              <li>Browse other available doctors in our network</li>
            </ul>
            
            <p>We apologize for any inconvenience and appreciate your understanding.</p>
            
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
