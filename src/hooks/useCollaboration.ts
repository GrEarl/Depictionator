"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  editingCardId?: string;
}

export interface UseCollaborationOptions {
  mapId: string;
  userId: string;
  userName: string;
  onCardMoved?: (data: { cardId: string; x: number; y: number; userId: string }) => void;
  onConnectionCreated?: (data: any) => void;
  onCardLocked?: (data: { cardId: string; userId: string }) => void;
  onCardUnlocked?: (cardId: string) => void;
}

const USER_COLORS = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
];

export function useCollaboration(options: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const userColor = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);

  // Initialize socket connection
  useEffect(() => {
    const socket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);

      // Join map room
      socket.emit('join-map', {
        mapId: options.mapId,
        user: {
          id: options.userId,
          name: options.userName,
          color: userColor.current
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Active users
    socket.on('active-users', (users: CollaborationUser[]) => {
      setActiveUsers(users);
    });

    socket.on('user-joined', (user: CollaborationUser) => {
      setActiveUsers(prev => [...prev, user]);
    });

    socket.on('user-left', (userId: string) => {
      setActiveUsers(prev => prev.filter(u => u.id !== userId));
    });

    // Card updates
    socket.on('card-position-update', (data: any) => {
      options.onCardMoved?.(data);
    });

    socket.on('new-connection', (data: any) => {
      options.onConnectionCreated?.(data);
    });

    // Edit locks
    socket.on('card-locked', (data: { cardId: string; userId: string }) => {
      options.onCardLocked?.(data);
    });

    socket.on('card-unlocked', (cardId: string) => {
      options.onCardUnlocked?.(cardId);
    });

    // Cursor updates
    socket.on('cursor-update', (data: { userId: string; x: number; y: number }) => {
      setActiveUsers(prev =>
        prev.map(u =>
          u.id === data.userId
            ? { ...u, cursor: { x: data.x, y: data.y } }
            : u
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [options.mapId, options.userId, options.userName]);

  // Broadcast card move
  const broadcastCardMove = useCallback((cardId: string, x: number, y: number) => {
    socketRef.current?.emit('card-moved', {
      cardId,
      x,
      y,
      userId: options.userId
    });
  }, [options.userId]);

  // Broadcast connection
  const broadcastConnection = useCallback((connection: any) => {
    socketRef.current?.emit('connection-created', connection);
  }, []);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    socketRef.current?.emit('cursor-move', { x, y });
  }, []);

  // Request edit lock
  const requestEditLock = useCallback((cardId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      socketRef.current.emit('request-edit-lock', cardId);

      const handleGranted = (grantedCardId: string) => {
        if (grantedCardId === cardId) {
          socketRef.current?.off('edit-lock-granted', handleGranted);
          socketRef.current?.off('edit-lock-denied', handleDenied);
          resolve(true);
        }
      };

      const handleDenied = (data: any) => {
        if (data.cardId === cardId) {
          socketRef.current?.off('edit-lock-granted', handleGranted);
          socketRef.current?.off('edit-lock-denied', handleDenied);
          resolve(false);
        }
      };

      socketRef.current.on('edit-lock-granted', handleGranted);
      socketRef.current.on('edit-lock-denied', handleDenied);

      // Timeout after 3 seconds
      setTimeout(() => {
        socketRef.current?.off('edit-lock-granted', handleGranted);
        socketRef.current?.off('edit-lock-denied', handleDenied);
        resolve(false);
      }, 3000);
    });
  }, []);

  // Release edit lock
  const releaseEditLock = useCallback((cardId: string) => {
    socketRef.current?.emit('release-edit-lock', cardId);
  }, []);

  return {
    isConnected,
    activeUsers,
    broadcastCardMove,
    broadcastConnection,
    updateCursor,
    requestEditLock,
    releaseEditLock
  };
}
