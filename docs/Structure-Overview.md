# MediLocker V2 — Project Structure Overview

This document explains the purpose of the folders and key modules in the MediLocker V2 monorepo **as it exists today**. It is kept in sync with the current codebase and complements the broader vision in MediLocker-V2-Spec.md.

## Root
- [apps](../apps): Application code — user-facing Next.js app and Python FastAPI AI service.
- [packages](../packages): Shared libraries and internal packages (auth helpers, db schemas, infra scaffolding, shared types).
- [scripts](../scripts): Operational scripts and placeholders for future maintenance tooling.
- [tsconfig.json](../tsconfig.json): TypeScript configuration root (extended by app/package-level configs).
- [.eslintrc.json](../.eslintrc.json): Lint configuration for the monorepo.
- [README.md](../README.md): Monorepo introduction and quick-start.

## apps/web — Next.js App Router (Web UI + Web APIs)
Next.js hosts all end-user and clinician-facing UI as well as the non-AI HTTP route handlers.

- Top-level layout and entry:
  - [apps/web/app/layout.tsx](../apps/web/app/layout.tsx): Global layout, font/theme setup.
  - [apps/web/app/page.tsx](../apps/web/app/page.tsx): Root route; redirects into the main experience.

- Major UI route groups (client-facing pages):
  - [apps/web/app/home](../apps/web/app/home): Home/landing experience once signed in.
  - [apps/web/app/documents](../apps/web/app/documents): Document upload, AI extraction review, vault listing, bin, and in-depth document viewer with summaries.
  - [apps/web/app/profile](../apps/web/app/profile): Basic profile management views.
  - [apps/web/app/dashboard](../apps/web/app/dashboard): Patient/guardian dashboard shell.
  - [apps/web/app/doctor](../apps/web/app/doctor): Doctor-facing view (early shell; reads from shared records when wired).
  - [apps/web/app/admin](../apps/web/app/admin): Admin/ops shell for future verifications and monitoring.
  - [apps/web/app/emergency](../apps/web/app/emergency): Shell for emergency access flows (currently minimal UI).
  - [apps/web/app/auth](../apps/web/app/auth): Auth-related pages that integrate with NextAuth.

- API route handlers (server-side endpoints) — key ones:
  - [apps/web/app/api/auth/[...nextauth]/route.ts](../apps/web/app/api/auth/[...nextauth]/route.ts): NextAuth configuration (providers, callbacks, session shaping).
  - [apps/web/app/api/profiles/route.ts](../apps/web/app/api/profiles/route.ts): Profile listing/creation and auto-creation of a default profile for new users.
  - [apps/web/app/api/profile](../apps/web/app/api/profile): Per-profile read/update helpers.
  - [apps/web/app/api/documents/route.ts](../apps/web/app/api/documents/route.ts): Document creation, listing (active/bin), soft-delete, and ingestion job enqueue.
  - [apps/web/app/api/documents/extract/route.ts](../apps/web/app/api/documents/extract/route.ts): Calls the AI service to extract structure from uploaded documents.
  - [apps/web/app/api/documents/download/route.ts](../apps/web/app/api/documents/download/route.ts): Issues signed URLs for viewing/downloading stored documents.
  - [apps/web/app/api/documents/analysis/route.ts](../apps/web/app/api/documents/analysis/route.ts): Fetches classification/observation data for a given document.
  - [apps/web/app/api/documents/summarize/route.ts](../apps/web/app/api/documents/summarize/route.ts): Enqueues a job to re-run OCR and summarization.
  - [apps/web/app/api/documents/fast-summarize/route.ts](../apps/web/app/api/documents/fast-summarize/route.ts): Calls the AI summarizer synchronously and upserts the structured summary into the `summaries` collection (used by the "Retry Summary" button).
  - [apps/web/app/api/documents/bin/route.ts](../apps/web/app/api/documents/bin/route.ts): Moves documents to/from the bin.
  - [apps/web/app/api/documents/purge/route.ts](../apps/web/app/api/documents/purge/route.ts): Permanent deletion endpoint for archived documents.
  - [apps/web/app/api/ocr/route.ts](../apps/web/app/api/ocr/route.ts): Exposes OCR outputs stored in `ocrOutputs` for a document/version pair.
  - [apps/web/app/api/sharing](../apps/web/app/api/sharing): Sharing-related endpoints (grants/revocations; early stages).
  - [apps/web/app/api/emergency](../apps/web/app/api/emergency): Emergency-mode APIs (scaffolded; limited implementation).
  - [apps/web/app/api/alerts](../apps/web/app/api/alerts): Alert listing and status updates (aligned with the `alerts` collection schema).
  - [apps/web/app/api/claims](../apps/web/app/api/claims): Claims-related scaffolding.
  - [apps/web/app/api/admin](../apps/web/app/api/admin): Admin utilities and verification/monitoring stubs.
  - [apps/web/app/api/jobs](../apps/web/app/api/jobs): Job inspection and helpers for the Mongo-backed `jobs` collection.
  - [apps/web/app/api/storage/init/route.ts](../apps/web/app/api/storage/init/route.ts): Storage initialization helpers used by the web tier.

- Libraries (web-tier helpers):
  - [apps/web/lib/auth.ts](../apps/web/lib/auth.ts): NextAuth integration helpers; `getIdentity` exposes `{ actorId, role, session }` to route handlers.
  - [apps/web/lib/db.ts](../apps/web/lib/db.ts): MongoDB client bootstrap and typed `getCollection` helper for server-side handlers.
  - [apps/web/lib/permissions.ts](../apps/web/lib/permissions.ts): Role- and profile-based permission checks (e.g., `canUploadDocument`, `canAccessProfile`).
  - [apps/web/lib/audit.ts](../apps/web/lib/audit.ts): Simple audit logging helper used by sensitive routes (e.g., document upload/download).
  - [apps/web/lib/supabase.ts](../apps/web/lib/supabase.ts): Supabase Storage client wiring.

- Services (cross-service orchestration):
  - [apps/web/services/aiClient.ts](../apps/web/services/aiClient.ts): HTTP client for calling the FastAPI AI service (OCR, classify, summarize, etc.).
  - [apps/web/services/storageClient.ts](../apps/web/services/storageClient.ts): Wrapper around Supabase Storage for uploads/download URLs.
  - [apps/web/services/queueClient.ts](../apps/web/services/queueClient.ts): Placeholder for future Node-side queue integration (currently unused; async work is driven via the Mongo `jobs` collection instead).

- Types (web-layer domain models and NextAuth typing):
  - [apps/web/types/domain.ts](../apps/web/types/domain.ts): Shared interfaces for web handlers (e.g., `DocumentWithSummary`), aligned with the db schemas used at runtime.
  - [apps/web/types/next-auth.d.ts](../apps/web/types/next-auth.d.ts): Augments the NextAuth `Session` and `User` objects with MediLocker-specific fields.

## apps/ai — Python FastAPI (AI Services)
The AI service performs assistive tasks only: OCR, classification, summarization, trend analysis, recommendations, explanations, and structured extraction. It is isolated from the web tier.

- Entrypoint:
  - [apps/ai/main.py](../apps/ai/main.py): FastAPI app assembly; registers routers for `ocr`, `classify`, `summarize`, `trends`, `recommend`, `explain`, and `extract`.

- Routers (endpoints by capability):
  - [apps/ai/routers/ocr.py](../apps/ai/routers/ocr.py): OCR endpoint; accepts a storage key or URL and returns text.
  - [apps/ai/routers/classify.py](../apps/ai/routers/classify.py): Classification endpoint; returns detected type/tags and confidence.
  - [apps/ai/routers/summarize.py](../apps/ai/routers/summarize.py): Lab summarization endpoint; returns structured summary JSON.
  - [apps/ai/routers/trends.py](../apps/ai/routers/trends.py): Trend analysis endpoint; returns simple patterns and metadata.
  - [apps/ai/routers/recommend.py](../apps/ai/routers/recommend.py): Non-diagnostic recommendation endpoint.
  - [apps/ai/routers/explain.py](../apps/ai/routers/explain.py): Explainability endpoint; wraps outputs with rationale and caveats.
  - [apps/ai/routers/extract.py](../apps/ai/routers/extract.py): Structured data extraction from raw documents (used by `/api/documents/extract`).

- Pipelines:
  - [apps/ai/pipelines/ocr_pipeline.py](../apps/ai/pipelines/ocr_pipeline.py)
  - [apps/ai/pipelines/classification_pipeline.py](../apps/ai/pipelines/classification_pipeline.py)
  - [apps/ai/pipelines/summarization_pipeline.py](../apps/ai/pipelines/summarization_pipeline.py)
  - [apps/ai/pipelines/trend_pipeline.py](../apps/ai/pipelines/trend_pipeline.py)
  - [apps/ai/pipelines/recommendation_pipeline.py](../apps/ai/pipelines/recommendation_pipeline.py)
  - [apps/ai/pipelines/explain_pipeline.py](../apps/ai/pipelines/explain_pipeline.py)

- Services and security:
  - [apps/ai/services/storage.py](../apps/ai/services/storage.py): Storage helpers for pipelines.
  - [apps/ai/services/ocr_service.py](../apps/ai/services/ocr_service.py) and related helpers: Encapsulate OCR logic.
  - [apps/ai/services/extraction_service.py](../apps/ai/services/extraction_service.py): Structured extraction logic.
  - [apps/ai/services/db.py](../apps/ai/services/db.py): Mongo client for AI-side persistence when needed.
  - [apps/ai/security/dependencies.py](../apps/ai/security/dependencies.py): Service-level auth (e.g., internal tokens) for FastAPI routes.

- Workers (background AI jobs):
  - [apps/ai/workers/celery_app.py](../apps/ai/workers/celery_app.py): Celery configuration.
  - [apps/ai/workers/tasks.py](../apps/ai/workers/tasks.py): AI job tasks; integrate with `jobs` and other collections.

## packages/db — MongoDB Schema Layer
Type-safe schema files for each MongoDB collection used by the system, including index definitions.
- [packages/db/users.ts](../packages/db/users.ts)
- [packages/db/profiles.ts](../packages/db/profiles.ts)
- [packages/db/documents.ts](../packages/db/documents.ts)
- [packages/db/documentVersions.ts](../packages/db/documentVersions.ts)
- [packages/db/classification.ts](../packages/db/classification.ts) (merged classification + lab-structured observations)
- [packages/db/labStructured.ts](../packages/db/labStructured.ts) (deprecated compatibility shim; new code should use `classification.ts`)
- [packages/db/summaries.ts](../packages/db/summaries.ts)
- [packages/db/ocrOutputs.ts](../packages/db/ocrOutputs.ts)
- [packages/db/jobs.ts](../packages/db/jobs.ts)
- [packages/db/trends.ts](../packages/db/trends.ts)
- [packages/db/insights.ts](../packages/db/insights.ts)
- [packages/db/timeline.ts](../packages/db/timeline.ts)
- [packages/db/shares.ts](../packages/db/shares.ts)
- [packages/db/doctors.ts](../packages/db/doctors.ts)
- [packages/db/alerts.ts](../packages/db/alerts.ts)
- [packages/db/redundancyChecks.ts](../packages/db/redundancyChecks.ts)
- [packages/db/claims.ts](../packages/db/claims.ts)
- [packages/db/healthScores.ts](../packages/db/healthScores.ts)
- [packages/db/audits.ts](../packages/db/audits.ts)
- [packages/db/adminEvents.ts](../packages/db/adminEvents.ts)
- [packages/db/sessions.ts](../packages/db/sessions.ts)
- [packages/db/indexes.ts](../packages/db/indexes.ts): Central index-management utilities (`createAllIndexes`, `getIndexStats`, `checkIndexHealth`, etc.).
- [packages/db/schemaValidation.ts](../packages/db/schemaValidation.ts): JSON schema validation helpers.

## packages/auth — Auth & Security Helpers
Auth utilities that back or supplement NextAuth and future service-to-service auth flows.
- [packages/auth/oauthProviders.ts](../packages/auth/oauthProviders.ts)
- [packages/auth/jwt.ts](../packages/auth/jwt.ts)
- [packages/auth/refreshRotation.ts](../packages/auth/refreshRotation.ts)
- [packages/auth/rbac.ts](../packages/auth/rbac.ts)
- [packages/auth/sessionRevocation.ts](../packages/auth/sessionRevocation.ts)

These modules are largely **scaffolding** today; the web tier currently relies on NextAuth sessions and `apps/web/lib/auth.ts` for most runtime behavior, but the package is the planned home for stricter JWT/refresh and RBAC enforcement.

## packages/shared-types — Shared Types
- [packages/shared-types](../packages/shared-types): Reserved for cross-service TypeScript type definitions. It is currently minimal but intended as a safe place to centralize shared contracts.

## packages/infra — Infrastructure Tooling
Infra-related utilities and configuration.
- [packages/infra/tsconfig.base.json](../packages/infra/tsconfig.base.json): Shared TS base config for infra-related packages.
- [packages/infra/queues](../packages/infra/queues): Currently empty; reserved for future queue producers/consumers (e.g., BullMQ) once introduced.

## scripts — Operational Scripts
- [scripts](../scripts): Reserved for future maintenance tooling such as data migrations, seeders, and exports.

## docs — Documentation
- [docs/MediLocker-V2-Spec.md](../docs/MediLocker-V2-Spec.md): Product and system specification (target design; see the implementation-status section for current coverage).
- [docs/SCHEMA_OPTIMIZATION_GUIDE.md](../docs/SCHEMA_OPTIMIZATION_GUIDE.md): How indexes, TTL, and merged classification schemas are implemented.
- [docs/Structure-Overview.md](../docs/Structure-Overview.md): This document.
- [docs/Team-Collaboration-Plan.md](../docs/Team-Collaboration-Plan.md): Team roles, ownership, and delivery plan.

## Security Boundaries & Responsibilities
- Web-tier auth and scoping: enforced in web route handlers via `apps/web/lib/auth.ts` and `apps/web/lib/permissions.ts` (e.g., `canAccessProfile`, `canUploadDocument`, `canDownloadDocument`).
- AI service auth: guarded by [apps/ai/security/dependencies.py](../apps/ai/security/dependencies.py) using internal tokens.
- Data scoping: `profiles`, `documents`, `sharing`, and `emergency` APIs enforce profile-level and share-scoped access.
- Auditability: Sensitive actions (e.g., document upload/download, profile auto-creation) are logged via [apps/web/lib/audit.ts](../apps/web/lib/audit.ts) into the `audits` collection.

## Background Workloads & Reliability
- Async document ingestion/OCR/classification/summarization is orchestrated via the Mongo-backed `jobs` collection and workers that run against `apps/ai` pipelines.
- Celery workers under [apps/ai/workers](../apps/ai/workers) process AI-heavy jobs; Node-side queue producers are planned for `packages/infra/queues`.

---
This overview should be kept in sync with the repository. When adding new folders or key files, update this document so that contributors can quickly understand where responsibilities live.
