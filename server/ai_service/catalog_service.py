import json
import os
from difflib import SequenceMatcher
from typing import Any, Dict, List

from models import CatalogMergeSuggestionRequest
from utils import parse_json_object

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None


def _fallback_catalog_groups(payload: CatalogMergeSuggestionRequest) -> List[Dict[str, Any]]:
    terms = [
        {
            "kind": str(term.kind or "skill").strip(),
            "key": str(term.key or "").strip(),
            "label": str(term.label or term.key or "").strip(),
        }
        for term in payload.terms
        if str(term.key or "").strip()
    ]
    groups: List[Dict[str, Any]] = []
    used = set()

    for index, base in enumerate(terms):
        if base["key"] in used:
            continue
        members = [base]
        for candidate in terms[index + 1 :]:
            if candidate["kind"] != base["kind"] or candidate["key"] in used:
                continue
            ratio = SequenceMatcher(None, base["label"].lower(), candidate["label"].lower()).ratio()
            if ratio >= 0.82 or base["key"].replace("_", "") == candidate["key"].replace("_", ""):
                members.append(candidate)
        if len(members) > 1:
            for item in members:
                used.add(item["key"])
            groups.append(
                {
                    "kind": base["kind"],
                    "primaryKey": base["key"],
                    "primaryLabel": base["label"],
                    "members": [{"key": item["key"], "label": item["label"]} for item in members],
                    "reason": "Fallback grouping based on normalized text similarity.",
                }
            )
    return groups


def ai_catalog_merge_suggestions(payload: CatalogMergeSuggestionRequest) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or genai is None:
        return {"groups": _fallback_catalog_groups(payload)}

    genai.configure(api_key=api_key)
    prompt = (
        "You are a taxonomy cleanup assistant for WorkCloud. "
        "Return strict JSON only with schema: "
        '{"groups":[{"kind":"skill|category","primaryKey":"string","primaryLabel":"string","members":[{"key":"string","label":"string"}],"reason":"string"}]}. '
        "Group only terms that should likely be merged because they are near-duplicates, aliases, abbreviations, or spelling variants. "
        "Do not group unrelated terms. Prefer the most professional, canonical label as primary. "
        f"Terms: {json.dumps([term.model_dump() for term in payload.terms], ensure_ascii=False)}"
    )

    model_candidates = [
        os.getenv("GEMINI_MODEL", "").strip(),
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
    ]
    model_candidates = [name for name in model_candidates if name]

    for model_name in model_candidates:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            parsed = parse_json_object(getattr(response, "text", ""))
            groups = parsed.get("groups")
            if isinstance(groups, list):
                return {"groups": groups}
        except Exception:
            continue

    return {"groups": _fallback_catalog_groups(payload)}
