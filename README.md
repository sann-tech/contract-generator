# ⚡ DevZan Contract Generator — Multi-User Edition

A professional web development contract generator with **Google OAuth**, **cloud storage**, and **guest mode**.

---

## How It Works

| Mode | Auth | Storage | Features |
|------|------|---------|----------|
| **Guest** | None | Browser (localStorage) | Full contract builder, PDF, email |
| **Signed In** | Google | Server (SQLite) | Everything + synced across devices |

When a guest signs in, they're prompted to **import** their local contracts to their account.

---

## Setup (Local Development)

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Get Google OAuth credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Go to **APIs & Services → OAuth consent screen**
   - User Type: External
   - Fill in App name, support email
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
5. Copy your **Client ID** and **Client Secret**

### 3. Set environment variables
```bash
# Linux/Mac
export GOOGLE_CLIENT_ID="your-client-id-here"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
export SECRET_KEY="any-random-string-here"

# Windows (PowerShell)
$env:GOOGLE_CLIENT_ID="your-client-id-here"
$env:GOOGLE_CLIENT_SECRET="your-client-secret-here"
$env:SECRET_KEY="any-random-string-here"
```

### 4. Run
```bash
python app.py
# Open: http://127.0.0.1:5000
```

---

## Deploy to Railway

1. Push your project to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add these environment variables in Railway dashboard:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   SECRET_KEY=some-long-random-string
   OAUTHLIB_INSECURE_TRANSPORT=0
   ```
4. In Google Cloud Console, add your Railway URL to **Authorized redirect URIs**:
   ```
   https://your-app.railway.app/auth/google/callback
   ```

### Render.com
Same steps — set the same environment variables in the Render dashboard.

---

## Project Structure
```
devzan/
├── app.py              ← Flask backend (run this)
├── requirements.txt
├── devzan.db           ← Auto-created SQLite database
└── templates/
    └── index.html      ← Frontend UI
```

---

## Gmail Setup (for sending contract emails)
1. Enable **2-Step Verification** on your Google Account
2. Go to: Google Account → Security → **App Passwords**
3. Create an App Password for "Mail"
4. Use that password in the **Email Settings** section (NOT your regular password)

---

## Security Notes
- `OAUTHLIB_INSECURE_TRANSPORT=1` is set automatically in dev (HTTP). Remove this in production (Railway/Render handles HTTPS automatically).
- SMTP passwords are **never stored** on the server — they're entered per session in the browser.
- Each user's contracts are fully private — no user can access another user's contracts.