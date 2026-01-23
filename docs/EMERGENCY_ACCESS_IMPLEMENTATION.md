# Emergency Access Mode - Implementation Guide

## Overview

This implementation provides a secure, single-use emergency access system for MediLocker that allows users to generate time-limited tokens for emergency medical situations. The system includes cryptographic security, comprehensive audit logging, and a user-friendly interface.

## Features Implemented

### ✅ Backend API Routes

1. **POST /api/emergency/token** - Generate Emergency Token
   - Cryptographically secure token generation (32 bytes, SHA-256 hashed)
   - QR code generation for easy sharing
   - 10-minute default TTL (configurable 1-30 minutes)
   - Rate limiting (3 tokens per minute per user)
   - Comprehensive audit logging
   - Returns token, QR code, URL, and expiry information

2. **GET /api/emergency/[token]** - Access Emergency Data
   - Single-use token validation
   - Automatic expiry enforcement
   - IP-based rate limiting (10 attempts per minute)
   - Suspicious activity detection
   - Returns minimal emergency data only:
     - Name, age, blood group
     - Allergies and chronic conditions
     - Emergency notes and contacts
   - NO files, NO medical history, NO documents

3. **POST /api/emergency/revoke** - Revoke Tokens
   - Instant token revocation
   - Revoke specific token or all active tokens
   - Audit logging for all revocations
   - Profile ownership verification

### ✅ Database Schema (MongoDB)

1. **emergencyTokens Collection**
   - Stores hashed tokens (never plain text)
   - Fields: userId, profileId, tokenHash, expiresAt, used, revoked, timestamps
   - Indexes: tokenHash (unique), userId, profileId, expiresAt (TTL index)
   - Auto-deletion after 24 hours using MongoDB TTL index

2. **emergencyAudit Collection**
   - Comprehensive audit trail for all emergency access events
   - Actions tracked:
     - `token_created` - Token generation
     - `token_accessed` - Successful access
     - `token_expired` - Token expiration
     - `token_revoked` - Manual revocation
     - `token_invalid` - Invalid access attempts
     - `token_reuse_attempt` - Single-use violation
     - `token_extended` - Token extension
   - Stores: userId, profileId, tokenHash, timestamp, IP, user agent, metadata
   - Indexes: userId, profileId, tokenHash, action, timestamp, IP

### ✅ Client UI Components

1. **EmergencyTokenGenerator Component**
   - Generate emergency tokens with one click
   - Display QR code and URL
   - Real-time countdown timer
   - Copy-to-clipboard functionality
   - One-tap revoke
   - Extend access (generates new token)
   - List active tokens with status
   - Revoke all tokens option
   - Comprehensive security warnings

2. **Emergency Access Page** (`/emergency/[token]`)
   - Clean, medical-focused UI
   - Prominent emergency header with countdown
   - Security warnings clearly displayed
   - Organized data display:
     - Patient information
     - Blood group (highlighted)
     - Allergies (color-coded warnings)
     - Chronic conditions
     - Emergency notes
     - Emergency contacts with click-to-call
   - Auto-lock on expiry
   - Error handling for:
     - Expired tokens
     - Revoked tokens
     - Already-used tokens
     - Invalid tokens

## Security Features

### 🔒 Token Security
- Cryptographically secure random generation (crypto.randomBytes)
- SHA-256 hashing before storage
- Never stored in plain text
- Single-use enforcement with atomic operations
- Configurable TTL (1-30 minutes, default 10)
- Auto-expiry via MongoDB TTL indexes

### 🔒 Access Control
- No authentication required (emergency nature)
- Rate limiting per IP (10 attempts/minute)
- Suspicious activity detection
- Immediate revocation capability
- Profile ownership verification
- Concurrent access prevention

### 🔒 Data Minimization
- Only emergency-scope data exposed
- No medical history or documents
- No file access
- No sharing capabilities
- Read-only access

### 🔒 Audit & Monitoring
- All events logged with:
  - Timestamp
  - IP address
  - User agent
  - Action type
  - Metadata
- Suspicious activity detection
- Failed attempt tracking
- Reuse attempt logging

## Usage

### For Users (Token Generation)

1. Import the component in your dashboard:
```typescript
import EmergencyTokenGenerator from '@/components/EmergencyTokenGenerator';

// In your component
<EmergencyTokenGenerator profileId={userProfileId} />
```

2. Click "Generate Token" to create a new emergency access token
3. Share the QR code or URL with trusted emergency contacts
4. Monitor active tokens and revoke if needed

### For Emergency Responders (Token Access)

1. Scan QR code or visit the provided URL
2. View emergency data immediately (single-use)
3. Access expires automatically after 10 minutes
4. Token cannot be reused

## API Usage Examples

### Generate Token
```typescript
const response = await fetch('/api/emergency/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profileId: 'user-profile-id',
    ttlMinutes: 10, // optional, default 10
  }),
});

const data = await response.json();
// Returns: { token, qrCode, url, expiresAt, warning }
```

### Access Emergency Data
```typescript
const response = await fetch(`/api/emergency/${token}`);
const data = await response.json();
// Returns: { profile: { name, age, bloodGroup, allergies, ... }, warnings }
```

### Revoke Token
```typescript
// Revoke specific token
await fetch('/api/emergency/revoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profileId: 'user-profile-id',
    token: 'specific-token',
  }),
});

// Revoke all active tokens
await fetch('/api/emergency/revoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profileId: 'user-profile-id',
    revokeAll: true,
  }),
});
```

## Database Functions

### Emergency Tokens
```typescript
import {
  createEmergencyToken,
  findTokenByHash,
  markTokenAsUsed,
  revokeToken,
  revokeAllActiveTokensForProfile,
  getActiveTokensForProfile,
} from '@/packages/db';
```

### Emergency Audit
```typescript
import {
  logEmergencyAction,
  getAuditLogsForProfile,
  getAuditLogsForToken,
  detectSuspiciousActivity,
} from '@/packages/db';
```

## Environment Variables

No additional environment variables required. Uses existing:
- `NEXTAUTH_URL` - For generating emergency URLs

## Production Considerations

### Recommended Enhancements

1. **Rate Limiting**
   - Replace in-memory rate limiting with Redis
   - Implement distributed rate limiting for multi-instance deployments

2. **Monitoring**
   - Set up alerts for suspicious activity
   - Monitor token usage patterns
   - Track revocation rates

3. **Compliance**
   - Ensure audit logs meet HIPAA/regulatory requirements
   - Implement log retention policies
   - Add data access notifications

4. **Performance**
   - Cache active tokens for better performance
   - Optimize database queries with proper indexes
   - Consider CDN for QR code delivery

5. **Security**
   - Implement CAPTCHA for high-risk scenarios
   - Add IP geolocation checks
   - Implement device fingerprinting
   - Add multi-factor confirmation for token generation

## Testing

### Test Scenarios

1. **Happy Path**
   - Generate token
   - Access with valid token
   - Verify data displayed
   - Confirm expiry

2. **Security Tests**
   - Attempt token reuse (should fail)
   - Try expired token (should fail)
   - Test revoked token (should fail)
   - Verify rate limiting
   - Test concurrent access

3. **Edge Cases**
   - Missing profile data
   - Network failures
   - Rapid token generation
   - Revoke during active session

## Troubleshooting

### Common Issues

1. **"Token not found"**
   - Token may have expired or been revoked
   - Check token format (64 hex characters)
   - Verify database connection

2. **"Rate limit exceeded"**
   - Wait before generating new token
   - Check for malicious activity
   - Review rate limit settings

3. **"Profile not found"**
   - Verify profile exists and belongs to user
   - Check profile permissions
   - Ensure profile has required emergency data

4. **QR Code not displaying**
   - Verify qrcode package is installed
   - Check image rendering in browser
   - Verify base64 data URL format

## Files Created/Modified

### New Files
- `/packages/db/emergencyTokens.ts` - Token schema and functions
- `/packages/db/emergencyAudit.ts` - Audit schema and functions
- `/apps/web/app/api/emergency/token/route.ts` - Token generation API
- `/apps/web/app/api/emergency/[token]/route.ts` - Token access API
- `/apps/web/app/api/emergency/revoke/route.ts` - Token revocation API
- `/apps/web/app/emergency/[token]/page.tsx` - Emergency access page
- `/apps/web/components/EmergencyTokenGenerator.tsx` - Generator component

### Modified Files
- `/packages/db/index.ts` - Export emergency modules
- `/packages/db/profiles.ts` - Add emergency data fields

## Compliance Notes

This implementation follows the MediLocker V2 specification for Emergency Access Mode:
- ✅ Single-use tokens
- ✅ Short TTL (10 minutes)
- ✅ Minimal data exposure
- ✅ Comprehensive audit logging
- ✅ Instant revocation
- ✅ No authentication required
- ✅ Clear security warnings
- ✅ IP and user agent tracking

## Future Enhancements

1. SMS/Email notifications when token is accessed
2. Biometric confirmation for token generation
3. Geographic restrictions for token usage
4. Integration with emergency services
5. Multi-language support for emergency responders
6. Offline QR code verification (cryptographic signature)
7. Emergency contact auto-notification
8. Integration with wearable devices

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready
