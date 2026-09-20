# PhishGuard Web (3D)

Your Tkinter PhishGuard project as a website: **Python (Flask) backend** + **3D frontend (HTML/CSS/JavaScript + Three.js)**, running on your own computer.

## Run it (3 steps)

1. Install Python 3.9+ (tick "Add Python to PATH" on Windows).
2. In a terminal, inside this folder:
   ```
   pip install -r requirements.txt
   cd backend
   python app.py
   ```
   (Shortcut: double-click `start.bat` on Windows, or run `./start.sh` on macOS/Linux.)
3. Open the address it prints, normally **http://127.0.0.1:8000**

Stop the server with `Ctrl+C`.

## AI features (optional)

Quiz, Email Simulator and Chat use Groq when a key is available. Without one they automatically use a built-in offline bank, so nothing ever errors.

1. Get a free key at console.groq.com
2. Copy `.env.example` to `.env` and paste the key after `GROQ_API_KEY=`
3. Restart `python app.py`. The badge (top right) turns green.

The key stays on the server and is never sent to the browser.

## Structure

```
backend/   app.py (Flask server + API), groq_client.py, modules_data.py,
           modules.txt, fallback_data.py, lab_data.py
frontend/  index.html, style.css, app.js (screens), scene.js (3D scene)
```

## Notes

- **Internet on first load:** Three.js loads from the jsDelivr CDN. For fully offline use, save
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js as `frontend/vendor/three.module.js`.
- If WebGL is unavailable, the site still works with a gradient background.
- The server only listens on 127.0.0.1 (your machine). The Victim/Attacker Lab is a client-side simulation:
  what you type on the fake login page never reaches the server.
- Set a different port with the `PORT` environment variable.

## Security

- Never commit `.env`. It is listed in `.gitignore`; only `.env.example` (placeholder values) belongs in the repo.
- If a real key was ever committed or shared, revoke it at console.groq.com and create a new one.
