"""
PhishGuard web backend (Flask).

Run:   python app.py
Open:  http://127.0.0.1:8000

Serves the 3D frontend (../frontend) and a small JSON API:
  GET  /api/health      -> {ai: bool}
  GET  /api/modules     -> learning modules
  GET  /api/quiz        -> 5 questions   (Groq AI, or offline bank on any failure)
  GET  /api/simulator   -> 5 emails      (Groq AI, or offline bank on any failure)
  POST /api/chat        -> chatbot reply (Groq AI, or offline answer on any failure)
  GET  /api/lab         -> Victim/Attacker lab content (static simulation data)

The lab is a client-side simulation: whatever is typed into the fake login page
never leaves the browser and is never sent to this server.
"""

import os
import socket

from flask import Flask, jsonify, request, send_from_directory

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.abspath(os.path.join(HERE, "..", "frontend"))


def load_env_file(path):
    """Tiny .env reader (KEY=VALUE per line) so no extra dependency is needed."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


load_env_file(os.path.join(HERE, ".env"))
load_env_file(os.path.join(HERE, "..", ".env"))

# Imported after .env so GROQ_MODEL from .env is honoured.
import fallback_data as fb                                   # noqa: E402
from groq_client import GroqError, ask_groq, extract_json_array, has_key  # noqa: E402
from lab_data import LAB                                     # noqa: E402
from modules_data import load_modules                        # noqa: E402

app = Flask(__name__, static_folder=None)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


# ------------------------------------------------------------------ helpers
def valid_question(q):
    return (
        isinstance(q, dict)
        and isinstance(q.get("question"), str) and q["question"].strip()
        and isinstance(q.get("options"), list) and 2 <= len(q["options"]) <= 6
        and all(isinstance(o, str) and o.strip() for o in q["options"])
        and isinstance(q.get("answer"), int) and not isinstance(q["answer"], bool)
        and 0 <= q["answer"] < len(q["options"])
    )


def clean_question(q):
    return {
        "question": q["question"].strip(),
        "options": [o.strip() for o in q["options"]],
        "answer": q["answer"],
        "explain": str(q.get("explain", "")).strip(),
    }


def valid_email(e):
    return (
        isinstance(e, dict)
        and isinstance(e.get("subject"), str) and e["subject"].strip()
        and isinstance(e.get("body"), str) and e["body"].strip()
        and isinstance(e.get("is_phishing"), bool)
    )


def clean_email(e):
    flags = e.get("red_flags")
    flags = [str(f) for f in flags] if isinstance(flags, list) else []
    return {
        "from_name": str(e.get("from_name", "Unknown")).strip(),
        "from_email": str(e.get("from_email", "unknown@example.com")).strip(),
        "subject": e["subject"].strip(),
        "body": e["body"].strip(),
        "url": str(e.get("url", "")).strip(),
        "is_phishing": e["is_phishing"],
        "red_flags": flags if e["is_phishing"] else [],
    }


QUIZ_PROMPT = (
    "Generate exactly 5 multiple choice questions about phishing awareness. "
    "Vary the topics and difficulty. Respond ONLY with a JSON array. No extra text. Format:\n"
    '[{"question": "question text", "options": ["A", "B", "C", "D"], "answer": 0, '
    '"explain": "short explanation"}]\n'
    "answer is the 0-based index of the correct option. Put the correct option at a random index."
)

SIM_PROMPT = (
    "Generate exactly 5 emails for a phishing awareness simulator. 3 must be phishing, 2 must be "
    "legitimate. Make them realistic but clearly for training. Respond ONLY with a JSON array. "
    "No extra text. Format:\n"
    '[{"from_name": "name", "from_email": "email", "subject": "subject", "body": "body text", '
    '"url": "link", "is_phishing": true, "red_flags": ["flag1", "flag2"]}]\n'
    "Legitimate emails must have red_flags as an empty array []."
)

CHAT_SYSTEM = (
    "You are a friendly phishing awareness expert inside a training app. Give short, clear answers "
    "(under 120 words). Only discuss phishing, scams, and online safety; politely steer other "
    "topics back. Never write working phishing kits or attack instructions."
)


# ------------------------------------------------------------------- routes
@app.get("/api/health")
def health():
    return jsonify({"ai": has_key()})


@app.get("/api/modules")
def modules():
    data = load_modules()
    if not data:
        return jsonify({"error": "modules.txt could not be loaded."}), 500
    return jsonify({"modules": data})


@app.get("/api/quiz")
def quiz():
    notice = None
    if has_key():
        try:
            raw = ask_groq("You are a phishing awareness quiz generator. Only respond with valid JSON.",
                           QUIZ_PROMPT, temperature=0.9)
            questions = [clean_question(q) for q in extract_json_array(raw) if valid_question(q)]
            if len(questions) >= 3:
                return jsonify({"source": "ai", "questions": questions[:5]})
            notice = "The AI reply was incomplete, so the offline question bank was used."
        except GroqError as exc:
            notice = f"{exc} Using the offline question bank."
        except (ValueError, TypeError):
            notice = "The AI reply could not be read, so the offline question bank was used."
    return jsonify({"source": "offline", "notice": notice, "questions": fb.pick_quiz()})


@app.get("/api/simulator")
def simulator():
    notice = None
    if has_key():
        try:
            raw = ask_groq("You are a phishing awareness trainer. Only respond with valid JSON.",
                           SIM_PROMPT, temperature=0.9)
            emails = [clean_email(e) for e in extract_json_array(raw) if valid_email(e)]
            has_both = any(e["is_phishing"] for e in emails) and any(not e["is_phishing"] for e in emails)
            if len(emails) >= 3 and has_both:
                return jsonify({"source": "ai", "emails": emails[:5]})
            notice = "The AI reply was incomplete, so the offline email bank was used."
        except GroqError as exc:
            notice = f"{exc} Using the offline email bank."
        except (ValueError, TypeError):
            notice = "The AI reply could not be read, so the offline email bank was used."
    return jsonify({"source": "offline", "notice": notice, "emails": fb.pick_emails()})


@app.post("/api/chat")
def chat():
    body = request.get_json(silent=True) or {}
    raw_messages = body.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        return jsonify({"error": "No messages provided."}), 400

    messages = []
    for m in raw_messages[-10:]:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            text = m["content"].strip()[:1000]
            if text:
                messages.append({"role": m["role"], "content": text})
    if not messages or messages[-1]["role"] != "user":
        return jsonify({"error": "The last message must be from the user."}), 400

    if has_key():
        try:
            reply = ask_groq(CHAT_SYSTEM, messages, temperature=0.5).strip()
            if reply:
                return jsonify({"source": "ai", "reply": reply})
        except GroqError as exc:
            return jsonify({"source": "offline", "notice": str(exc),
                            "reply": fb.offline_chat_reply(messages[-1]["content"])})
    return jsonify({"source": "offline", "reply": fb.offline_chat_reply(messages[-1]["content"])})


@app.get("/api/lab")
def lab():
    return jsonify(LAB)


@app.errorhandler(404)
def not_found(_):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found."}), 404
    return "Not found", 404


@app.errorhandler(500)
def server_error(_):
    return jsonify({"error": "Something went wrong on the server."}), 500


@app.after_request
def no_cache(resp):
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/")
def index():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/<path:filename>")
def assets(filename):
    return send_from_directory(FRONTEND, filename)


# --------------------------------------------------------------------- main
def find_port(start=8000, tries=20):
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No free port found between 8000 and 8019.")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 0)) or find_port()
    print("\n  PhishGuard is running")
    print(f"  Open:  http://127.0.0.1:{port}")
    print(f"  AI:    {'Groq key found' if has_key() else 'no GROQ_API_KEY - using offline question bank'}")
    print("  Stop:  Ctrl+C\n")
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
