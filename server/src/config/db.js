import dns from 'dns';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Ensure IPv4 DNS resolution (important on some Linux/Windows environments)
dns.setDefaultResultOrder('ipv4first');

let replSet = null;

export async function connectDB() {
  // Accept both MONGO_URI and MONGODB_URI for compatibility
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    console.log('[Database] Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log('[Database] Connected to MongoDB Atlas successfully.');
    return;
  }

  // Fallback: embedded replica set for local dev without .env
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGO_URI env var is required in production. Set it in your Render dashboard.');
  }

  console.log('[Database] No MONGO_URI set — starting embedded MongoMemoryReplSet for local dev...');
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const replUri = replSet.getUri();
  await mongoose.connect(replUri);
  console.log(`[Database] Connected to embedded MongoMemoryReplSet at: ${replUri}`);
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
      replSet = null;
    }
    console.log('[Database] Disconnected cleanly.');
  } catch (err) {
    console.error('[Database] Error during disconnect:', err);
  }
}

export function getReplicaSet() {
  return replSet;
}
