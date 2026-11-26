# 📦 StockTrace

> **Real-Time Inventory Movement, FIFO Lot Tracking & POS Billing System**

🔗 **Live Deployment:** [https://stocktrace-b72l.onrender.com](https://stocktrace-b72l.onrender.com)  
🏥 **Health Check:** [https://stocktrace-b72l.onrender.com/api/health](https://stocktrace-b72l.onrender.com/api/health)

---

## ⚡ Highlights

- **FIFO Costing & Depletion:** Automatic First-In, First-Out lot deduction with real-time profit computation.
- **POS Billing:** Fast barcode/search billing, cart validation, receipts, and oversell protection (`409 Conflict`).
- **Real-Time Sync:** Socket.IO sub-second live updates across all connected cashier screens.
- **Audits & Reconciliation:** Track transfers (Shop ⇄ Godown), adjustments, and physical variance counts.
- **Reports & Dashboard:** Sales insights, top moving items, low-stock warnings, and CSV export.
- **Unified Architecture:** Express serves the REST API, Socket.IO, and built React client from a single origin.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Recharts
- **Backend:** Node.js, Express, Socket.IO, Helmet, Compression, Express Rate Limit
- **Database:** MongoDB Atlas (Replica Set with multi-document transactions)
- **Hosting:** Render (Web Service Blueprint)

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Clone repository
git clone https://github.com/Lahari-HS/stocktrace.git
cd stocktrace

# 2. Configure environment
cp .env.example server/.env
# Add your MONGO_URI in server/.env

# 3. Install dependencies
npm install --prefix server
npm install --prefix client

# 4. Run development servers
npm run dev:server   # Backend (port 5000)
npm run dev:client   # Frontend (Vite)
```

---

## 🚢 Deployment

The project is configured with a Render Blueprint (`render.yaml`). Every push to the `main` branch automatically builds and deploys to Render:

```bash
git add -A
git commit -m "your update"
git push origin main
```

*Note: On Render's free tier, the instance spins down after 15 minutes of inactivity; allow ~30s on first load after idle.*
