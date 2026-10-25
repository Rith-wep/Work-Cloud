export const SKILL_SUGGESTIONS_BY_CATEGORY = {
  Delivery: [
    "Driver License",
    "Map Reading",
    "Route Planning",
    "Motorbike Riding",
    "Customer Service",
  ],
  Cleaning: [
    "Deep Cleaning",
    "Sanitization",
    "Time Management",
    "Attention to Detail",
    "Equipment Handling",
  ],
  Construction: [
    "Blueprint Reading",
    "Safety Compliance",
    "Welding",
    "Concrete Work",
    "Scaffolding",
  ],
  "IT/Digital": [
    "JavaScript",
    "React",
    "UI Design",
    "Data Entry",
    "Technical Support",
  ],
  Teaching: [
    "Lesson Planning",
    "Classroom Management",
    "Communication",
    "Curriculum Design",
    "Student Assessment",
  ],
  "Event Staff": [
    "Crowd Management",
    "Setup and Teardown",
    "Guest Support",
    "Team Coordination",
    "Time Management",
  ],
};

const SKILL_KEY_MAP = {
  "driver license": "driver_license",
  "map reading": "map_reading",
  "route planning": "route_planning",
  "motorbike riding": "motorbike_riding",
  "customer service": "customer_service",
  "deep cleaning": "deep_cleaning",
  sanitization: "sanitization",
  "time management": "time_management",
  "attention to detail": "attention_to_detail",
  "equipment handling": "equipment_handling",
  "blueprint reading": "blueprint_reading",
  "safety compliance": "safety_compliance",
  welding: "welding",
  "concrete work": "concrete_work",
  scaffolding: "scaffolding",
  javascript: "javascript",
  react: "react",
  "ui design": "ui_design",
  "data entry": "data_entry",
  "technical support": "technical_support",
  "lesson planning": "lesson_planning",
  "classroom management": "classroom_management",
  communication: "communication",
  "curriculum design": "curriculum_design",
  "student assessment": "student_assessment",
  "crowd management": "crowd_management",
  "setup and teardown": "setup_teardown",
  "guest support": "guest_support",
  "team coordination": "team_coordination",
};

export const normalizeSkill = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const toSkillKey = (value = "") => {
  const normalized = normalizeSkill(value);
  return (
    SKILL_KEY_MAP[normalized] ||
    normalized
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
};

export const getCandidateSkillSet = (skills = []) => {
  const list = Array.isArray(skills) ? skills : [];
  return new Set(
    list
      .map((skill) => {
        if (typeof skill === "string") return normalizeSkill(skill);
        return normalizeSkill(skill?.name || "");
      })
      .filter(Boolean)
  );
};

export const canAccessMatching = (user) => Boolean(user);

export const getMatchedSkills = (userSkills = [], jobSkills = []) => {
  const userSet = new Set(
    (Array.isArray(userSkills) ? userSkills : [])
      .map((skill) => (typeof skill === "string" ? skill : String(skill?.name || "")))
      .map((skill) => toSkillKey(skill))
      .filter(Boolean)
  );

  const jobList = (Array.isArray(jobSkills) ? jobSkills : [])
    .map((skill) => String(skill || "").trim())
    .filter(Boolean);

  return jobList.filter((skill) => userSet.has(toSkillKey(skill)));
};

export const getTopSkills = (skills = [], limit = 3) =>
  (Array.isArray(skills) ? skills : [])
    .map((skill) => String(skill || "").trim())
    .filter(Boolean)
    .slice(0, limit);

export const extractJobSkillKeys = (job = {}) => {
  const requiredSkills = Array.isArray(job?.requiredSkills)
    ? job.requiredSkills
    : typeof job?.requirements === "string"
      ? job.requirements.split(",")
      : [];

  return requiredSkills
    .map((entry) => toSkillKey(String(entry || "").trim()))
    .filter(Boolean);
};

export const calculateMatchScore = (userProfile = {}, job = {}) => {
  const selectedCategoryKeys = new Set(
    (Array.isArray(userProfile?.selectedCategories) ? userProfile.selectedCategories : [])
      .map((entry) => toSkillKey(String(entry || "").trim()))
      .filter(Boolean)
  );
  const selectedSkillKeys = new Set(
    (Array.isArray(userProfile?.selectedSkills) ? userProfile.selectedSkills : [])
      .map((entry) => toSkillKey(String(entry || "").trim()))
      .filter(Boolean)
  );

  const jobCategoryKey = toSkillKey(String(job?.category || "").trim());
  const jobSkillKeys = extractJobSkillKeys(job);

  const categoryMatch = selectedCategoryKeys.has(jobCategoryKey);
  const matchedSkillCount = jobSkillKeys.filter((skillKey) => selectedSkillKeys.has(skillKey)).length;
  const skillMatchRatio = jobSkillKeys.length > 0 ? matchedSkillCount / jobSkillKeys.length : 0;

  const categoryWeight = 45;
  const skillWeight = 55;
  const score = (categoryMatch ? categoryWeight : 0) + skillMatchRatio * skillWeight;

  return Math.max(0, Math.min(100, Math.round(score)));
};
