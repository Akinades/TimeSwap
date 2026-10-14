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

## Production / GitHub Pages

### Why the site was blank / `main.jsx` 404

GitHub Pages was set to **Deploy from a branch → `main` / (root)**.  
That serves the **source** `index.html`, which points at `/src/main.jsx`.  
Browsers cannot run JSX — you must deploy the **Vite `dist/` build**.

### Fix (recommended)

1. In repo **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”).
2. Push to `main` — workflow `.github/workflows/deploy-pages.yml` builds with `VITE_BASE=/TimeSwap/` and deploys `dist/`.
3. Site URL: `https://<user>.github.io/TimeSwap/`

GitHub Pages is **static only** — it does **not** run Express/MongoDB.  
Host the API separately (Railway, Render, Fly.io, VPS), then set a repo variable:

- **Settings → Secrets and variables → Actions → Variables**  
  `VITE_API_BASE` = `https://your-api-host/api`

Never put `MONGODB_URI`, `AUTH_PASSWORD`, or `AUTH_SECRET` in the frontend.

### Host API + frontend together (simpler for login)

```bash
npm run build
npm start
```

Express serves `dist/` and `/api`. Use `VITE_BASE=/` (default) for that setup.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/employees` | Employees |
| `/attendance` | Attendance log |
| `/swaps` | Shift & holiday swap |
| `/summary` | Monthly summary + Excel export |
| `/history` | Change history |
