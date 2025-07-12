import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { createNotificationSchema, updateNotificationSchema, notificationIdParam, queryNotificationsSchema } from './notification.validation';
import { asyncWrapper } from '../../utils/asyncWrapper';

export const createNotification = asyncWrapper(async (req: Request, res: Response) => {
  
  const notification = await notificationService.createNotification(req.body);
  res.status(201).json(notification);
});

export const getNotification = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = notificationIdParam.parse(req.params);
  const notification = await notificationService.getNotificationById(id);
  res.json(notification);
});

export const updateNotification = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = notificationIdParam.parse(req.params);
  const data = updateNotificationSchema.parse(req.body);
  const notification = await notificationService.updateNotification(id, data);
  res.json(notification);
});

export const deleteNotification = asyncWrapper(async (req: Request, res: Response) => {
  const { id } = notificationIdParam.parse(req.params);
  await notificationService.deleteNotification(id);
  res.status(204).send();
});

export const listNotifications = asyncWrapper(async (req: Request, res: Response) => {
  const query = queryNotificationsSchema.parse(req.query);
  const notifications = await notificationService.listNotifications(query);
  res.json(notifications);
}); 