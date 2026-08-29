# Hearth

A local email warmup app. Add two or more of your mailboxes and Hearth quietly
sends short human emails between them, opens what arrives, pulls warmup mail
out of spam, and raises volume day by day.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Add a mailbox

1. Click **Add mailbox**.
2. Choose Gmail, Outlook, Yahoo, or Custom.
3. Use an **app password** for Gmail and Yahoo — not your normal login.
4. Test the connection, then start warmup.

Hearth needs at least two addresses so they can write to each other.

## How warmup works

- A background worker runs every two minutes after `npm run dev` or `npm start`.
- Each mailbox starts around 4 emails/day and grows about 30% daily up to your cap.
- Sends are spread through the day instead of going out in a burst.
- Incoming warmup mail is marked read, sometimes starred, and moved out of spam.
- About half of received warmup mail gets a short reply.

Mailbox passwords are encrypted at rest with `ENCRYPTION_KEY` in `.env.local`.
