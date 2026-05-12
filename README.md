# ARIA-Solana-Sniper
Trading sniper for memecoins 
# ARIA Telegram Terminal — Lead Capture Mini App

A polished Telegram **Mini App** that renders the ARIA Solana Sniper terminal
inside Telegram as a live, animated demo, and captures prospect leads
(name, email, Solana wallet) directly to your inbox + database.

```
  Telegram user        →  /start the bot  →  taps "OPEN TERMINAL"
        ↓
  Mini App opens inside Telegram (HTTPS)
        ↓
  Sees simulated live sniper activity (detections, buys, PnL, feed)
        ↓
  Fills form: name, email, Solana wallet, interest
        ↓
  Submit  →  /api/submit  (HMAC-verified initData)
        ↓
  SQLite save  →  Resend email to YOU  →  Telegram DM to YOU
        ↓
  Confirmation email to the prospect
```

## What you get

- **Telegram bot** with `/start` that opens the Mini App
- **Mini App** = your existing terminal HTML, modified:
  - Loads `telegram-web-app.js` SDK
  - Mock-data simulator generates realistic detections, safety filters, buys, sells, PnL — looks busy 24/7 with zero backend dependencies
  - Embedded **Request Access form** (name, email, Solana wallet, optional notes)
  - Uses Telegram's native `MainButton` for submit (proper Mini App UX)
  - Mobile-responsive (Telegram users are mostly on phones)
- **Secure backend** (Hono + better-sqlite3):
  - `POST /api/submit` — verifies Telegram `initData` HMAC so only real bot users can submit
  - Per-user rate limit (3/hour) to block abuse
  - SQLite lead storage with indexes + WAL mode
  - Email via **Resend** (free tier: 3,000 emails/month, no card)
  - Optional Telegram DM to you for every new lead
- **Railway-ready** Dockerfile + `railway.json` (healthcheck wired)

---

## Quick start — 20 minutes from clone to live

### 1. Create the Telegram bot (3 min)

1. Open Telegram, message **@BotFather**
2. Send `/newbot`, follow the prompts. You'll get a token like `8123456789:AAH...`. Save it.
3. Set a description and picture if you want: `/setdescription`, `/setuserpic`
4. Optional: `/setmenubutton` → set a default menu button text + URL (you'll fill in the URL after step 4)

### 2. Set up Resend for email (2 min)

1. Sign up at **https://resend.com** (free, no card required)
2. Create an API key (Dashboard → API Keys → Create). Copy it.
3. For first launch you can use `onboarding@resend.dev` as the from-address. Production: add your domain at Domains → Add Domain and verify the DNS records.

### 3. Get your Telegram chat ID (1 min, optional but recommended)

1. DM **@userinfobot** on Telegram
2. It replies with your numeric ID. Copy it.
3. **DM your new bot once** — say "hi" — so the bot has permission to message you back. (Telegram bots can only DM users who have opened a chat with them first.)

### 4. Deploy to Railway (10 min)

```bash
# Local: install Railway CLI if you haven't
npm i -g @railway/cli
railway login

# Push this folder to a GitHub repo, then:
railway init                      # link the repo to a new Railway project
railway up                        # initial deploy
```

In Railway dashboard:

1. **Variables tab** — set every value from `.env.example`:
   - `TELEGRAM_BOT_TOKEN` (from step 1)
   - `RESEND_API_KEY` (from step 2)
   - `ADMIN_EMAIL` — where leads get emailed
   - `FROM_EMAIL` — `onboarding@resend.dev` for testing, or your verified domain
   - `ADMIN_TELEGRAM_CHAT_ID` (from step 3) — for DM notifications
   - `PUBLIC_URL` — Railway gives you a domain like `https://aria-terminal-production.up.railway.app`. Set this.
   - `PORT` — Railway sets `PORT` automatically; leave the env var alone or set to `8080`
2. **Settings → Volumes** — add a volume mounted at `/data` so the SQLite DB survives redeploys. Set `DB_PATH=/data/leads.db` in variables.
3. **Settings → Networking** — generate a public domain. Copy it into `PUBLIC_URL`.

Once it boots, check logs — you should see:

```
[bot] telegram bot online   username=YourBotName
[http server listening]     port=8080  publicUrl=https://...
```

### 5. Wire the bot to the Mini App URL (1 min)

Back in **@BotFather** on Telegram:

1. `/mybots` → select your bot → **Bot Settings** → **Menu Button** → **Configure Menu Button**
2. Send your `PUBLIC_URL` (e.g. `https://aria-terminal-production.up.railway.app/`)
3. Send a button label, e.g. `🟢 OPEN TERMINAL`

Now every chat with your bot has a persistent menu button that opens the Mini App.

### 6. Test the full flow

1. In Telegram, DM your bot, send `/start`
2. Tap **OPEN TERMINAL** → Mini App opens, terminal animates
3. Scroll to the form, fill name + email + wallet
4. Tap Telegram's native **SUBMIT REQUEST** button at the bottom
5. Within ~5s: you get the lead email + Telegram DM, and the prospect gets a confirmation email

If anything's off, `railway logs` shows the request trace.

---

## Local dev

```bash
npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, RESEND_API_KEY, ADMIN_EMAIL

# Mini App needs HTTPS — Telegram won't load http://. Use ngrok:
npx ngrok http 8080
# Copy the https://...ngrok.io URL → paste into .env as PUBLIC_URL
# Also update the @BotFather menu button to that URL while testing

npm run dev
```

Open Telegram, message your bot, tap the menu button → Mini App loads from your local machine via the ngrok tunnel.

---

## File map

```
aria-telegram-terminal/
├── public/
│   └── index.html              # The Mini App — terminal + simulator + form
├── src/
│   ├── index.ts                # Entrypoint — boots bot + server
│   ├── config.ts               # Zod-validated env
│   ├── logger.ts               # Pino
│   ├── bot.ts                  # grammy Telegram bot
│   ├── server.ts               # Hono HTTP server + /api/submit
│   ├── telegram-auth.ts        # initData HMAC verification (CRITICAL)
│   ├── leads.ts                # SQLite lead storage
│   └── email.ts                # Resend client
├── Dockerfile
├── railway.json
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Security notes

- **initData HMAC verification is non-optional.** Without it, anyone could POST anything to `/api/submit` and pollute your lead DB. With it, the `tg_user_id` field is guaranteed by Telegram's signing key.
- **Burner wallet only.** The form collects PUBLIC wallet addresses. Never collect, log, or store private keys, seed phrases, or signed transactions. The validator rejects anything not matching Solana's base58 32–44-char address format.
- **Rate limit:** 3 submissions per Telegram user per hour. Tune in `src/server.ts` if needed.
- **No PII beyond name/email/wallet.** Don't add more fields without thinking about GDPR / your terms.
- **Disclaimer:** The HTML footer keeps the existing RISK NOTICE. Don't remove it.

---

## Inspecting leads

```bash
# On Railway, SSH into the container OR use the shell tab
sqlite3 /data/leads.db

sqlite> SELECT id, name, email, wallet, tg_username, created_at FROM leads ORDER BY id DESC LIMIT 20;
```

Or add `/stats` admin command (already wired) — DM your bot `/stats` to see the total count.

---

## Next steps (if this works and you want more)

- **Export to CSV**: add a `/export` admin command that DMs you a CSV of all leads
- **CRM webhook**: in `src/server.ts` after `saveLead`, POST to HubSpot / Pipedrive / Notion
- **Real backend data**: when the actual sniper from `sniper-solana` is hosted, point `index.html` at its `/api/snapshot` + `/api/stream` instead of running the simulator
- **Tier gating**: add a `/access` command that issues real ARIA license keys to approved leads
