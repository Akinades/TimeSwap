# TimeSwap

Mock frontend for Hiptime attendance, shift/holiday swap, and monthly summary export.

## Stack

- React + Vite
- Express + MongoDB Atlas (workspace persistence)
- Tailwind CSS
- Lucide React
- React Router
- date-fns

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI` (Atlas connection string).
2. Install and run both API + frontend:

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  

`npm run server` starts the API only; `npm run dev:web` starts Vite only.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — metrics, upload mock, quick actions |
| `/attendance` | Attendance log with filters |
| `/swaps` | Shift & holiday swap calendar |
| `/summary` | Monthly summary + CSV export |
