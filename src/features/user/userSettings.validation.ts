import { z } from 'zod';

export const userSettingsSchema = z.object({
  receivesNotifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

export type updatedUserSettings = z.infer<typeof userSettingsSchema>;

export const updateUserProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters long.').optional(),
  profilePictureUrl: z.string().url().optional(),
});

export const userIdParam = z.object({
  userId: z.string().uuid(),
});

export const notificationPreferenceSchema = z.object({
  receivesNotifications: z.boolean(),
});

export const themePreferenceSchema = z.object({
  darkMode: z.boolean(),
});

export const languagePreferenceSchema = z.object({
  language: z.string().min(2).max(5),
});

export const timezonePreferenceSchema = z.object({
  timezone: z.string(),
}); 


export type UpdateUserProfileDto = z.infer<typeof updateUserProfileSchema>;