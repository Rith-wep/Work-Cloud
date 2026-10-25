import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from job_service import ai_job_search
from cv_service import ai_cv_assist
from models import AIJobSearchRequest, CVAssistRequest, CatalogMergeSuggestionRequest
from catalog_service import ai_catalog_merge_suggestions


_CURRENT_DIR = Path(__file__).resolve().parent
_SERVER_ENV = _CURRENT_DIR.parent / ".env"
if _SERVER_ENV.exists():
    load_dotenv(_SERVER_ENV)
else:
    load_dotenv()


app = FastAPI(title="WorkCloud AI Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_mongo_uri = os.getenv("MONGODB_URI", "").strip()
mongo_client: Optional[MongoClient] = MongoClient(_mongo_uri) if _mongo_uri else None


@app.on_event("shutdown")
def shutdown_db_client() -> None:
    global mongo_client
    if mongo_client is not None:
        mongo_client.close()


@app.post("/api/ai/job-search")
def ai_job_search_route(payload: AIJobSearchRequest):
    return ai_job_search(payload, mongo_client)


@app.post("/api/ai/cv-assist")
def ai_cv_assist_route(payload: CVAssistRequest):
    return ai_cv_assist(payload)


@app.post("/api/ai/catalog-merge-suggestions")
def ai_catalog_merge_suggestions_route(payload: CatalogMergeSuggestionRequest):
    return ai_catalog_merge_suggestions(payload)
