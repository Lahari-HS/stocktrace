import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import productRoutes from './routes/productRoutes.js';
import lotRoutes from './routes/lotRoutes.js';
import billRoutes from './routes/billRoutes.js';
import movementRoutes from './routes/movementRoutes.js';
import countRoutes from './routes/countRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

// ── Security & performance ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Vite build uses inline scripts
}));
app.use(compression());

// ── CORS (same-origin in production, open in dev) ───────────────────────────
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true,
}));

// ── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiter on /api ─────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 300,              // 300 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api', apiLimiter);

app.use(express.json());

// ── Serve React build (production) ──────────────────────────────────────────
app.use(express.static(clientDist));

// ── Health check (DB-aware) ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const db = dbState === 1 ? 'connected' : 'down';
  res.status(db === 'connected' ? 200 : 503).json({
    status: db === 'connected' ? 'ok' : 'degraded',
    db,
    service: 'StockTrace API',
    time: new Date(),
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/products', productRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/counts', countRoutes);
app.use('/api/reports', reportRoutes);

// ── SPA fallback (React Router deep-link support) ───────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// ── Central Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
