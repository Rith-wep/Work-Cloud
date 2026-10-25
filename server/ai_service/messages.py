def greeting_message_by_lang(lang: str) -> str:
    code = str(lang or "en").lower().split("-")[0]
    if code == "km":
        return "សួស្តី! ខ្ញុំអាចជួយស្វែងរកការងារតាមប្រភេទ តំបន់ ជំនាញ ឬប្រាក់ខែបាន។"
    if code == "zh":
        return "你好！我可以按类别、地点、技能或薪资帮你找工作。"
    return "Hi! I can help you find jobs by category, location, skills, or salary."


def identity_message_by_lang(lang: str) -> str:
    code = str(lang or "en").lower().split("-")[0]
    if code == "km":
        return "សួស្តី! ខ្ញុំគឺជា WorkCloud Bot ដើម្បីជួយអ្នកស្វែងរកការងារដែលសមស្របបំផុត។"
    if code == "zh":
        return "你好！我是 WorkCloud Bot，帮助你找到更匹配的工作机会。"
    return "Hello! I am WorkCloud Bot, your smart job assistant."


def out_of_scope_message_by_lang(lang: str) -> str:
    code = str(lang or "en").lower().split("-")[0]
    if code == "km":
        return "ខ្ញុំផ្តោតលើការស្វែងរកការងារ និងការលូតលាស់អាជីព។ ថ្ងៃនេះអ្នកកំពុងស្វែងរកការងារប្រភេទអ្វី?"
    if code == "zh":
        return "我专注于求职搜索和职业成长。你今天想找哪一类工作？"
    return "I specialize in job searches and career growth. What kind of job are you looking for today?"