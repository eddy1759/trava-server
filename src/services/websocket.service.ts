import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { cache } from './cache.service';
import logger from '../utils/logger';
import CONFIG from '../config/env';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  messageId?: string;
}

export interface WebSocketClient {
  id: string;
  userId: string;
  ws: WebSocket;
  rooms: Set<string>;
  isAlive: boolean;
  lastPing: number;
  userAgent?: string;
  ip?: string;
}

export interface RoomInfo {
  id: string;
  type: 'trip' | 'photo' | 'journal' | 'social';
  participants: Set<string>;
  metadata?: any;
  createdAt: Date;
  lastActivity: Date;
}

export interface WebSocketEvent {
  type: 'message' | 'join' | 'leave' | 'error' | 'disconnect' | 'reconnect';
  clientId: string;
  userId: string;
  roomId?: string;
  data?: any;
  timestamp: number;
}

class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private rooms: Map<string, RoomInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly CLIENT_TIMEOUT = 120000; // 2 minutes
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
  private readonly MAX_ROOM_PARTICIPANTS = 100;

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: this.MAX_MESSAGE_SIZE,
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanup();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', async (ws: WebSocket, request) => {
      try {
        await this.handleConnection(ws, request);
      } catch (error) {
        logger.error('Error handling WebSocket connection:', error);
        ws.close(1008, 'Authentication failed');
      }
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const token = this.extractToken(request);
    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, CONFIG.JWT_ACCESS_SECRET!) as any;
      const clientId = this.generateClientId();
      
      const client: WebSocketClient = {
        id: clientId,
        userId: decoded.userId,
        ws,
        rooms: new Set(),
        isAlive: true,
        lastPing: Date.now(),
        userAgent: request.headers['user-agent'],
        ip: this.getClientIP(request),
      };

      this.clients.set(clientId, client);
      this.setupClientHandlers(client);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        payload: {
          clientId,
          userId: decoded.userId,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      logger.info(`WebSocket client connected: ${clientId} (User: ${decoded.userId})`);
      this.emit('client:connected', { clientId, userId: decoded.userId });

    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Setup handlers for individual client
   */
  private setupClientHandlers(client: WebSocketClient): void {
    const { ws, id } = client;

    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(client, data);
      } catch (error) {
        logger.error(`Error handling message from client ${id}:`, error);
        this.sendError(client.id, 'Message processing failed');
      }
    });

    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPing = Date.now();
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClientDisconnect(client, code, reason.toString());
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${id}:`, error);
      this.handleClientDisconnect(client, 1011, 'Internal error');
    });
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(client: WebSocketClient, data: Buffer): Promise<void> {
    const message = this.parseMessage(data);
    if (!message) {
      this.sendError(client.id, 'Invalid message format');
      return;
    }

    // Rate limiting
    const rateLimitKey = `ws_rate_limit:${client.userId}`;
    const messageCount = await cache.get<number>(rateLimitKey, 'rate_limit') || 0;
    if (messageCount > 100) { // Max 100 messages per minute
      this.sendError(client.id, 'Rate limit exceeded');
      return;
    }
    await cache.set(rateLimitKey, messageCount + 1, { ttl: 60, prefix: 'rate_limit' });

    // Handle different message types
    switch (message.type) {
      case 'join_room':
        await this.handleJoinRoom(client, message.payload);
        break;
      case 'leave_room':
        await this.handleLeaveRoom(client, message.payload);
        break;
      case 'photo_upload':
        await this.handlePhotoUpload(client, message.payload);
        break;
      case 'photo_comment':
        await this.handlePhotoComment(client, message.payload);
        break;
      case 'journal_entry':
        await this.handleJournalEntry(client, message.payload);
        break;
      case 'social_activity':
        await this.handleSocialActivity(client, message.payload);
        break;
      case 'trip_update':
        await this.handleTripUpdate(client, message.payload);
        break;
      case 'ping':
        this.sendToClient(client.id, {
          type: 'pong',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
        break;
      default:
        this.sendError(client.id, `Unknown message type: ${message.type}`);
    }

    this.emit('message:received', {
      clientId: client.id,
      userId: client.userId,
      messageType: message.type,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle room joining
   */
  private async handleJoinRoom(client: WebSocketClient, payload: any): Promise<void> {
    const { roomId, roomType } = payload;
    
    if (!roomId || !roomType) {
      this.sendError(client.id, 'Invalid room parameters');
      return;
    }

    // Verify user has access to the room
    const hasAccess = await this.verifyRoomAccess(client.userId, roomId, roomType);
    if (!hasAccess) {
      this.sendError(client.id, 'Access denied to room');
      return;
    }

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        type: roomType,
        participants: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.rooms.set(roomId, room);
    }

    // Check room capacity
    if (room.participants.size >= this.MAX_ROOM_PARTICIPANTS) {
      this.sendError(client.id, 'Room is full');
      return;
    }

    // Join room
    room.participants.add(client.userId);
    client.rooms.add(roomId);
    room.lastActivity = new Date();

    // Notify room participants
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      payload: {
        userId: client.userId,
        roomId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    }, [client.userId]);

    // Send room info to joining client
    this.sendToClient(client.id, {
      type: 'room_joined',
      payload: {
        roomId,
        participants: Array.from(room.participants),
        metadata: room.metadata,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    logger.info(`User ${client.userId} joined room ${roomId}`);
  }

  /**
   * Handle room leaving
   */
  private async handleLeaveRoom(client: WebSocketClient, payload: any): Promise<void> {
    const { roomId } = payload;
    
    if (!roomId) {
      this.sendError(client.id, 'Room ID required');
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(client.id, 'Room not found');
      return;
    }

    // Leave room
    room.participants.delete(client.userId);
    client.rooms.delete(roomId);
    room.lastActivity = new Date();

    // Notify room participants
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      payload: {
        userId: client.userId,
        roomId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    // Clean up empty rooms
    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      logger.info(`Room ${roomId} deleted (no participants)`);
    }

    logger.info(`User ${client.userId} left room ${roomId}`);
  }

  /**
   * Handle photo upload events
   */
  private async handlePhotoUpload(client: WebSocketClient, payload: any): Promise<void> {
    const { tripId, photoData, caption } = payload;
    
    if (!tripId || !photoData) {
      this.sendError(client.id, 'Invalid photo data');
      return;
    }

    // Verify trip access
    const hasAccess = await this.verifyTripAccess(client.userId, tripId);
    if (!hasAccess) {
      this.sendError(client.id, 'Access denied to trip');
      return;
    }

    // Broadcast to trip room
    const roomId = `trip:${tripId}`;
    this.broadcastToRoom(roomId, {
      type: 'photo_uploaded',
      payload: {
        userId: client.userId,
        tripId,
        photoData,
        caption,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    logger.info(`Photo uploaded by ${client.userId} for trip ${tripId}`);
  }

  /**
   * Handle photo comments
   */
  private async handlePhotoComment(client: WebSocketClient, payload: any): Promise<void> {
    const { photoId, comment, tripId } = payload;
    
    if (!photoId || !comment) {
      this.sendError(client.id, 'Invalid comment data');
      return;
    }

    // Broadcast to trip room
    const roomId = `trip:${tripId}`;
    this.broadcastToRoom(roomId, {
      type: 'photo_commented',
      payload: {
        userId: client.userId,
        photoId,
        comment,
        tripId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    logger.info(`Photo comment by ${client.userId} on photo ${photoId}`);
  }

  /**
   * Handle journal entries
   */
  private async handleJournalEntry(client: WebSocketClient, payload: any): Promise<void> {
    const { tripId, entry, isPublic } = payload;
    
    if (!tripId || !entry) {
      this.sendError(client.id, 'Invalid journal entry');
      return;
    }

    // Verify trip access
    const hasAccess = await this.verifyTripAccess(client.userId, tripId);
    if (!hasAccess) {
      this.sendError(client.id, 'Access denied to trip');
      return;
    }

    // Broadcast to trip room
    const roomId = `trip:${tripId}`;
    this.broadcastToRoom(roomId, {
      type: 'journal_entry_created',
      payload: {
        userId: client.userId,
        tripId,
        entry,
        isPublic,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    // If public, also broadcast to social feed
    if (isPublic) {
      this.broadcastToRoom('social:feed', {
        type: 'public_journal_entry',
        payload: {
          userId: client.userId,
          tripId,
          entry,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    }

    logger.info(`Journal entry created by ${client.userId} for trip ${tripId}`);
  }

  /**
   * Handle social activities
   */
  private async handleSocialActivity(client: WebSocketClient, payload: any): Promise<void> {
    const { activityType, data } = payload;
    
    if (!activityType) {
      this.sendError(client.id, 'Invalid social activity');
      return;
    }

    // Broadcast to social feed
    this.broadcastToRoom('social:feed', {
      type: 'social_activity',
      payload: {
        userId: client.userId,
        activityType,
        data,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    logger.info(`Social activity by ${client.userId}: ${activityType}`);
  }

  /**
   * Handle trip updates
   */
  private async handleTripUpdate(client: WebSocketClient, payload: any): Promise<void> {
    const { tripId, updateType, data } = payload;
    
    if (!tripId || !updateType) {
      this.sendError(client.id, 'Invalid trip update');
      return;
    }

    // Verify trip access
    const hasAccess = await this.verifyTripAccess(client.userId, tripId);
    if (!hasAccess) {
      this.sendError(client.id, 'Access denied to trip');
      return;
    }

    // Broadcast to trip room
    const roomId = `trip:${tripId}`;
    this.broadcastToRoom(roomId, {
      type: 'trip_updated',
      payload: {
        userId: client.userId,
        tripId,
        updateType,
        data,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    logger.info(`Trip update by ${client.userId} for trip ${tripId}: ${updateType}`);
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(client: WebSocketClient, code: number, reason: string): void {
    // Leave all rooms
    for (const roomId of client.rooms) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.participants.delete(client.userId);
        room.lastActivity = new Date();

        // Notify room participants
        this.broadcastToRoom(roomId, {
          type: 'user_disconnected',
          payload: {
            userId: client.userId,
            roomId,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        });

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    // Remove client
    this.clients.delete(client.id);

    logger.info(`WebSocket client disconnected: ${client.id} (User: ${client.userId}) - Code: ${code}, Reason: ${reason}`);
    this.emit('client:disconnected', { clientId: client.id, userId: client.userId, code, reason });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      this.handleClientDisconnect(client, 1011, 'Send error');
    }
  }

  /**
   * Broadcast message to all clients in a room
   */
  broadcastToRoom(roomId: string, message: WebSocketMessage, excludeUsers: string[] = []): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const userId of room.participants) {
      if (excludeUsers.includes(userId)) continue;

      // Find all clients for this user
      for (const client of this.clients.values()) {
        if (client.userId === userId && client.rooms.has(roomId)) {
          try {
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(messageStr);
              sentCount++;
            }
          } catch (error) {
            logger.error(`Error broadcasting to client ${client.id}:`, error);
          }
        }
      }
    }

    logger.debug(`Broadcasted message to ${sentCount} clients in room ${roomId}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message: WebSocketMessage, excludeUsers: string[] = []): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (excludeUsers.includes(client.userId)) continue;

      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
          sentCount++;
        }
      } catch (error) {
        logger.error(`Error broadcasting to client ${client.id}:`, error);
      }
    }

    logger.debug(`Broadcasted message to ${sentCount} clients`);
  }

  /**
   * Send error message to client
   */
  sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      payload: { error, timestamp: Date.now() },
      timestamp: Date.now(),
    });
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.isAlive) {
          logger.warn(`Terminating dead connection: ${client.id}`);
          client.ws.terminate();
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean up inactive clients
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPing > this.CLIENT_TIMEOUT) {
          logger.warn(`Cleaning up inactive client: ${clientId}`);
          client.ws.terminate();
        }
      }

      // Clean up empty rooms
      for (const [roomId, room] of this.rooms.entries()) {
        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: any): string {
    return request.headers['x-forwarded-for'] || 
           request.connection.remoteAddress || 
           request.socket.remoteAddress || 
           'unknown';
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Parse incoming message
   */
  private parseMessage(data: Buffer): WebSocketMessage | null {
    try {
      const message = JSON.parse(data.toString());
      return {
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp || Date.now(),
        messageId: message.messageId,
      };
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
      return null;
    }
  }

  /**
   * Verify user has access to room
   */
  private async verifyRoomAccess(userId: string, roomId: string, roomType: string): Promise<boolean> {
    try {
      switch (roomType) {
        case 'trip':
          const trip = await prisma.trip.findFirst({
            where: {
              id: roomId,
              collaborators: {
                some: { userId, role: { not: 'NONE' } }
              }
            }
          });
          return !!trip;

        case 'photo':
        case 'journal':
          // These are typically associated with trips
          return this.verifyRoomAccess(userId, roomId, 'trip');

        case 'social':
          // Social rooms are public
          return true;

        default:
          return false;
      }
    } catch (error) {
      logger.error('Error verifying room access:', error);
      return false;
    }
  }

  /**
   * Verify user has access to trip
   */
  private async verifyTripAccess(userId: string, tripId: string): Promise<boolean> {
    try {
      const trip = await prisma.trip.findFirst({
        where: {
          id: tripId,
          collaborators: {
            some: { userId, role: { not: 'NONE' } }
          }
        }
      });
      return !!trip;
    } catch (error) {
      logger.error('Error verifying trip access:', error);
      return false;
    }
  }

  /**
   * Get server statistics
   */
  getStats(): any {
    return {
      connectedClients: this.clients.size,
      activeRooms: this.rooms.size,
      totalRooms: this.rooms.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Get room information
   */
  getRoomInfo(roomId: string): RoomInfo | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      ...room,
      participants: new Set(room.participants), // Clone to avoid external modification
    };
  }

  /**
   * Get client information
   */
  getClientInfo(clientId: string): WebSocketClient | null {
    const client = this.clients.get(clientId);
    if (!client) return null;

    return {
      ...client,
      rooms: new Set(client.rooms), // Clone to avoid external modification
    };
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Server shutdown');
    }

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server closed');
  }
}

export const websocketService = new WebSocketService(); 