import os
from pathlib import Path

from fastapi import FastAPI


def _load_local_env() -> None:
	"""Load .env file from app directory, ensuring API keys and secrets are available.
	
	Works from any working directory by resolving the .env path relative to this file.
	"""
	env_path = Path(__file__).resolve().parent / ".env"
	
	if not env_path.exists():
		print(f"[ENV] Warning: .env file not found at {env_path}")
		return
	
	try:
		loaded_keys = []
		for line in env_path.read_text().splitlines():
			line = line.strip()
			# Skip empty lines and comments
			if not line or line.startswith("#"):
				continue
			# Skip lines without =
			if "=" not in line:
				continue
			
			key, value = line.split("=", 1)
			key = key.strip()
			value = value.strip()
			
			# Skip empty keys
			if not key:
				continue
			
			# Load the variable (always set, overwriting if needed)
			os.environ[key] = value
			loaded_keys.append(key)
		
		if loaded_keys:
			print(f"[ENV] Loaded {len(loaded_keys)} environment variables from {env_path.name}")
			# Log loaded keys WITHOUT printing values (security)
			if "OPENROUTER_API_KEY" in loaded_keys:
				print(f"[ENV] ✓ OPENROUTER_API_KEY is loaded and available")
		else:
			print(f"[ENV] Warning: .env file is empty or contains no valid key=value pairs")
			
	except Exception as e:
		print(f"[ENV] Error loading .env file: {e}")
		raise


# Ensure local .env values are present before routers run.
_load_local_env()

from .routers import classify, summarize, trends, recommend, explain, extract, vitals, health_summary, openrouter, generate_title

app = FastAPI(title="MediLocker AI Services")

# Include AI feature routers; each enforces service-level auth and validation.
app.include_router(classify.router, prefix="/classify", tags=["classify"])
app.include_router(summarize.router, prefix="/summarize", tags=["summarize"])
app.include_router(trends.router, prefix="/trends", tags=["trends"])
app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
app.include_router(explain.router, prefix="/explain", tags=["explain"])
app.include_router(extract.router, prefix="/extract", tags=["extract"])
app.include_router(vitals.router, prefix="/vitals", tags=["vitals"])
app.include_router(health_summary.router, prefix="/health-summary", tags=["health-summary"])
app.include_router(openrouter.router, prefix="/openrouter", tags=["openrouter"])
app.include_router(generate_title.router, prefix="/generate-title", tags=["generate-title"])
