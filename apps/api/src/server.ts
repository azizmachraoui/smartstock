import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env';
import { app } from './app';
import { initSocket, closeSocket } from './socket';
import './models';

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(env.PORT, () => {
      console.log(`SmartStock API + Socket.IO on :${env.PORT}`);
      resolve();
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${env.PORT} is already in use. Stop the other process, then start again.`));
        return;
      }
      reject(err);
    });
  });
}

async function start() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('MongoDB connected');
    await mongoose.connection.syncIndexes();
    const server = http.createServer(app);
    initSocket(server);
    await listen(server);
    const shutdown = async () => {
      closeSocket();
      server.close();
      await mongoose.disconnect().catch(() => undefined);
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to start API: ${message}`);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  }
}

start();
