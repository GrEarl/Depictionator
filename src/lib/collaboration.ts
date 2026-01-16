/**
 * WebSocket Server for Real-time Collaboration
 *
 * Features:
 * - Real-time card position sync
 * - Active users tracking
 * - Cursor position sharing
 * - Edit locking
 */

import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  editingCardId?: string;
}

export interface CardUpdate {
  cardId: string;
  x: number;
  y: number;
  userId: string;
}

export interface ConnectionUpdate {
  id: string;
  fromCardId: string;
  toCardId: string;
  type: 'timeline' | 'causal' | 'reference';
}

export function setupCollaborationServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.APP_BASE_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  // Track active users per map
  const mapUsers = new Map<string, Map<string, CollaborationUser>>();
  const editLocks = new Map<string, string>(); // cardId -> userId

  io.on('connection', (socket) => {
    let currentMapId: string | null = null;
    let currentUser: CollaborationUser | null = null;

    // Join a map room
    socket.on('join-map', (data: { mapId: string; user: CollaborationUser }) => {
      currentMapId = data.mapId;
      currentUser = data.user;

      socket.join(`map:${data.mapId}`);

      // Add user to active users
      if (!mapUsers.has(data.mapId)) {
        mapUsers.set(data.mapId, new Map());
      }
      mapUsers.get(data.mapId)!.set(socket.id, data.user);

      // Broadcast new user to others
      socket.to(`map:${data.mapId}`).emit('user-joined', data.user);

      // Send current users to new user
      const users = Array.from(mapUsers.get(data.mapId)!.values());
      socket.emit('active-users', users.filter(u => u.id !== data.user.id));
    });

    // Card position update
    socket.on('card-moved', (data: CardUpdate) => {
      if (!currentMapId) return;

      socket.to(`map:${currentMapId}`).emit('card-position-update', data);
    });

    // Connection created
    socket.on('connection-created', (data: ConnectionUpdate) => {
      if (!currentMapId) return;

      socket.to(`map:${currentMapId}`).emit('new-connection', data);
    });

    // Cursor position update
    socket.on('cursor-move', (data: { x: number; y: number }) => {
      if (!currentMapId || !currentUser) return;

      currentUser.cursor = data;
      socket.to(`map:${currentMapId}`).emit('cursor-update', {
        userId: currentUser.id,
        ...data
      });
    });

    // Request edit lock
    socket.on('request-edit-lock', (cardId: string) => {
      if (!currentUser) return;

      const currentLock = editLocks.get(cardId);

      if (!currentLock || currentLock === currentUser.id) {
        editLocks.set(cardId, currentUser.id);
        currentUser.editingCardId = cardId;

        socket.emit('edit-lock-granted', cardId);

        if (currentMapId) {
          socket.to(`map:${currentMapId}`).emit('card-locked', {
            cardId,
            userId: currentUser.id
          });
        }
      } else {
        socket.emit('edit-lock-denied', { cardId, lockedBy: currentLock });
      }
    });

    // Release edit lock
    socket.on('release-edit-lock', (cardId: string) => {
      if (!currentUser) return;

      if (editLocks.get(cardId) === currentUser.id) {
        editLocks.delete(cardId);
        currentUser.editingCardId = undefined;

        if (currentMapId) {
          io.to(`map:${currentMapId}`).emit('card-unlocked', cardId);
        }
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentMapId && currentUser) {
        // Remove user
        mapUsers.get(currentMapId)?.delete(socket.id);

        // Release any locks
        if (currentUser.editingCardId) {
          editLocks.delete(currentUser.editingCardId);
        }

        // Broadcast user left
        socket.to(`map:${currentMapId}`).emit('user-left', currentUser.id);
      }
    });
  });

  return io;
}
