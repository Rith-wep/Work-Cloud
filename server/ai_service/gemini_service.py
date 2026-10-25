import json
import logging
import os
from typing import Any, Dict

from constants import ALLOWED_CATEGORIES
from extractors import infer_filters_fallback, normalize_filters
from utils import parse_json_object

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None


logger = logging.getLogger("workcloud_ai")


def extract_filters_with_gemini(prompt: str, lang: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or genai is None:
        return infer_filters_fallback(prompt, user_context)

    genai.configure(api_key=api_key)

    model_candidates = [
        os.getenv("GEMINI_MODEL", "").strip(),
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
    ]
    model_candidates = [name for name in model_candidates if name]

    system = (
        "You are the WorkCloud Intelligent Assistant. "
        "Help candidates find jobs and give career guidance only. "
        "If the user asks who you are, set intent='greeting'. "
        "Return strict JSON only. "
        "Schema: {"
        "intent:'job_search'|'greeting'|'out_of_scope', "
        "category:string|null, "
        "jobTitleKeywords:string[]|null, "
        "skills:string[]|null, "
        "location:string|null, "
        "salaryMin:number|null, "
        "salaryMax:number|null, "
        "experienceLevel:'entry'|'junior'|'senior'|null, "
        "isRemote:boolean|null, "
        "noExperience:boolean|null, "
        "tier:'remote'|'no_experience'|'junior'|'senior'|null"
        "}. "
        f"Allowed categories: {ALLOWED_CATEGORIES}. "
        "Extract specific role words like backend, frontend, java developer, designer, cleaner, teacher into jobTitleKeywords. "
        "Extract technologies or tools like Java, Spring Boot, React, Node.js, Figma into skills. "
        "If greeting only, set intent='greeting'. "
        "If non-career topic, set intent='out_of_scope'. "
        "If job-related with no details, set intent='job_search' and filters null. "
        "For no experience or internship, set noExperience=true, experienceLevel='entry', tier='no_experience'. "
        "For remote requests, set isRemote=true, tier='remote'."
    )

    payload = {
        "language": lang,
        "prompt": prompt,
        "userContext": user_context,
    }

    for model_name in model_candidates:
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(
                f"{system}\nInput:\n{json.dumps(payload, ensure_ascii=False)}"
            )
            parsed = parse_json_object(getattr(resp, "text", ""))
            if parsed:
                return normalize_filters(parsed, prompt, user_context)
        except Exception as exc:
            logger.warning("Gemini model failed: %s (%s)", model_name, exc)

    return infer_filters_fallback(prompt, user_context)
