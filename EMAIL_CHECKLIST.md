# Email Setup Checklist ✅

Complete this checklist to get email working with your custom domain (medora.buzz).

## Pre-Setup
- [ ] Read `EMAIL_SETUP.md` for full documentation
- [ ] Read `INTEGRATION_EXAMPLES.md` for code examples
- [ ] You have access to your domain's DNS settings

## Part 1: Resend Account Setup (15 minutes)
- [ ] Create account at [resend.com](https://resend.com)
- [ ] Verify email address
- [ ] Go to Resend Dashboard

## Part 2: Domain Configuration (24-48 hours waiting)
- [ ] In Resend, click "Domains" → "+ Add Domain"
- [ ] Enter: `medora.buzz`
- [ ] Copy the DNS records from Resend
- [ ] Login to your domain registrar (GoDaddy, Namecheap, Route 53, Cloudflare, etc.)
- [ ] Add all 3 DNS records to your domain:
  - [ ] DKIM record
  - [ ] SPF record
  - [ ] CNAME record (if applicable)
- [ ] Wait 24-48 hours for DNS propagation
- [ ] Verify domain in Resend Dashboard (status should show "Verified")

## Part 3: Get API Key
- [ ] In Resend Dashboard, click "API Keys"
- [ ] Click "+ Create API Key"
- [ ] Name it: "MediLocker Production"
- [ ] Copy the API key (starts with `re_`)
- [ ] Store it securely

## Part 4: Local Development Setup
- [ ] Create `.env.local` in `apps/web/` directory
- [ ] Add these to `.env.local`:
  ```env
  RESEND_API_KEY=re_paste_your_key_here
  RESEND_FROM_EMAIL=noreply@medora.buzz
  ```
- [ ] Restart your Next.js dev server
- [ ] Test by running:
  ```bash
  npm run web:dev
  ```

## Part 5: Production Setup on Render
- [ ] Go to your Render dashboard
- [ ] Find your **medilocker-web** service
- [ ] Click on the service name → go to "Environment"
- [ ] Update/add these environment variables:
  - [ ] `RESEND_API_KEY` = (paste your API key)
  - [ ] `RESEND_FROM_EMAIL` = `noreply@medora.buzz`
- [ ] Click "Save"
- [ ] Wait for redeploy to complete

## Part 6: Test Email Sending
- [ ] Make a test request to verify it works:
  ```bash
  curl -X POST https://your-render-app.onrender.com/api/email/send \
    -H "Content-Type: application/json" \
    -d '{
      "to": "your-test-email@example.com",
      "subject": "Test",
      "template": "welcome",
      "data": {"name": "John"}
    }'
  ```
- [ ] Check your test email inbox
- [ ] Verify email came from `noreply@medora.buzz`
- [ ] Check Resend Dashboard → "Emails" tab for delivery status

## Part 7: Integrate Into App

### Option A: Welcome Email on Signup
- [ ] Open `apps/web/lib/authOptions.ts`
- [ ] Add `import { sendWelcomeEmail } from '@/lib/emailHooks';`
- [ ] In the `jwt` callback, after user creation, add:
  ```typescript
  try {
    await sendWelcomeEmail((user as any).email, (user as any).name);
  } catch (error) {
    console.error('Welcome email failed:', error);
  }
  ```
- [ ] Test by signing up a new user
- [ ] Verify welcome email arrives

### Option B: Share Document Emails
- [ ] In your document sharing route, add:
  ```typescript
  import { sendDocumentSharedEmail } from '@/lib/emailHooks';
  
  // After creating share record:
  await sendDocumentSharedEmail({
    recipientEmail: grantee.email,
    sharedByName: currentUser.name,
    documentName: 'Lab Results',
    shareToken: shareId,
  });
  ```
- [ ] Test by sharing a document
- [ ] Verify recipient gets email

### Option C: Appointment Reminders (Optional)
- [ ] Create `apps/web/app/api/cron/appointment-reminders/route.ts`
- [ ] Copy code from `INTEGRATION_EXAMPLES.md`
- [ ] Set up external cron service to call it hourly
- [ ] Or set `CRON_SECRET` in environment variables

## Verification
- [ ] You can receive test emails locally
- [ ] Emails send successfully in production
- [ ] Emails have correct "From" address
- [ ] Email links work and go to correct URLs
- [ ] Emails don't go to spam (check spam folder)

## Troubleshooting

**Emails not sending?**
- Check Resend API key is set: `echo $RESEND_API_KEY`
- Check Resend dashboard logs
- Wait for DNS propagation if domain recently added

**Emails going to spam?**
- Verify all DNS records are in place
- Check SPF/DKIM are properly configured
- Resend has good email reputation normally

**Domain not verifying?**
- Double-check DNS records at your registrar
- Use online DNS checker tool to verify records exist
- Wait 24-48 hours and try again
- Contact domain registrar support if stuck

## File Reference

The following files were created for you:
- ✅ `apps/web/lib/email.ts` - Main email service
- ✅ `apps/web/lib/emailHooks.ts` - Easy helper functions
- ✅ `apps/web/app/api/email/send/route.ts` - Email API endpoint
- ✅ `render.yaml` - Updated with email env vars
- ✅ `EMAIL_SETUP.md` - Detailed setup guide
- ✅ `INTEGRATION_EXAMPLES.md` - Code examples

## Next Steps

1. ✅ Complete Part 1-5 above
2. ✅ Wait for DNS (24-48h)
3. ✅ Run test in Part 6
4. ✅ Integrate one of the examples in Part 7
5. ✅ Test end-to-end
6. ✅ Deploy to production

## Support

- Resend Docs: https://resend.com/docs
- Email not working? Check Resend dashboard → Emails tab
- Questions? See `EMAIL_SETUP.md` or `INTEGRATION_EXAMPLES.md`

---

**You've got everything you need!** 🚀

The code is ready, the templates are built, and you're set up to send emails with your custom domain.
