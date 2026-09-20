"""Static data for the Victim / Attacker lab. Everything is a simulation."""

LAB = {
    "phishing": {
        "brand": "SecureBank",
        "from_name": "SecureBank Support",
        "from_email": "support@securebank-alerts.com",
        "subject": "Urgent: Your account will be suspended in 24 hours",
        "preview": "We noticed unusual sign-in activity on your account...",
        "body": [
            "Dear Customer,",
            "We detected unusual sign-in activity on your account from an unrecognized device.",
            "For your security, your account will be permanently suspended in 24 hours unless you verify your identity right away.",
            "Please click below to verify now and avoid interruption to your account.",
        ],
        "link_text": "Verify My Account",
        "fake_url": "https://securebank-alerts.com/verify",
        "real_domain": "securebank.com",
        "red_flags": [
            "Sender domain is 'securebank-alerts.com' - not the bank's real domain",
            "Creates urgency and fear ('suspended in 24 hours')",
            "Generic greeting ('Dear Customer') instead of your actual name",
            "Asks you to click a link and enter your password to 'verify'",
        ],
    },
    "safe": {
        "from_name": "GitHub",
        "from_email": "noreply@github.com",
        "subject": "Your weekly digest is ready",
        "preview": "Here's what happened in your repositories this week...",
        "body": [
            "Hi there,",
            "Here's a summary of activity in the repositories you watch this week: 3 new issues, 2 merged pull requests and 1 new release.",
            "No action is needed. You can change how often you get this digest in your notification settings on the site.",
        ],
        "verdict": "This one is a genuine, low-risk email: no urgency, no login required, nothing to verify.",
    },
}
