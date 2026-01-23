# MediLocker AI Service

FastAPI service providing AI-assisted document analysis for MediLocker.

## Features

- **OCR**: Extract text from medical documents
- **Classification**: Detect document type (lab report, prescription, discharge summary, etc.)
- **Extraction**: Parse structured data (patient name, medications, vitals, lab observations)
- **Summarization**: Generate plain-language summaries with key findings and recommendations
- **Trends**: Analyze time-series health metrics
- **Recommendations**: Provide non-diagnostic guidance based on patterns
- **Explainability**: Wrap outputs with confidence scores and rationale

## Running Locally

From this directory:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

The service will start at `http://localhost:8000` (or as configured).

## API Endpoints

- `POST /extract` - Extract structured data from uploaded documents
- `POST /ocr` - Run OCR on a document
- `POST /classify` - Classify document type
- `POST /summarize` - Generate structured summary
- `POST /trends` - Analyze health metric trends
- `POST /recommend` - Generate recommendations
- `POST /explain` - Get explanations for AI outputs

## Project Structure

- `main.py` - FastAPI app and router registration
- `routers/` - API endpoints grouped by capability
- `pipelines/` - AI processing workflows
- `services/` - Helper services (storage, DB, OCR, extraction)
- `workers/` - Celery workers for background jobs
- `security/` - Auth dependencies for service-to-service calls

## Configuration

Set environment variables in `.env`:

- `INTERNAL_AUTH_TOKEN` - Token for service-to-service auth
- `MONGODB_URI` - MongoDB connection string (if workers need DB access)
- `OPENROUTER_API_KEY` - API key for AI model providers
- Other model/service-specific credentials as needed 