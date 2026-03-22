# 🎨 LiveBoard — Vercel Edition

Real-time collaborative whiteboard. Draw together, live, with anyone.  
This version is rebuilt to work on **Vercel** using **Pusher Channels** for real-time sync.

---

## Why the change?

The original used Socket.IO with a Node.js server. Vercel is **serverless** — it doesn't
keep servers running between requests, so persistent WebSocket connections don't work.

This version uses **Pusher Channels**, a hosted real-time service that works perfectly
with serverless deployments. The drawing logic is 100% identical.

---

## Setup (5 minutes)

### Step 1 — Create a free Pusher account

1. Go to **https://pusher.com** → Sign up (free)
2. Click **"Create app"**
3. Give it a name (e.g. `liveboard`), pick a cluster close to you (e.g. `us2` or `eu`)
4. Go to **App Keys** — you'll see `app_id`, `key`, `secret`, `cluster`

### Step 2 — Enable client events

In your Pusher app → **App Settings** → turn on **"Enable client events"** → Save

> This allows users to send drawing events directly without going through a server.

### Step 3 — Add env vars to Vercel

In your Vercel project:  
**Settings → Environment Variables** → add all four:

| Name              | Value                      |
|-------------------|---------------------------|
| `PUSHER_APP_ID`   | (from Pusher App Keys)    |
| `PUSHER_KEY`      | (from Pusher App Keys)    |
| `PUSHER_SECRET`   | (from Pusher App Keys)    |
| `PUSHER_CLUSTER`  | e.g. `us2` or `eu`        |

### Step 4 — Deploy

Push to GitHub → Vercel auto-deploys, OR run:

```bash
npx vercel --prod
```

---

## How it works

| Feature                  | How                                                  |
|--------------------------|------------------------------------------------------|
| Live drawing sync        | Pusher client events (batched every 50ms)            |
| Cursor tracking          | Pusher client events (throttled to 10/s)             |
| New user board sync      | Peer-to-peer: existing user sends their stroke array |
| Shapes & text            | Committed strokes broadcast to all                   |
| Undo / Clear             | Broadcast to all; each client updates locally        |
| User presence            | Pusher presence channels                             |

---

## Pusher Free Tier limits

| Limit                  | Free tier        | Notes                     |
|------------------------|------------------|---------------------------|
| Messages / day         | 200,000          | More than enough           |
| Concurrent connections | 100              | 100 people at once         |
| Channels               | Unlimited        |                            |

---

## Local development

```bash
npm install
npx vercel dev     # runs local dev server with API routes
```

Set env vars in a `.env.local` file (copy from `.env.example`).

---

## Project structure

```
├── api/
│   ├── config.js          ← serves Pusher public key to browser
│   └── pusher-auth.js     ← authenticates Pusher presence channels
├── public/
│   ├── index.html
│   ├── app.js             ← all drawing + Pusher logic
│   └── style.css
├── vercel.json
└── package.json
```
