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

## Production / GitHub deploy

GitHub Pages is **static only** — it cannot hide MongoDB credentials. Use this pattern:

1. Host the **API + built frontend** together (Railway, Render, Fly.io, VPS, etc.).
2. Build then start:

```bash
npm run build
npm start
```

The Express server serves `dist/` and protects `/api/workspace` behind login.

If the frontend is hosted separately, set:

```env
VITE_API_BASE=https://your-api-host/api
```

and rebuild. Never put `MONGODB_URI`, `AUTH_PASSWORD`, or `AUTH_SECRET` in the frontend or in a public repo.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/employees` | Employees |
| `/attendance` | Attendance log |
| `/swaps` | Shift & holiday swap |
| `/summary` | Monthly summary + Excel export |
| `/history` | Change history |
