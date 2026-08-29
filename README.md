# Hearth

Email warmup for your own mailboxes. Add two or more addresses and Hearth
sends short human emails between them, opens what arrives, pulls warmup mail
out of spam, and raises volume day by day.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

The app cannot keep a SQLite file on Vercel — that is what caused the 500.
After deploy, add these environment variables in the Vercel project, then
redeploy:

1. `ENCRYPTION_KEY` — 64 hex characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
2. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — from a free [Turso](https://turso.tech) database, so mailboxes persist
3. Optional `CRON_SECRET` — if set, protect `/api/warmup/tick`

Vercel Cron hits `/api/warmup/tick` once a day (Hobby limit). Use **Run now** anytime.

Without Turso the dashboard still loads, but data lives in `/tmp` and can reset.

## Add a mailbox

1. Click **Add mailbox**.
2. Choose Gmail, Outlook, Yahoo, or Custom.
3. Use an **app password** for Gmail and Yahoo — not your normal login.
4. Test the connection, then start warmup.

Hearth needs at least two addresses so they can write to each other.

## How warmup works

- Locally, a worker runs every two minutes.
- On Vercel, cron plus **Run now** drive the same cycle.
- Each mailbox starts around 4 emails/day and grows about 30% daily up to your cap.
- Incoming warmup mail is marked read, sometimes starred, and moved out of spam.
