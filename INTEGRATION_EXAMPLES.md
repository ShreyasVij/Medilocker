# Email Integration Examples

Quick examples of how to integrate emails into your MediLocker app.

## 1. Send Welcome Email on User Signup

In `apps/web/lib/authOptions.ts`, update the jwt callback:

```typescript
import { sendWelcomeEmail } from '@/lib/emailHooks';

async jwt({ token, user, account }) {
  if (user && account?.provider === "google") {
    const users = await getCollection<any>("users");

    let dbUser = await users.findOne({
      identityProvider: "google",
      identityId: account.providerAccountId,
    });

    const isNewUser = !dbUser;

    if (!dbUser) {
      const result = await users.insertOne({
        email: (user as any).email,
        name: (user as any).name,
        identityProvider: "google",
        identityId: account.providerAccountId,
        roles: ["patient"],
        status: "active",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      dbUser = { _id: result.insertedId } as any;

      // 🎉 Send welcome email to new user
      try {
        await sendWelcomeEmail((user as any).email, (user as any).name);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
        // Don't fail auth if email fails - log and continue
      }
    } else {
      await users.updateOne(
        { _id: dbUser._id },
        { $set: { lastLoginAt: new Date() } }
      );
    }

    (token as any).id = (dbUser as any)._id.toString();
    (token as any).isNewUser = isNewUser;
  }

  return token;
}
```

## 2. Send Email When Document is Shared

In your document sharing API route (e.g., `apps/web/app/api/documents/share/route.ts`):

```typescript
import { sendDocumentSharedEmail } from '@/lib/emailHooks';
import { getCollection } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { documentId, recipientEmail, recipientName } = body;

  try {
    // 1. Create share record in database
    const shares = await getCollection('shares');
    const documents = await getCollection('documents');
    
    const document = await documents.findOne({ _id: new ObjectId(documentId) });
    const user = await users.findOne({ email: session.user.email });

    const shareResult = await shares.insertOne({
      documentId: new ObjectId(documentId),
      grantedToEmail: recipientEmail,
      granteeType: 'email',
      grantedByUserId: user._id,
      status: 'active',
      createdAt: new Date(),
    });

    // 2. Send email notification
    await sendDocumentSharedEmail({
      recipientEmail,
      recipientName,
      sharedByName: user.name,
      documentName: document.filename || 'Medical Document',
      documentType: document.type || 'Document',
      shareToken: shareResult.insertedId.toString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Share document error:', error);
    return NextResponse.json(
      { error: 'Failed to share document' },
      { status: 500 }
    );
  }
}
```

## 3. Send Appointment Reminder

Create a cron job or use a task queue to send reminders before appointments.

### Using a Simple API Route with Vercel Cron (or Render background job):

In `apps/web/app/api/cron/appointment-reminders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/db';
import { sendAppointmentReminderEmail } from '@/lib/emailHooks';

// This will be called by a cron service
// Verify the request is from your cron provider
export async function GET(request: NextRequest) {
  // Security: Verify cron token
  const token = request.headers.get('authorization');
  if (token !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const appointments = await getCollection('appointments');
    
    // Find appointments happening in 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const upcomingAppointments = await appointments
      .find({
        appointmentDate: {
          $gte: new Date(),
          $lte: tomorrow,
        },
        reminderSent: { $ne: true },
      })
      .toArray();

    let sent = 0;

    for (const appointment of upcomingAppointments) {
      try {
        await sendAppointmentReminderEmail({
          patientEmail: appointment.patientEmail,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate.toLocaleDateString(),
          appointmentTime: appointment.appointmentTime,
          appointmentId: appointment._id.toString(),
        });

        // Mark reminder as sent
        await appointments.updateOne(
          { _id: appointment._id },
          { $set: { reminderSent: true } }
        );

        sent++;
      } catch (error) {
        console.error(`Failed to send reminder for appointment ${appointment._id}:`, error);
        // Continue with next appointment
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      total: upcomingAppointments.length,
    });
  } catch (error) {
    console.error('Appointment reminder cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}
```

### Set up cron in Render (free option):

1. Add to your `render.yaml`:

```yaml
- type: web
  name: cron-service
  env: node
  buildCommand: npm install
  startCommand: npm run start
  envVars:
    - key: CRON_SECRET
      generateValue: true
```

2. Or use **EasyCron** (free) to ping your endpoint:
   - Go to [easycron.com](https://easycron.com)
   - Create a cron job that hits: `https://your-app.onrender.com/api/cron/appointment-reminders`
   - Add header: `Authorization: Bearer YOUR_CRON_SECRET`
   - Set to run every hour

## 4. Send Custom Email

For other scenarios, use the base `sendEmail` function directly:

```typescript
import { sendEmail } from '@/lib/email';

// Send a custom email
await sendEmail({
  to: 'user@example.com',
  subject: 'Important Health Update',
  template: 'welcome', // Use existing template
  data: {
    name: 'John Doe',
    loginUrl: 'https://medora.buzz',
  },
  replyTo: 'support@medora.buzz',
});
```

## 5. Send to Multiple Recipients

```typescript
import { sendDocumentSharedEmail } from '@/lib/emailHooks';

// Share with multiple doctors
const doctorEmails = [
  'dr.smith@hospital.com',
  'dr.johnson@hospital.com',
];

for (const email of doctorEmails) {
  await sendDocumentSharedEmail({
    recipientEmail: email,
    sharedByName: 'Patient Name',
    documentName: 'Lab Results',
    documentType: 'Lab Report',
    shareToken: token,
  });
}
```

## 6. Handle Email Failures Gracefully

Always wrap email sending in try-catch:

```typescript
try {
  await sendWelcomeEmail(email, name);
} catch (error) {
  console.error('Email send failed:', error);
  // Log to monitoring service (Sentry, DataDog, etc.)
  // Don't fail the whole operation
}
```

## 7. Environment Variables Needed

Make sure these are set in your environment:

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional (defaults provided in email.ts)
RESEND_FROM_EMAIL=noreply@medora.buzz
NEXTAUTH_URL=https://medora.buzz
CRON_SECRET=your_secret_for_cron_endpoints
```

## 8. Testing Emails Locally

To test emails without hitting Resend:

1. **Option A: Use Mailtrap**
   - Sign up at [mailtrap.io](https://mailtrap.io)
   - Get SMTP credentials
   - Use nodemailer instead of Resend for testing

2. **Option B: Use Resend Test Mode**
   - Resend has a test API key for development
   - Check Resend docs

3. **Option C: Console Log**
   - Modify `apps/web/lib/email.ts` to log emails instead of sending:
   ```typescript
   export async function sendEmail(params) {
     console.log('EMAIL:', params); // In development
     // ... rest of code
   }
   ```

## Troubleshooting Email Integration

### Email not sending after user signup?
1. Check logs in Render dashboard
2. Verify `RESEND_API_KEY` is set
3. Check Resend dashboard → Emails tab for failures
4. Make sure `isNewUser` flag is being set correctly

### Documents shared emails not working?
1. Verify `RESEND_FROM_EMAIL` is set to `noreply@medora.buzz`
2. Check document sharing route doesn't have errors
3. Ensure email addresses are valid before sending

### Cron reminders not firing?
1. Set up external cron service (EasyCron, AWS EventBridge, etc.)
2. Verify `CRON_SECRET` matches between service and route
3. Check appointment dates are stored as Date objects in MongoDB
4. Monitor the cron endpoint logs
