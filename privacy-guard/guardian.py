import re
import json
import os
from mitmproxy import http

# Simple Regex Patterns
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
PHONE_PATTERN = re.compile(r'\b1[3-9]\d{9}\b') # Simple CN mobile pattern

def load_settings():
    try:
        settings_path = os.path.join(os.path.dirname(__file__), "settings.json")
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"[PrivacyGuard] Error loading settings: {e}")
    return {}

def redact(text, settings):
    modified = False
    
    if settings.get("block_email", True):
        if EMAIL_PATTERN.search(text):
            text = EMAIL_PATTERN.sub('[EMAIL_REDACTED]', text)
            modified = True
            
    if settings.get("block_phone", True):
        if PHONE_PATTERN.search(text):
            text = PHONE_PATTERN.sub('[PHONE_REDACTED]', text)
            modified = True
            
    return text, modified

def request(flow: http.HTTPFlow):
    settings = load_settings()
    if not settings.get("active", True):
        return

    if flow.request.content:
        # Simple check for text-based content
        ct = flow.request.headers.get("Content-Type", "")
        if "json" in ct or "text" in ct or "form" in ct:
            try:
                content = flow.request.get_text()
                if content:
                    new_content, modified = redact(content, settings)
                    if modified:
                        flow.request.set_text(new_content)
                        print(f"[PLUGIN] [PrivacyGuard] Redacted PII from Request to {flow.request.host}")
            except:
                pass

def response(flow: http.HTTPFlow):
    settings = load_settings()
    if not settings.get("active", True):
        return

    if flow.response.content:
        ct = flow.response.headers.get("Content-Type", "")
        if "json" in ct or "text" in ct:
            try:
                content = flow.response.get_text()
                if content:
                    new_content, modified = redact(content, settings)
                    if modified:
                        flow.response.set_text(new_content)
                        print(f"[PLUGIN] [PrivacyGuard] Redacted PII from Response from {flow.request.host}")
            except:
                pass
