# Email Setup Guide for MediLocker (Resend + Custom Domain)

## Overview
You now have email infrastructure set up using **Resend**, a modern transactional email service. This guide walks you through getting everything connected.

## Step 1: Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. After signup, you'll be redirected to the dashboard

## Step 2: Add Your Custom Domain (medora.buzz)

### In Resend Dashboard:

1. Navigate to **Domains** in the left sidebar
2. Click **+ Add Domain**
3. Enter your domain: `medora.buzz`
4. Resend will generate DNS records you need to add to your domain registrar

### DNS Records to Add:

Resend will show you three DNS records. You need to add these to your domain registrar (wherever you manage medora.buzz's DNS):

- **DKIM Record** (from Resend) → Add to your DNS
- **SPF Record** → Add to your DNS  
- **CNAME Record** (if using Resend's email domain) → Add to your DNS

### Common Domain Registrars:
- **GoDaddy** → Manage DNS in your GoDaddy account
- **Namecheap** → Dashboard → Domain → Advanced DNS
- **Route 53** (AWS) → Create new record sets
- **Cloudflare** → DNS settings
- **Google Domains** → DNS settings

⏱️ **Wait 24-48 hours** for DNS propagation after adding records.

## Step 3: Get Your API Key

1. In Resend Dashboard, go to **API Keys** (left sidebar)
2. Click **+ Create API Key**
3. Give it a name like "MediLocker Production"
4. Copy the API key (starts with `re_`)

## Step 4: Update Your Environment Variables

### Locally (for development):

Create/update `.env.local` in `apps/web/`:

```env
RESEND_API_KEY=re_your_actual_key_here
RESEND_FROM_EMAIL=noreply@medora.buzz
```

### In Render (for production):

1. Go to your Render dashboard
2. Find your **medilocker-web** service
3. Go to **Environment** tab
4. Update these variables:
   - `RESEND_API_KEY` → Paste your API key from Resend
   - `RESEND_FROM_EMAIL` → Should already be `noreply@medora.buzz`

5. Click **Save** (this will redeploy your service)

## Step 5: Test Your Email Setup

### Option A: Using the API Route

Make a POST request to `/api/email/send`:

```bash
curl -X POST https://your-domain.onrender.com/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email",
    "template": "welcome",
    "data": {
      "name": "John Doe",
      "loginUrl": "https://medora.buzz"
    }
  }'
```

### Option B: Using the Helper Functions

In any of your route handlers or server-side code:

```typescript
import { sendWelcomeEmail } from '@/lib/emailHooks';

// Send welcome email
await sendWelcomeEmail('user@example.com', 'John Doe');
```

### Option C: Direct Integration

When a user signs up, add this to your signup route:

```typescript
import { sendWelcomeEmail } from '@/lib/emailHooks';

// After user creation
await sendWelcomeEmail(newUser.email, newUser.name);
```

## Step 6: Integrate Emails Into Your App

### For User Registration

In your auth callback (`apps/web/app/api/auth/[...nextauth]/route.ts`):

```typescript
import { sendWelcomeEmail } from '@/lib/emailHooks';

// In your signIn callback or user creation logic:
if (isNewUser) {
  await sendWelcomeEmail(user.email, user.name);
}
```

### For Document Sharing

When sharing a document:

```typescript
import { sendDocumentSharedEmail } from '@/lib/emailHooks';

await sendDocumentSharedEmail({
  recipientEmail: grantee.email,
  recipientName: grantee.name,
  sharedByName: currentUser.name,
  documentName: 'Lab Results',
  documentType: 'Lab Report',
  shareToken: shareToken,
});
```

### For Appointment Reminders

When creating or updating an appointment:

```typescript
import { sendAppointmentReminderEmail } from '@/lib/emailHooks';

await sendAppointmentReminderEmail({
  patientEmail: appointment.patientEmail,
  patientName: appointment.patientName,
  doctorName: appointment.doctorName,
  appointmentDate: appointment.date,
  appointmentTime: appointment.time,
  appointmentId: appointment._id.toString(),
});
```

## Available Email Templates

You have three pre-built templates:

### 1. `welcome`
**Purpose:** New user registration emails
**Data fields:**
- `name` (string) - User's name
- `loginUrl` (string) - Link to login page

### 2. `share-document`
**Purpose:** Notify when a document is shared
**Data fields:**
- `recipientName` (string) - Recipient's name
- `sharedByName` (string) - Who shared it
- `documentName` (string) - Document name
- `documentType` (string) - Type (e.g., "Lab Report")
- `accessUrl` (string) - Link to access document

### 3. `appointment-reminder`
**Purpose:** Appointment reminders
**Data fields:**
- `patientName` (string) - Patient's name
- `doctorName` (string) - Doctor's name
- `appointmentDate` (string) - Date
- `appointmentTime` (string) - Time
- `appointmentUrl` (string) - Link to appointment

## Custom Email Templates

To add more email templates, edit `apps/web/lib/email.ts`:

1. Add template type to `EmailTemplate` type:
```typescript
type EmailTemplate = 'welcome' | 'share-document' | 'appointment-reminder' | 'your-new-template';
```

2. Add case to `getEmailTemplate()` function
3. Create a new template function like `getYourNewTemplate()`

## Troubleshooting

### Emails not sending?
- ✅ Check API key is set in environment variables
- ✅ Verify domain is added in Resend dashboard
- ✅ Wait for DNS records to propagate (24-48h)
- ✅ Check Resend dashboard's "Emails" tab for failed sends
- ✅ Verify `NEXTAUTH_URL` is set correctly for email links

### Emails going to spam?
- ✅ Ensure all DNS records (SPF, DKIM, DMARC) are properly configured
- ✅ Use `Reply-To` header (already configured)
- ✅ Keep email content professional
- ✅ Resend's reputation is usually high

### Domain verification failing?
- ✅ Make sure DNS records are correctly added to your registrar
- ✅ Wait 24-48 hours for propagation
- ✅ Use online DNS checkers to verify records are live
- ✅ Contact your domain registrar's support if issues persist

## Environment Variables Checklist

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@medora.buzz
NEXTAUTH_URL=https://medora.buzz  # or your Render URL during setup
NEXTAUTH_SECRET=xxxxxxxxxxxxx
```

## Next Steps

1. ✅ Create Resend account
2. ✅ Add medora.buzz domain
3. ✅ Get API key
4. ✅ Update environment variables (local + Render)
5. ✅ Wait for DNS propagation
6. ✅ Test sending an email
7. ✅ Integrate into your app workflows

## Support

- **Resend Docs:** https://resend.com/docs
- **Resend Status:** https://status.resend.com
- **Email Test:** Use Mailtrap or MailHog for local testing
