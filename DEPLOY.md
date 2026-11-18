# StockTrace – Deployment Guide

## Architecture
Single Render web service: Node/Express serves the REST API, Socket.IO, **and** the pre-built React app from `client/dist` — one origin, no CORS issues.

## Environment Variables (set in Render dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ Yes | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `NODE_ENV` | ✅ Yes | Set to `production` |
| `NODE_VERSION` | ✅ Yes | `20.18.0` |
| `CLIENT_ORIGIN` | Optional | Allowed CORS origin (defaults to same-origin in production) |
| `PORT` | Auto | Render sets this automatically — do not override |

## First Deploy (Render Blueprint)

1. Push this repo to GitHub (public or private).
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect your GitHub account and select this repository.
4. Render will read `render.yaml` and create the `stocktrace` web service.
5. When prompted, paste your `MONGO_URI` (from MongoDB Atlas → Connect → Drivers).
6. Click **Apply** and wait ~3 minutes for the build to complete.

## MongoDB Atlas Setup

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → Add user with password.
3. **Network Access** → Add IP `0.0.0.0/0` (allow from anywhere — Render uses dynamic IPs).
4. **Connect** → Drivers → Copy the `mongodb+srv://` URI.
5. Replace `<password>` with your actual password.

## Redeploy

```bash
git add -A
git commit -m "your change"
git push origin main
```
Render auto-deploys on every push to `main`.

## Health Check

```
GET https://<your-service>.onrender.com/api/health
```
Returns `{ "status": "ok", "db": "connected" }` when healthy.

## Cold Starts (Free Tier)

Render free services spin down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. To keep it warm, use [UptimeRobot](https://uptimerobot.com) (free) to ping `/api/health` every 10 minutes.

## Local Development

```bash
# 1. Copy and fill in env vars
cp server/.env.example server/.env

# 2. Install all deps
npm install --prefix server
npm install --prefix client

# 3. Start dev servers (two terminals)
npm run dev:server
npm run dev:client
```
