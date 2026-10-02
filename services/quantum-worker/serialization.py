import re
from typing import Any, Dict

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}", re.IGNORECASE),
    re.compile(r"crn:v1:[^\s\"']+", re.IGNORECASE),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", re.IGNORECASE),
]

def sanitize_payload(data: Any) -> Any:
    if isinstance(data, str):
        cleaned = data
        for pat in SECRET_PATTERNS:
            cleaned = pat.sub("[REDACTED_SECRET]", cleaned)
        return cleaned
    elif isinstance(data, dict):
        cleaned_dict = {}
        for k, v in data.items():
            if k.lower() in ("apikey", "token", "servicecrn", "authorization", "secret", "password"):
                cleaned_dict[k] = "[REDACTED_SECRET]"
            else:
                cleaned_dict[k] = sanitize_payload(v)
        return cleaned_dict
    elif isinstance(data, list):
        return [sanitize_payload(item) for item in data]
    return data
