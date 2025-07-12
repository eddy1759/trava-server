 import { Router } from 'express';
import * as controller from './notification.controller';
import { validateBody, validateParams, validateQuery} from '../../middlewares/validation.middleware';
import { createNotificationSchema, updateNotificationSchema, notificationIdParam, queryNotificationsSchema } from './notification.validation';

const router = Router();

router.post('/', validateBody(createNotificationSchema), controller.createNotification);
router.get('/', validateQuery(queryNotificationsSchema), controller.listNotifications);
router.get('/:id', validateParams(notificationIdParam), controller.getNotification);
router.patch('/:id', validateBody(updateNotificationSchema), controller.updateNotification);
router.delete('/:id', validateParams(notificationIdParam), controller.deleteNotification);

export default router;
