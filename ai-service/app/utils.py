import json
import re
from typing import Any, Dict, List, Optional


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def first_non_none(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def to_number(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    raw = str(text or "").strip()
    if not raw:
        return None

    cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
        return None

    candidate = cleaned[start_idx:end_idx + 1]
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def text_has_phrase(text: str, phrase: str) -> bool:
    norm_text = normalize_text(text)
    norm_phrase = normalize_text(phrase)
    if not norm_phrase:
        return False

    if re.fullmatch(r"[a-z0-9/\-\s\+\.#]+", norm_phrase):
        return bool(re.search(rf"\b{re.escape(norm_phrase)}\b", norm_text, flags=re.IGNORECASE))
    return norm_phrase in norm_text


def unique_normalized_strings(values: List[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        norm = normalize_text(value)
        if norm and norm not in seen:
            seen.add(norm)
            result.append(value.strip())
    return result


def salary_to_int(raw: Any) -> Optional[int]:
    text = str(raw or "").replace(",", "")
    numbers = [int(n) for n in re.findall(r"\d+", text)]
    if not numbers:
        return None
    if len(numbers) >= 2:
        return (numbers[0] + numbers[1]) // 2
    return numbers[0]

