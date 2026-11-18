import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSocket } from './socket.js';
import { Product } from './models/Product.js';
import { seedDatabase } from './scripts/seed.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

async function bootstrap() {
  try {
    await connectDB();

    // Auto-seed only in non-production or when DB is empty
    const prodCount = await Product.countDocuments();
    if (prodCount === 0) {
      console.log('[Server] No products found. Auto-seeding catalog...');
      await seedDatabase(false);
    }

    const server = http.createServer(app);

    // In production, same-origin so no CORS needed for Socket.IO
    const clientOrigin = process.env.NODE_ENV === 'production'
      ? false  // same-origin, Socket.IO will not add CORS headers
      : (process.env.CLIENT_ORIGIN || '*');

    initSocket(server, clientOrigin);

    server.listen(PORT, HOST, () => {
      console.log(`🚀 StockTrace running on http://${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      // Force exit after 10s if connections hang
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (err) {
    console.error('[Server] Fatal error during startup:', err);
    process.exit(1);
  }
}

bootstrap();
