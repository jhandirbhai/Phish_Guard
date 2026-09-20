/**
 * app.js -- PhishGuard frontend (vanilla JS, no build step).
 * Screens: home, learn, sim, quiz, chat, lab. Hash routing (#/learn etc.).
 * All server text is inserted with textContent -- never innerHTML -- so
 * AI-generated content can't inject markup.
 */
import { initScene } from "./scene.js";

const view = document.getElementById("view");
const badge = document.getElementById("ai-badge");
let scene = null;          // 3D controller (null if WebGL/Three unavailable)
let navToken = 0;          // bumps on every navigation; stale async work checks it

// ------------------------------------------------------------------ helpers
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Like el.replaceChildren(), but skips null/false and flattens arrays (native replaceChildren
// would turn those into the text "null"/"false"/"[object ...]").
function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(path, {
      ...options,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON body */ }
    if (!res.ok) throw new Error((data && data.error) || `Server error (${res.status}).`);
    if (data === null) throw new Error("The server sent an unreadable response.");
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The request took too long. Please try again.");
    if (err instanceof TypeError) throw new Error("Cannot reach the PhishGuard server. Is app.py still running?");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function loadingView(text) {
  return h("div", { class: "panel loading" }, h("div", { class: "spinner" }), h("div", { text }));
}

function errorView(message, retry) {
  return h("div", { class: "panel" },
    h("p", { class: "error", text: message }),
    h("div", { class: "row" },
      retry && h("button", { class: "btn primary", onclick: retry, text: "Try again" }),
      h("button", { class: "btn", onclick: () => navigate("home"), text: "Back to menu" }),
    ),
  );
}

function backButton(label = "← Back to menu") {
  return h("button", { class: "btn ghost", onclick: () => navigate("home"), text: label });
}

function noticeBox(text) {
  return text ? h("div", { class: "notice", text }) : null;
}

// ------------------------------------------------------------------- router
const screens = {};

function navigate(name) {
  const target = `#/${name}`;
  if (location.hash === target) render(name);
  else location.hash = target;
}

function render(name) {
  if (!screens[name]) name = "home";
  const token = ++navToken;
  const alive = () => token === navToken;
  view.replaceChildren();
  const root = h("section", { class: `screen ${name}` });
  view.append(root);
  if (scene) scene.setMood(name);
  try {
    screens[name](root, alive);
  } catch (err) {
    console.error(err);
    root.replaceChildren(errorView("Something went wrong showing this page.", () => render(name)));
  }
  window.scrollTo({ top: 0 });
  view.focus({ preventScroll: true });
}

function route() {
  const m = location.hash.match(/^#\/([a-z]+)/);
  render(m ? m[1] : "home");
}

// --------------------------------------------------------------------- home
const MENU = [
  ["learn", "📚", "Learning Modules", "Slides on spotting and stopping phishing."],
  ["sim", "📧", "Email Simulator", "Judge 5 emails: phishing or legitimate?"],
  ["quiz", "🧠", "Phishing Quiz", "5 questions. Score 70%+ to pass."],
  ["chat", "💬", "Ask the AI", "Ask anything about phishing and scams."],
  ["lab", "🎣", "Victim / Attacker Lab", "Live the attack from both sides. A safe simulation."],
];

screens.home = (root) => {
  const cards = MENU.map(([id, icon, name, desc], i) => {
    const card = h("button", { class: `card${i === 4 ? " wide" : ""}`, onclick: () => navigate(id) },
      h("span", { class: "icon", text: icon }),
      h("span", { class: "name", text: name }),
      h("span", { class: "desc", text: desc }),
    );
    addTilt(card);
    return card;
  });
  root.append(
    h("div", { class: "hero" },
      h("h1", { text: "PhishGuard" }),
      h("p", { text: "Learn to spot phishing before it spots you. Practise on realistic emails, test yourself, and see exactly what an attacker sees." }),
    ),
    h("div", { class: "cards" }, cards),
    h("p", { class: "foot-note", text: "Everything here is a training simulation. Nothing you type is stored or sent to anyone." }),
  );
};

function addTilt(card) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  card.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(700px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateY(-3px)`;
  });
  card.addEventListener("pointerleave", () => { card.style.transform = ""; });
}

// ----------------------------------------------------------- learning modules
screens.learn = async (root, alive) => {
  root.append(loadingView("Loading modules…"));
  let modules;
  try {
    modules = (await api("/api/modules")).modules;
  } catch (err) {
    if (alive()) root.replaceChildren(errorView(err.message, () => render("learn")));
    return;
  }
  if (!alive()) return;

  let mi = 0, si = 0;
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const meta = h("span", { class: "meta" });
  const bar = h("i");
  const card = h("div", { class: "panel slide" });
  const prev = h("button", { class: "btn", text: "← Prev" });
  const next = h("button", { class: "btn primary", text: "Next →" });
  const finish = h("button", { class: "btn good", text: "🧠 Test yourself", onclick: () => navigate("quiz") });

  function paint(animate = true) {
    const mod = modules[mi];
    const slide = mod.slides[si];
    tabs.replaceChildren(...modules.map((m, i) =>
      h("button", {
        class: `tab${i === mi ? " active" : ""}`, role: "tab", "aria-selected": String(i === mi),
        onclick: () => { mi = i; si = 0; paint(); },
        text: `${m.icon} ${m.title}`,
      })));
    meta.textContent = `Module ${mi + 1}/${modules.length} · Slide ${si + 1}/${mod.slides.length}`;
    bar.style.width = `${((si + 1) / mod.slides.length) * 100}%`;
    card.className = `panel slide${animate ? " slide-anim" : ""}`;
    fill(card,
      h("h2", { text: slide.heading }),
      slide.blocks.map((b) => b.kind === "lines"
        ? h("pre", { class: "lines", text: b.lines.join("\n") })
        : h("p", { text: b.text })),
      slide.highlight && h("div", { class: "highlight", text: `💡 ${slide.highlight}` }),
    );
    const first = mi === 0 && si === 0;
    const last = mi === modules.length - 1 && si === mod.slides.length - 1;
    prev.disabled = first;
    next.hidden = last;
    finish.hidden = !last;
  }

  function step(delta) {
    const mod = modules[mi];
    if (delta > 0) {
      if (si < mod.slides.length - 1) si++;
      else if (mi < modules.length - 1) { mi++; si = 0; }
    } else if (si > 0) si--;
    else if (mi > 0) { mi--; si = modules[mi].slides.length - 1; }
    paint();
  }
  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));

  const onKey = (e) => {
    if (!alive()) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  };
  document.addEventListener("keydown", onKey);

  root.replaceChildren(
    h("h1", { class: "screen-title", text: "📚 Learning Modules" }),
    h("p", { class: "screen-sub", text: "Use the buttons or the ← → arrow keys." }),
    tabs,
    h("div", { class: "row between" }, meta),
    h("div", { class: "progress" }, bar),
    card,
    h("div", { class: "spacer" }),
    h("div", { class: "row" }, prev, next, finish, backButton()),
  );
  paint(false);
};

// ---------------------------------------------------------- email simulator
screens.sim = async (root, alive) => {
  root.append(loadingView("Generating 5 fresh emails…"));
  let data;
  try {
    data = await api("/api/simulator");
  } catch (err) {
    if (alive()) root.replaceChildren(errorView(err.message, () => render("sim")));
    return;
  }
  if (!alive()) return;

  const emails = data.emails;
  let i = 0, score = 0;

  function showEmail() {
    if (i >= emails.length) return showResult();
    const em = emails[i];
    const feedback = h("div", { "aria-live": "polite" });
    const btnPhish = h("button", { class: "btn danger", text: "🎣 Phishing" });
    const btnLegit = h("button", { class: "btn good", text: "✅ Legitimate" });

    function answer(guessedPhishing) {
      btnPhish.disabled = btnLegit.disabled = true;
      const correct = guessedPhishing === em.is_phishing;
      if (correct) score++;
      if (scene) scene.flash(correct ? "good" : "bad");
      const nextBtn = h("button", { class: "btn primary", onclick: () => { i++; showEmail(); },
        text: i === emails.length - 1 ? "See results →" : "Next email →" });
      feedback.replaceChildren(h("div", { class: `feedback ${correct ? "good" : "bad"}` },
        h("strong", { class: correct ? "good" : "bad", text: correct ? "Correct!" : "Not quite." }),
        ` This was ${em.is_phishing ? "PHISHING" : "LEGITIMATE"}.`,
        em.red_flags.length
          ? h("ul", {}, em.red_flags.map((f) => h("li", { text: f })))
          : h("div", { text: "No red flags: this is a genuine email." }),
      ), h("div", { class: "spacer" }), nextBtn);
      nextBtn.focus({ preventScroll: true });
    }
    btnPhish.addEventListener("click", () => answer(true));
    btnLegit.addEventListener("click", () => answer(false));

    fill(root,
      h("h1", { class: "screen-title", text: "📧 Email Simulator" }),
      h("p", { class: "screen-sub", text: `Email ${i + 1} of ${emails.length}: is it phishing or legitimate?` }),
      i === 0 && noticeBox(data.notice),
      h("div", { class: "email" },
        h("div", { class: "email-head" },
          h("div", { class: "subject", text: em.subject }),
          h("div", { class: "from", text: `From: ${em.from_name} <${em.from_email}>` })),
        h("div", { class: "email-body" },
          em.body.split(/\n+/).map((p) => h("p", { text: p })),
          em.url && h("span", { class: "fake-link", title: "Links are shown as text in this simulator", text: em.url }))),
      h("div", { class: "spacer" }),
      h("div", { class: "row" }, btnPhish, btnLegit, backButton("Quit")),
      feedback,
    );
  }

  function showResult() {
    const msg = score === emails.length ? "Perfect! You have a sharp eye."
      : score >= 3 ? "Nice work. Review the red flags you missed."
      : "Keep practising. Try the Learning Modules first.";
    root.replaceChildren(
      h("div", { class: "panel result" },
        h("h1", { class: "screen-title", text: "Simulator complete" }),
        h("div", { class: "score-big", text: `${score}/${emails.length}` }),
        h("p", { text: `You judged ${score} of ${emails.length} emails correctly. ${msg}` }),
        h("div", { class: "row center" },
          h("button", { class: "btn primary", onclick: () => render("sim"), text: "Play again" }),
          h("button", { class: "btn", onclick: () => navigate("learn"), text: "Learning modules" }),
          backButton("Menu"))),
    );
  }
  showEmail();
};

// --------------------------------------------------------------------- quiz
screens.quiz = async (root, alive) => {
  root.append(loadingView("Generating 5 fresh questions…"));
  let data;
  try {
    data = await api("/api/quiz");
  } catch (err) {
    if (alive()) root.replaceChildren(errorView(err.message, () => render("quiz")));
    return;
  }
  if (!alive()) return;

  const qs = data.questions;
  let qi = 0, score = 0;
  const LETTERS = "ABCDEF";

  function showQuestion() {
    if (qi >= qs.length) return showResult();
    const q = qs[qi];
    let chosen = -1;
    let submitted = false;
    const feedback = h("div", { "aria-live": "polite" });
    const action = h("button", { class: "btn primary", text: "Submit answer", disabled: true });
    const buttons = q.options.map((opt, idx) => h("button", {
      class: "option", type: "button",
      onclick: () => {
        if (submitted) return;
        chosen = idx;
        buttons.forEach((b, j) => b.classList.toggle("selected", j === idx));
        action.disabled = false;
      },
    }, h("span", { class: "dot" }), h("span", { text: `${LETTERS[idx]}. ${opt}` })));

    action.addEventListener("click", () => {
      if (!submitted) {
        if (chosen === -1) return;
        submitted = true;
        const correct = chosen === q.answer;
        if (correct) score++;
        if (scene) scene.flash(correct ? "good" : "bad");
        buttons.forEach((b, j) => {
          b.disabled = true;
          b.classList.remove("selected");
          if (j === q.answer) b.classList.add("correct");
          else if (j === chosen) b.classList.add("wrong");
        });
        feedback.replaceChildren(h("div", { class: `feedback ${correct ? "good" : "bad"}` },
          h("strong", { class: correct ? "good" : "bad", text: correct ? "Correct!" : "Incorrect." }),
          correct ? " " : ` The right answer is ${LETTERS[q.answer]}. `,
          q.explain));
        action.textContent = qi === qs.length - 1 ? "See results →" : "Next question →";
        action.focus({ preventScroll: true });
      } else {
        qi++;
        showQuestion();
      }
    });

    fill(root,
      h("h1", { class: "screen-title", text: "🧠 Phishing Quiz" }),
      h("p", { class: "screen-sub", text: `Question ${qi + 1} of ${qs.length}` }),
      qi === 0 && noticeBox(data.notice),
      h("div", { class: "panel" },
        h("div", { class: "progress" }, h("i", { style: `width:${(qi / qs.length) * 100}%` })),
        h("h2", { class: "q-title", text: q.question }),
        h("div", { class: "options", role: "group" }, buttons),
        feedback,
        h("div", { class: "row" }, action, backButton("Quit"))),
    );
  }

  function showResult() {
    const pct = Math.round((score * 100) / qs.length);
    const passed = pct >= 70;
    root.replaceChildren(h("div", { class: "panel result" },
      h("h1", { class: "screen-title", text: "Quiz complete" }),
      h("div", { class: "score-big", text: `${score}/${qs.length}` }),
      h("p", { text: `${pct}%` }),
      h("p", { class: passed ? "" : "error", text: passed ? "🎉 Passed!" : "Not passed. You need 70%." }),
      h("div", { class: "row center" },
        h("button", { class: "btn primary", onclick: () => render("quiz"), text: "New quiz" }),
        h("button", { class: "btn", onclick: () => navigate("learn"), text: "Learning modules" }),
        backButton("Menu"))));
    if (scene) scene.flash(passed ? "good" : "bad");
  }
  showQuestion();
};

// --------------------------------------------------------------------- chat
screens.chat = (root, alive) => {
  const history = [];         // {role, content}
  let busy = false;
  let warnedOffline = false;

  const log = h("div", { class: "chat-log", role: "log", "aria-live": "polite" });
  const input = h("input", { type: "text", maxlength: "500", placeholder: "Ask about phishing…", "aria-label": "Your question", autocomplete: "off" });
  const send = h("button", { class: "btn primary", type: "submit", text: "Send" });
  const chips = h("div", { class: "chips" });

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  function bubble(kind, text, small) {
    const b = h("div", { class: `bubble ${kind}` }, text, small && h("small", { text: small }));
    log.append(b);
    scrollDown();
    return b;
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    input.disabled = send.disabled = true;
    chips.remove();
    history.push({ role: "user", content: text });
    bubble("user", text);
    const typing = h("div", { class: "bubble ai" }, h("span", { class: "typing" }, h("i"), h("i"), h("i")));
    log.append(typing);
    scrollDown();
    try {
      const data = await api("/api/chat", { method: "POST", body: JSON.stringify({ messages: history.slice(-10) }) });
      if (!alive()) return;
      typing.remove();
      history.push({ role: "assistant", content: data.reply });
      const note = data.source === "offline" && !warnedOffline
        ? (data.notice || "Offline mode: short built-in answers. Add a GROQ_API_KEY for the full AI.") : null;
      if (note) warnedOffline = true;
      bubble("ai", data.reply, note);
    } catch (err) {
      if (!alive()) return;
      typing.remove();
      history.pop();          // let the user retry the same question
      bubble("err", err.message);
    } finally {
      if (alive()) {
        busy = false;
        input.disabled = send.disabled = false;
        input.focus();
      }
    }
  }

  ["How do I spot a phishing email?", "What should I do if I clicked a bad link?", "Does the HTTPS padlock mean a site is safe?", "What is spear phishing?"]
    .forEach((s) => chips.append(h("button", { class: "chip", type: "button", onclick: () => ask(s), text: s })));

  bubble("ai", "Hi! I'm your phishing awareness assistant. Ask me anything about spotting scams and staying safe online.");

  root.append(
    h("h1", { class: "screen-title", text: "💬 Ask the AI" }),
    h("p", { class: "screen-sub", text: "A phishing-awareness chatbot." }),
    h("div", { class: "panel" },
      log, chips,
      h("form", { class: "chat-form", onsubmit: (e) => { e.preventDefault(); ask(input.value); } }, input, send)),
    h("div", { class: "spacer" }),
    backButton(),
  );
  input.focus({ preventScroll: true });
};

// ---------------------------------------------- victim / attacker lab (story)
screens.lab = async (root, alive) => {
  root.append(loadingView("Setting up the lab…"));
  let lab;
  try {
    lab = await api("/api/lab");
  } catch (err) {
    if (alive()) root.replaceChildren(errorView(err.message, () => render("lab")));
    return;
  }
  if (!alive()) return;

  let stage = 0;                       // bumps per stage so old animations stop
  const live = (s) => alive() && s === stage;
  const goStage = (fn, mood = "lab") => {
    stage++;
    if (scene) scene.setMood(mood);
    root.replaceChildren();
    fn(stage);
    window.scrollTo({ top: 0 });
  };

  // 1. Inbox -------------------------------------------------------------
  function inbox() {
    const row = (mail, onclick) => h("button", { class: "inbox-row", onclick },
      h("div", { class: "from", text: mail.from_name }),
      h("div", { class: "subj", text: mail.subject }),
      h("div", { class: "prev", text: mail.preview }));
    root.append(
      h("h1", { class: "screen-title", text: "📥 Inbox: training simulation" }),
      h("p", { class: "screen-sub", text: "Nothing here is real. Click an email to open it." }),
      row(lab.phishing, () => goStage(() => emailView(lab.phishing))),
      row(lab.safe, () => goStage(() => safeView())),
      h("div", { class: "spacer" }),
      backButton(),
    );
  }

  function safeView() {
    const s = lab.safe;
    root.append(
      h("div", { class: "email" },
        h("div", { class: "email-head" }, h("div", { class: "subject", text: s.subject }),
          h("div", { class: "from", text: `From: ${s.from_name} <${s.from_email}>` })),
        h("div", { class: "email-body" }, s.body.map((p) => h("p", { text: p })))),
      h("div", { class: "feedback good" }, h("strong", { class: "good", text: "Genuine email. " }), s.verdict),
      h("div", { class: "spacer" }),
      h("button", { class: "btn", onclick: () => goStage(inbox), text: "← Back to inbox" }),
    );
  }

  // 2. The phishing email ------------------------------------------------
  function emailView(mail) {
    const status = h("div", { class: "statusbar", text: " " });
    const cta = h("button", { class: "email-cta", onclick: () => goStage(() => loginView(mail)), text: `${mail.link_text} →` });
    const showUrl = () => { status.textContent = mail.fake_url; };
    const hideUrl = () => { status.textContent = " "; };
    cta.addEventListener("pointerenter", showUrl); cta.addEventListener("focus", showUrl);
    cta.addEventListener("pointerleave", hideUrl); cta.addEventListener("blur", hideUrl);
    root.append(
      h("div", { class: "email" },
        h("div", { class: "email-head" }, h("div", { class: "subject", text: mail.subject }),
          h("div", { class: "from", text: `From: ${mail.from_name} <${mail.from_email}>` })),
        h("div", { class: "email-body" }, mail.body.map((p) => h("p", { text: p })), cta),
        status),
      h("p", { class: "meta", text: "Tip: hover the button to see where a link really goes. Real users rarely do." }),
      h("button", { class: "btn", onclick: () => goStage(inbox), text: "← Back to inbox" }),
    );
  }

  // 3. Fake login --------------------------------------------------------
  function loginView(mail) {
    const user = h("input", { type: "text", id: "lab-user", autocomplete: "off", placeholder: "you@example.com" });
    const pass = h("input", { type: "password", id: "lab-pass", autocomplete: "new-password", placeholder: "••••••••" });
    const form = h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        // Kept in memory only for the next two screens. Never sent to the server.
        const captured = { user: user.value.trim() || "(empty)", password: pass.value || "(empty)" };
        goStage(() => debrief(mail, captured));
      },
    },
      h("div", { class: "field" }, h("label", { for: "lab-user", text: "Email address" }), user),
      h("div", { class: "field" }, h("label", { for: "lab-pass", text: "Password" }), pass),
      h("button", { class: "email-cta", type: "submit", text: "Verify Account" }));
    root.append(
      h("div", { class: "browser" },
        h("div", { class: "browser-bar" },
          h("div", { class: "dots" }, h("i"), h("i"), h("i")),
          h("div", { class: "url", text: `🔒 ${mail.fake_url}` })),
        h("div", { class: "browser-page" },
          h("div", { class: "brandname", text: mail.brand }),
          h("div", { class: "lead", text: "Verify your identity to continue" }),
          h("div", { class: "sim-banner", text: "SIMULATION: type fake details, not your real ones. Nothing is validated, stored or sent anywhere." }),
          form)),
    );
    user.focus({ preventScroll: true });
  }

  // 4. Debrief -----------------------------------------------------------
  function debrief(mail, captured) {
    const fakeDomain = mail.from_email.split("@").pop();
    root.append(
      h("div", { class: "panel" },
        h("div", { class: "big-warn", text: "🎣 You just got phished!" }),
        h("p", { class: "meta", text: "This was a simulation. Nothing was actually sent anywhere." }),
        h("h3", { text: "Signs this email was phishing:" }),
        h("ul", { class: "flag-list" }, mail.red_flags.map((f) => h("li", { text: f }))),
        h("div", { class: "compare" },
          h("div", { class: "real", text: `✅ Real bank: ${mail.real_domain}` }),
          h("div", { class: "fake", text: `🚩 This email: ${fakeDomain}` }))),
      h("div", { class: "spacer" }),
      h("div", { class: "row" },
        h("button", { class: "btn danger", onclick: () => goStage(() => terminal(mail, captured), "attack"), text: "See what the attacker now has →" }),
        backButton("Menu")),
    );
  }

  // 5. Attacker terminal -------------------------------------------------
  function terminal(mail, captured) {
    const s = stage;
    let skip = false;
    const term = h("div", { class: "terminal", role: "log", "aria-label": "Simulated attacker terminal" });
    const skipBtn = h("button", { class: "btn ghost", text: "Skip animation ⏭", onclick: () => { skip = true; skipBtn.hidden = true; } });
    const domain = mail.from_email.split("@").pop();
    root.append(term, h("div", { class: "spacer" }), h("div", { class: "row" }, skipBtn));

    const scroll = () => { term.scrollTop = term.scrollHeight; };
    const line = (cls = "") => { const el = h("div", { class: `ln ${cls}` }); term.append(el); return el; };
    async function typeLine(text, cls, speed) {
      const el = line(cls);
      if (skip) { el.textContent = text; scroll(); return; }
      for (const ch of text) {
        if (!live(s)) return;
        if (skip) { el.textContent = text; break; }
        el.textContent += ch;
        scroll();
        await sleep(speed);
      }
      scroll();
      if (!skip) await sleep(140);
    }

    (async () => {
      const script = [
        ["$ nc -lvp 8080", "", 14], ["listening on [0.0.0.0] 8080 ...", "dim", 12],
        [`connection received: victim reached ${domain}`, "", 10], ["GET /verify HTTP/1.1", "dim", 6],
        [`Host: ${domain}`, "dim", 6], ["[+] phishing payload delivered", "", 10],
        ["[+] waiting for form submission...", "", 12], ["POST /verify HTTP/1.1", "dim", 6],
        ["Content-Type: application/x-www-form-urlencoded", "dim", 5],
        ["[+] form submitted: parsing credentials...", "", 12],
      ];
      for (const [t, c, sp] of script) {
        if (!live(s)) return;
        await typeLine(t, c, sp);
      }
      if (!live(s)) return;

      // progress bar
      term.append(h("div", { class: "ln" }, " "));
      const bar = line("yellow");
      for (let pct = 0; pct <= 100; pct += 10) {
        if (!live(s)) return;
        bar.textContent = `decrypting credentials... [${"#".repeat(pct / 10)}${"-".repeat(10 - pct / 10)}] ${pct}%`;
        scroll();
        if (!skip) await sleep(85);
      }
      if (!skip) await sleep(300);
      if (!live(s)) return;

      term.append(h("div", { class: "ln" }, " "));
      line("good").textContent = "[+] credentials extracted:";
      line("good").textContent = `      Email:    ${captured.user}`;
      line("good").textContent = `      Password: ${captured.password}`;
      term.append(h("div", { class: "ln" }, " "));
      line("dim").textContent = "[!] saving to loot.txt ... (not really: this is a simulation)";
      term.append(h("div", { class: "ln" }, " "));
      line("warn").textContent = "=".repeat(46);
      line("warn").textContent = "  REMEMBER: this was a SIMULATION.";
      line("warn").textContent = "  Real attackers use exactly this pattern.";
      line("warn").textContent = "  Verify senders. Hover links. Never trust urgency.";
      line("warn").textContent = "=".repeat(46);
      scroll();
      skipBtn.remove();
      captured.user = captured.password = "";   // drop it from memory now that the demo is over
      if (scene) scene.flash("bad");
      root.append(h("div", { class: "row" },
        h("button", { class: "btn primary", onclick: () => goStage(inbox), text: "↺ Replay the lab" }),
        h("button", { class: "btn", onclick: () => navigate("learn"), text: "📚 Learning modules" }),
        backButton("Menu")));
    })();
  }

  inbox();
};

// --------------------------------------------------------------------- boot
async function loadBadge() {
  try {
    const { ai } = await api("/api/health");
    badge.textContent = ai ? "● AI: Groq connected" : "● Offline mode (no API key)";
    badge.className = `badge ${ai ? "ok" : "warn"}`;
    badge.title = ai ? "Quiz, simulator and chat use the Groq AI."
      : "Quiz, simulator and chat use a built-in question bank. Add GROQ_API_KEY to enable AI.";
  } catch (_) {
    badge.textContent = "● Server unreachable";
    badge.className = "badge err";
  }
}

window.addEventListener("hashchange", route);
route();           // show the UI immediately; never wait on the 3D scene
loadBadge();
initScene(document.getElementById("bg"))
  .then((s) => {
    scene = s;
    if (scene) {
      const m = location.hash.match(/^#\/([a-z]+)/);
      scene.setMood(m && screens[m[1]] ? m[1] : "home");
    } else {
      document.getElementById("bg").style.display = "none";
    }
  })
  .catch(() => { document.getElementById("bg").style.display = "none"; });
