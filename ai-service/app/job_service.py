import logging
import os
import re
from typing import Any, Dict, Optional

from fastapi import HTTPException
from pymongo import MongoClient

from .constants import ALLOWED_CATEGORIES, EXPERIENCE_LEVELS
from .extractors import has_any_filter, is_greeting_intent, is_personality_question
from .gemini_service import extract_filters_with_gemini
from .messages import greeting_message_by_lang, identity_message_by_lang, out_of_scope_message_by_lang
from .models import AIJobSearchRequest
from .utils import normalize_text, salary_to_int, to_number, unique_normalized_strings


logger = logging.getLogger("workcloud_ai")


def get_job_remote(job_item: Dict[str, Any]) -> bool:
    if isinstance(job_item.get("isRemote"), bool):
        return job_item["isRemote"]
    if isinstance(job_item.get("is_remote"), bool):
        return job_item["is_remote"]
    if isinstance(job_item.get("remote"), bool):
        return job_item["remote"]
    return normalize_text(job_item.get("workMode") or "") == "remote"


def get_job_experience_level(job_item: Dict[str, Any]) -> str:
    tier_level = normalize_text(job_item.get("tier_level") or "")
    if tier_level == "no_experience":
        return "entry"
    if tier_level in {"junior", "senior"}:
        return tier_level

    raw = normalize_text(job_item.get("experienceLevel") or "")
    if raw in EXPERIENCE_LEVELS:
        return raw

    min_exp = to_number(job_item.get("min_experience"))
    if min_exp is None:
        min_exp = to_number(job_item.get("minExperience"))

    if min_exp is None:
        return "entry"
    if min_exp <= 0:
        return "entry"
    if min_exp <= 2:
        return "junior"
    return "senior"


def is_in_tier(job_item: Dict[str, Any], tier: str) -> bool:
    value = str(tier or "").lower()
    if value == "remote":
        return get_job_remote(job_item)

    exp = get_job_experience_level(job_item)
    if value == "no_experience":
        return exp == "entry"
    if value == "junior":
        return exp == "junior"
    if value == "senior":
        return exp == "senior"
    return True


def score_job(job: Dict[str, Any], filters: Dict[str, Any]) -> int:
    score = 0

    title = normalize_text(job.get("title", ""))
    description = normalize_text(job.get("description", ""))
    category = normalize_text(job.get("category", ""))
    salary_value = salary_to_int(job.get("salary"))

    location_obj = job.get("location") or {}
    address = normalize_text(location_obj.get("address", ""))
    company = normalize_text((job.get("companyProfile") or {}).get("companyName", ""))

    combined_text = " ".join([
        title,
        description,
        category,
        address,
        company,
        normalize_text(job.get("experienceLevel", "")),
        normalize_text(job.get("tier_level", "")),
    ])

    if filters.get("category") and normalize_text(filters["category"]) == category:
        score += 4

    for keyword in filters.get("jobTitleKeywords", []):
        kw = normalize_text(keyword)
        if kw in title:
            score += 8
        elif kw in description:
            score += 4
        elif kw in combined_text:
            score += 2

    for skill in filters.get("skills", []):
        sk = normalize_text(skill)
        if sk in title:
            score += 6
        elif sk in description:
            score += 5
        elif sk in combined_text:
            score += 3

    if filters.get("location"):
        wanted_loc = normalize_text(filters["location"])
        if wanted_loc in address:
            score += 4

    if filters.get("isRemote") is True and get_job_remote(job):
        score += 5
    elif filters.get("isRemote") is False and not get_job_remote(job):
        score += 3

    target_exp = normalize_text(filters.get("experienceLevel"))
    if target_exp and get_job_experience_level(job) == target_exp:
        score += 4

    if filters.get("noExperience") and get_job_experience_level(job) == "entry":
        score += 5

    if filters.get("salaryMin") is not None and salary_value is not None and salary_value >= int(filters["salaryMin"]):
        score += 2
    if filters.get("salaryMax") is not None and salary_value is not None and salary_value <= int(filters["salaryMax"]):
        score += 2

    if job.get("createdAt"):
        score += 1

    return score


def normalize_job(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": str(item.get("_id")),
        "title": item.get("title", ""),
        "description": item.get("description", ""),
        "salary": item.get("salary", ""),
        "category": item.get("category", ""),
        "experienceLevel": item.get("experienceLevel", ""),
        "tier_level": item.get("tier_level", ""),
        "minExperience": item.get("minExperience", item.get("min_experience")),
        "isRemote": (
            item.get("isRemote")
            if isinstance(item.get("isRemote"), bool)
            else (
                item.get("is_remote")
                if isinstance(item.get("is_remote"), bool)
                else (
                    item.get("remote")
                    if isinstance(item.get("remote"), bool)
                    else normalize_text(item.get("workMode") or "") == "remote"
                )
            )
        ),
        "location": item.get("location", {}) or {},
        "companyProfile": item.get("companyProfile", {}) or {},
        "matchScore": item.get("matchScore", 0),
    }


def ai_job_search(payload: AIJobSearchRequest, mongo_client: Optional[MongoClient]):
    try:
        if mongo_client is None:
            raise HTTPException(status_code=500, detail="MONGODB_URI is missing")

        user_context = {
            "preferredCategory": payload.preferredCategory,
            "preferredExperienceLevel": payload.preferredExperienceLevel,
            "prefersRemote": payload.prefersRemote,
            "skills": payload.skills,
            "isVerified": payload.isVerified,
        }

        filters = extract_filters_with_gemini(payload.prompt, payload.language, user_context)

        if (
            filters.get("intent") == "job_search"
            and not filters.get("category")
            and payload.preferredCategory in ALLOWED_CATEGORIES
        ):
            filters["category"] = payload.preferredCategory
            filters["usedPreference"] = True

        if (
            filters.get("intent") == "job_search"
            and not filters.get("experienceLevel")
            and str(payload.preferredExperienceLevel or "").lower() in EXPERIENCE_LEVELS
        ):
            filters["experienceLevel"] = str(payload.preferredExperienceLevel).lower()

        if (
            filters.get("intent") == "job_search"
            and filters.get("isRemote") is None
            and isinstance(payload.prefersRemote, bool)
        ):
            filters["isRemote"] = payload.prefersRemote

        if not filters.get("skills") and payload.skills:
            filters["skills"] = unique_normalized_strings(payload.skills)

        if not filters.get("tier"):
            if filters.get("isRemote") is True:
                filters["tier"] = "remote"
            elif filters.get("noExperience") or str(filters.get("experienceLevel") or "").lower() == "entry":
                filters["tier"] = "no_experience"
            elif str(filters.get("experienceLevel") or "").lower() in {"junior", "senior"}:
                filters["tier"] = str(filters.get("experienceLevel")).lower()

        logger.info("Prompt: %s", payload.prompt)
        logger.info("Extracted filters: %s", filters)

        if is_personality_question(payload.prompt):
            return {
                "success": True,
                "type": "greeting",
                "intent": "greeting",
                "filters": filters,
                "count": 0,
                "jobs": [],
                "chat_message": identity_message_by_lang(payload.language),
            }

        if (filters.get("intent") == "greeting") or (
            not has_any_filter(filters) and is_greeting_intent(payload.prompt)
        ):
            return {
                "success": True,
                "type": "greeting",
                "intent": "greeting",
                "filters": filters,
                "count": 0,
                "jobs": [],
                "chat_message": greeting_message_by_lang(payload.language),
            }

        if filters.get("intent") == "out_of_scope":
            return {
                "success": True,
                "type": "out_of_scope",
                "intent": "out_of_scope",
                "filters": filters,
                "count": 0,
                "jobs": [],
                "chat_message": out_of_scope_message_by_lang(payload.language),
                "show_tips": True,
                "tips_categories": [
                    "Delivery",
                    "Cleaning",
                    "IT/Digital",
                    "__remote__",
                    "__no_experience__",
                    "__junior__",
                    "__senior__",
                ],
            }

        db_name = os.getenv("MONGO_DB_NAME", "test")
        db = mongo_client.get_database(db_name)
        jobs_col = db.get_collection("jobs")

        query: Dict[str, Any] = {
            "$and": [
                {
                    "$or": [
                        {"status": "open"},
                        {"status": {"$exists": False}},
                        {"status": None},
                    ]
                }
            ]
        }

        if filters.get("category"):
            query["$and"].append({"category": filters["category"]})

        text_conditions = []

        for keyword in filters.get("jobTitleKeywords", []):
            kw = str(keyword).strip()
            if not kw:
                continue
            text_conditions.append(
                {
                    "$or": [
                        {"title": {"$regex": re.escape(kw), "$options": "i"}},
                        {"description": {"$regex": re.escape(kw), "$options": "i"}},
                    ]
                }
            )

        for skill in filters.get("skills", []):
            sk = str(skill).strip()
            if not sk:
                continue
            text_conditions.append(
                {
                    "$or": [
                        {"title": {"$regex": re.escape(sk), "$options": "i"}},
                        {"description": {"$regex": re.escape(sk), "$options": "i"}},
                    ]
                }
            )

        if filters.get("location"):
            text_conditions.append(
                {
                    "location.address": {
                        "$regex": re.escape(str(filters["location"])),
                        "$options": "i",
                    }
                }
            )

        query["$and"].extend(text_conditions)

        jobs = list(jobs_col.find(query).limit(150))

        if not jobs:
            broad_query: Dict[str, Any] = {
                "$or": [
                    {"status": "open"},
                    {"status": {"$exists": False}},
                    {"status": None},
                ]
            }
            if filters.get("category"):
                broad_query["category"] = filters["category"]
            jobs = list(jobs_col.find(broad_query).limit(200))

        salary_min = to_number(filters.get("salaryMin"))
        salary_max = to_number(filters.get("salaryMax"))
        if salary_min is not None or salary_max is not None:
            filtered_jobs = []
            for job in jobs:
                value = salary_to_int(job.get("salary"))
                if value is None:
                    continue
                if salary_min is not None and value < salary_min:
                    continue
                if salary_max is not None and value > salary_max:
                    continue
                filtered_jobs.append(job)
            jobs = filtered_jobs

        selected_tier = str(filters.get("tier") or "").lower()
        if selected_tier in {"remote", "no_experience", "junior", "senior"}:
            jobs = [job for job in jobs if is_in_tier(job, selected_tier)]

        scored_jobs = []
        for job in jobs:
            job["matchScore"] = score_job(job, filters)
            scored_jobs.append(job)

        scored_jobs = sorted(
            scored_jobs,
            key=lambda item: (item.get("matchScore", 0), str(item.get("createdAt") or "")),
            reverse=True,
        )[:24]

        relaxed = False
        if not scored_jobs and filters.get("location"):
            relaxed = True
            relaxed_query: Dict[str, Any] = {
                "$or": [
                    {"status": "open"},
                    {"status": {"$exists": False}},
                    {"status": None},
                ]
            }
            if filters.get("category"):
                relaxed_query["category"] = filters["category"]

            fallback_jobs = list(jobs_col.find(relaxed_query).limit(150))
            if selected_tier in {"remote", "no_experience", "junior", "senior"}:
                fallback_jobs = [job for job in fallback_jobs if is_in_tier(job, selected_tier)]

            for job in fallback_jobs:
                job["matchScore"] = score_job(job, filters)

            scored_jobs = sorted(
                fallback_jobs,
                key=lambda item: (item.get("matchScore", 0), str(item.get("createdAt") or "")),
                reverse=True,
            )[:24]

        normalized_jobs = [normalize_job(item) for item in scored_jobs]

        lang_code = str(payload.language or "en").lower().split("-")[0]
        if lang_code == "km":
            # ប្រើឃ្លាដែលផ្ដល់អារម្មណ៍រាក់ទាក់ និងច្បាស់លាស់
            chat_message = f"ខ្ញុំរកឃើញការងារដែលត្រូវនឹងតម្រូវការរបស់អ្នកចំនួន {len(normalized_jobs)} កន្លែង។" 
        elif lang_code == "zh":
            # ឃ្លាភាសាចិនដែលមានលក្ខណៈអាជីព
            chat_message = f"根据您的需求，我为您找到了 {len(normalized_jobs)} 个匹配的岗位。"
        else:
            # ឃ្លាភាសាអង់គ្លេសដែលងាយស្រួលយល់
            chat_message = f"I've found {len(normalized_jobs)} jobs that match your preferences."

        return {
            "success": True,
            "type": "job_results",
            "intent": "job_search",
            "filters": filters,
            "relaxed": relaxed,
            "count": len(normalized_jobs),
            "jobs": normalized_jobs,
            "chat_message": chat_message,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("AI job search failed")
        raise HTTPException(status_code=500, detail=str(exc))

