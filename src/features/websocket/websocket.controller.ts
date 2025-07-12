import { Request, Response } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { websocketService } from '../../services/websocket.service';
import logger from '../../utils/logger';

/**
 * Get WebSocket server statistics
 */
export const getWebSocketStats = asyncWrapper(async (req: Request, res: Response) => {
  const stats = websocketService.getStats();
  
  logger.info('WebSocket stats requested', { stats });
  
  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * Get information about a specific room
 */
export const getRoomInfo = asyncWrapper(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  
  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'Room ID is required'
    });
  }

  const roomInfo = websocketService.getRoomInfo(roomId);
  
  if (!roomInfo) {
    return res.status(404).json({
      success: false,
      message: 'Room not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      ...roomInfo,
      participants: Array.from(roomInfo.participants)
    }
  });
});

/**
 * Get information about a specific client
 */
export const getClientInfo = asyncWrapper(async (req: Request, res: Response) => {
  const { clientId } = req.params;
  
  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: 'Client ID is required'
    });
  }

  const clientInfo = websocketService.getClientInfo(clientId);
  
  if (!clientInfo) {
    return res.status(404).json({
      success: false,
      message: 'Client not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      ...clientInfo,
      rooms: Array.from(clientInfo.rooms)
    }
  });
});

/**
 * Broadcast a message to all connected clients (admin only)
 */
export const broadcastMessage = asyncWrapper(async (req: Request, res: Response) => {
  const { message, type = 'admin_broadcast', excludeUsers = [] } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  // Check if user is admin (you can implement your own admin check)
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  websocketService.broadcastToAll({
    type,
    payload: {
      message,
      adminId: req.user.id,
      timestamp: Date.now()
    },
    timestamp: Date.now()
  }, excludeUsers);

  logger.info('Admin broadcast sent', {
    adminId: req.user.id,
    message,
    type
  });

  res.status(200).json({
    success: true,
    message: 'Broadcast sent successfully'
  });
});

/**
 * Broadcast a message to a specific room (admin only)
 */
export const broadcastToRoom = asyncWrapper(async (req: Request, res: Response) => {
  const { roomId, message, type = 'admin_room_broadcast', excludeUsers = [] } = req.body;
  
  if (!roomId || !message) {
    return res.status(400).json({
      success: false,
      message: 'Room ID and message are required'
    });
  }

  // Check if user is admin
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  websocketService.broadcastToRoom(roomId, {
    type,
    payload: {
      message,
      adminId: req.user.id,
      timestamp: Date.now()
    },
    timestamp: Date.now()
  }, excludeUsers);

  logger.info('Admin room broadcast sent', {
    adminId: req.user.id,
    roomId,
    message,
    type
  });

  res.status(200).json({
    success: true,
    message: 'Room broadcast sent successfully'
  });
}); 