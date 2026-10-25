from typing import List, Optional

from pydantic import BaseModel, Field


class AIJobSearchRequest(BaseModel):
    prompt: str = Field(..., min_length=2)
    language: str = "en"
    preferredCategory: Optional[str] = None
    preferredExperienceLevel: Optional[str] = None
    prefersRemote: Optional[bool] = None
    skills: List[str] = []
    isVerified: bool = False


class CVWorkExperienceItem(BaseModel):
    jobTitle: str = ""
    startDate: str = ""
    endDate: str = ""
    bulletPoints: List[str] = []


class CVAssistRequest(BaseModel):
    mode: str = Field(..., min_length=2)
    language: str = "en"
    inputText: Optional[str] = None
    jobTitle: Optional[str] = None
    selectedCategory: Optional[str] = None
    experienceLevel: Optional[str] = None
    selectedSkills: List[str] = []
    workExperience: List[CVWorkExperienceItem] = []
    professionalSummary: Optional[str] = None


class CatalogTermItem(BaseModel):
    kind: str = "skill"
    key: str
    label: str = ""
    usageCount: int = 0


class CatalogMergeSuggestionRequest(BaseModel):
    terms: List[CatalogTermItem] = []

