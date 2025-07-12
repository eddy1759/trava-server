import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth';
import {
  getWebSocketStats,
  getRoomInfo,
  getClientInfo,
  broadcastMessage,
  broadcastToRoom
} from './websocket.controller';

const router = Router();

// Apply authentication to all WebSocket admin routes
router.use(authMiddleware);

/**
 * @route GET /api/websocket/stats
 * @desc Get WebSocket server statistics
 * @access Private (Admin)
 */
router.get('/stats', getWebSocketStats);

/**
 * @route GET /api/websocket/rooms/:roomId
 * @desc Get information about a specific room
 * @access Private (Admin)
 */
router.get('/rooms/:roomId', getRoomInfo);

/**
 * @route GET /api/websocket/clients/:clientId
 * @desc Get information about a specific client
 * @access Private (Admin)
 */
router.get('/clients/:clientId', getClientInfo);

/**
 * @route POST /api/websocket/broadcast
 * @desc Broadcast a message to all connected clients
 * @access Private (Admin)
 */
router.post('/broadcast', broadcastMessage);

/**
 * @route POST /api/websocket/broadcast/room
 * @desc Broadcast a message to a specific room
 * @access Private (Admin)
 */
router.post('/broadcast/room', broadcastToRoom);

export default router; 