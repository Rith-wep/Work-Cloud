ALLOWED_CATEGORIES = [
    "Delivery",
    "Cleaning",
    "Construction",
    "IT/Digital",
    "Teaching",
    "Event Staff",
]

EXPERIENCE_LEVELS = ["entry", "junior", "senior"]

CATEGORY_ALIASES = {
    "Delivery": [
        "delivery", "deliver", "driver", "courier", "logistics",
        "ដឹកជញ្ជូន", "អ្នកដឹក", "配送", "快递",
    ],
    "Cleaning": [
        "cleaning", "cleaner", "housekeeping", "janitor",
        "សម្អាត", "អ្នកសម្អាត", "清洁", "保洁",
    ],
    "Construction": [
        "construction", "builder", "labor", "labour", "worker",
        "សំណង់", "កម្មករ", "建筑", "工地",
    ],
    "IT/Digital": [
        "it", "digital", "developer", "software", "tech", "programmer",
        "web developer", "frontend", "backend", "engineer",
        "ព័ត៌មានវិទ្យា", "អាយធី", "技术", "互联网", "开发",
    ],
    "Teaching": [
        "teaching", "teacher", "tutor", "education",
        "បង្រៀន", "គ្រូ", "教学", "老师",
    ],
    "Event Staff": [
        "event", "staff", "promoter", "usher",
        "ព្រឹត្តិការណ៍", "បុគ្គលិកព្រឹត្តិការណ៍", "活动", "会展",
    ],
}

JOB_ROLE_KEYWORDS = [
    "backend", "frontend", "fullstack", "full stack", "developer", "engineer",
    "designer", "teacher", "tutor", "cleaner", "driver", "courier",
    "java", "python", "react", "node", "php", "spring boot",
    "manager", "staff", "worker", "intern", "sales", "marketing",
]

SKILL_KEYWORDS = [
    "java", "spring", "spring boot", "python", "django", "flask",
    "javascript", "typescript", "react", "vue", "angular",
    "node", "nodejs", "express", "php", "laravel",
    "mysql", "postgresql", "mongodb", "docker", "kubernetes",
    "figma", "photoshop", "illustrator", "excel", "word",
    "english", "chinese", "khmer",
]

GREETING_WORDS = {
    "en": ["hi", "hello", "hey", "good morning", "good evening"],
    "km": ["សួស្តី", "ជំរាបសួរ", "ហាយ", "hello"],
    "zh": ["你好", "您好", "哈喽", "早上好", "晚上好"],
}

JOB_KEYWORDS = [
    "job", "jobs", "career", "work", "salary", "apply", "position",
    "vacancy", "hiring", "category", "location", "part time",
    "full time", "internship", "remote job",
    "ការងារ", "ប្រាក់ខែ", "ដាក់ពាក្យ",
    "工作", "职位", "薪资", "申请", "找工作",
]

SALARY_MIN_HINTS = [
    "above", "over", "more than", "at least", "starting from",
    "លើស", "ចាប់ពី", "至少", "高于",
]

SALARY_MAX_HINTS = [
    "below", "under", "less than", "up to",
    "ក្រោម", "តិចជាង", "以内", "低于",
]

REMOTE_YES_HINTS = [
    "remote", "work from home", "wfh", "from home", "online job",
    "ការងារពីផ្ទះ", "ពីផ្ទះ", "远程", "居家",
]

REMOTE_NO_HINTS = [
    "on-site", "onsite", "in office", "office only",
    "នៅកន្លែងធ្វើការ", "现场",
]

ENTRY_HINTS = [
    "no experience", "without experience", "fresh graduate",
    "entry level", "intern", "internship", "trainee",
    "អត់បទពិសោធន៍", "គ្មានបទពិសោធន៍", "ហាត់ការ",
    "无经验", "实习", "应届",
]

ENTRY_REGEX_PATTERNS = [
    r"\bno\s+exp(?:erience)?\b",
    r"\bwithout\s+exp(?:erience)?\b",
    r"\bentry[\s-]*level\b",
    r"\bintern(?:ship)?\b",
    r"\btrainee\b",
    r"\bfresh\s*grad(?:uate)?\b",
    r"អត់បទពិសោធន៍",
    r"គ្មានបទពិសោធន៍",
    r"无经验",
    r"没经验",
]

JUNIOR_HINTS = ["junior", "new staff", "new employee", "1 year", "2 years", "初级"]
SENIOR_HINTS = ["senior", "expert", "lead", "manager", "3 years", "5 years", "资深", "高级"]

ASSISTANT_IDENTITY_PATTERNS = [
    r"\bwho are you\b",
    r"\bwhat are you\b",
    r"អ្នកជា​នរណា",
    r"អ្នកជាអ្វី",
    r"你是谁",
    r"你是做什么的",
]