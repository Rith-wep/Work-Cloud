import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from models import CVAssistRequest
from utils import parse_json_object

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover
    genai = None


ROLE_HINTS: Dict[str, Dict[str, Any]] = {
    "driver": {
        "focus": [
            "safe driving",
            "punctual transportation",
            "route planning",
            "map reading",
            "vehicle inspection",
            "customer service",
            "traffic law compliance",
        ],
        "fallback_bullets": [
            "Provided safe and timely transportation services while following traffic regulations and company procedures.",
            "Used route planning and map-reading skills to reduce delays and improve travel efficiency.",
            "Performed routine vehicle inspections and maintained vehicle cleanliness, safety, and readiness for daily operations.",
        ],
        "fallback_keywords": ["Safe Driving", "Route Planning", "Vehicle Inspection"],
    },
    "cashier": {
        "focus": [
            "cash handling",
            "POS operation",
            "customer service",
            "accuracy",
            "transaction processing",
        ],
        "fallback_bullets": [
            "Processed customer transactions accurately and efficiently while maintaining a positive service experience.",
            "Handled cash, card, and digital payments with strong attention to accuracy and company procedures.",
            "Supported daily store operations by resolving customer inquiries and maintaining an organized checkout area.",
        ],
        "fallback_keywords": ["Cash Handling", "POS Operation", "Customer Service"],
    },
    "receptionist": {
        "focus": [
            "front desk support",
            "customer service",
            "scheduling",
            "phone handling",
            "administrative coordination",
        ],
        "fallback_bullets": [
            "Managed front desk operations by greeting visitors, answering calls, and directing inquiries professionally.",
            "Coordinated appointments, schedules, and administrative tasks to support smooth daily office operations.",
            "Maintained accurate records and delivered responsive customer service to visitors, clients, and internal teams.",
        ],
        "fallback_keywords": ["Front Desk", "Scheduling", "Administrative Support"],
    },
    "sales": {
        "focus": [
            "customer engagement",
            "sales targets",
            "product knowledge",
            "upselling",
            "relationship building",
        ],
        "fallback_bullets": [
            "Engaged customers effectively to understand needs and recommend suitable products or services.",
            "Contributed to sales performance by applying product knowledge, communication skills, and service excellence.",
            "Built positive customer relationships that supported repeat business and overall satisfaction.",
        ],
        "fallback_keywords": ["Customer Engagement", "Sales Support", "Product Knowledge"],
    },
}

TECH_KEYWORD_CONTEXT: Dict[str, List[str]] = {
    "java": ["Spring Boot", "Microservices", "REST APIs"],
    "spring boot": ["Java", "Microservices", "REST APIs"],
    "python": ["FastAPI", "APIs", "Automation"],
    "javascript": ["React", "Node.js", "REST APIs"],
    "react": ["Component Architecture", "State Management", "Responsive UI"],
    "node": ["Express.js", "APIs", "Backend Services"],
    "sql": ["Database Optimization", "Query Tuning", "Reporting"],
    "excel": ["Reporting", "Data Analysis", "Process Tracking"],
}

WEAK_VERBS = {
    "managed",
    "helped",
    "handled",
    "responsible",
    "assisted",
    "supported",
    "worked",
}

POWER_VERBS = [
    "Spearheaded",
    "Orchestrated",
    "Optimized",
    "Engineered",
    "Exceeded",
    "Accelerated",
    "Strengthened",
]


def _sanitize_lines(value: Any, max_items: int = 6) -> List[str]:
    if isinstance(value, list):
        items = value
    else:
        items = str(value or "").split("\n")

    cleaned: List[str] = []
    for item in items:
        text = re.sub(r"^[\-\*\s]+", "", str(item or "").strip())
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            cleaned.append(text)
        if len(cleaned) >= max_items:
            break
    return cleaned


def _normalize_skill_text(skill: str) -> str:
    text = str(skill or "").strip()
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    return text


def _dedupe_keep_order(items: List[str], max_items: Optional[int] = None) -> List[str]:
    unique: List[str] = []
    seen = set()

    for item in items:
        cleaned = str(item or "").strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(cleaned)
        if max_items and len(unique) >= max_items:
            break
    return unique


def _detect_role_family(job_title: str) -> Optional[str]:
    title = str(job_title or "").strip().lower()

    patterns = {
        "driver": [r"\bdriver\b", r"\bdelivery driver\b", r"\btruck driver\b", r"\bchauffeur\b"],
        "cashier": [r"\bcashier\b"],
        "receptionist": [r"\breceptionist\b", r"\bfront desk\b", r"\bfront office\b"],
        "sales": [r"\bsales\b", r"\bsales associate\b", r"\bsales representative\b", r"\bseller\b"],
    }

    for family, regexes in patterns.items():
        for pattern in regexes:
            if re.search(pattern, title, flags=re.IGNORECASE):
                return family
    return None


def _is_license_or_cert(skill: str) -> bool:
    text = str(skill or "").strip().lower()
    license_terms = [
        "license",
        "licence",
        "certificate",
        "certification",
        "permit",
    ]
    return any(term in text for term in license_terms)


def _normalize_selected_skills(skills: List[str], job_title: str = "") -> Dict[str, List[str]]:
    title_lower = str(job_title or "").strip().lower()
    normalized_skills: List[str] = []
    certifications: List[str] = []

    for raw in skills or []:
        skill = _normalize_skill_text(raw)
        if not skill:
            continue

        skill_lower = skill.lower()

        # Remove obvious title echoes that should not be treated as skills.
        if title_lower and skill_lower == title_lower:
            continue

        # Move licenses/certifications into a separate bucket.
        if _is_license_or_cert(skill):
            certifications.append(skill)
            continue

        normalized_skills.append(skill)

    normalized_skills = _dedupe_keep_order(normalized_skills, max_items=8)
    certifications = _dedupe_keep_order(certifications, max_items=5)

    return {
        "skills": normalized_skills,
        "certifications": certifications,
    }


def _fallback_summary(payload: CVAssistRequest) -> str:
    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)
    role_family = _detect_role_family(payload.jobTitle)

    if role_family == "driver":
        text = (
            "Reliable transportation professional with strengths in safe driving, route planning, and service quality. "
            "Recognized for punctual execution, strong road awareness, and dependable daily operations."
        )
        return text[:260]

    skills = ", ".join(normalized["skills"][:4]) if normalized["skills"] else "teamwork and problem solving"
    base = (
        f"Detail-oriented candidate with strong capability in {skills}. "
        "Recognized for clear communication, reliable execution, and consistent performance in fast-paced environments."
    )
    return base[:260]


def _fallback_experience(payload: CVAssistRequest) -> List[str]:
    job_title = str(payload.jobTitle or "").strip()
    role_family = _detect_role_family(job_title)
    duration_context = _experience_duration_context(payload).lower()
    expert_tone = "expertise" in duration_context or "strategic" in duration_context
    early_tone = "fast learner" in duration_context or "early contributor" in duration_context

    if role_family and role_family in ROLE_HINTS:
        role_bullets = ROLE_HINTS[role_family]["fallback_bullets"]
        if expert_tone:
            return [
                "Optimized long-term operational performance, improving service consistency and measurable quality outcomes over multiple years.",
                role_bullets[1],
                "Orchestrated sustained execution standards that strengthened stakeholder confidence, reliability, and day-to-day efficiency.",
            ]
        if early_tone:
            return [
                "Accelerated onboarding impact as a fast learner by applying core role skills to deliver measurable early results.",
                role_bullets[1],
                "Exceeded initial performance expectations through reliable execution, strong learning agility, and visible team contribution.",
            ]
        return role_bullets

    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)
    skill_hint = normalized["skills"][0] if normalized["skills"] else "relevant professional skills"

    if expert_tone:
        return [
            "Optimized strategic execution standards to improve quality outcomes, efficiency, and long-term operational reliability.",
            f"Engineered workflow improvements by applying {skill_hint}, reducing delays and strengthening measurable performance outcomes.",
            "Orchestrated cross-functional coordination that improved consistency, execution quality, and stakeholder confidence over time.",
        ]
    if early_tone:
        return [
            "Accelerated early contribution by learning role requirements quickly and delivering measurable execution improvements.",
            f"Applied {skill_hint} to shorten turnaround time, improve task quality, and build strong performance momentum.",
            "Exceeded entry-level expectations through disciplined follow-through, adaptability, and visible contribution to team outcomes.",
        ]

    return [
        "Optimized daily operations to improve service quality, execution speed, and measurable task reliability.",
        f"Applied {skill_hint} to streamline workflows, reduce delays, and improve overall performance metrics.",
        "Orchestrated effective coordination with team members and stakeholders to deliver consistent, measurable results.",
    ]


def _fallback_keywords(payload: CVAssistRequest) -> List[str]:
    role_family = _detect_role_family(payload.jobTitle)
    if role_family and role_family in ROLE_HINTS:
        return ROLE_HINTS[role_family]["fallback_keywords"]

    title_tokens = re.findall(r"[A-Za-z]+", str(payload.jobTitle or ""))
    base_keywords = [token.title() for token in title_tokens[:2] if token]

    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)
    skill_keywords = [str(skill).title() for skill in normalized["skills"][:2]]

    keywords = [item for item in (base_keywords + skill_keywords + ["Process Improvement"]) if item]
    keywords = _dedupe_keep_order(keywords)

    while len(keywords) < 3:
        fillers = ["Execution Quality", "Team Collaboration", "Service Excellence"]
        keywords.append(fillers[len(keywords) - len(_dedupe_keep_order(keywords))] if len(keywords) < len(fillers) else "Professional Support")

    return keywords[:3]


def _get_tech_keyword_context(payload: CVAssistRequest) -> List[str]:
    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)
    raw_terms = normalized["skills"] + normalized["certifications"] + [str(payload.jobTitle or "").strip()]
    enriched: List[str] = []

    for term in raw_terms:
        lowered = str(term or "").strip().lower()
        if not lowered:
            continue
        for key, related_terms in TECH_KEYWORD_CONTEXT.items():
            if key in lowered:
                enriched.extend(related_terms)

    return _dedupe_keep_order(enriched, max_items=6)


def _robust_fallback_bullet(payload: CVAssistRequest, index: int) -> str:
    fallback = _fallback_experience(payload)
    if index < len(fallback):
        return fallback[index]
    power_verb = POWER_VERBS[index % len(POWER_VERBS)]
    job_title = str(payload.jobTitle or "the role").strip() or "the role"
    return (
        f"{power_verb} {job_title.lower()} outcomes by improving quality metrics, reducing turnaround time, "
        "and delivering measurable execution gains."
    )


def _clean_generated_bullet(text: str, payload: CVAssistRequest, index: int) -> str:
    fallback = _fallback_experience(payload)
    cleaned = re.sub(r"^[\-\*\s]+", "", str(text or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    banned_patterns = [
        r"\bmanaged daily responsibilities\b",
        r"\bspearheaded\s+driver\s+initiatives\b",
        r"\bapplying\s+driver\s+license\b",
        r"\bdelivered quantifiable results through cross functional collaboration\b",
    ]
    for pattern in banned_patterns:
        if re.search(pattern, cleaned, flags=re.IGNORECASE):
            return _robust_fallback_bullet(payload, index)

    # Prevent awkward title repetition such as "Driver initiatives".
    job_title = str(payload.jobTitle or "").strip()
    if job_title and re.search(rf"\b{re.escape(job_title)}\s+initiatives\b", cleaned, flags=re.IGNORECASE):
        return _robust_fallback_bullet(payload, index)

    first_word = re.sub(r"[^A-Za-z]", "", cleaned.split(" ")[0]).lower() if cleaned else ""
    if first_word in WEAK_VERBS:
        return _robust_fallback_bullet(payload, index)

    if cleaned and not cleaned.endswith("."):
        cleaned += "."

    if len(cleaned.split()) < 8:
        return _robust_fallback_bullet(payload, index)

    if not re.search(r"\b\d+(?:[%x]| percent| hours?| days?| weeks?| months?| years?)\b", cleaned, flags=re.IGNORECASE):
        return _robust_fallback_bullet(payload, index)

    return cleaned


def _normalize_experience_bullets(raw_points: Any, payload: CVAssistRequest) -> List[str]:
    points = _sanitize_lines(raw_points, max_items=3)
    fallback = _fallback_experience(payload)

    while len(points) < 3:
        points.append(fallback[len(points)])

    points = points[:3]

    normalized: List[str] = []
    for index, point in enumerate(points):
        normalized.append(_clean_generated_bullet(point, payload, index))

    return normalized


def _fallback_refine(text: str) -> str:
    refined = str(text or "").strip()
    if not refined:
        return ""

    replacements = {
        "i am": "I am",
        "im ": "I am ",
        "dont": "do not",
        "cant": "cannot",
        "wanna": "want to",
        "gonna": "going to",
    }

    lowered = refined.lower()
    for old, new in replacements.items():
        lowered = lowered.replace(old, new)

    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered[:1].upper() + lowered[1:] if lowered else ""


def _fallback_health(payload: CVAssistRequest) -> Dict[str, Any]:
    summary = str(payload.professionalSummary or "").strip()
    score = 45
    tips: List[str] = []

    if len(summary) >= 80:
        score += 20
    else:
        tips.append("AI recommends adding your key achievements here")

    if re.search(r"\b\d+[%x]?\b", summary):
        score += 15
    else:
        tips.append("Include measurable impact such as percentages, counts, or time saved")

    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)
    if len(normalized["skills"]) >= 3:
        score += 10

    if len(payload.workExperience or []) >= 1:
        score += 10

    score = max(0, min(100, score))
    return {
        "score": score,
        "tip": tips[0] if tips else "Great profile strength. Keep your achievements specific.",
    }


def _parse_month_year(raw: str) -> Optional[datetime]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%m/%Y")
    except Exception:
        return None


def _experience_duration_context(payload: CVAssistRequest) -> str:
    job_title = str(payload.jobTitle or "").strip().lower()
    target = None

    for entry in payload.workExperience:
        title = str(getattr(entry, "jobTitle", "") or "").strip().lower()
        if job_title and title == job_title:
            target = entry
            break

    if target is None and payload.workExperience:
        target = payload.workExperience[0]

    if target is None:
        return ""

    start_raw = str(getattr(target, "startDate", "") or "").strip()
    end_raw = str(getattr(target, "endDate", "") or "").strip()
    if not start_raw:
        return ""

    start_dt = _parse_month_year(start_raw)
    if not start_dt:
        return ""

    if not end_raw or re.search(r"present|current|now", end_raw, flags=re.IGNORECASE):
        end_dt = datetime.utcnow()
    else:
        end_dt = _parse_month_year(end_raw)

    if not end_dt:
        return ""

    total_months = max(0, (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month))
    total_years = round(total_months / 12, 1)

    if total_years >= 10:
        return f"Duration context: {total_years} years in this role. Emphasize long-term consistency and sustained impact."
    if total_years >= 5:
        return f"Duration context: {total_years} years in this role. Use strategic, expertise-oriented language and emphasize sustained impact."
    if total_years >= 1:
        return f"Duration context: {total_years} years in this role. Reflect progression and measurable impact over time."
    return "Duration context: less than 1 year in this role. Emphasize fast learner positioning, early contributor language, and measurable contribution."


def _role_specific_prompt_context(job_title: str) -> str:
    role_family = _detect_role_family(job_title)
    if not role_family or role_family not in ROLE_HINTS:
        return (
            "Use responsibilities and achievements that sound natural for the role. "
            "Avoid generic corporate phrasing and avoid repeating the job title awkwardly."
        )

    focus = ROLE_HINTS[role_family]["focus"]
    joined_focus = ", ".join(focus)
    return (
        f"This role belongs to the '{role_family}' family. "
        f"Emphasize: {joined_focus}. "
        "Use realistic resume language for this role. "
        "Do not repeat the job title in phrases like '<job title> initiatives'. "
        "Do not treat licenses or certifications as action tools or methods."
    )


def _gemini_json(prompt: str, temperature: float = 0.65, top_p: float = 0.65) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or genai is None:
        return {}

    genai.configure(api_key=api_key)
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
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": temperature,
                    "top_p": top_p,
                },
            )
            parsed = parse_json_object(getattr(response, "text", ""))
            if parsed:
                return parsed
        except Exception:
            continue

    return {}


def ai_cv_assist(payload: CVAssistRequest) -> Dict[str, Any]:
    mode = str(payload.mode or "").strip().lower()
    normalized = _normalize_selected_skills(payload.selectedSkills, payload.jobTitle)

    work_experience_data = []
    for item in payload.workExperience:
        if hasattr(item, "model_dump"):
            work_experience_data.append(item.model_dump())
        else:
            work_experience_data.append(item.dict())

    data_blob = {
        "language": "en",
        "selectedCategory": str(payload.selectedCategory or "").strip(),
        "selectedSkills": normalized["skills"],
        "certifications": normalized["certifications"],
        "experienceLevel": str(payload.experienceLevel or "").strip() or "unspecified",
        "workExperience": work_experience_data,
        "professionalSummary": payload.professionalSummary or "",
        "inputText": payload.inputText or "",
        "jobTitle": payload.jobTitle or "",
    }

    if mode == "summary":
        skills_context = ", ".join(normalized["skills"][:8]) if normalized["skills"] else "general professional skills"
        prompt = (
            "You are a recruitment specialist for WorkCloud Cambodia. "
            "Return ONLY strict JSON: {\"summary\":\"\"}. "
            "Output must be in professional English only. "
            "Create a 2-sentence career profile based on the candidate's role and strongest capabilities. "
            "Focus on reliability, specific capabilities, and strengths. "
            "Never mention zero experience, no experience, lack of experience, or equivalent phrases. "
            "Style: no first-person pronouns. Use third-person professional tone. "
            "Do not force keywords unnaturally into the summary. "
            "Max 260 characters. "
            f"Primary skills: {skills_context}. "
            f"Candidate Context: {json.dumps(data_blob, ensure_ascii=False)}"
        )
        parsed = _gemini_json(prompt)
        summary = str(parsed.get("summary") or "").strip()
        return {"summary": summary or _fallback_summary(payload)}

    if mode == "experience":
        technical_context = _get_tech_keyword_context(payload)
        hybrid_input = {
            "jobTitle": str(payload.jobTitle or "").strip(),
            "selectedCategory": str(payload.selectedCategory or "").strip(),
            "selectedSkills": normalized["skills"],
            "certifications": normalized["certifications"],
            "experienceLevel": str(payload.experienceLevel or "").strip() or "unspecified",
            "technicalContext": technical_context,
        }

        duration_context = _experience_duration_context(payload)
        role_prompt_context = _role_specific_prompt_context(payload.jobTitle)

        prompt = (
            "You are a Senior Executive Resume Writer. "
            "Return strict JSON only: "
            "{\"bulletPoints\":[\"string\",\"string\",\"string\"],\"keywords\":[\"string\",\"string\",\"string\"]}. "
            "Language: Professional English ONLY. "
            "Generate exactly 3 LinkedIn-grade executive resume bullets for the role. "
            "Use the STAR formula in compressed form: Situation/Task, Action, Result. "
            "Every bullet must include a measurable metric such as %, time saved, volume, count, revenue, quality score, or throughput. "
            "Each bullet must sound natural for the actual job title. "
            "Avoid vague corporate filler, awkward phrasing, and generic templates like 'Managed daily responsibilities'. "
            "Forbidden weak verbs at the start of any bullet: Managed, Helped, Handled, Responsible for, Assisted, Supported, Worked on. "
            "Prefer strong power verbs such as Spearheaded, Orchestrated, Optimized, Engineered, Exceeded, Accelerated, Strengthened. "
            "Do not repeat the job title in unnatural phrases like 'Driver initiatives' or 'Cashier strategy'. "
            "Do not treat licenses or certifications as methods, tools, or verbs. "
            "If technical keywords appear, incorporate credible industry context such as frameworks, systems, or delivery patterns that match those keywords. "
            "If duration indicates more than 5 years, use strategic or expertise-oriented language. "
            "If duration indicates less than 1 year, use fast learner or early contributor framing while keeping the result measurable. "
            "Keep each bullet concise, specific, achievement-based, and resume-ready. "
            "Also generate 3 concise keywords relevant to the role and strongest real skills. "
            f"{duration_context} "
            f"{role_prompt_context} "
            f"Hybrid Input JSON: {json.dumps(hybrid_input, ensure_ascii=False)} "
            f"Context JSON: {json.dumps(data_blob, ensure_ascii=False)}"
        )

        parsed = _gemini_json(prompt, temperature=0.8, top_p=0.8)
        bullet_points = _normalize_experience_bullets(parsed.get("bulletPoints"), payload)

        keywords = _sanitize_lines(parsed.get("keywords"), max_items=3)
        if len(keywords) < 3:
            keywords = _fallback_keywords(payload)
        else:
            keywords = _dedupe_keep_order(
                [str(item).replace("_", " ").strip().title() for item in keywords],
                max_items=3,
            )
            while len(keywords) < 3:
                fallback_keywords = _fallback_keywords(payload)
                for item in fallback_keywords:
                    if item not in keywords:
                        keywords.append(item)
                    if len(keywords) >= 3:
                        break

        return {"bulletPoints": bullet_points, "keywords": keywords[:3]}

    if mode == "refine":
        prompt = (
            "You are an editor for professional CV language. "
            "Return strict JSON only with schema: {\"refinedText\":\"string\"}. "
            "Correct spelling and grammar, convert informal wording to professional tone, and output in professional English only. "
            f"Input: {json.dumps(data_blob, ensure_ascii=False)}"
        )
        parsed = _gemini_json(prompt)
        refined = str(parsed.get("refinedText") or "").strip()
        source_text = str(payload.inputText or "")
        return {"refinedText": refined or _fallback_refine(source_text)}

    if mode == "health":
        prompt = (
            "You are a CV reviewer. "
            "Return strict JSON only with schema: {\"score\":number,\"tip\":\"string\"}. "
            "Score 0-100 based on strength, clarity, and impact. "
            "If summary is weak, tip should be: \"AI recommends adding your key achievements here\". "
            f"Input: {json.dumps(data_blob, ensure_ascii=False)}"
        )
        parsed = _gemini_json(prompt)

        try:
            score = int(parsed.get("score"))
        except Exception:
            score = None

        tip = str(parsed.get("tip") or "").strip()

        if score is None:
            return _fallback_health(payload)

        score = max(0, min(100, score))
        if not tip:
            tip = "AI recommends adding your key achievements here" if score < 70 else "Strong CV profile."

        return {"score": score, "tip": tip}

    return {"message": "Unsupported mode"}
