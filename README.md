# 📦 StockTrace

> **Full-Stack MERN Inventory Movement Audit, Real-Time Billing & FIFO Tracking System**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-stocktrace--b72l.onrender.com-success?style=for-the-badge&logo=render)](https://stocktrace-b72l.onrender.com)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/Lahari-HS/stocktrace)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/react-18.3-blue?style=flat-square&logo=react)](https://react.dev)
[![Database](https://img.shields.io/badge/MongoDB-Atlas%20ReplicaSet-green?style=flat-square&logo=mongodb)](https://www.mongodb.com/atlas)

---

## 🚀 Live Links

- **Production URL:** [https://stocktrace-b72l.onrender.com](https://stocktrace-b72l.onrender.com)
- **API Health Check:** [https://stocktrace-b72l.onrender.com/api/health](https://stocktrace-b72l.onrender.com/api/health)
- **Source Code:** [https://github.com/Lahari-HS/stocktrace](https://github.com/Lahari-HS/stocktrace)

---

## 🌟 Key Features

- **Strict FIFO Inventory Depletion:**
  - Automated First-In, First-Out costing logic across multiple supplier lots and batches.
  - Accurate cost-of-goods-sold (COGS) and instantaneous profit calculation per sale.
- **Point of Sale (POS) & Billing:**
  - Fast barcode/search-based billing terminal.
  - Multi-item carts, instantaneous quantity validation, itemized returns, and receipt generation.
  - Guarded against overselling with clear conflict (`409 Conflict`) notifications.
- **Real-Time Synchronisation:**
  - Socket.IO powers sub-second updates across multiple cashier terminals, dashboards, and mobile devices.
- **Stock Movement & Audit Trail:**
  - Full traceability: Tracks Restocks, Sales, Inter-location Transfers (Shop ⇄ Godown), and Manual Adjustments.
  - Immutable movement records for accountability and audit compliance.
- **Physical Reconciliation & Variance Tracking:**
  - Count workflow comparing physical counts against system book quantities.
  - Automated variance calculation and adjustment posting with reason tracking.
- **Analytics & Reporting:**
  - Live dashboard with sales summaries, top-moving items, low-stock alerts, and profit margins.
  - Full CSV export capability for accounting.
- **Production Hardened:**
  - Helmet security headers, Gzip compression, and rate limiting on API routes.
  - Unified single-origin Express architecture serving API, WebSockets, and pre-built React SPA without CORS overhead.

---

## 🛠️ Architecture & Tech Stack

```
                     ┌─────────────────────────────────────────┐
                     │            Client (React SPA)           │
                     │   Vite + Tailwind CSS + Lucide + Router │
                     └────────────────────┬────────────────────┘
                                          │
                         HTTP / WebSocket │ (Same-Origin)
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Render Web Service (Node.js & Express)                    │
│                                                                              │
│   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   │
│   │   REST API (/api)  │   │  Socket.IO Server  │   │ Static SPA Server  │   │
│   │ Helmet / RateLimit │   │  Live broadcasts   │   │  SPA Fallback Route│   │
│   └─────────┬──────────┘   └────────────────────┘   └────────────────────┘   │
└─────────────┼────────────────────────────────────────────────────────────────┘
              ▼
┌───────────────────────────────┐
│     MongoDB Atlas (M0)        │
│  Multi-document Transactions  │
└───────────────────────────────┘
```

### Frontend
- **Framework:** React 18 (Vite bundler)
- **Styling:** Tailwind CSS, Tailwind Merge, Lucide React icons
- **Animations & Charts:** Framer Motion, Recharts, Canvas Confetti
- **Networking:** Fetch API with custom wrapper, Socket.IO Client

### Backend
- **Runtime:** Node.js (v20+)
- **Server:** Express 4
- **Realtime:** Socket.IO 4
- **Database:** MongoDB Atlas via Mongoose (with full multi-document transaction support)
- **Security & Ops:** Helmet, Compression, Morgan logging, Express Rate Limit, Zod validation

---

## 📁 Repository Structure

```text
stocktrace/
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── api/                # API client helper & endpoints
│   │   ├── components/         # POS, Products, Movements, Reconcile, Reports
│   │   ├── context/            # SocketContext, ThemeContext, ToastContext
│   │   ├── utils/              # Unit formatters and calculation helpers
│   │   ├── App.jsx             # React Router structure
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   └── vite.config.js
├── server/                     # Backend Node.js / Express application
│   ├── src/
│   │   ├── config/             # DB connection with Atlas & IPv4 resolution
│   │   ├── controllers/        # Billing, Products, Movements, Counts, Reports
│   │   ├── middleware/         # Central error handler, Zod validation
│   │   ├── models/             # Mongoose schemas (Product, StockLot, Bill, etc.)
│   │   ├── routes/             # Express API route declarations
│   │   ├── services/           # FIFO stock engine & reconciliation services
│   │   ├── app.js              # Express app configuration & middlewares
│   │   ├── server.js           # Server bootstrap & process lifecycle
│   │   └── socket.js           # Socket.IO instance and broadcast helpers
│   └── package.json
├── package.json                # Root orchestrator scripts
├── render.yaml                 # Render Blueprint deployment definition
├── DEPLOY.md                   # Step-by-step deployment and operational manual
└── .env.example                # Example environment variables
```

---

## 💻 Local Setup & Development

### 1. Prerequisites
- **Node.js** v20.x or higher
- **npm** v10.x or higher
- **Git**
- A **MongoDB Atlas** database connection string (or run local MongoDB)

### 2. Clone the Repository
```bash
git clone https://github.com/Lahari-HS/stocktrace.git
cd stocktrace
```

### 3. Environment Variables
Create a `.env` file in the `server` directory (or copy from `.env.example`):
```bash
cp .env.example server/.env
```
Populate `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/stocktrace?retryWrites=true&w=majority
CLIENT_ORIGIN=http://localhost:5173
```

### 4. Install Dependencies
```bash
npm install --prefix server
npm install --prefix client
```

### 5. Run the Application
In development, run the server and client concurrently:

```bash
# Terminal 1: Backend API & Socket Server
npm run dev:server

# Terminal 2: Frontend Vite Dev Server
npm run dev:client
```
Visit `http://localhost:5173` to interact with the development server.

### 6. Run Tests
```bash
npm run test
```

---

## 🚢 Production Deployment

The project includes a ready-to-deploy **Render Blueprint** (`render.yaml`).

### Deployment via Render Blueprint
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Select your forked or cloned repository (`stocktrace`).
4. Enter your secret environment variable:
   - `MONGO_URI`: `mongodb+srv://...`
5. Click **Apply**. Render will run:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Health check: `/api/health`

### Automatic Deployments
Every push to the `main` branch triggers an automated build and zero-downtime redeployment on Render:
```bash
git add -A
git commit -m "feat: your feature"
git push origin main
```

> [!NOTE]
> On Render's Free Tier, services spin down after 15 minutes of inactivity. First visits after sleep take ~30 seconds to wake. To prevent spin-downs, configure a free monitor like [UptimeRobot](https://uptimerobot.com) to ping `https://stocktrace-b72l.onrender.com/api/health` every 10 minutes.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
