# MediLocker V2 — Complete Product & System Specification

## Overview
MediLocker is a patient-controlled, AI-assisted health intelligence platform that transforms fragmented medical data into secure, understandable, and actionable insights without compromising privacy or clinical authority. This document provides an exhaustive, implementation-ready specification covering product goals, architecture, data models, APIs, pipelines, security, compliance, operations, and delivery.

> **Implementation status (current codebase)**
>
> This specification intentionally describes the full MediLocker V2 vision. The current repository implements a focused subset of this scope:
> - **Implemented today**
>   - Next.js web app under `apps/web` with:
>     - Auth via NextAuth (Google OAuth set up; additional providers are planned).
>     - Secure document upload to Supabase Storage, version tracking, soft-delete/bin.
>     - AI-assisted document extraction and **lab report summaries** (including retry summary with structured output and disclaimers).
>     - Basic profile auto-creation for the signed-in user.
>   - Python FastAPI AI service under `apps/ai` with routers for: `ocr`, `classify`, `summarize`, `trends`, `recommend`, `explain`, and `extract`.
>   - MongoDB schemas and indexes under `packages/db` for `users`, `profiles`, `documents`, `documentVersions`, `classification`, `ocrOutputs`, `jobs`, `summaries`, `alerts`, `shares`, `sessions`, and more.
>   - A Mongo-backed `jobs` collection powering async ingestion/OCR/classification/summarization pipelines.
> - **Scaffolded / planned but not yet fully wired**
>   - Rich doctor/admin dashboards, emergency access flows, claims/health scores/insights UIs.
>   - Node-side Redis/BullMQ producers in `packages/infra/queues` (folder exists but producers are not yet implemented).
>   - Full JWT-based access/refresh rotation from `packages/auth/*` (web tier currently uses NextAuth sessions as the primary mechanism).
>
> When in doubt, treat this document as the **target design**, and refer to the code under `apps/` and `packages/` for the exact current behavior.

## Guiding Principles
- Patient-first: Full control over data, sharing, and portability.
- Safety-led AI: Assistive, explainable, non-diagnostic recommendations only.
- Privacy by design: Least privilege, encryption, auditability, revocation.
- Reliability at scale: Stateless services, async workloads, graceful failure.
- Modular AI: OCR, summarization, trend analysis, and recommendations decoupled.
- Inclusivity: Plain-language content, elder-friendly flows, multilingual readiness.
- Interoperability: Clear schemas, standard formats, portable exports.

## Technology Stack
- Frontend: Next.js (App Router)
- Backend APIs: Next.js Route Handlers (Node) + Python FastAPI (AI services)
- Authentication: NextAuth (OAuth 2.0 providers such as Google; additional providers can be added incrementally)
- Authorization: Role-based access derived from session identity (JWT helpers in `packages/auth/*` are available for internal/service tokens and future expansion)
- Database: MongoDB Atlas
- Storage: Supabase Storage (S3-compatible) with server-side encryption
- AI Stack: OCR, NLP summarization, time-series trend analysis, recommendation engines
- Queues/Workers: Mongo-backed `jobs` collection for ingestion/classification/summarization, plus Celery-based workers for AI pipelines (Node-side Redis/BullMQ producers are planned but not yet wired)
- Observability: OpenTelemetry, centralized logs, metrics, traces; Sentry/Elastic
- CI/CD: GitHub Actions
- Infra-as-code: Terraform (or Pulumi)

## Deployment Topology
- Next.js application (SSR + route handlers) — deployed on a managed platform or container orchestration (e.g., Vercel + separate Node container for route handlers as needed).
- Python FastAPI service — containerized, deployed on a managed runtime (e.g., Azure App Service, AWS ECS/Fargate, or Kubernetes).
- MongoDB Atlas — managed cluster with appropriate network controls.
- S3-compatible storage — server-side encryption (SSE-KMS), private buckets, pre-signed URLs.
- Redis — managed (e.g., Redis Enterprise/Elasticache) for queues and caching.
- CDN — for static assets, optional image acceleration.

## Environments & Configuration
- Environments: `dev`, `staging`, `prod`.
- Secrets stored in a secure manager (AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault).
- Environment variables:
  - OAuth client IDs/secrets per provider.
  - JWT signing keys (rotated, stored in KMS or secrets manager).
  - MongoDB URI, Redis URI, S3 endpoints/buckets.
  - FastAPI base URL; AI service credentials if any.
  - Feature flags for AI fallbacks and emergency mode.

## Identity, Authentication & Authorization
- OAuth Providers: Google, GitHub, and institutional OIDC/SAML (via an adapter).
- Identity Mapping: Normalize provider profile → `User` with canonical `identityId`.
- JWT Sessions:
  - Access token: short TTL (e.g., 15 minutes), includes roles/permissions and selected profile context.
  - Refresh token: longer TTL (e.g., 30 days), rotation on each refresh.
  - Refresh token hashes stored and rotated per session; revocation via blocklist.
- RBAC Roles: `patient`, `guardian`, `doctor`, `admin`, `system-worker`.
- Session Rotation & Revocation: On refresh, issue new tokens, revoke old; refresh tokens hashed in DB; explicit session kill supported.
- Auditability: All access and sensitive actions logged with actor, target, and reason.

### Auth Flow (Pipeline)
1. OAuth Login → Provider callback returns user info.
2. Identity Mapping → Lookup or create `User` with normalized identifiers.
3. JWT Issue → Access + Refresh; set secure HTTP-only cookies.
4. Role Check → Enforce RBAC via access token claims.
5. Access → Proceed to protected resources per role and resource ACLs.
6. Audit → Record login and subsequent sensitive actions.

## Data Model (MongoDB)
Design with clear collections, indexes, references. All sensitive fields encrypted at rest.

- `users`
  - `id`, `email`, `name`, `identityProvider`, `identityId`, `roles[]`, `createdAt`, `status`
  - Index: `email` unique; `identityProvider + identityId` unique

- `profiles` (health identities; one `User` can have multiple profiles — self and dependents)
  - `id`, `userId`, `type` (`self|dependent`), `displayName`, `bloodGroup`, `allergies[]`, `conditions[]`, `emergencyData`, `vitalIdentifiers`, `guardians[]`, `createdAt`, `updatedAt`
  - Index: `userId`, `guardians.userId`

- `documents`
  - `id`, `profileId`, `ownerUserId`, `docType` (`prescription|lab|scan|discharge|other`), `storageKey`, `versionId`, `metadata`, `tags[]`, `status`, `createdAt`
  - Index: `profileId`, `docType`, `createdAt`

- `documentVersions`
  - `id`, `documentId`, `storageKey`, `hash`, `size`, `mimeType`, `createdAt`
  - Index: `documentId`, `createdAt`

- `classification`
  - `id`, `documentId`, `ocrText`, `detectedType`, `confidence`, `inferredTags[]`, `overrides`, `createdAt`
  - Index: `documentId`

- `labStructured`
  - `id`, `documentId`, `panel`, `observations[]` (name, value, unit, refRange, flags), `createdAt`
  - Index: `documentId`, `panel`

- `summaries`
  - `id`, `documentId` (or `profileId` for corpus summary), `type` (`doc|history`), `content`, `explanations[]`, `confidence`, `createdAt`

- `trends`
  - `id`, `profileId`, `metricKey`, `series[]` (timestamp, value, flags), `analysis` (rising|falling|stable), `createdAt`, `updatedAt`
  - Index: `profileId + metricKey`

- `insights`
  - `id`, `profileId`, `signals[]`, `recommendations[]`, `labels`, `confidence`, `createdAt`

- `timeline`
  - `id`, `profileId`, `groupingKey` (condition|episode), `items[]` (docId, type, date, tags), `createdAt`, `updatedAt`

- `shares`
  - `id`, `ownerUserId`, `profileId`, `granteeType` (`doctor|email|institution-user`), `permissions` (view|upload|summary), `scope` (docIds[]|types), `expiresAt`, `status`, `createdAt`
  - Index: `profileId`, `expiresAt`

- `doctors`
  - `id`, `name`, `email`, `clinicInfo`, `verificationStatus`, `createdAt`

- `alerts`
  - `id`, `profileId`, `type` (`followup|medication|abnormal|preventive`), `eventTime`, `payload`, `status`, `createdAt`
  - Index: `profileId + type + status`

- `redundancyChecks`
  - `id`, `profileId`, `testName`, `window`, `occurrences[]`, `createdAt`

- `claims`
  - `id`, `profileId`, `documents[]`, `status`, `bundleKey`, `createdAt`

- `healthScores`
  - `id`, `profileId`, `metrics`, `score`, `labels`, `createdAt`

- `audits`
  - `id`, `actorId`, `action`, `target`, `timestamp`, `metadata`
  - Index: `actorId`, `timestamp`

- `adminEvents`
  - `id`, `actorId`, `eventType`, `payload`, `timestamp`

- `sessions`
  - `id`, `userId`, `refreshTokenHash`, `issuedAt`, `expiresAt`, `revokedAt`, `metadata`
  - Index: `userId`, `expiresAt`

## Storage Model (S3-compatible)
- Buckets (private): `medilocker-docs` for originals; `medilocker-derivatives` for OCR text and generated artifacts.
- Keying:
  - Originals: `profiles/{profileId}/documents/{documentId}/versions/{versionId}/{filename}`
  - Derivatives: `profiles/{profileId}/documents/{documentId}/classification/{timestamp}.json`
- Versioning: Use object versioning; maintain `documentVersions` in DB for immutable linkage.
- Encryption: SSE-KMS; optionally client-side envelope encryption for high-sensitivity docs.
- Access: Pre-signed URLs for upload/download; enforce permissions server-side.

## API Design
### Next.js Route Handlers (Node)
- Authentication endpoints: OAuth redirect/callback, token refresh, logout, session revoke.
- Profiles: CRUD for `profiles`, guardian linking, dependent isolation rules.
- Documents: Upload initiation (pre-signed), finalize, metadata patch, listing, download, deletion (soft delete; immutable originals).
- Sharing: Create share grants, list/revoke, validate access, expiry enforcement.
- Doctor Dashboard: Access shared records, upload prescriptions, view AI summaries.
- Timeline: Fetch grouped chronological views.
- Alerts: Create/list/update alert status; notification triggers.
- Claims: Tag docs, generate export bundles.
- Health Score: Generate/fetch snapshot.
- Admin: Doctor verification workflows, anomaly monitoring endpoints.
- Emergency Access: Token/QR generation, limited data exposure, audit logging.

Conventions:
- REST-ish JSON; use RPC-styled endpoints for batch/complex operations as needed.
- Pagination: `limit`, `cursor/nextToken`.
- Idempotency: `Idempotency-Key` header for uploads and share creation.
- Error model: `code`, `message`, `details`.
- Content types: JSON; multipart only for form initiation.

### Python FastAPI (AI Services)
- OCR: Accept storage key or pre-signed URL; return text + layout.
- Classification: Input OCR text → type, tags, confidence.
- Summarization: Input structured lab data or corpus → plain-language summary + explanations.
- Trend Analysis: Input timeseries → rising/falling/stable + confidence.
- Recommendations: Input trend signals + rules → non-diagnostic guidance.
- Explainability: Wrap outputs with rationale, references, confidence.

Security:
- Service-to-service auth via signed JWT or mTLS.
- Rate limits and cost controls for AI operations.

## Feature Specifications & Pipelines
Each feature states purpose, inputs, pipeline, outputs, permissions, UX, edge cases.

1. Authentication & Identity
- Purpose: Secure OAuth login, JWT sessions, RBAC.
- Inputs: Provider tokens.
- Pipeline: OAuth → Identity → JWT → Role Check → Access → Audit.
- Outputs: Access/Refresh tokens; session records.
- Permissions: Public for login; protected thereafter.
- Edge cases: Provider unlink/merge; revocation; concurrent sessions.

2. User Profiles & Health Identity
- Purpose: Store health basics and emergency info.
- Inputs: User edits.
- Pipeline: Validation → Encrypted Storage.
- Outputs: `profiles` records.
- Permissions: Owner and guardians per isolation rules.
- Edge cases: Missing data; multi-language content.

3. Family & Dependent Profiles
- Purpose: Isolate dependent data; guardian controls.
- Inputs: Guardian actions.
- Pipeline: Guardian Validation → Profile-Level Access.
- Outputs: `profiles` with guardian links.
- Permissions: Strict isolation; guardians only as configured.
- Edge cases: Multiple guardians; revocation; disputes.

4. Medical Document Management
- Purpose: Secure uploads for medical docs; immutable versions.
- Inputs: Files via pre-signed upload; metadata.
- Pipeline: Upload → Validation → Secure Storage → Metadata Indexing.
- Outputs: `documents`, `documentVersions`.
- Permissions: Profile owner; guardian; shared as allowed.
- Edge cases: Corrupt files; large scans; retries with idempotency.

5. Smart Document Classification
- Purpose: Auto-detect type, infer tags, allow override.
- Inputs: OCR text, metadata.
- Pipeline: OCR → Classification Model → Tag Inference → User Override.
- Outputs: `classification` rows; updated `documents`.
- Permissions: Owner/doctor view; manual override by owner.
- Edge cases: Low confidence; ambiguous docs; fallback to manual.

6. Lab Report Summaries
- Purpose: Highlight abnormal/borderline/normal values; explain in plain language.
- Inputs: Structured lab data.
- Pipeline: Range Comparison → Explanation Generator.
- Outputs: `summaries` type `doc`.
- Permissions: Owner, doctor if shared.
- Edge cases: Missing units; varying reference ranges; pediatric vs adult ranges.

7. Trend Analysis Across Reports
- Purpose: Detect time-series patterns for metrics.
- Inputs: Historical lab observations.
- Pipeline: Historical Data → Trend Engine → Pattern Output.
- Outputs: `trends` entries.
- Permissions: Owner; doctor if shared.
- Edge cases: Sparse data; outliers; unit normalization over time.

8. Health Insights & Recommendations
- Purpose: Non-diagnostic guidance and prompts.
- Inputs: Trend signals.
- Pipeline: Trend Signals → Rule Engine → Recommendation Output.
- Outputs: `insights` entries.
- Permissions: Owner; doctor.
- Edge cases: Conflicting signals; low confidence; conservative default.

9. Medical History Summaries
- Purpose: Condensed corpus summaries.
- Inputs: Document corpus.
- Pipeline: Corpus → Summary Model.
- Outputs: `summaries` type `history`.
- Permissions: Owner; doctor.
- Edge cases: Duplicate content; conflicting docs.

10. Medical Timeline View
- Purpose: Chronological visual timeline grouped by condition/episode.
- Inputs: Sorted metadata.
- Pipeline: Sorted Metadata → Timeline Renderer.
- Outputs: `timeline` items.
- Permissions: Owner; doctor.
- Edge cases: Missing dates; grouping heuristics.

11. Secure Sharing & Access Control
- Purpose: Time-bound sharing with fine-grained permissions.
- Inputs: Share request.
- Pipeline: Share Request → Access Grant → Expiry Enforcement.
- Outputs: `shares` entries.
- Permissions: Owner grants; grantee views.
- Edge cases: Expiry; revocation; scope updates.

12. Doctor Interface & Clinical View
- Purpose: Dedicated clinical view for doctors.
- Inputs: Doctor Auth; grants.
- Pipeline: Doctor Auth → Grant Validation → Clinical Dashboard.
- Outputs: Restricted record views; upload capability.
- Permissions: Doctor only via shares.
- Edge cases: Unverified doctor; clinic multi-user.

13. Doctor-Focused Decision Support
- Purpose: Pre-visit summaries; abnormal cluster highlighting; missing/outdated report detection.
- Inputs: Patient data.
- Pipeline: Patient Data → Clinical Insights Engine.
- Outputs: Visual cues, summaries.
- Permissions: Doctor via shares.
- Edge cases: Insufficient data; stale insights.

14. Emergency Access Mode
- Purpose: Token/QR-based limited critical data exposure, time-limited.
- Inputs: Emergency token.
- Pipeline: Emergency Token → Limited Data Access → Audit.
- Outputs: Minimal profile view (blood group, allergies, emergency notes).
- Permissions: Emergency scope only.
- Edge cases: Token misuse; instant revocation; UI warnings.

15. Alerts & Smart Reminders
- Purpose: Follow-up, refill, abnormal result, preventive prompts.
- Inputs: Event triggers.
- Pipeline: Event Trigger → Notification Engine.
- Outputs: `alerts` rows; notifications.
- Permissions: Owner controls.
- Edge cases: Notification throttling; opt-out; locale.

16. Duplicate & Redundancy Detection
- Purpose: Identify repeated tests within short intervals.
- Inputs: Document history.
- Pipeline: Document History → Redundancy Detector.
- Outputs: `redundancyChecks` entries; warnings.
- Permissions: Owner.
- Edge cases: Intentional repeats; evolving conditions.

17. Insurance & Claim Support
- Purpose: Tag claims, export bundles, timeline tracking for insurers.
- Inputs: Tagged docs.
- Pipeline: Tagged Docs → Claim Bundle Generator.
- Outputs: `claims` entries; bundle in storage.
- Permissions: Owner; shared with insurer via grants.
- Edge cases: Format requirements; sensitive redactions.

18. Health Score & Snapshot
- Purpose: Non-clinical snapshot based on consistency and trends.
- Inputs: Trend metrics.
- Pipeline: Trend Metrics → Scoring Engine.
- Outputs: `healthScores` entries.
- Permissions: Owner.
- Edge cases: Overfitting; clearly label as non-diagnostic.

19. AI Safety & Explainability
- Purpose: Explainable outputs with confidence, rationale, and references.
- Inputs: Model outputs.
- Pipeline: Model Output → Explanation Layer.
- Outputs: Explanations included with AI features.
- Permissions: Owner/doctor.
- Edge cases: Low confidence → default to human-readable caveats.

20. Security & Privacy Controls
- Purpose: Audit logs, access history, one-tap revocation, emergency override controls.
- Inputs: User actions.
- Pipeline: User Action → Security Enforcement → Audit.
- Outputs: `audits`, session changes.
- Permissions: Owner/admin.
- Edge cases: Mis-click revocation; confirm flows.

21. Data Ownership & Portability
- Purpose: Full data export, permanent deletion, compliance lifecycle.
- Inputs: User requests.
- Pipeline: User Request → Data Export/Delete Pipeline.
- Outputs: Export bundle; deletion confirmation.
- Permissions: Owner.
- Edge cases: Legal holds; guardian dependencies.

22. Admin & Trust Controls
- Purpose: Doctor verification, abuse detection, anomaly monitoring, policy enforcement.
- Inputs: Admin actions.
- Pipeline: Admin Action → Verification/Monitoring.
- Outputs: `adminEvents` entries; flags.
- Permissions: Admin.
- Edge cases: False positives; appeals.

23. System Intelligence & Reliability
- Purpose: Stateless ops, graceful failure, background AI processing.
- Inputs: Jobs.
- Pipeline: Async Queue → Worker Processing.
- Outputs: Derivatives, summaries, trends.
- Permissions: System-worker.
- Edge cases: Replays; retries; deduplication.

24. AI-Ready Modular Design
- Purpose: Isolated services with safe non-AI fallbacks.
- Inputs: Service boundaries.
- Pipeline: Service Boundary → Fallback Logic.
- Outputs: Deterministic fallbacks when AI unavailable.
- Permissions: N/A.
- Edge cases: Cost spikes; rate limits.

25. Accessibility & Inclusivity
- Purpose: Plain language, elderly-friendly UI, multilingual, low-bandwidth.
- Inputs: Content and UI.
- Pipeline: Content Simplifier → Locale/UX Adapter.
- Outputs: Accessible interfaces.
- Permissions: N/A.
- Edge cases: Font sizes, contrast, offline scenarios.

## Authorization & Resource Access
- Resource-level checks: Profile-scoped; share-scoped; operation-specific.
- Guardian permissions: Explicit grants per dependent; upload/view parameters.
- Doctor access: Limited to shared scope; no lateral access.
- Emergency tokens: Separate policy and ACL; auto-expiry; minimal surface.

## Background Processing & Queues
- Node (BullMQ) for document ingestion orchestration and notifications.
- Python (Celery) for OCR, classification, summarization, trend analysis, recommendations.
- Deduplication: Job keys per document/version.
- Retries: Exponential backoff with caps; DLQ for manual intervention.
- Idempotency: Keys for upload finalization and share creation.

## AI Pipelines & Fallbacks
- OCR: Prefer server-side OCR engines; fallback to client-assisted upload of text when OCR fails.
- Classification: Confidence threshold; below threshold → require user confirmation.
- Summarization: Template-based deterministic summaries as fallback to ML.
- Trends: Basic statistical slopes and moving averages as fallback.
- Recommendations: Rule-based engine remains primary; ML augments.
- Explainability: Always include confidence and rationale; show references or rules used.

## Security & Privacy
- Encryption: SSE-KMS for storage; TLS everywhere; DB encryption at rest.
- Key Management: Managed KMS; rotation policies; audit key usage.
- Secrets: Store in secret manager; never in repo.
- Audit Logs: Comprehensive for auth, access, sharing, emergency mode, admin actions.
- Consent: Explicit shares and revocations; transparent access history.
- Threat Model: Mitigate OWASP Top 10; secure file handling; anti-abuse patterns.
- PII/PHI Handling: Minimum necessary; masking/redaction in logs; structured access.

## Compliance & Data Lifecycle
- Data Subject Rights: Export, delete, rectification (where applicable), revoke sharing.
- Retention: Configurable per region/policy; deletion workflows with tombstones and safe-erase for storage.
- Portability: Export structured JSON + raw files; ZIP bundles.
- Legal Holds: Admin-set flags preventing deletion.

## Performance & Scalability
- Stateless services; scale horizontally.
- Caching: Redis for hot queries; CDN for static.
- Rate Limits: Per-user and per-service limits; protect AI costs.
- Backpressure: Queue length monitoring; job shedding under duress.
- Resource Quotas: Per tenant limits for storage and compute.

## Reliability & SRE
- SLIs/SLOs: Availability, latency, OCR success rate, job completion time.
- Graceful Degradation: Fallbacks for AI-heavy features; minimal core remains available.
- Disaster Recovery: Backups for MongoDB and storage; tested restore procedures.
- Incident Response: Runbooks for queue stalls, storage errors, auth outages.

## Doctor & Clinical UX
- Clean access to shared records only.
- Pre-visit summary and abnormal clusters.
- Missing/outdated report detection prompts.
- Prescription upload with version-safe storage.

## Emergency Mode
- Token/QR generation with short TTL (e.g., 10 minutes) and single-use.
- Minimal data scope: blood group, allergies, critical notes.
- Prominent warnings and audit.
- One-tap revoke; auto-expiry.

## Notifications & Reminders
- Channels: Email, in-app; SMS optional.
- Scheduling: Cron-like worker jobs.
- Throttling: Avoid spam; consolidate alerts.
- Locales: Multilingual content templates.

## Accessibility & Inclusivity Guidelines
- Plain-language summaries and recommendations.
- Large touch targets; high contrast modes.
- Font scaling; screen reader support; focus order.
- Multilingual content; low-bandwidth hints (defer heavy images).

## Observability & Monitoring
- Logging: Structured JSON logs; sensitive data masked.
- Metrics: Request rates, latencies, queue depths, error rates, AI cost metrics.
- Tracing: Distributed traces across Node and Python services.
- Alerts: On-call notifications for SLO breaches; anomaly detection for abusive usage.

## Testing & QA Strategy
- Unit Tests: Business logic, rules engine, classification overrides.
- Integration Tests: Auth flows, document ingestion, sharing enforcement.
- E2E Tests: Core user journeys (upload → classify → summarize → share).
- AI Evaluation: Golden sets for OCR/summaries; confidence thresholds.
- Performance Tests: Upload/download throughput; queue processing times.
- Security Tests: Authz bypass attempts; CSRF; injection; storage access.

## DevOps & Deployment
- CI/CD: Build, test, lint; separate pipelines for Node and Python.
- Rollouts: Canary; feature flags for risky features.
- Infra: Terraform modules for MongoDB, Redis, S3, services.
- Backups: Scheduled DB backups; storage lifecycle policies.
- Secrets: Managed per environment; rotation cadence.

## API Endpoint Examples (Representative)
- Auth
  - `POST /api/auth/login/:provider` → redirect URL
  - `GET /api/auth/callback/:provider` → issue tokens
  - `POST /api/auth/refresh` → rotate refresh
  - `POST /api/auth/logout` → revoke session

- Profiles
  - `GET /api/profiles` → list
  - `POST /api/profiles` → create
  - `PATCH /api/profiles/:id` → update

- Documents
  - `POST /api/documents/upload/init` → pre-signed URL
  - `POST /api/documents/upload/finalize` → commit version
  - `GET /api/documents?profileId=...` → list
  - `GET /api/documents/:id/download` → pre-signed download

- Sharing
  - `POST /api/shares` → create grant
  - `GET /api/shares` → list
  - `DELETE /api/shares/:id` → revoke

- Emergency
  - `POST /api/emergency/token` → create
  - `GET /api/emergency/:token` → minimal data

- AI Service (FastAPI)
  - `POST /ai/ocr` → { storageKey } → { text, confidence }
  - `POST /ai/classify` → { text } → { type, tags, confidence }
  - `POST /ai/summarize` → { structuredData } → { summary, explanations }
  - `POST /ai/trends` → { series } → { pattern, confidence }
  - `POST /ai/recommend` → { signals } → { recommendations }

## Permissions Matrix (Condensed)
- Patient (owner): Full access to own profiles and documents.
- Guardian: Access to dependent profiles per configured scope.
- Doctor: Access only via shares; upload prescriptions to shared scope.
- Admin: Verification and monitoring; no patient data without explicit need and policy.
- System-worker: Background processing with least privilege.

## Edge Cases & Safeguards
- Ambiguous classification: Require confirmation; allow override.
- Unit mismatches: Normalize; mark uncertainty.
- Token theft risks: Short TTL + revocation; refresh rotation.
- Emergency misuse: Single-use tokens; audit; visible revocation.
- Large files: Chunked uploads; virus scanning pipeline.

## Roadmap & Delivery Plan
- Phase 1: Core auth, profiles, uploads, secure storage, basic sharing.
- Phase 2: OCR + classification + summaries; timeline; doctor portal.
- Phase 3: Trends, insights, recommendations; redundancy detection; alerts.
- Phase 4: Emergency access; claims support; health score; admin tooling.
- Phase 5: Accessibility refinements; multilingual; performance & SRE hardening.

## Runbooks (Operational)
- Queue stall: Inspect dead-letter; restart worker; drain backlog.
- Storage errors: Rotate credentials; verify KMS; fall back to cached metadata.
- Auth outage: Disable provider; allow cached sessions; message users.
- AI cost spike: Rate limit; switch to fallbacks; pause non-critical jobs.

## Implementation Notes
- Keep services stateless; store minimal session state in DB.
- Idempotent operations wherever retry is possible.
- Consistent request IDs and correlation IDs across services.
- Strict schema validation at API edges.
- Feature flags for risky changes.

## Glossary
- Profile: A health identity (self or dependent).
- Document: Medical artifact (prescription, lab report, scan, discharge summary).
- Share: Time-bound, fine-grained access grant.
- Emergency Token: Short-lived token exposing minimal critical data.
- Trend: Time-series analysis of lab values.
- Insight: Non-diagnostic recommendation or guidance.

---
This specification is intended to be implementation-ready. It outlines architecture, schemas, endpoints, pipelines, and operational practices to build MediLocker V2 with safety, privacy, and reliability at its core.
