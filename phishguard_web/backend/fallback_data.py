"""
Offline question banks, used automatically when there is no GROQ_API_KEY or the
AI call fails, so the site always works instead of showing errors.
"""

import random

QUIZ_BANK = [
    {"question": "What is the main goal of a phishing attack?",
     "options": ["To slow down your computer", "To trick you into revealing sensitive information", "To delete your files", "To update your software"],
     "answer": 1, "explain": "Phishing uses deception to steal credentials, financial data or personal information."},
    {"question": "Which sender address is most suspicious for a message claiming to be from PayPal?",
     "options": ["service@paypal.com", "support@paypa1.com", "no-reply@paypal.com", "help@mail.paypal.com"],
     "answer": 1, "explain": "'paypa1.com' swaps the letter l for the number 1 (typosquatting)."},
    {"question": "An email says 'Act within 24 hours or your account is closed'. What tactic is this?",
     "options": ["Urgency and fear", "Authentic customer care", "A routine newsletter", "Two-factor authentication"],
     "answer": 0, "explain": "Manufactured urgency stops you thinking carefully. Slow down and verify."},
    {"question": "What is the safest way to check where a link really goes?",
     "options": ["Click it and see", "Hover over it to preview the real URL", "Trust the link text", "Forward it to a friend"],
     "answer": 1, "explain": "Hovering (without clicking) shows the true destination in most email clients and browsers."},
    {"question": "Does the HTTPS padlock prove a website is legitimate?",
     "options": ["Yes, always", "Only on weekdays", "No, it only means the connection is encrypted", "Yes, if it is green"],
     "answer": 2, "explain": "Most phishing sites use HTTPS today. The padlock says nothing about who runs the site."},
    {"question": "Which URL really belongs to PayPal?",
     "options": ["https://paypal.com.secure-login.xyz/login", "https://www.paypal.com/myaccount", "https://paypal-verify.net/account", "https://secure.paypal.account-help.ru"],
     "answer": 1, "explain": "The real owner is the domain just before the first single slash: paypal.com."},
    {"question": "What is spear phishing?",
     "options": ["Mass emails sent to everyone", "A phishing attack tailored to one specific person", "A fake antivirus", "A hardware attack"],
     "answer": 1, "explain": "Spear phishing uses personal details (name, job, boss) to look convincing."},
    {"question": "You clicked a phishing link and entered your password. What should you do first?",
     "options": ["Ignore it", "Change the password from a safe device and enable 2FA", "Reply to the sender", "Delete the browser"],
     "answer": 1, "explain": "Change the password immediately, turn on 2FA, and report the incident."},
    {"question": "What does SMS phishing ('smishing') usually look like?",
     "options": ["A fake parcel or bank text with a link", "A calendar invite", "A software update notice from your OS", "A weather alert"],
     "answer": 0, "explain": "Smishing texts impersonate delivery firms or banks and push you to click quickly."},
    {"question": "How does two-factor authentication (2FA) help against phishing?",
     "options": ["It makes passwords longer", "A stolen password alone is not enough to log in", "It blocks all emails", "It hides your IP address"],
     "answer": 1, "explain": "Even if attackers steal your password they still need your second factor."},
    {"question": "An unexpected email from your 'CEO' asks for an urgent wire transfer. Best response?",
     "options": ["Send it quickly", "Verify by phone using a known number", "Reply asking for details", "Forward to the whole team"],
     "answer": 1, "explain": "Business email compromise relies on authority and urgency. Always verify out-of-band."},
    {"question": "Which attachment type from an unknown sender is most dangerous?",
     "options": [".txt", ".exe", ".png", ".ics"],
     "answer": 1, "explain": "Executables (.exe) and macro-enabled documents can install malware."},
]

EMAIL_BANK = [
    {"from_name": "Amazon Security", "from_email": "security@amazon-verify-login.com", "subject": "Your order has been suspended",
     "body": "Dear Customer, we could not verify your payment. Confirm your card details within 12 hours or your order will be cancelled.",
     "url": "http://amazon-verify-login.com/confirm", "is_phishing": True,
     "red_flags": ["Sender domain is not amazon.com", "Threatens cancellation to create urgency", "Generic greeting", "Asks for card details via a link"]},
    {"from_name": "IT Helpdesk", "from_email": "helpdesk@company-support.help", "subject": "Password expires today",
     "body": "Your mailbox password expires today. Click the link below and sign in to keep your email active.",
     "url": "https://company-support.help/owa", "is_phishing": True,
     "red_flags": ["Unusual '.help' domain instead of your real company domain", "Deadline pressure", "Requests your login through a link"]},
    {"from_name": "Netflix", "from_email": "info@netflix.com.account-verify.ru", "subject": "Payment declined - update now",
     "body": "We were unable to process your last payment. Update your billing information to avoid losing access.",
     "url": "https://netflix.com.account-verify.ru/login", "is_phishing": True,
     "red_flags": ["Real owner of the domain is account-verify.ru, not Netflix", "Urgent payment threat", "Link goes to a look-alike login page"]},
    {"from_name": "Tax Refund Office", "from_email": "refund@gov-tax-return.info", "subject": "You are eligible for a refund of $842.10",
     "body": "After the latest calculation you are owed a refund. Submit your bank details on the secure form to receive it.",
     "url": "http://gov-tax-return.info/claim", "is_phishing": True,
     "red_flags": ["Government agencies do not email refund forms", "Unofficial '.info' domain", "Asks for bank details", "Unexpected reward (greed)"]},
    {"from_name": "Parcel Service", "from_email": "delivery@parcel-tracking-uk.top", "subject": "Missed delivery - small fee required",
     "body": "We tried to deliver your parcel. Pay a 1.99 redelivery fee using the link below.",
     "url": "https://parcel-tracking-uk.top/pay", "is_phishing": True,
     "red_flags": ["Suspicious '.top' domain", "Small fee is a trick to capture card details", "You may not be expecting any parcel"]},
    {"from_name": "GitHub", "from_email": "noreply@github.com", "subject": "Your weekly digest is ready",
     "body": "Here is your weekly summary of activity in the repositories you watch. No action is required.",
     "url": "https://github.com/notifications", "is_phishing": False, "red_flags": []},
    {"from_name": "Google", "from_email": "no-reply@accounts.google.com", "subject": "New sign-in on your Windows device",
     "body": "We noticed a new sign-in to your account. If this was you, you don't need to do anything. If not, review your recent activity from your account page.",
     "url": "https://myaccount.google.com/notifications", "is_phishing": False, "red_flags": []},
    {"from_name": "Library Services", "from_email": "hello@citylibrary.org", "subject": "Your book is due back on Friday",
     "body": "A friendly reminder that 'Cybersecurity Basics' is due on Friday. You can renew it from your library account.",
     "url": "https://citylibrary.org/account", "is_phishing": False, "red_flags": []},
]

CHAT_TOPICS = [
    (("clicked", "phished", "fell for", "entered my password", "what should i do"),
     "Stay calm. Change the password from a safe device, enable 2FA, check other accounts that share the password, report it to your IT team or bank, and scan your device for malware."),
    (("what is phishing", "define phishing", "phishing mean"),
     "Phishing is a cyber attack where criminals pretend to be a trusted person or company to trick you into giving away passwords, card numbers or other sensitive data."),
    (("spot", "identify", "recognize", "red flag", "warning sign"),
     "Check the full sender address, look for urgency or threats, hover links to see the real URL, and watch for generic greetings or requests for passwords. When in doubt, go to the official site directly."),
    (("link", "url", "hover", "domain"),
     "Hover over a link to preview it. The real owner is the domain right before the first single '/'. 'paypal.com.secure-login.xyz' belongs to secure-login.xyz, not PayPal."),
    (("https", "padlock", "ssl"),
     "The HTTPS padlock only means the connection is encrypted. Over 80% of phishing sites use HTTPS, so it says nothing about whether the site is legitimate."),
    (("2fa", "two-factor", "two factor", "mfa"),
     "Two-factor authentication means a stolen password alone is not enough. Prefer an authenticator app or hardware key over SMS codes where possible."),
    (("spear", "whaling", "smishing", "vishing", "types"),
     "Main types: email phishing (mass), spear phishing (targeted at one person), whaling (executives), smishing (SMS), vishing (voice calls) and pharming (redirecting you to fake sites)."),
    (("report",),
     "Report phishing to your IT/security team or email provider's 'report phishing' button. In the UK use Action Fraud; in the USA use IC3 or reportphishing@apwg.org."),
    (("password",),
     "Use a unique password for every account, store them in a password manager, and turn on 2FA. Never enter a password on a page you reached from an unexpected message."),
]
CHAT_DEFAULT = ("I'm running in offline mode, so my answers are limited. Try asking about spotting phishing emails, "
                "checking links, what to do after clicking one, 2FA, or the types of phishing.")


def pick_quiz(n: int = 5):
    return random.sample(QUIZ_BANK, n)


def pick_emails():
    phishing = [e for e in EMAIL_BANK if e["is_phishing"]]
    legit = [e for e in EMAIL_BANK if not e["is_phishing"]]
    chosen = random.sample(phishing, 3) + random.sample(legit, 2)
    random.shuffle(chosen)
    return chosen


def offline_chat_reply(message: str) -> str:
    lower = message.lower()
    for keys, answer in CHAT_TOPICS:
        if any(k in lower for k in keys):
            return answer
    return CHAT_DEFAULT
