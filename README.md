# MediLocker V2

Patient-controlled, AI-assisted health vault that turns scattered lab reports and medical documents into clear, safe, and actionable summaries.

This repository is a monorepo with:
- A **Next.js App Router** web app in `apps/web`
- A **Python FastAPI** AI service in `apps/ai`
- Shared **MongoDB schemas**, **auth helpers**, and **infra scaffolding** in `packages/*`

For the full product vision, see `docs/MediLocker-V2-Spec.md`. This README focuses on what is **implemented today** and how to run it.

---

## What’s Implemented Right Now

### Core Features
- **Account & identity (via NextAuth)**
	- Google OAuth sign-in wired through `apps/web/app/api/auth/[...nextauth]/route.ts`.
	- Each signed-in user automatically gets a default health profile on first use.

- **Secure document vault**
	- Upload lab reports and other medical documents from the `Documents` page (`apps/web/app/documents/page.tsx`).
	- Files are stored in **Supabase Storage**; only metadata and references are stored in MongoDB.
	- Documents are versioned via the `documentVersions` collection.
	- Soft delete / bin flow with restore and permanent purge.

- **AI-assisted document extraction**
	- When you upload a document, the web app calls `/api/documents/extract`, which talks to the AI service in `apps/ai`.
	- Extracted structure includes:
		- Patient name, DOB
		- Doctor name
		- Diagnosis (if present)
		- Medications
		- Vitals and lab observations
	- You review and confirm the extracted data before saving it into the vault.

- **Structured lab summaries (with retry)**
	- Each lab document can have a structured, AI-generated summary stored in the `summaries` collection.
	- The document viewer shows:
		- A clear disclaimer
		- In-depth summary paragraph
		- Bullet lists for key findings, recommendations, follow‑ups, and lifestyle advice
	- A **“Generate / Retry Summary”** button:
		- Calls `/api/documents/fast-summarize` with structured data.
		- Persists the latest summary in MongoDB (`summaries` collection).
		- Immediately refreshes the UI to display the newest summary.

- **Background ingestion pipeline**
	- When a document is saved, an `ingest` job is inserted into the `jobs` collection.
	- Jobs cover tasks such as OCR, classification, and document summarization.
	- AI workers in `apps/ai/workers` can consume these jobs to perform heavy processing off the main request path.

### Data Model (Implemented Collections)
The real codebase currently uses the following key MongoDB collections (see `packages/db`):

- `users`: identity and roles
- `profiles`: health identities (self/dependents)
- `documents`: medical documents and metadata
- `documentVersions`: immutable versions for each document
- `ocrOutputs`: raw OCR text per document/version
- `classification`: combined classification + lab-structured observations
- `summaries`: structured summaries for documents and histories
- `jobs`: background jobs (ingest, ocr, classify, extract-structured, summarize-doc, history-summary)
- `shares`: scaffolding for sharing records
- `alerts`: alert/reminder records
- `sessions`: refresh/session metadata
- `audits`, `adminEvents`: audit and admin events

Details, indexes, and validation rules are documented in `docs/SCHEMA_OPTIMIZATION_GUIDE.md` and implemented in `packages/db/*`.

---

## Project Structure (High Level)

- `apps/web`
	- Next.js App Router app (TypeScript)
	- UI routes: `home`, `documents`, `profile`, `dashboard`, `doctor`, `admin`, `emergency`, `auth`
	- API routes under `app/api/*` for profiles, documents, OCR, jobs, alerts, sharing, emergency, etc.
	- Web helpers in `lib/` (`auth`, `db`, `permissions`, `audit`, `supabase`, `utils`).
	- Web services in `services/` (`aiClient`, `storageClient`, `queueClient` placeholder).

- `apps/ai`
	- FastAPI app configured in `main.py`.
	- Routers: `ocr`, `classify`, `summarize`, `trends`, `recommend`, `explain`, `extract`.
	- Pipelines under `pipelines/` encapsulate OCR, classification, summarization, trend, recommendation, and explain flows.
	- Workers under `workers/` (Celery) consume jobs and run AI workloads.

- `packages/db`
	- One file per collection with TypeScript interfaces and index specs.
	- `indexes.ts` and `schemaValidation.ts` centralize index creation and JSON schema validation.

- `packages/auth`
	- JWT, OAuth provider adapters, RBAC, refresh rotation, and session revocation helpers.
	- Currently used primarily as **internal scaffolding**; the main user-facing auth uses NextAuth in `apps/web`.

- `packages/infra`
	- `queues/` reserved for future Node-side queue producers/consumers.

More detail is in `docs/Structure-Overview.md`.

---

## Getting Started

### Prerequisites
- Node.js (LTS)
- npm
- Python 3.10+
- A running MongoDB instance
- A Supabase project (or another environment matching `apps/web/lib/supabase.ts` configuration)

You will also need environment variables set up for:
- NextAuth (e.g., Google OAuth client ID/secret)
- MongoDB connection string
- Supabase URL and key
- Internal token for AI service calls

Use the `.env` files in `apps/web` and `apps/ai` as a guide.

### Install Dependencies

From the repo root:

```bash
npm install
```

Then, inside `apps/ai` (for the Python service):

```bash
cd apps/ai
pip install -r requirements.txt
```

### Running the Web App (Next.js)

From the repo root:

```bash
cd apps/web
npm run dev
```

This starts the Next.js app (typically at `http://localhost:3000`).

### Running the AI Service (FastAPI)

From `apps/ai`:

```bash
uvicorn main:app --reload
```

By default this will start the AI service at `http://localhost:8000` (or as configured). The web app calls this service via `apps/web/services/aiClient.ts`.

> In development, ensure CORS and internal auth settings in `apps/ai/security/dependencies.py` are configured to accept calls from your web app.

### Optional: Background Workers

To process jobs from the `jobs` collection asynchronously, you can run the Celery worker defined in `apps/ai/workers` once your broker/back-end is configured.

---

## Development Notes

- The source of truth for behavior is always the code under `apps/` and `packages/`.
- `docs/` is kept in sync and describes the target architecture plus what is implemented now.
- When adding new features, update:
	- `docs/MediLocker-V2-Spec.md` (high-level spec)
	- `docs/Structure-Overview.md` (where files live)
	- `docs/SCHEMA_OPTIMIZATION_GUIDE.md` (if schemas/indexes change)

For team roles, branching strategy, and delivery phases, see `docs/Team-Collaboration-Plan.md`.

---

## Status Summary

- ✅ Next.js web app with document vault and AI-assisted summaries
- ✅ FastAPI AI service with OCR, classification, summarization, and related endpoints
- ✅ MongoDB schema layer with consolidated classification/lab structure and jobs
- ✅ Supabase-backed storage integration
- 🟡 Doctor/admin dashboards, advanced insights, and claims/health scores are partially scaffolded
- 🟡 Node-side queue producers and richer auth flows (beyond NextAuth sessions) are planned but not yet wired

This README will be updated as additional pieces of the V2 spec are implemented.

