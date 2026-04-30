# NFC Emergency Access System - Comprehensive Implementation Plan

**Document Version:** 1.0  
**Last Updated:** 2026-04-30  
**Status:** Ready for Implementation  
**Priority:** High  
**Timeline:** 4-5 weeks  

---

## Executive Summary

This document outlines the design and implementation of a **Near Field Communication (NFC)-based emergency access system** for MediLocker. The system enables patients to create tap-activated emergency medical profiles accessible via NFC cards/stickers, providing instant life-saving information to doctors and bystanders while maintaining strict privacy through a two-tier access model: public (blood group, allergies, conditions) and protected (full medical records, policy numbers) behind OTP verification.

### Business Value

| Aspect | Impact |
|---|---|
| **Emergency Response Time** | Reduce time to access critical medical info from 5+ minutes to <10 seconds |
| **Hardware Cost** | Minimal (NFC tags: $0.50-$2 each) vs. proprietary devices |
| **User Friction** | No app download required; just tap with any smartphone |
| **Privacy Protection** | Two-tier access; sensitive data behind OTP + patient consent |
| **Compliance** | HIPAA emergency exception + enhanced audit trail |
| **Market Differentiation** | Unique feature in health records space combining accessibility + privacy |

### Key Success Metrics

- ✅ Patient can create NFC card in <2 minutes
- ✅ Doctor sees public profile in <5 seconds after tap
- ✅ Full access via OTP in <2 minutes (email delivery + verification)
- ✅ 20 taps/minute rate limiting enforced
- ✅ 100% audit trail of all emergency accesses
- ✅ Zero accidental disclosure of sensitive data
- ✅ Mobile-first responsive design (3G-compatible)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Feature Overview](#feature-overview)
3. [Architecture & Design](#architecture--design)
4. [Database Schema](#database-schema)
5. [API Specification](#api-specification)
6. [Frontend Components](#frontend-components)
7. [Security & Privacy](#security--privacy)
8. [Integration Strategy](#integration-strategy)
9. [Implementation Phases](#implementation-phases)
10. [Testing Strategy](#testing-strategy)
11. [Risk Analysis](#risk-analysis)
12. [Timeline & Resources](#timeline--resources)

---

## Problem Statement

### Current State

MediLocker has an emergency QR code system that allows patients to share limited medical information. However:

1. **QR Code Limitations:**
   - Requires camera + photo app + URL loading (3-5 steps)
   - Takes 30-60 seconds in real emergency scenarios
   - Requires internet connectivity at doctor's location
   - Doctors may not recognize QR codes in emergencies

2. **Privacy Gaps:**
   - QR codes typically broadcast same access level for all
   - No fine-grained control (public vs. authenticated access)
   - Limited audit trail for sensitive accesses

3. **Hardware Barriers:**
   - No standard for emergency medical cards in India/developing markets
   - Proprietary solutions expensive ($50-$500)
   - Single points of failure

### Opportunity

NFC technology addresses these gaps:
- **Physical accessibility:** Card/sticker on person always
- **Speed:** Tap ≈1 second vs. QR scan ≈30 seconds
- **Offline resilience:** URL stored on tag, works without internet for initial access
- **Affordability:** Mass production at <$2/tag
- **Privacy:** URL leads to access *request* layer, not direct data disclosure

---

## Feature Overview

### User Journeys

#### Journey 1: Patient Creates NFC Emergency Card

```
Patient Action                      → System Response
─────────────────────────────────────────────────────
1. Opens Dashboard
   → Clicks "Emergency Settings"     → Redirected to /app/emergency/nfc
   
2. Clicks "Create NFC Card"          → Modal: Select profile, device name
   
3. Configures Card
   • Profile: "Dhairya Sood (Self)"
   • Device Name: "Wallet Card"
   • OTP Required: Toggle ON
   • Pre-authorize doctors: 
     + dr.amit@hospital.in (6 months)
   
4. Clicks "Generate"                 → System creates token, shows nfc URL:
                                       "https://medora.buzz/emergency/nfc/a7f3e9..."
   
5. Copies URL or clicks 
   "Write to NFC Card"               → Instructions for NFC Writer apps
                                       (Android: TagWriter, iOS: Shortcuts)
   
6. Uses NFC Writer App               → Physically writes URL to NFC tag
   to write URL to tag               
   
7. Tests Card                        → Taps tag with phone
                                       → Browser opens, sees public profile
                                       → Card created successfully ✓
```

#### Journey 2: Doctor Accesses Emergency Profile

```
Doctor's Action                     → System Response
─────────────────────────────────────────────────────
1. Called to patient's location
   (car accident/collapse)
   
2. Notices Emergency Card          → Pulls out phone, taps card
   in patient's wallet
   
3. Phone opens to profile URL       → GET /api/emergency/nfc/[token]
                                      → 200ms response
                                      
4. Sees Public Profile              → ✓ Blood group: O+
                                      ✓ Allergies: Penicillin, Latex
                                      ✓ Conditions: Diabetes, Hypertension
                                      ✓ Medications: Metformin 500mg
                                      ✓ Health summary (AI-generated, sanitized)
                                      ✓ Emergency contacts (clickable)
                                      ✓ Insurance provider: HDFC ERGO
                                      ✗ Insurance Policy # (hidden)
                                      ✗ Full medical records (locked)
                                      
5. Needs full patient records       → Clicks "Request Full Access"
   (for anesthesia decision)
   
6. Provides context (optional)      → "Dr. Amit - City Hospital - Emergency Surgery"
   
7. Clicks Submit                    → POST /api/emergency/nfc/request-full-access
                                      → OTP sent to patient's email
                                      → Session created, waiting for OTP
                                      
8. [Patient receives email]         → Email: "Dr. Amit at City Hospital requesting 
                                       access to your emergency profile"
                                      → OTP: 483729 (valid 10 minutes)
                                      
9. [Assume patient conscious       → Patient clicks "Approve" in email
   and approves]                     or navigates to link
   
10. Doctor asks patient for OTP     → "Can you see your OTP?"
    (if conscious) or              
    checks back after approval       
                                     
11. Enters OTP: 483729             → POST /api/emergency/nfc/verify-otp
                                     → OTP validated ✓
                                     → Access granted for 30 minutes
                                     → Full profile unlocked
                                     
12. Sees Full Profile               → All data accessible:
                                      ✓ Full medical history
                                      ✓ Lab results with values
                                      ✓ Doctor notes
                                      ✓ Insurance policy #
                                      ✓ Vaccination records
                                      ✓ Recent documents
```

#### Journey 3: Pre-Authorized Doctor Access (Faster)

```
Cardiologist Scenario:
─────────────────────

Patient creates NFC card:
  • Pre-authorizes: dr.sharma@cardiology.hospital (lifetime access)

Doctor taps card:
  • System checks: Dr. Sharma in pre-authorized list? YES
  • Returns: Full profile immediately (no OTP needed)
  • Doctor sees: Everything, ready to make decisions
  • Access logged: [timestamp] Dr. Sharma accessed via NFC (pre-auth)
```

#### Journey 4: Patient Monitors Access & Revokes

```
Patient Dashboard:
─────────────────

Card: "Wallet Card" (Created: Apr 20, 2026)
  └─ Total Taps: 23
  └─ Last Access: Apr 30, 10:52 AM
  └─ Status: Active
  
  Access Logs:
  ┌─ Apr 30, 10:52 AM │ OTP Request   │ New Delhi    │ Android
  ├─ Apr 30, 10:53 AM │ OTP Verified  │ New Delhi    │ Android
  ├─ Apr 30, 10:54 AM │ Full Access   │ New Delhi    │ Android (Dr. Amit)
  ├─ Apr 29, 3:45 PM  │ Public View   │ Mumbai       │ iOS ⚠️ (Anomaly: different city)
  ├─ Apr 29, 2:12 PM  │ Public View   │ Mumbai       │ iOS
  └─ ...
  
  Actions:
  [Revoke Card] [View Full Logs] [Pre-authorize Doctor] [Disable Temporarily]

Patient clicks "Revoke Card":
  → Card immediately disabled
  → All future taps return 410 Gone
  → Access log shows: "Revoked by patient - Lost card"
```

---

## Architecture & Design

### High-Level System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHYSICAL NFC TAG (Card/Sticker)             │
│                  Stored: URL + Metadata (ASCII)                │
│              https://medora.buzz/emergency/nfc/token123        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    [Tap with Phone]
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    [First Load]                    [Repeat Tap - Cached]
        │                                 │
        ▼                                 ▼
   Browser opens URL             Browser hits cache
   Uses default browser          Still goes to server
                                 (no offline caching for security)
        │
        └────────────────┬────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │  GET /api/emergency/nfc/[token] │  [Public, Rate-Limited]
        │  Response: ~50KB JSON           │  No authentication required
        └────────────────┬────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
       [Public Profile]        [Wants Full Access]
    (Blood, Allergies,              │
     Conditions, Meds)          Clicks "Request"
     AI Summary                       │
                                      ▼
                          POST /api/emergency/nfc/
                          request-full-access
                                      │
                          ┌───────────┴──────────┐
                          │                      │
                      [Email OTP]        [Pre-Auth Doctor?]
                          │                      │
                          ▼                      ▼
                 Enter OTP on page        Auto-grant full access
                 (60 second timer)        (skip OTP)
                          │                      │
                          ▼                      ▼
                  POST /api/emergency/nfc/  Immediate access
                  verify-otp                   │
                          │                      │
                          └───────────┬──────────┘
                                      │
                          ┌───────────▼──────────┐
                          │  Full Profile Data   │
                          │                      │
                          │ ✓ Records            │
                          │ ✓ Lab Results        │
                          │ ✓ Doctor Notes       │
                          │ ✓ Insurance Policy   │
                          │ ✓ Vaccination Hx    │
                          │                      │
                          │ Duration: 30 mins    │
                          └──────────────────────┘
```

### Data Access Layers

```
┌──────────────────────────────────────────────────────────────┐
│                          NFC Token Tap                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        [Layer 1]                 [Token Valid?]
      Public View                  │
    (No Auth Needed)      ┌────────┴────────┐
    Read Permissions:     │                 │
      ✓ Name              YES (→ Layer 2)   NO → 410 Gone
      ✓ Age                               (Revoked or
      ✓ Blood Group                        Malformed)
      ✓ DOB (partial)
      ✓ Allergies (critical)
      ✓ Conditions
      ✓ Medications (generic)
      ✓ Health Summary (public version)
      ✓ Insurance Provider
      ✓ Emergency Contacts
      ✓ "Request Full Access" CTA

              │
              ▼
        [Layer 2]
    Request Full Access
    (OTP Flow Initiated)
    
    System sends OTP to patient email
    Doctor enters OTP
    
    ┌──────────────────────┐
    │ OTP Valid? (10 mins) │
    └────────┬──────┬──────┘
             │      │
          YES       NO
             │      │
             │      └─→ 400 Bad Request
             │           "Invalid OTP"
             │(or retry)
             │
             ▼
        [Layer 3]
    Full Access (30 mins)
    Read Permissions:
      ✓ All Layer 1 + 2
      ✓ Full Medical Records
      ✓ Lab Results (detailed)
      ✓ Doctor Notes
      ✓ Insurance Policy #
      ✓ Vaccination Records
      ✓ Prescription History
      ✓ Previous Diagnoses
    
    Duration: 30 minutes
    (Requires new OTP after expiry)
```

### Multi-Profile Architecture

```
User: Dhairya Sood
│
├─ Profile 1: Self (Dhairya)
│   └─ NFC Token 1: Wallet Card
│       └─ Public: Name, Allergies, Blood Group
│       └─ Pre-Auth: Cardiologist Dr. Sharma
│       └─ OTP-Protected: Full records
│
├─ Profile 2: Son (Arjun - Age 8)
│   └─ NFC Token 2: Backpack Card
│       └─ Public: Child name, parent contact
│       └─ Pre-Auth: School nurse, Pediatrician
│       └─ Guardian approval required for OTP access
│
└─ Profile 3: Mother (Priya - Age 68)
    └─ NFC Token 3: Purse Card
        └─ Public: Age, Allergies, Blood Group
        └─ Pre-Auth: Primary care doctor
        └─ OTP goes to Dhairya (designated approver)
```

---

## Database Schema

### Collection 1: `emergencyNfcTokens`

**Purpose:** Store NFC tokens and their metadata. This is the core collection for all NFC emergency access.

```typescript
type EmergencyNfcToken = {
  // Identifiers
  _id: ObjectId,                        // MongoDB primary key
  id: UUID,                             // Application-level UUID (for REST APIs)
  userId: ObjectId,                     // Profile owner (MongoDB user ID)
  profileId: UUID,                      // Which profile does this token access?
  
  // Token Security
  tokenHash: String,                    // SHA-256(rawToken) - NEVER store raw token in DB
  rawToken?: String,                    // Only returned ONCE during creation, never persisted
  tokenType: 'nfc' | 'qr',             // Distinguish from QR code emergency tokens
  
  // NFC Physical Metadata
  nfcUrl: String,                       // Full URL for NFC tag: "https://medora.buzz/emergency/nfc/{token}"
  nfcSerialNumber?: String,             // Optional: NFC tag manufacturer serial number
  deviceName?: String,                  // User-friendly name: "Driver License Card", "Phone Case Sticker"
  createdFromDevice: 'web' | 'mobile' | 'api', // Where was token created?
  
  // Lifecycle Management
  isActive: Boolean,                    // Can be temporarily disabled by patient
  isPermanent: Boolean,                 // Permanent token vs. one-time use
  revokedAt?: Date,                     // When was token revoked?
  revokedReason?: String,               // Why revoked? ("Lost card", "Security concern", "Accidental creation")
  
  // OTP Configuration
  otpRequiredForFullAccess: Boolean,    // Require OTP to view full medical records?
  otpExpiryMinutes: Number,             // How long is OTP valid? (default: 10)
  otpSendTo?: String,                   // Override email for OTP delivery (default: user email)
  
  // Pre-Authorized Access
  preAuthorizedAccessList: [
    {
      // One pre-auth entry per doctor/provider
      id: UUID,
      doctorId?: UUID,                  // Reference to doctor.id if registered
      doctorEmail: String,              // Unique identifier even if not registered
      doctorName?: String,              // Cached name from doctor profile
      fullAccessGranted: Boolean,       // Can bypas OTP?
      grantedAt: Date,                  // When was access granted?
      grantedByUserId?: ObjectId,       // Who authorized this? (sanity check)
      expiresAt?: Date,                 // When does access expire? (null = permanent)
      notes?: String                    // "Regular cardiologist", "Emergency-only"
    }
  ],
  
  // Access Statistics
  totalScans: Number,                   // Cumulative number of times token accessed
  totalOtpRequests: Number,             // How many OTP flows started?
  totalOtpVerified: Number,             // How many OTP flows completed?
  totalPreAuthAccess: Number,           // How many pre-auth doctor accesses?
  lastAccessAt?: Date,                  // Most recent access timestamp
  lastAccessIp?: String,                // Most recent accessor IP
  lastAccessLocation?: String,          // Most recent city/country
  
  // Anomaly Tracking
  suspiciousAccessCount: Number,        // Incremented for flagged anomalies
  suspiciousAccessLastSeenAt?: Date,    // Most recent anomaly
  failedOtpAttempts: Number,            // Cumulative failed OTP attempts
  lastFailedOtpAt?: Date,               // Most recent OTP failure
  
  // Security & Encryption
  encryptionVersion: 'v1',              // Track schema changes for decryption
  encryptedFields: String[],            // Which fields are encrypted? E.g., ["preAuthorizedAccessList"]
  
  // Versioning & Tracking
  createdAt: Date,                      // When was token created?
  updatedAt: Date,                      // When was token last updated?
  version: Number,                      // Document version for optimistic locking
};

// Indexes
db.emergencyNfcTokens.createIndex(
  { tokenHash: 1 },
  { unique: true, name: 'idx_tokenHash_unique' }
);

db.emergencyNfcTokens.createIndex(
  { profileId: 1, isActive: 1, revokedAt: 1 },
  { name: 'idx_profile_active_revoked' }
);

db.emergencyNfcTokens.createIndex(
  { userId: 1, createdAt: -1 },
  { name: 'idx_user_created_recent' }
);

db.emergencyNfcTokens.createIndex(
  { suspiciousAccessCount: -1, userId: 1 },
  { name: 'idx_suspicious_by_user' }
);

db.emergencyNfcTokens.createIndex(
  { lastAccessAt: -1 },
  { name: 'idx_last_access_recent' }
);

db.emergencyNfcTokens.createIndex(
  { "preAuthorizedAccessList.doctorEmail": 1, profileId: 1 },
  { name: 'idx_preauth_doctor_profile' }
);

// TTL Index: Remove tokens 24 hours after revocation
db.emergencyNfcTokens.createIndex(
  { revokedAt: 1 },
  { expireAfterSeconds: 86400, name: 'idx_revoked_cleanup' }
);
```

**Field Explanations:**

- **tokenHash**: Never store raw token. On creation: `tokenHash = SHA256(randomBytes(32))`. On access: compare `SHA256(providedToken)` with stored hash.
- **isPermanent**: `true` = token can be used unlimited times. `false` = token invalidates after first full access.
- **preAuthorizedAccessList**: Array of doctors who can bypass OTP. Each doctor has individual expiry date (e.g., "Dr. Sharma until Dec 31, 2026").
- **totalScans**: Incremented every time token endpoint is called.
- **suspiciousAccessCount**: Flagged by anomaly detector (rapid succession taps, geo jumps, repeated failed OTPs).
- **encryptionVersion**: If data format changes, we need to know how to decrypt old records.

---

### Collection 2: `emergencyNfcAccessLogs`

**Purpose:** Immutable audit trail of all NFC accesses. Used for compliance, anomaly detection, and patient dashboard.

```typescript
type EmergencyNfcAccessLog = {
  // Identifiers
  _id: ObjectId,
  id: UUID,
  tokenId: UUID,                        // Which token was accessed?
  profileId: UUID,                      // Which profile?
  userId: ObjectId,                     // Profile owner (for bulk queries)
  
  // Action & Timing
  action: 
    | 'tap'                             // User tapped card in NFC
    | 'view_public'                     // Viewed public profile
    | 'request_full_access'             // Clicked "Request Full Access"
    | 'otp_sent'                        // OTP email sent to patient
    | 'otp_attempted'                   // OTP code submitted (may be wrong)
    | 'otp_verified'                    // OTP code correct
    | 'full_access_granted'             // Full access unlocked
    | 'pre_auth_access_granted'         // Pre-authorized doctor bypassed OTP
    | 'access_expired'                  // 30-min full access window closed
    | 'rate_limit_exceeded'             // Rate limiter blocked request
    | 'token_revoked_access'            // Token was revoked
    | 'anomaly_detected'                // System flagged suspicious pattern
    | 'error',                          // Generic error
    
  timestamp: Date,                      // When did this action occur?
  
  // Requester Information
  ip: String,                           // Source IP address (for anomaly detection)
  userAgent: String,                    // Full User-Agent header
  deviceOs?: 'iOS' | 'Android' | 'Web' | 'Unknown', // Derived from user agent
  deviceBrowser?: String,               // "Safari", "Chrome", "Samsung Internet"
  deviceName?: String,                  // "iPhone 15 Pro", "Pixel 8"
  
  // Geolocation Data
  geoLocation?: {
    latitude: Number,                   // IP-based geolocation
    longitude: Number,
    city?: String,                      // "New Delhi"
    state?: String,                     // "Delhi"
    country?: String,                   // "India"
    timezone?: String,                  // "Asia/Kolkata"
    isp?: String,                       // "Jio", "Airtel"
    isVpn?: Boolean,                    // VPN detected?
    errorMessage?: String               // If geolocation lookup failed
  },
  
  // Access Level & Data Exposure
  dataAccessedLevel: 'none' | 'public' | 'public_with_summary' | 'full', // What data did they see?
  dataAccessedFields?: String[],        // Subset of ["name", "allergies", "bloodGroup", ...]
  
  // OTP Flow Details (if applicable)
  otpSessionId?: UUID,                  // Link to OTP session if OTP involved
  otpDeliveryMethod?: 'email' | 'sms',  // How was OTP sent?
  otpSentTo?: String,                   // Partial: "p***@example.com"
  otpVerified?: Boolean,                // Did they enter correct OTP?
  otpAttempts?: Number,                 // How many OTP attempts made?
  otpFirstAttemptAt?: Date,             // When did first OTP attempt occur?
  otpLastAttemptAt?: Date,              // When did most recent OTP attempt occur?
  
  // Doctor/Responder Context (if provided)
  responderContext?: {
    name?: String,                      // "Dr. Amit Patel"
    role?: String,                      // "Emergency Doctor", "Paramedic"
    organization?: String,              // "City Hospital", "Ambulance Service"
    specialization?: String             // "Cardiology", "Emergency Medicine"
  },
  
  // Anomalies & Flags
  flaggedAsAnomalous: Boolean,          // System flagged this access?
  anomalyReasons?: String[],            // ["rapid_succession", "geographic_jump", "failed_otp_x3"]
  anomalySeverity?: 'low' | 'medium' | 'high', // How concerning is the anomaly?
  
  // Response & Outcome
  statusCode: Number,                   // HTTP response: 200, 401, 403, 429, 410, 500, etc.
  errorMessage?: String,                // If error occurred: "Token revoked", "Rate limit exceeded"
  responseTimeMs?: Number,              // How long did endpoint take to respond?
  
  // Metadata
  createdAt: Date,
  
  // Patient Notification Sent?
  patientNotifiedAt?: Date,             // When did we email patient about this access?
  patientNotificationRead?: Boolean,    // Did patient read the notification?
};

// Indexes
db.emergencyNfcAccessLogs.createIndex(
  { tokenId: 1, timestamp: -1 },
  { name: 'idx_token_recent' }
);

db.emergencyNfcAccessLogs.createIndex(
  { userId: 1, timestamp: -1 },
  { name: 'idx_user_recent' }
);

db.emergencyNfcAccessLogs.createIndex(
  { flaggedAsAnomalous: 1, timestamp: -1 },
  { name: 'idx_anomalies' }
);

db.emergencyNfcAccessLogs.createIndex(
  { ip: 1, timestamp: -1 },
  { name: 'idx_ip_access_pattern' }
);

// TTL Index: Auto-delete logs after 1 year (compliance retention)
db.emergencyNfcAccessLogs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000, name: 'idx_ttl_1year' }
);

// Geospatial index for finding accesses from specific regions
db.emergencyNfcAccessLogs.createIndex(
  { "geoLocation.latitude": "2d", "geoLocation.longitude": "2d" },
  { name: 'idx_geo_2d' }
);
```

**Field Explanations:**

- **action**: Enum of all possible actions. Allows filtering dashboard: "Show me all OTP attempts", "Show failed accesses", etc.
- **dataAccessedLevel**: Tracks what level of data was exposed. Used for compliance audits.
- **flaggedAsAnomalous**: If true, system sends patient notification + flags for review.
- **anomalyReasons**: Multiple reasons can trigger flag. Examples:
  - `rapid_succession`: 5 taps in 10 seconds (spamming)
  - `geographic_jump`: Same token accessed from India, then UK in 1 hour (impossible)
  - `failed_otp_x3`: Failed OTP 3 times (brute force attempt)
  - `unusual_time`: Access at 3 AM (contextual)
  - `repeat_token_different_ip`: Same token, different IPs (possible fraud)

---

### Collection 3: `emergencyNfcOtpSessions`

**Purpose:** Manage OTP lifecycle. Each OTP request creates a new session. Sessions auto-delete after expiry.

```typescript
type EmergencyNfcOtpSession = {
  // Identifiers
  _id: ObjectId,
  id: UUID,                             // OTP session ID
  tokenId: UUID,                        // Which NFC token initiated this OTP request?
  userId: ObjectId,                     // Patient (profile owner)
  profileId: UUID,
  
  // OTP Code
  otpCode: String,                      // Hashed OTP: SHA256(code) - NEVER store plaintext
  otpLength: Number,                    // Always 6 digits (000000-999999)
  otpRawCode?: String,                  // Only returned ONCE in response, never in DB
  
  // OTP Delivery
  deliveryMethod: 'email' | 'sms' | 'websocket', // How was OTP sent?
  deliveredTo: String,                  // "patient@example.com" or "+919876543210"
  deliveredToMasked: String,            // "p***@example.com" (for UI display)
  deliveryAttempts: Number,             // How many times did we try to send? (retry logic)
  deliverySucceededAt?: Date,           // When was delivery confirmed?
  deliveryErrorMessage?: String,        // If delivery failed
  
  // Lifecycle
  createdAt: Date,                      // When was OTP session created?
  expiresAt: Date,                      // When does OTP expire? (typically: createdAt + 10 mins)
  verifiedAt?: Date,                    // When was OTP successfully verified?
  
  // Validation Attempts
  attemptCount: Number,                 // How many verification attempts made?
  maxAttempts: Number,                  // Max allowed: 3
  firstAttemptAt?: Date,                // When was first attempt made?
  lastAttemptAt?: Date,                 // When was most recent attempt?
  lastAttemptIp?: String,               // IP address of most recent attempt
  
  // Outcome
  verified: Boolean,                    // Was OTP successfully verified?
  verificationFailed: Boolean,          // Did verification attempts all fail?
  failureReason?: 'max_attempts_exceeded' | 'expired' | 'invalid_code', // Why did it fail?
  
  // Request Context
  requestContext?: {
    responderName?: String,             // Doctor optionally provided their name
    responderOrganization?: String,     // Optional: "City Hospital"
    requestReason?: String,             // Optional: "Emergency surgery decision"
    requestIp: String,                  // IP that initiated OTP request
    requestUserAgent: String,
    requestGeoLocation?: {
      city?: String,
      country?: String
    }
  },
  
  // Access Scope (what gets unlocked after OTP verification)
  accessScope: 'public' | 'full',       // What level of access to grant?
  grantedUntil?: Date,                  // If verified, access valid until this datetime
  accessTokenCreated?: Boolean,         // Did we create an access token after verification?
  accessToken?: String,                 // Optional: signed JWT for accessing /full endpoint
  
  // Flags
  flaggedAsAnomalous?: Boolean,         // Multiple failed attempts?
  
  // Metadata
  source: 'nfc_tap' | 'api_call' | 'manual', // Where did OTP request originate?
};

// Indexes
db.emergencyNfcOtpSessions.createIndex(
  { tokenId: 1, expiresAt: 1 },
  { name: 'idx_token_expiry' }
);

db.emergencyNfcOtpSessions.createIndex(
  { userId: 1, createdAt: -1 },
  { name: 'idx_user_created' }
);

// TTL (expires after OTP expiry)
db.emergencyNfcOtpSessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idx_ttl_otp_expiry' }
);

// Find active OTP for token
db.emergencyNfcOtpSessions.createIndex(
  { tokenId: 1, verified: 1 },
  { name: 'idx_token_verified' }
);
```

**Field Explanations:**

- **otpCode**: Hashed for security. On verification: `SHA256(submittedCode) === storedOtpCode`.
- **deliverAttempts**: Retry logic if email bounces. Max attempts: 3.
- **maxAttempts**: Limit OTP guessing. After 3 failed: session becomes ineligible.
- **expiresAt**: OTP window (10 minutes). After expiry, session auto-deleted + request must start over.
- **accessToken**: Optional JWT token that can be passed to `/full` endpoint instead of storing state on client.

---

## API Specification

### Authentication

All authenticated APIs require:
- `Authorization: Bearer {nextAuthToken}` (from NextAuth session)
- Session validation via `getIdentity()` helper

Public APIs (unauthenticated):
- Rate limiting per IP (20 requests/min for GET /emergency/nfc/[token])
- No authentication header required
- Responses include rate-limit headers

---

### Patient/Guardian Endpoints

#### 1. Create NFC Token

**Endpoint:** `POST /api/emergency/nfc/create`

**Authentication:** Required (authenticated user)

**Request:**
```json
{
  "profileId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceName": "Driver License Card",
  "isPermanent": true,
  "otpRequiredForFullAccess": true,
  "otpExpiryMinutes": 10,
  "preAuthorizedDoctors": [
    {
      "doctorEmail": "dr.sharma@cardiology.com",
      "grantFullAccess": true,
      "expiresInDays": 180
    },
    {
      "doctorEmail": "dr.patel@hospital.com",
      "grantFullAccess": false,
      "expiresInDays": 365
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "tokenId": "550e8400-e29b-41d4-a716-446655440001",
  "nfcUrl": "https://medora.buzz/emergency/nfc/a7f3e9c21b5d8e0f4a6b2c9d",
  "rawToken": "a7f3e9c21b5d8e0f4a6b2c9d",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "instructions": {
    "title": "Write to NFC Card",
    "steps": [
      "1. Open NFC Writer app (TagWriter or Shortcuts)",
      "2. Tap 'Create New Record'",
      "3. Select type: URL",
      "4. Paste URL below",
      "5. Hold phone to NFC card/sticker",
      "6. Confirm write"
    ],
    "url": "https://medora.buzz/emergency/nfc/a7f3e9c21b5d8e0f4a6b2c9d",
    "automationLink": "Create with Shortcuts (iOS): [link]"
  },
  "message": "NFC token created. Show this page to write URL to your NFC card."
}
```

**Error Responses:**

| Status | Code | Message |
|---|---|---|
| 400 | INVALID_PROFILE | Profile ID does not exist or user cannot access |
| 401 | UNAUTHORIZED | User not authenticated |
| 429 | RATE_LIMIT | Too many tokens created (max 3/minute) |
| 500 | SERVER_ERROR | Database write failed |

**Rate Limiting:**
- Max 3 tokens per user per minute
- Returns `X-RateLimit-Remaining` header
- Returns `Retry-After` on 429

---

#### 2. List NFC Tokens

**Endpoint:** `GET /api/emergency/nfc/tokens`

**Query Parameters:**
- `profileId` (UUID): Filter by profile [REQUIRED]
- `limit` (number, 1-100): Pagination [default: 20]
- `offset` (number ≥ 0): Pagination [default: 0]
- `sortBy` (string): 'createdAt' | 'lastAccessAt' | 'totalScans' [default: 'createdAt']
- `sortOrder` (string): 'asc' | 'desc' [default: 'desc']

**Response (200 OK):**
```json
{
  "tokens": [
    {
      "tokenId": "550e8400-e29b-41d4-a716-446655440001",
      "deviceName": "Driver License Card",
      "createdAt": "2026-04-20T10:30:00Z",
      "lastAccessAt": "2026-04-30T14:52:00Z",
      "totalScans": 23,
      "isActive": true,
      "isPermanent": true,
      "revokedAt": null,
      "otpRequired": true,
      "preAuthorizedDoctorCount": 2,
      "preAuthorizedDoctors": [
        {
          "doctorEmail": "dr.sharma@cardiology.com",
          "expiresAt": "2026-10-20T00:00:00Z"
        }
      ],
      "suspiciousActivityCount": 0,
      "recentActivity": {
        "lastAction": "view_public",
        "lastActionTime": "2026-04-30T14:52:00Z",
        "lastActionCity": "New Delhi"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

**Error Responses:**
- 400: Invalid profileId or pagination parameters
- 401: Unauthorized
- 404: Profile not found

---

#### 3. Revoke NFC Token

**Endpoint:** `POST /api/emergency/nfc/revoke`

**Request:**
```json
{
  "tokenId": "550e8400-e29b-41d4-a716-446655440001",
  "reason": "Lost card"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "tokenId": "550e8400-e29b-41d4-a716-446655440001",
  "revokedAt": "2026-04-30T15:30:00Z",
  "message": "Token revoked. All future access attempts will be blocked."
}
```

**Effects of Revocation:**
- Token immediately marked revoked
- All future taps return 410 Gone
- Pre-authorized doctors also blocked
- Access log created with action: "token_revoked"
- Patient receives notification email
- Document auto-deletes after 24 hours (TTL index)

---

#### 4. Get NFC Access Logs

**Endpoint:** `GET /api/emergency/nfc/logs`

**Query Parameters:**
- `profileId` (UUID): [REQUIRED]
- `limit` (number, 1-100): [default: 50]
- `offset` (number): [default: 0]
- `actionFilter` (string): 'tap' | 'otp_sent' | 'otp_verified' | 'full_access_granted' | 'anomaly' [optional]
- `anomalyOnly` (boolean): Return only flagged logs [optional]
- `dateFrom` (ISO8601): Filter by date range [optional]
- `dateTo` (ISO8601): Filter by date range [optional]

**Response (200 OK):**
```json
{
  "logs": [
    {
      "logId": "550e8400-e29b-41d4-a716-446655440002",
      "timestamp": "2026-04-30T14:52:00Z",
      "action": "otp_verified",
      "actionLabel": "Full Access Granted",
      "ip": "203.0.113.45",
      "location": {
        "city": "New Delhi",
        "country": "India",
        "timezone": "Asia/Kolkata"
      },
      "deviceInfo": {
        "os": "iOS",
        "browser": "Safari",
        "deviceName": "iPhone 15 Pro"
      },
      "dataAccessedLevel": "full",
      "responderContext": {
        "name": "Dr. Amit Patel",
        "organization": "City Hospital"
      },
      "flaggedAsAnomalous": false,
      "anomalyReasons": [],
      "statusCode": 200
    },
    {
      "logId": "550e8400-e29b-41d4-a716-446655440003",
      "timestamp": "2026-04-29T22:30:00Z",
      "action": "view_public",
      "actionLabel": "Public Profile Viewed",
      "ip": "203.0.113.50",
      "location": {
        "city": "Mumbai",
        "country": "India"
      },
      "deviceInfo": {
        "os": "Android",
        "browser": "Chrome"
      },
      "dataAccessedLevel": "public",
      "flaggedAsAnomalous": true,
      "anomalyReasons": ["geographic_jump"],
      "anomalySeverity": "medium",
      "statusCode": 200,
      "patientNotified": true
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  },
  "summary": {
    "totalAccesses": 45,
    "anomalousAccesses": 2,
    "preAuthAccessCount": 12,
    "otpVerifiedCount": 5,
    "publicViewCount": 26,
    "lastAccessTime": "2026-04-30T14:52:00Z"
  }
}
```

---

#### 5. Authorize Doctor for Pre-Auth Access

**Endpoint:** `POST /api/emergency/nfc/authorize-doctor`

**Request:**
```json
{
  "tokenId": "550e8400-e29b-41d4-a716-446655440001",
  "doctorEmail": "dr.sharma@cardiology.com",
  "expiresInDays": 180,
  "grantFullAccess": true,
  "notes": "Regular cardiologist"
}
```

**Response (201 Created):**
```json
{
  "authorizationId": "550e8400-e29b-41d4-a716-446655440004",
  "tokenId": "550e8400-e29b-41d4-a716-446655440001",
  "doctorEmail": "dr.sharma@cardiology.com",
  "grantedAt": "2026-04-30T16:00:00Z",
  "expiresAt": "2026-10-28T00:00:00Z",
  "grantFullAccess": true,
  "message": "Dr. Sharma will now have instant full access when tapping this card."
}
```

**Notifications:**
- System sends email to doctor (if registered in MediLocker): "You've been granted emergency access to patient profile"
- Patient sees confirmation in dashboard

---

### Public Emergency Access Endpoints

#### 1. Get Emergency Profile (Public View)

**Endpoint:** `GET /api/emergency/nfc/[token]`

**Parameters:**
- `token` (path): NFC token string
- `requestFullAccess` (query, optional): boolean - Load full access request UI?

**Authentication:** None required

**Rate Limiting:** 20 requests per minute per IP

**Response (200 OK - Public Profile):**
```json
{
  "emergencyProfile": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "patient": {
      "name": "Dhairya Sood",
      "age": 28,
      "dateOfBirth": "1997-12-15",          // Only Y-M-D, no full precision
      "gender": "Male",
      "bloodGroup": "O+",
      "bloodGroupEmoji": "🩸"
    },
    "allergies": {
      "list": ["Penicillin", "Latex", "Shellfish"],
      "severity": ["High", "High", "Moderate"],
      "description": "⚠️ SEVERE: Do NOT use penicillin-based antibiotics. Use Cephalosporin alternative."
    },
    "medicalConditions": {
      "activeConditions": [
        {
          "condition": "Type 2 Diabetes Mellitus",
          "diagnosed": "2020",
          "status": "Controlled"
        },
        {
          "condition": "Hypertension",
          "diagnosed": "2019",
          "status": "On medication"
        }
      ]
    },
    "medications": {
      "current": [
        "Metformin 500mg twice daily",
        "Lisinopril 10mg once daily"
      ],
      "note": "Patient is diabetic and hypertensive"
    },
    "healthSummary": {
      "overallStatus": "Stable - Managing chronic conditions",
      "keyFindings": [
        "Diabetes controlled with Metformin",
        "Blood pressure stable on Lisinopril",
        "Recent labs normal"
      ],
      "alert": null
    },
    "insurance": {
      "hasInsurance": true,
      "insurerName": "HDFC ERGO",
      "policyType": "Family Mediclaim",
      "policyNumberHidden": true,
      "estimatedCoverage": "Up to ₹5,00,000",
      "contactButtonText": "Contact Insurance"
    },
    "emergencyContacts": [
      {
        "name": "Priya Sood (Mother)",
        "relationship": "Mother",
        "phone": "+91-98765-43210"
      },
      {
        "name": "Akshay Sood (Brother)",
        "relationship": "Brother",
        "phone": "+91-98765-43211"
      }
    ],
    "doctorNotes": "No critical allergies missed. Recent health status good.",
    "vaccinations": {
      "lastupdated": "2026-04-01",
      "summary": "Fully vaccinated for COVID-19, Tetanus, and Hepatitis B"
    }
  },
  "accessControl": {
    "otpRequired": true,
    "canRequestFullAccess": true,
    "preAuthByDoctorCount": 2,
    "fullAccessMessage": "To view complete medical records, medications, and insurance details, you can request access."
  },
  "tokenMetadata": {
    "tokenCreatedAt": "2026-04-20T10:30:00Z",
    "lastAccessedAt": "2026-04-30T14:52:00Z",
    "totalAccesses": 23,
    "isTokenValid": true,
    "tokenExpiresAt": null
  }
}
```

**Error Responses:**

| Status | Scenario |
|---|---|
| 404 | Token not found / malformed |
| 410 | Token revoked |
| 429 | Rate limit exceeded (20/min per IP) |
| 500 | Server error |

**Client Implementation Notes:**
- Display allergies in RED/warning style
- Display blood group prominently
- Make emergency contacts clickable (tel: links)
- Include "Request Full Access" CTA
- Show last access timestamp (builds trust)

---

#### 2. Request Full Access (OTP Initiation)

**Endpoint:** `POST /api/emergency/nfc/request-full-access`

**Request:**
```json
{
  "token": "a7f3e9c21b5d8e0f4a6b2c9d",
  "requestMessage": "Emergency doctor at City Hospital examining patient",
  "responderName": "Dr. Amit Patel",
  "responderOrganization": "City Hospital Emergency"
}
```

**Response (200 OK):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440005",
  "otpSent": true,
  "sentTo": "p***@example.com",
  "otpExpiresIn": 600,
  "otpExpiresAt": "2026-04-30T17:10:00Z",
  "message": "OTP sent to patient's email. Expire in 10 minutes.",
  "instructions": {
    "step1": "Ask patient for OTP code",
    "step2": "Enter 6-digit code below",
    "step3": "Complete verification to unlock full records"
  }
}
```

**Behind the Scenes:**
1. System generates 6-digit OTP
2. Email sent to patient: "Doctor at City Hospital requesting access to your emergency profile. If you approve, reply with this OTP: 483729"
3. OTP session created with 10-minute expiry
4. System logs action: "otp_sent"

**Error Responses:**
- 404: Token not found / revoked
- 400: OTP request already in-flight (retry in 60 seconds)
- 429: Too many requests
- 500: Failed to send email

---

#### 3. Verify OTP & Unlock Full Access

**Endpoint:** `POST /api/emergency/nfc/verify-otp`

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440005",
  "otp": "483729"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "accessGrantedUntil": "2026-04-30T17:30:00Z",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenExpirySeconds": 1800,
  "message": "Access granted for 30 minutes. You can now view complete records.",
  "fullProfile": {
    // Include full profile here, or return link to /[token]/full endpoint
    // Same as public profile, but with additional fields unlocked
  }
}
```

**Effects:**
1. OTP session marked as verified
2. Access token created (JWT, 30-min expiry)
3. System logs: "otp_verified", "full_access_granted"
4. Patient receives notification email: "Your emergency profile was accessed by Dr. Amit Patel at City Hospital"
5. Access log flags any anomalies

**Error Responses:**

| Status | Reason |
|---|---|
| 400 | Invalid OTP - Attempts remaining: 2 |
| 400 | OTP expired - Please request new OTP |
| 429 | Too many failed attempts - Locked for 15 minutes |
| 404 | Session not found |

---

#### 4. Get Full Emergency Profile

**Endpoint:** `GET /api/emergency/nfc/[token]/full`

**Query Parameters:**
- `accessToken` (string): JWT from OTP verification
- OR cookie: `nfc_access_token` (if using secure cookies)

**Response (200 OK):**
```json
{
  "fullProfile": {
    // All public profile fields PLUS:
    "medicalHistory": {
      "recentDiagnoses": [
        {
          "diagnosis": "Type 2 Diabetes Mellitus",
          "diagnosedDate": "2020-06-15",
          "severity": "Moderate",
          "status": "Controlled"
        }
      ],
      "pastSurgeries": [
        {
          "procedure": "Appendectomy",
          "date": "2015-03-20",
          "hospital": "Apollo Hospital",
          "notes": "Uncomplicated recovery"
        }
      ],
      "pastHospitalizations": [
        {
          "reason": "Gastroenteritis",
          "dates": "2019-07-10 to 2019-07-12",
          "hospital": "Max Healthcare"
        }
      ]
    },
    "labResults": {
      "recent": [
        {
          "testName": "Fasting Glucose",
          "testDate": "2026-04-15",
          "value": 115,
          "unit": "mg/dL",
          "referenceRange": "70-100",
          "status": "High",
          "interpretation": "Slightly elevated, consistent with controlled diabetes"
        },
        {
          "testName": "HbA1c",
          "testDate": "2026-04-15",
          "value": 7.1,
          "unit": "%",
          "referenceRange": "<7",
          "status": "Normal-ish",
          "lastThreeMonthsAverage": "Good control"
        }
      ]
    },
    "medications": {
      "current": [
        {
          "name": "Metformin",
          "dosage": "500mg",
          "frequency": "Twice daily",
          "startDate": "2020-06-20",
          "indication": "Type 2 Diabetes",
          "sideEffects": []
        },
        {
          "name": "Lisinopril",
          "dosage": "10mg",
          "frequency": "Once daily",
          "startDate": "2019-10-01",
          "indication": "Hypertension",
          "sideEffects": []
        }
      ],
      "previousMedications": [
        {
          "name": "Atorvastatin",
          "dosage": "20mg",
          "reason": "Discontinued 2024-01-15 (lipids normalized)"
        }
      ]
    },
    "allergies": {
      "detailed": [
        {
          "allergen": "Penicillin",
          "severity": "Severe",
          "reactionType": "Anaphylaxis",
          "dateDiscovered": "2010",
          "alternativeClass": "Use Cephalosporin or Macrolide",
          "notes": "Hives + throat tightness"
        }
      ]
    },
    "insurance": {
      "provider": "HDFC ERGO",
      "policyNumber": "HDFC/2022/XXX12345",
      "policyType": "Family Mediclaim",
      "coverageAmount": "Rs. 5,00,000",
      "sumInsured": "Rs. 10,00,000",
      "claimHistory": "No active claims",
      "documentUrl": "https://storage.example.com/policy.pdf"
    },
    "vaccinations": {
      "lastUpdated": "2026-04-01",
      "records": [
        {
          "vaccine": "COVID-19 (Booster)",
          "doses": [
            "2021-03-10 (Covishield)",
            "2021-04-15 (Covishield)",
            "2022-09-20 (Pfizer)"
          ],
          "status": "Up to date"
        }
      ]
    },
    "recentDocuments": [
      {
        "docName": "Blood Pressure Log - April 2026",
        "type": "Health Record",
        "uploadDate": "2026-04-25",
        "url": "https://storage.example.com/bp-log.pdf"
      }
    ],
    "doctorNotes": [
      {
        "doctorName": "Dr. Sharma",
        "date": "2026-04-20",
        "note": "Patient doing well. Diabetes and BP stable. Continue current medications."
      }
    ]
  },
  "accessInfo": {
    "grantedAt": "2026-04-30T17:00:00Z",
    "grantedUntil": "2026-04-30T17:30:00Z",
    "timeRemainingMinutes": 5,
    "accessExpiredMessage": "Access will expire in 5 minutes. Screenshot now if needed."
  }
}
```

**Error Responses:**
- 403: Invalid/expired access token
- 404: Token not found

---

## Frontend Components

### Component 1: `EmergencyNfcCard`

**Location:** `/apps/web/components/emergency/EmergencyNfcCard.tsx`

**Purpose:** Display NFC token info, QR code, and management options.

**Props:**
```typescript
interface EmergencyNfcCardProps {
  token: {
    tokenId: UUID;
    deviceName: string;
    createdAt: Date;
    lastAccessAt?: Date;
    totalScans: number;
    isActive: boolean;
    nfcUrl: string;
  };
  onRevoke: (tokenId: UUID) => void;
  onCopyUrl: (url: string) => void;
  onViewLogs: (tokenId: UUID) => void;
}
```

**Display:**
```
┌─────────────────────────────────────────┐
│  📱 Driver License Card                 │
│  Created: Apr 20, 2026                  │
│  Last Access: Apr 30, 14:52 (New Delhi) │
│                                         │
│  Scans: 23                              │
│  Status: ✅ Active                      │
│                                         │
│┌───────────────────────────────────────┐│
││ [QR Code Image]                       ││
││ Tap to open in NFC Writer              ││
│└───────────────────────────────────────┘│
│                                         │
│ NFC URL:                                │
│ https://medora.buzz/emergency/nfc/a7f3 │
│ [Copy] [Write to Card]                  │
│                                         │
│ [View Logs] [Pre-auth Doctors]          │
│ [Revoke Card]                           │
└─────────────────────────────────────────┘
```

### Component 2: `CreateNfcTokenModal`

**Location:** `/apps/web/components/emergency/CreateNfcTokenModal.tsx`

**Form Fields:**
```
[ Select Profile ]
  └─ Dhairya (Self)
  └─ Son (Arjun)
  └─ Mother (Priya)

[ Device Name ]
  Placeholder: "Driver License", "Phone Case Sticker"

[ OTP Required? ]
  ☑ Require OTP for full access
  ○ Allow instant full access (not recommended)

[ Pre-authorize Doctors ]
  + Add doctor email
    dr.sharma@cardiology.com [Lifetime] [Remove]
    dr.patel@hospital.com [180 days] [Remove]

[Generate Card] [Cancel]
```

---

### Component 3: `EmergencyProfilePublic`

**Location:** `/apps/web/components/emergency/EmergencyProfilePublic.tsx`

**Responsive Design:** Mobile-first, optimized for emergency context

**Layout:**
```
┌────────────────────────────────────────┐
│         🩺 Emergency Profile            │
│         Dhairya Sood (28M)             │
├────────────────────────────────────────┤
│                                         │
│ Blood Group: 🩸 O+                     │
│                                         │
│ ⚠️ ALLERGIES                           │
│  ❌ Penicillin (SEVERE)                │
│  ❌ Latex (SEVERE)                     │
│  ⚠️ Shellfish (Moderate)               │
│                                         │
│ Conditions:                             │
│  • Diabetes (Controlled)               │
│  • Hypertension (On meds)              │
│                                         │
│ Current Medications:                    │
│  • Metformin 500mg 2x daily            │
│  • Lisinopril 10mg daily               │
│                                         │
│ Health Summary:                         │
│  Stable, managing chronic conditions.  │
│                                         │
│ Insurance: HDFC ERGO                   │
│  [Contact Insurance]                   │
│                                         │
│ Emergency Contacts:                     │
│  Priya Sood (Mother)                   │
│  [📞 +91-9876543210]                   │
│                                         │
│  Akshay Sood (Brother)                 │
│  [📞 +91-9876543211]                   │
│                                         │
├────────────────────────────────────────┤
│  [Request Full Access]                  │
│  [Share with Hospital]                  │
└────────────────────────────────────────┘
```

---

### Component 4: `OtpVerificationFlow`

**Location:** `/apps/web/components/emergency/OtpVerificationFlow.tsx`

**States:**
1. **Requested:** Waiting for OTP
2. **Entered:** User typing OTP
3. **Verifying:** Submitting to backend
4. **Success:** Access granted
5. **Error:** Invalid OTP

**UI:**
```
┌────────────────────────────────────────┐
│     Enter OTP Code                      │
│     Check email: p***@example.com       │
│                                         │
│  [_][_][_][_][_][_]                   │
│   O  T  P  C  o  d  e                  │
│                                         │
│  ⏱ Expires in: 09:30                   │
│                                         │
│  [ Verify ]  [ Cancel ]                │
│                                         │
│  Didn't receive code?                   │
│  [Request New OTP] (30s cooldown)      │
│                                         │
│  Questions?                             │
│  [Contact Support]                      │
└────────────────────────────────────────┘
```

---

## Security & Privacy

### Data Hierarchy

```
Level 1: Public (No Auth)
├─ Name, Age, Blood Group
├─ Allergies (Critical highlight)
├─ Conditions (High-level)
├─ Medications (Generic)
├─ Health summary (Sanitized)
├─ Insurance provider name
└─ Emergency contacts

Level 2: OTP-Protected (Patient Consent)
├─ All Level 1 fields
├─ Full medical history
├─ Lab results (detailed values)
├─ Doctor notes
├─ Insurance policy number
├─ Vaccinations (detailed)
└─ Recent documents

Level 3: Pre-Auth (Invited Doctors)
└─ Same as Level 2 (if full access granted)
```

### Threat Models & Mitigations

| Threat | Scenario | Mitigation |
|---|---|---|
| **Token Brute Force** | Attacker tries all possible tokens | Use 256-bit random tokens; rate limit per IP (20/min) |
| **OTP Brute Force** | Attacker tries all 6-digit codes | Max 3 attempts per OTP session; 15-min lockout after failure |
| **Token Theft** | Attacker steals NFC card from patient | Only gives public access; OTP required for full records |
| **Geographic Spoofing** | Attacker uses VPN to fake location | Detect impossible travel (same token, 2 countries in 1 hour) |
| **Replay Attacks** | Attacker replays old OTP code | OTP single-use within 10-min window; session deleted after use |
| **Email Interception** | Attacker intercepts OTP email | Use HTTPS; OTP valid only 10 minutes; patient notified of access |
| **Rate Limiting Bypass** | Attacker uses distributed IPs | Implement sliding window; track per-user total requests |
| **Pre-auth Conflict** | Unauthorized doctor gets pre-auth | Patient must explicitly invite; email verification optional |

---

### Encryption

**At-Rest Encryption:**
- OTP codes: `SHA256(code)` - never plaintext DB storage
- Sensitive fields (policy numbers): AES-256-GCM with key rotation
- Version field tracks encryption algorithm changes

**In-Transit Encryption:**
- All endpoints: HTTPS/TLS 1.3+
- Rate limit headers included

---

### Compliance

**HIPAA (US):**
- Emergency exception allows limited disclosure without explicit consent
- OTP + audit trail provide enhanced control
- Access logs maintained for 6 years minimum

**GDPR (EU):**
- Legitimate interest (emergency response)
- Audit logs maintained for compliance review
- Data minimization: only essential fields on public view
- Right to access: Patient can download full access logs

**India Health Data Policy:**
- Data stored in India (Supabase region configurable)
- OTP consent mechanism aligns with requirements
- Audit trail supports compliance investigations

---

## Integration Strategy

### Reuse Existing Patterns

**1. Token Generation** (File: `/apps/web/lib/emergencyTokens.ts`)
```typescript
// Existing pattern
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

// Reuse for NFC tokens
```

**2. Rate Limiting** (File: `/apps/web/lib/rateLimiter.ts`)
```typescript
// Existing RateLimiter class
const limiter = new RateLimiter('nfc-create', {
  maxRequests: 3,
  windowMs: 60000
});
```

**3. Email Service** (File: `/apps/web/lib/emailHooks.ts`)
```typescript
// Add new function
export async function sendNfcOtpEmail(
  to: string,
  patientName: string,
  otpCode: string,
  responderInfo?: { name: string; organization: string }
) {
  // Reuse existing Resend integration
}
```

**4. Permission Checks** (File: `/apps/web/lib/permissions.ts`)
```typescript
// Reuse existing pattern
export function canAccessProfile(userId, profileId) {
  // Extended with: is user guardian? can access pre-auth?
}
```

---

### New Collections

Three new MongoDB collections (already specified in schema section):
1. `emergencyNfcTokens`
2. `emergencyNfcAccessLogs`
3. `emergencyNfcOtpSessions`

---

### Modified Files

| File | Change | Reason |
|---|---|---|
| `packages/db/index.ts` | Export NFC collections | Surface types for REST APIs |
| `apps/web/lib/auth.ts` | Add NFC context to emails | Include patient name in OTP email |
| `apps/web/lib/permissions.ts` | Add `canAccessNfcToken()` | Check if user can access specific token |
| `apps/web/app/layout.tsx` | Add public routes | No auth requirement for emergency pages |
| `apps/web/services/aiClient.ts` | Add filterLevel param | Support public vs. full health summary |
| `apps/web/app/api/health-summary/route.ts` | Support filtering | Return sanitized summary for public view |
| `apps/web/lib/emailHooks.ts` | Add OTP template | Send OTP-specific emails |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Objectives:**
- Create database collections
- Implement token generation
- Basic API endpoints for patient operations
- Unit tests for token logic

**Deliverables:**
1. Database collections + indexes
2. Token generation library
3. POST `/api/emergency/nfc/create`
4. POST `/api/emergency/nfc/revoke`
5. Rate limiting for token creation
6. Unit tests (token hashing, OTP generation)

**Files Created:**
```
packages/db/
  ├─ emergencyNfcTokens.ts
  ├─ emergencyNfcAccessLogs.ts
  └─ emergencyNfcOtpSessions.ts

apps/web/lib/
  └─ nfcGenerator.ts

apps/web/app/api/emergency/nfc/
  ├─ create/
  │  └─ route.ts
  └─ revoke/
     └─ route.ts

tests/
  └─ nfc-generator.test.ts
```

---

### Phase 2: Public Emergency Access (Week 2)

**Objectives:**
- Implement tap-to-access flow
- OTP generation & verification
- Data filtering (public vs. full)
- Anomaly detection

**Deliverables:**
1. GET `/api/emergency/nfc/[token]` (public profile)
2. POST `/api/emergency/nfc/request-full-access` (OTP initiation)
3. POST `/api/emergency/nfc/verify-otp` (OTP validation)
4. GET `/api/emergency/nfc/[token]/full` (full profile)
5. Anomaly detection logic
6. Rate limiting per IP

**Files Created:**
```
apps/web/lib/
  ├─ emergencyNfcFilters.ts
  └─ anomalyDetector.ts

apps/web/app/api/emergency/nfc/
  ├─ [token]/
  │  └─ route.ts
  ├─ request-full-access/
  │  └─ route.ts
  ├─ verify-otp/
  │  └─ route.ts
  └─ [token]/full/
     └─ route.ts
```

---

### Phase 3: Patient Dashboard (Week 2-3)

**Objectives:**
- Components for managing NFC tokens
- Access logs viewer
- Doctor pre-authorization UI

**Deliverables:**
1. `EmergencyNfcCard` component
2. `CreateNfcTokenModal` component
3. `NfcAccessLogsPanel` component
4. GET `/api/emergency/nfc/tokens`
5. GET `/api/emergency/nfc/logs`
6. POST `/api/emergency/nfc/authorize-doctor`
7. `/app/emergency/nfc` page

**Files Created:**
```
apps/web/components/emergency/
  ├─ EmergencyNfcCard.tsx
  ├─ CreateNfcTokenModal.tsx
  ├─ NfcAccessLogsPanel.tsx
  └─ NfcSettings.tsx

apps/web/app/
  ├─ emergency/nfc/
  │  └─ page.tsx
  └─ api/emergency/nfc/
     ├─ tokens/
     │  └─ route.ts
     ├─ logs/
     │  └─ route.ts
     └─ authorize-doctor/
        └─ route.ts
```

---

### Phase 4: Public Emergency UI (Week 3-4)

**Objectives:**
- Responsive emergency profile pages
- OTP verification UI
- Mobile optimization
- Accessibility (WCAG A)

**Deliverables:**
1. `EmergencyProfilePublic` component
2. `OtpVerificationFlow` component
3. `/emergency/public/nfc/[token]` page
4. Mobile responsiveness testing
5. Accessibility audit

**Files Created:**
```
apps/web/components/emergency/
  ├─ EmergencyProfilePublic.tsx
  └─ OtpVerificationFlow.tsx

apps/web/app/
  └─ emergency/
     └─ public/
        └─ nfc/
           └─ [token]/
              └─ page.tsx

tests/
  ├─ emergency-profile.e2e.test.ts
  └─ otp-flow.e2e.test.ts
```

---

### Phase 5: Testing & Hardening (Week 4)

**Objectives:**
- Security audit
- Load testing
- Edge case testing
- End-to-end testing

**Deliverables:**
1. Security review against OWASP top 10
2. Load test: 1000 concurrent taps
3. Geolocation accuracy testing
4. OTP delivery reliability
5. Mobile browser compatibility matrix
6. End-to-end test suite

**Testing Scenarios:**
- Create token → Tap → View public → Request OTP → Verify → View full
- Pre-auth doctor → Tap → View full (no OTP)
- Revoke token → Tap → 410 Gone
- Anomaly detection → Multiple taps → Flag as suspicious
- Brute force → 3 failed OTPs → Lockout

---

## Testing Strategy

### Unit Tests

```typescript
// Token Generation
describe('NFC Token Generation', () => {
  it('should generate 256-bit random token', () => {});
  it('should hash token with SHA256', () => {});
  it('should never return raw token after creation', () => {});
  it('should create unique tokens', () => {});
});

// OTP Generation
describe('OTP Generation', () => {
  it('should generate 6-digit code', () => {});
  it('should hash OTP with SHA256', () => {});
  it('should expire after 10 minutes', () => {});
});

// Data Filtering
describe('Emergency Profile Filtering', () => {
  it('should return only public fields for public view', () => {});
  it('should return full profile only with valid OTP', () => {});
  it('should remove policy numbers from public view', () => {});
});

// Anomaly Detection
describe('Anomaly Detection', () => {
  it('should flag rapid succession taps', () => {});
  it('should flag geographic jump', () => {});
  it('should flag repeated failed OTPs', () => {});
});
```

### Integration Tests

```typescript
// Full Tap-to-Access Flow
describe('NFC Emergency Access Flow', () => {
  it('should create token → retrieve profile → request OTP → verify → unlock full', async () => {});
  it('should pre-authorized doctor bypass OTP', async () => {});
  it('should revoke token immediately', async () => {});
  it('should log all access attempts', async () => {});
  it('should send email notifications', async () => {});
});
```

### End-to-End Tests

```typescript
// Browser-based testing
describe('Emergency Profile E2E', () => {
  it('should render public profile on tap', async () => {
    const page = await browser.newPage();
    await page.goto('https://medora.buzz/emergency/nfc/token123');
    
    const bloodGroup = await page.textContent('[data-test="blood-group"]');
    expect(bloodGroup).toContain('O+');
    
    const allergies = await page.textContent('[data-test="allergies"]');
    expect(allergies).toContain('Penicillin');
  });
  
  it('should send OTP on request', async () => {
    await page.click('[data-test="request-full-access"]');
    // Verify email sent
  });
  
  it('should unlock full profile on OTP verification', async () => {
    // Enter OTP
    // Verify full fields visible
  });
});
```

---

## Risk Analysis

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| **OTP Email Delivery Failure** | High | Medium | Implement retry logic (3 attempts); fallback SMS option; support resend |
| **Token Compromise** | Critical | Low | Use 256-bit random tokens; rate limiting; token revocation |
| **Geographic Spoofing** | Medium | Low | Implement impossible-travel detection; manual review of anomalies |
| **Rate Limiter Bypass** | Medium | Low | Use distributed rate limiting (Redis); log all bypass attempts |
| **Public Profile Data Leak** | Low | Low | Sanitize fields; separate collections; audit access |
| **Mass OTP Brute Force** | Medium | Low | IP-based rate limiting; account lockout after N failures |
| **Doctor Pre-auth Abuse** | Medium | Medium | Require patient explicit per-doctor authorization; time-bound grants |
| **Geolocation Precision Issues** | Low | Medium | Use IP-based + optional browser location; document fallbacks |

---

## Timeline & Resources

### Timeline

| Phase | Duration | Start | End |
|---|---|---|---|
| **Phase 1: Foundation** | 5 days | Day 1 | Day 5 |
| **Phase 2: Public Access** | 5 days | Day 6 | Day 10 |
| **Phase 3: Dashboard** | 5 days | Day 11 | Day 15 |
| **Phase 4: Public UI** | 5 days | Day 16 | Day 20 |
| **Phase 5: Testing** | 5 days | Day 21 | Day 25 |
| **Deployment & Documentation** | 3 days | Day 26 | Day 28 |
| **Total** | **28 days** | | |

### Resources Required

**Backend Development:** 1 FTE
- Database schema & migrations
- API endpoints
- Token/OTP logic
- Email integration

**Frontend Development:** 1 FTE
- Components
- Pages
- State management
- Mobile optimization

**QA/Testing:** 0.5 FTE
- Test automation
- Security testing
- Load testing
- Mobile testing

**DevOps/Deployment:** 0.5 FTE
- Deploy to Render
- Monitor performance
- Manage secrets/encryption keys

---

## Success Metrics

### Functional Metrics

| Metric | Target | How Measured |
|---|---|---|
| Patient token creation time | <2 minutes | Time from "Create Card" click to QR code display |
| Doctor profile view time | <5 seconds | Time from tap to profile render (after first load) |
| OTP delivery time | <30 seconds | Time from request to email received |
| OTP verification time | <2 minutes | Time from email receipt to full access granted |
| Token revocation effectiveness | Instant | Next tap returns 410 immediately |

### Privacy Metrics

| Metric | Target | How Measured |
|---|---|---|
| Unintended full data exposure | 0 | Audit logs + monitoring |
| OTP brute force attempts stopped | 100% | Failed attempts ≥4 → lockout |
| Anomalous access flagged | >95% | Manual review of flagged accesses |
| Patient notification rate | 100% | Email sent for all access attempts |

### Performance Metrics

| Metric | Target | How Measured |
|---|---|---|
| Public profile API latency | <200ms | API response time monitoring |
| OTP verification success rate | >99% | Failed OTP attempts / total attempts |
| Rate limiting enforced | 100% | No requests exceed limits |
| Mobile page load time (3G) | <2 seconds | Lighthouse/WebPageTest |

---

## Deployment Checklist

- [ ] Database migrations applied (collections created, indexes)
- [ ] Environment variables configured (AI_BASE_URL, INTERNAL_AUTH_TOKEN, etc.)
- [ ] Email templates tested (OTP delivery)
- [ ] Geolocation service verified
- [ ] Rate limiting Redis configured
- [ ] HTTPS/TLS certificates valid
- [ ] Monitoring & alerting set up
- [ ] Security audit completed
- [ ] Load testing passed (1000 concurrent users)
- [ ] Documentation updated
- [ ] Support team trained
- [ ] Deployment to production
- [ ] Post-deployment monitoring (24/7 for first week)

---

## Next Steps

1. **Approval**: Review this plan with stakeholders
2. **Resource Allocation**: Assign backend, frontend, QA, DevOps
3. **Sprint Planning**: Break phases into 2-week sprints
4. **Database Setup**: Create collections in staging environment
5. **Development Kickoff**: Start Phase 1
6. **Weekly Reviews**: Check progress against timeline
7. **Security Audit**: 2 weeks before launch
8. **Soft Launch**: Beta testing with select users
9. **Full Production Launch**: After beta feedback integration

---

## Appendix: Glossary

| Term | Definition |
|---|---|
| **NFC** | Near Field Communication - wireless protocol for short-distance data transfer |
| **OTP** | One-Time Password - 6-digit code valid for limited time (10 mins) |
| **Pre-Auth** | Pre-authorized doctor who can bypass OTP requirement |
| **Anomaly** | Unusual access pattern (rapid taps, geographic jump, brute force) |
| **Token Revocation** | Patient permanently disables a token; all future taps rejected |
| **Public Profile** | Limited emergency data visible without authentication |
| **Full Profile** | Complete medical records visible only after OTP verification |
| **Geolocation** | IP-derived location (city, country, ISP) |
| **Rate Limiting** | Maximum number of requests per time period |
| **TTL** | Time-To-Live - database documents auto-deleted after expiry |

---

**Document End**

---

**Version History**

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-04-30 | Initial comprehensive plan |

