import { Server } from 'socket.io';

let ioInstance = null;

export function initSocket(httpServer, clientOrigin = '*') {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

/**
 * Broadcast an event to all connected clients
 * @param {string} event 
 * @param {any} data 
 */
export function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, { ...data, timestamp: new Date() });
  }
}
