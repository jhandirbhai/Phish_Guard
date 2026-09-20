"""
groq_client.py
Server-side Groq helper. The API key lives ONLY on the server (env var or .env)
and is never sent to the browser.
"""

import os
import json
import time

import requests

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")


class GroqError(Exception):
    """Raised with a short, user-presentable message."""


def has_key() -> bool:
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


def ask_groq(system_msg: str, messages, temperature: float = 0.7, retries: int = 1) -> str:
    """messages: a str (single user message) or a list of {role, content} dicts."""
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        raise GroqError("GROQ_API_KEY is not set.")

    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    payload = {
        "model": GROQ_MODEL,
        "temperature": temperature,
        "messages": [{"role": "system", "content": system_msg}] + messages,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    last_error = "Unknown error."
    for attempt in range(retries + 1):
        try:
            resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=25)
        except requests.exceptions.RequestException as exc:
            last_error = f"Could not reach Groq ({exc.__class__.__name__})."
        else:
            if resp.status_code == 200:
                try:
                    return resp.json()["choices"][0]["message"]["content"]
                except (KeyError, IndexError, ValueError):
                    last_error = "Groq returned an unexpected response."
            elif resp.status_code in (401, 403):
                raise GroqError("Groq rejected the API key. Check GROQ_API_KEY.")
            elif resp.status_code == 429:
                last_error = "Groq rate limit reached. Try again in a moment."
            else:
                last_error = f"Groq error (HTTP {resp.status_code})."
        if attempt < retries:
            time.sleep(1.0)
    raise GroqError(last_error)


def extract_json_array(content: str):
    """Models sometimes wrap JSON in ``` fences or add chatter. Pull out the array."""
    text = content.strip()
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON array found")
    return json.loads(text[start:end + 1])
