# MediLocker V2 — Team Collaboration & Execution Plan

Team: Dhairya, Sanchit, Shreyas (3 members)
Goal: Equal contribution, clear sequence, minimal conflicts, and alignment with the **actual** V2 implementation.

## Principles
- Equal ownership: Balanced workload across backend, web, and AI services.
- Single responsibility: Each file/module has one clear owner to reduce conflicts.
- Security boundaries: Web (Next.js) vs AI (FastAPI) responsibilities remain isolated.
- Source of truth: Original documents and immutable versions in Mongo/Supabase are authoritative.
- Short-lived branches: Small PRs, frequent merges to keep divergence low.

## Roles & Focus Areas (Current Codebase)
- **Dhairya (backend & logic emphasis)**
  - Web API handlers under `apps/web/app/api/*`, especially:
    - `profiles`, `profile`, `documents`, `documents/*` (extract, download, summarize, fast-summarize, analysis, bin, purge), `sharing`, `emergency`, `alerts`, `claims`, `admin`, `jobs`, `ocr`, `storage`, `tokens`.
  - Security & permissions in the web tier: `apps/web/lib/auth.ts` (NextAuth identity) and `apps/web/lib/permissions.ts` (e.g., `canUploadDocument`, `canAccessProfile`, `canDownloadDocument`).
  - Auth/security package: `packages/auth/*` (JWT helpers, refresh rotation, RBAC, session revocation) — keep in sync with how/when it is actually used by the web and AI services.
  - DB schema layer: `packages/db/*` (collections, indexes, schema validation) and `packages/db/indexes.ts` / `schemaValidation.ts` utilities.
  - Background jobs model: `packages/db/jobs.ts` and related usage in API handlers.

- **Sanchit (frontend integration & web services)**
  - Next.js app UI under `apps/web/app/*`:
    - `home`, `documents`, `profile`, `dashboard`, `doctor`, `admin`, `emergency`, `auth` (client components and layouts).
  - Components and layout:
    - `apps/web/components/*` (navigation, document review form, shared UI elements).
  - Web services:
    - `apps/web/services/aiClient.ts`, `storageClient.ts` (integration with AI service and Supabase Storage).
  - Web libs (from a UX perspective):
    - `apps/web/lib/utils.ts`, `apps/web/lib/crypto.ts`, and any helpers needed by the UI.
  - Accessibility & UX consistency — summary viewer quality (headings, bullets, disclaimers), responsive layout, and elder-friendly flows.

- **Shreyas (AI services & operations)**
  - FastAPI and routers: `apps/ai/main.py`, `apps/ai/routers/*` (OCR, classify, summarize, trends, recommend, explain, extract).
  - Pipelines & workers: `apps/ai/pipelines/*`, `apps/ai/workers/*` (Celery tasks, retry/DLQ behavior) and how they consume `jobs`, `ocrOutputs`, `classification`, and `summaries`.
  - AI-side persistence and security: `apps/ai/services/db.py`, `apps/ai/security/dependencies.py`.
  - Observability & reliability for AI services (logging, timeouts, sensible error messages).

> Note: `packages/infra/queues` is currently an **empty scaffold**. Any future queue producers/consumers (e.g., BullMQ) should be added there, but it is not part of the current runtime yet.

## Delivery Sequence (Phases & Ownership)
Phase 0 — Repo & Guardrails (All)
- Branch protection (main), CI placeholders (build/test/lint), `.env.example` adoption.
- Code style & commit conventions; PR template.

Phase 1 — Access & Identity (Primarily Dhairya, support: Sanchit)
- NextAuth under `apps/web/app/api/auth/[...nextauth]/route.ts` configured with at least Google provider and a stable session shape.
- `getIdentity` and related helpers in `apps/web/lib/auth.ts` provide `{ actorId, role, session }` to all web APIs.
- Basic RBAC via roles on the session; wire through `apps/web/lib/permissions.ts`.
- Audit scaffolding: `apps/web/lib/audit.ts` writing to the `audits` collection.

Phase 2 — Profiles & Documents (Dhairya + Sanchit)
- `profiles` and `profile` APIs for self-profile auto-creation and basic metadata edits.
- `documents` APIs for upload, ingestion-job enqueue, listing (active/bin), restore/purge, and secure download.
- `sharing` APIs for basic grants/revocations (behaviour can start minimal and grow).
- `emergency` APIs and pages with a safely-limited scope.
- Storage flows via `storageClient` and Supabase; ingestion jobs persisted in the `jobs` collection.

Phase 3 — AI Assistive Features (Primarily Shreyas, support: Dhairya)
- Mature the AI routers (`ocr`, `classify`, `summarize`, `trends`, `recommend`, `explain`, `extract`) so they are stable and well-validated.
- Ensure outputs follow the JSON contracts used by `apps/web` (e.g., the structured summary format consumed by `/api/documents/fast-summarize`).
- Wire Celery workers to consume `jobs` for ingestion, OCR, classification, summarization, and trend-analysis where appropriate.

Phase 4 — Clinical & Insights (Sanchit + Dhairya + Shreyas)
- Doctor dashboard and supporting APIs under `apps/web/app/doctor` and `apps/web/app/api/*`.
- Timeline, insights, and health score read endpoints using `timeline`, `insights`, `healthScores` collections once populated.
- Alerts/reminders endpoints wired to `alerts` and surfaced in the UI.

Phase 5 — Data Ownership & Portability (Dhairya + Sanchit)
- Export/delete endpoints per spec; structured + raw downloads; audit coverage.
- Validate emergency override controls and any one-tap revocation UX/API.

## Acceptance Criteria (per phase)
- Auth: NextAuth configured; `getIdentity` and permissions helpers used consistently across APIs; audit logs written for sensitive actions.
- Profiles/Documents: Correct profile scoping; immutable versions via `documentVersions`; idempotent uploads and ingestion jobs.
- AI: Endpoints return structured outputs with confidence/rationale where applicable; no medical decision logic.
- Clinical/Insights: Only shared scope accessible to doctors; UI clearly labels AI output as non-diagnostic.
- Portability: Export/delete endpoints behave as specified; actions are audited.

## Git Workflow & Branching
- Branches
  - `main`: protected; only fast-forward merges via PRs.
  - `dev`: optional integration branch for frequent merges.
  - Feature branches: `feature/<area>-<short-desc>` (e.g., `feature/auth-refresh-rotation`).
- Merge strategy
  - Rebase-merge preferred; keep linear history.
  - Resolve conflicts locally; never push broken builds.
- Commit messages (Conventional Commits)
  - `feat(auth): add refresh rotation handler`
  - `fix(documents): correct index key order`
  - `chore(ci): add lint job`
- PR hygiene
  - Small, focused PRs (<400 LOC recommended).
  - Include description, spec section references, and acceptance criteria.
  - Request at least 1 review; 2 for security-sensitive changes.

## Code Ownership & Reviews
- Proposed ownership map
  - Dhairya: `packages/auth/*`, `packages/db/*`, `apps/web/app/api/*`.
  - Sanchit: `apps/web/app/*`, `apps/web/components/*`, `apps/web/services/*`, `apps/web/lib/*`, `apps/web/types/*`.
  - Shreyas: `apps/ai/*` (routers, pipelines, workers, security, services).
- Review policy
  - Cross-review when changes span boundaries (e.g., web calls AI → Shreyas reviews; DB schema changes → Dhairya reviews).

## Avoiding Conflicts
- Do not edit files owned by another member without coordination.
- Push frequently and rebase before opening PRs.
- Keep changes scoped to a single responsibility per file/module.
- Use `.env` locally; never commit secrets.

## Environment & Secrets Handling
- `.env.example` defines required vars; create `.env.local` per developer.
- Use distinct dev credentials; rotate often.
- S3/Mongo/Redis tokens via a secrets manager in CI; never plain text in PRs.

## CI/CD & Quality Gates (initial)
- Checks on PR: build (web/ai), lint (TS/ESLint), typecheck, unit tests.
- Required to merge: All checks green + review approvals.

## Testing Strategy (progressive)
- Unit tests: auth helpers, JWT/RBAC, DB schema validation.
- Integration: route handlers for auth/profiles/documents/sharing/emergency.
- E2E (later): upload → classify → summarize → share → doctor view.

## Risk Scenarios & Playbooks
- Large merge conflict: rebase on latest `main`, split PR into smaller parts, or pair-review to resolve.
- Schema drift: announce changes; run migrations; update types; add indexes safely.
- Secrets leaked: revoke immediately; rotate; audit impacted systems.
- Broken `main`: revert or hotfix with minimal change; write follow-up tests.
- Long-running PR: break into smaller PRs; feature flag if needed.

## Contribution Balancing
- Rotate tasks per phase to balance workload (e.g., Dhairya focuses backend; Sanchit web integration; Shreyas AI, then swap specific endpoints to ensure equal commit counts/time).
- Track contributions via issues/PRs; adjust assignments weekly.

## Milestones (example timeline)
- Week 1: Auth/RBAC, profiles/documents basics, storage/queue wiring.
- Week 2: AI OCR/classify/summarize/trends, doctor portal scaffolding.
- Week 3: Sharing/emergency/alerts/claims, insights/health score, timeline.
- Week 4: Portability/export/delete, audit visibility, accessibility, reliability polish.

## Daily Workflow
1. Pull latest `main`.
2. Create feature branch.
3. Implement scoped change.
4. Run lint/build/tests locally.
5. Push branch, open PR.
6. Request review per ownership map.
7. Rebase-merge when green and approved.

## Handy Commands
```bash
# Web: typecheck and lint
npm run typecheck
npm run lint

# AI: run FastAPI locally (example)
uvicorn apps.ai.main:app --reload

# Celery worker (example)
celery -A apps.ai.workers.celery_app.celery_app worker --loglevel=INFO
```

---
This plan aligns responsibilities to the V2 spec, prescribes a safe Git workflow, and sequences delivery to minimize conflicts while keeping contributions balanced across the team.