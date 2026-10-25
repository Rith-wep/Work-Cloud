import re
from typing import Any, Dict, List, Optional, Tuple

from constants import (
    ALLOWED_CATEGORIES,
    ASSISTANT_IDENTITY_PATTERNS,
    CATEGORY_ALIASES,
    ENTRY_HINTS,
    ENTRY_REGEX_PATTERNS,
    EXPERIENCE_LEVELS,
    GREETING_WORDS,
    JOB_KEYWORDS,
    JOB_ROLE_KEYWORDS,
    JUNIOR_HINTS,
    REMOTE_NO_HINTS,
    REMOTE_YES_HINTS,
    SALARY_MAX_HINTS,
    SALARY_MIN_HINTS,
    SENIOR_HINTS,
    SKILL_KEYWORDS,
)
from utils import (
    first_non_none,
    normalize_text,
    text_has_phrase,
    to_number,
    unique_normalized_strings,
)


def build_category_lookup() -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for canonical, aliases in CATEGORY_ALIASES.items():
        lookup[normalize_text(canonical)] = canonical
        for alias in aliases:
            lookup[normalize_text(alias)] = canonical
    return lookup


CATEGORY_LOOKUP = build_category_lookup()


def is_personality_question(prompt: str) -> bool:
    text = normalize_text(prompt)
    return bool(text) and any(re.search(p, text, flags=re.IGNORECASE) for p in ASSISTANT_IDENTITY_PATTERNS)


def is_greeting_intent(prompt: str) -> bool:
    text = normalize_text(prompt)
    if not text:
        return False
    for words in GREETING_WORDS.values():
        for word in words:
            if text_has_phrase(text, word):
                return True
    return False


def extract_category_from_text(text: str) -> Optional[str]:
    normalized = normalize_text(text)
    if not normalized:
        return None

    aliases_sorted = sorted(CATEGORY_LOOKUP.items(), key=lambda item: len(item[0]), reverse=True)
    for alias, canonical in aliases_sorted:
        if alias and text_has_phrase(normalized, alias):
            return canonical
    return None


def extract_job_title_keywords_from_text(prompt: str) -> List[str]:
    text = normalize_text(prompt)
    matches = []
    for keyword in sorted(JOB_ROLE_KEYWORDS, key=len, reverse=True):
        if text_has_phrase(text, keyword):
            matches.append(keyword)
    return unique_normalized_strings(matches)


def extract_skills_from_text(prompt: str, user_skills: Optional[List[str]] = None) -> List[str]:
    text = normalize_text(prompt)
    matches = []

    for keyword in sorted(SKILL_KEYWORDS, key=len, reverse=True):
        if text_has_phrase(text, keyword):
            matches.append(keyword)

    for skill in user_skills or []:
        if text_has_phrase(text, skill):
            matches.append(skill)

    return unique_normalized_strings(matches)


def extract_location_from_text(prompt: str) -> Optional[str]:
    source = str(prompt or "").strip()
    if not source:
        return None

    patterns = [
        r"(?:jobs?\s+in|work\s+in|located\s+in|near|at)\s+([A-Za-z][A-Za-z\s]{1,39})",
        r"(?:នៅ|ជិត)\s*([^\d,.;!?]{2,40})",
        r"(?:在|于)\s*([^\d,.;!?]{2,30})",
    ]

    stop_words = {
        "salary", "remote", "job", "jobs", "work", "home", "office", "experience",
        "full time", "part time", "internship", "developer", "teacher", "cleaning",
        "construction", "delivery", "backend", "frontend", "designer",
    }

    for pattern in patterns:
        match = re.search(pattern, source, flags=re.IGNORECASE)
        if match:
            candidate = re.sub(r"\s+", " ", match.group(1)).strip(" ,.-")
            if candidate and normalize_text(candidate) not in stop_words:
                return candidate
    return None


def extract_salary_range_from_text(prompt: str) -> Tuple[Optional[int], Optional[int]]:
    text = normalize_text(prompt)

    range_match = re.search(r"(\d{2,6})\s*(?:-|to|and|~|–|—)\s*(\d{2,6})", text)
    if range_match:
        low = int(range_match.group(1))
        high = int(range_match.group(2))
        return min(low, high), max(low, high)

    min_match = re.search(
        r"(?:above|over|more than|at least|starting from|លើស|ចាប់ពី|至少|高于)\s*(\d{2,6})",
        text,
    )
    max_match = re.search(
        r"(?:below|under|less than|up to|ក្រោម|តិចជាង|以内|低于)\s*(\d{2,6})",
        text,
    )

    salary_min = int(min_match.group(1)) if min_match else None
    salary_max = int(max_match.group(1)) if max_match else None

    if salary_min is not None or salary_max is not None:
        return salary_min, salary_max

    numbers = [int(n) for n in re.findall(r"\d{2,6}", text)]
    if len(numbers) >= 2:
        return min(numbers[0], numbers[1]), max(numbers[0], numbers[1])

    return None, None


def extract_no_experience_from_text(prompt: str) -> bool:
    text = normalize_text(prompt)
    if any(text_has_phrase(text, hint) for hint in ENTRY_HINTS):
        return True
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in ENTRY_REGEX_PATTERNS)


def extract_experience_level_from_text(prompt: str) -> Optional[str]:
    text = normalize_text(prompt)
    if not text:
        return None
    if extract_no_experience_from_text(text):
        return "entry"
    if any(text_has_phrase(text, hint) for hint in SENIOR_HINTS):
        return "senior"
    if any(text_has_phrase(text, hint) for hint in JUNIOR_HINTS):
        return "junior"
    return None


def extract_is_remote_from_text(prompt: str) -> Optional[bool]:
    text = normalize_text(prompt)
    if not text:
        return None
    if any(text_has_phrase(text, hint) for hint in REMOTE_YES_HINTS):
        return True
    if any(text_has_phrase(text, hint) for hint in REMOTE_NO_HINTS):
        return False
    return None


def normalize_tier(value: Any) -> Optional[str]:
    text = normalize_text(value)
    mapping = {
        "remote": "remote",
        "no experience": "no_experience",
        "no_experience": "no_experience",
        "entry": "no_experience",
        "junior": "junior",
        "senior": "senior",
    }
    return mapping.get(text)


def extract_tier_from_text(prompt: str) -> Optional[str]:
    text = normalize_text(prompt)
    if any(text_has_phrase(text, hint) for hint in REMOTE_YES_HINTS):
        return "remote"
    if any(text_has_phrase(text, hint) for hint in ENTRY_HINTS):
        return "no_experience"
    if any(text_has_phrase(text, hint) for hint in SENIOR_HINTS):
        return "senior"
    if any(text_has_phrase(text, hint) for hint in JUNIOR_HINTS):
        return "junior"
    return None


def has_any_filter(filters: Dict[str, Any]) -> bool:
    return any([
        bool(filters.get("category")),
        bool(filters.get("jobTitleKeywords")),
        bool(filters.get("skills")),
        bool(filters.get("location")),
        filters.get("salaryMin") is not None,
        filters.get("salaryMax") is not None,
        bool(filters.get("experienceLevel")),
        filters.get("isRemote") is not None,
        bool(filters.get("noExperience")),
        bool(filters.get("tier")),
    ])


def heuristic_intent(prompt: str) -> str:
    text = normalize_text(prompt)
    if not text:
        return "greeting"
    if is_personality_question(prompt):
        return "greeting"
    if is_greeting_intent(prompt) and len(text.split()) <= 4:
        return "greeting"

    if extract_category_from_text(prompt):
        return "job_search"
    if extract_job_title_keywords_from_text(prompt):
        return "job_search"
    if extract_skills_from_text(prompt):
        return "job_search"
    if extract_location_from_text(prompt):
        return "job_search"

    salary_min, salary_max = extract_salary_range_from_text(prompt)
    if salary_min is not None or salary_max is not None:
        return "job_search"

    if extract_experience_level_from_text(prompt):
        return "job_search"
    if extract_is_remote_from_text(prompt) is not None:
        return "job_search"
    if any(text_has_phrase(text, keyword) for keyword in JOB_KEYWORDS):
        return "job_search"

    return "out_of_scope"


def infer_filters_fallback(prompt: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    user_context = user_context or {}
    return {
        "intent": heuristic_intent(prompt),
        "category": extract_category_from_text(prompt),
        "jobTitleKeywords": extract_job_title_keywords_from_text(prompt),
        "skills": extract_skills_from_text(prompt, user_context.get("skills")),
        "location": extract_location_from_text(prompt),
        "salaryMin": extract_salary_range_from_text(prompt)[0],
        "salaryMax": extract_salary_range_from_text(prompt)[1],
        "experienceLevel": extract_experience_level_from_text(prompt),
        "isRemote": extract_is_remote_from_text(prompt),
        "noExperience": extract_no_experience_from_text(prompt),
        "tier": extract_tier_from_text(prompt),
    }


def normalize_filters(filters: Dict[str, Any], prompt: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    user_context = user_context or {}

    category = filters.get("category")
    if category and category not in ALLOWED_CATEGORIES:
        category = CATEGORY_LOOKUP.get(normalize_text(category))

    experience = normalize_text(filters.get("experienceLevel"))
    if experience not in EXPERIENCE_LEVELS:
        experience = extract_experience_level_from_text(prompt)

    is_remote_raw = filters.get("isRemote")
    if isinstance(is_remote_raw, bool):
        is_remote = is_remote_raw
    elif str(is_remote_raw).strip().lower() in {"true", "1", "yes"}:
        is_remote = True
    elif str(is_remote_raw).strip().lower() in {"false", "0", "no"}:
        is_remote = False
    else:
        is_remote = extract_is_remote_from_text(prompt)

    no_experience_raw = filters.get("noExperience")
    if isinstance(no_experience_raw, bool):
        no_experience = no_experience_raw
    elif str(no_experience_raw).strip().lower() in {"true", "1", "yes"}:
        no_experience = True
    elif str(no_experience_raw).strip().lower() in {"false", "0", "no"}:
        no_experience = False
    else:
        no_experience = extract_no_experience_from_text(prompt)

    fallback_salary_min, fallback_salary_max = extract_salary_range_from_text(prompt)

    raw_keywords = filters.get("jobTitleKeywords") or []
    if isinstance(raw_keywords, str):
        raw_keywords = [raw_keywords]
    job_title_keywords = unique_normalized_strings(
        [str(x) for x in raw_keywords if str(x).strip()]
    ) or extract_job_title_keywords_from_text(prompt)

    raw_skills = filters.get("skills") or []
    if isinstance(raw_skills, str):
        raw_skills = [raw_skills]
    skills = unique_normalized_strings(
        [str(x) for x in raw_skills if str(x).strip()]
    ) or extract_skills_from_text(prompt, user_context.get("skills"))

    intent = normalize_text(filters.get("intent"))
    if intent == "job":
        intent = "job_search"
    if intent not in {"job_search", "greeting", "out_of_scope"}:
        intent = heuristic_intent(prompt)

    tier = normalize_tier(filters.get("tier")) or extract_tier_from_text(prompt)
    if not tier and no_experience:
        tier = "no_experience"
    if not tier and is_remote is True:
        tier = "remote"
    if not tier and experience in {"junior", "senior"}:
        tier = experience

    return {
        "intent": intent,
        "category": category or extract_category_from_text(prompt),
        "jobTitleKeywords": job_title_keywords,
        "skills": skills,
        "location": filters.get("location") or extract_location_from_text(prompt),
        "salaryMin": first_non_none(to_number(filters.get("salaryMin")), fallback_salary_min),
        "salaryMax": first_non_none(to_number(filters.get("salaryMax")), fallback_salary_max),
        "experienceLevel": experience,
        "isRemote": is_remote,
        "noExperience": no_experience,
        "tier": tier,
    }