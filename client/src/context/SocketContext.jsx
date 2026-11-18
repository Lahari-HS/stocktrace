import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [status, setStatus] = useState('connecting'); // 'connected' | 'reconnecting' | 'disconnected'
  const [updatedProductId, setUpdatedProductId] = useState(null);
  const [latestMovement, setLatestMovement] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to server with ID:', socket.id);
      setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected successfully');
      setStatus('connected');
    });

    // Listen to stock and movement broadcasts
    socket.on('stock:updated', (data) => {
      if (data?.productId) {
        setUpdatedProductId(data.productId);
        // Clear highlight after 2.5s
        setTimeout(() => setUpdatedProductId(null), 2500);
      }
    });

    socket.on('movement:created', (data) => {
      if (data?.movement) {
        setLatestMovement(data.movement);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        status,
        updatedProductId,
        latestMovement,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
