# TimeSwap

Hiptime attendance, shift/holiday swap, and monthly summary export — with MongoDB persistence and login.

## Stack

- React + Vite
- Express + MongoDB Atlas
- Login tabs: normal users + admin account management (MongoDB users)
- Tailwind CSS · Lucide · React Router · date-fns

## Setup

1. Copy `.env.example` to `.env` and fill in:

```env
MONGODB_URI=mongodb+srv://...
AUTH_USERNAME=admin
AUTH_PASSWORD=your-strong-password
AUTH_SECRET=long-random-string
```

2. Install and run:

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  

On first start, an admin is created from `.env` (`AUTH_USERNAME` / `AUTH_PASSWORD`).  
Each login account has its **own workspace** (companies / attendance). New users start empty.  
Manage accounts from the **Admin** login tab → `/accounts`.

## Production (Railway / Render) — recommended

Host **frontend + API together**. Express serves `dist/` and `/api` on one URL.

```bash
npm ci && npm run build && npm start
```

### Environment variables (set in the host dashboard)

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | yes | Atlas connection string |
| `MONGODB_DB` | no | default `timeswap` |
| `AUTH_USERNAME` | yes* | first admin (*only if users empty) |
| `AUTH_PASSWORD` | yes* | first admin password |
| `AUTH_SECRET` | yes | long random JWT secret |
| `PORT` | no | host sets this automatically |

In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0` (or the host’s IPs) so Railway/Render can connect.

Do **not** set `VITE_API_BASE` or `VITE_BASE` on Railway/Render — same origin `/api` is enough.

### Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → this repo  
2. Add the env vars above  
3. Generate domain (Settings → Networking → Public Domain)  
4. Open the URL and log in  

`railway.toml` already sets build + start + `/api/health` check.

### Render

1. [render.com](https://render.com) → New → Blueprint → this repo (`render.yaml`)  
   or New Web Service → connect repo  
2. Build: `npm ci && npm run build` · Start: `npm start`  
3. Add the same env vars · Deploy  

### GitHub Pages (static only — no login API)

Pages cannot run Express. Use only for a static demo, or point `VITE_API_BASE` at a hosted API. Prefer Railway/Render for the real app.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/employees` | Employees |
| `/attendance` | Attendance log |
| `/swaps` | Shift & holiday swap |
| `/summary` | Monthly summary + Excel export |
| `/history` | Change history |
