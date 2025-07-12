import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { userService } from './user.service';
import { storageService } from '../../services/storage.service';
import { updateUserProfileSchema, userSettingsSchema, notificationPreferenceSchema, themePreferenceSchema, languagePreferenceSchema,
timezonePreferenceSchema } from './userSettings.validation';

/**
 * GET /me - Get current user details from access token
 */
export const getMe = asyncWrapper(async (req: Request, res: Response) => {
    const user = await userService.findUserById(req.user.id);
    res.status(StatusCodes.OK).json({ success: true, message: 'User fetched successfully', data: user });
});

/**
 * POST /me/profile-picture - Upload and update user profile picture
 */

export const uploadProfilePicture = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;

    if (!req.file) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'No file uploaded. Please include a file named "image".' });
    }

    const url = await storageService.uploadFile(req.file);


    const updatedUser = await userService.updateProfilePicture(userId, url);
    res.status(StatusCodes.OK).json({ success: true, message: 'Profile picture updated successfully', data: updatedUser });
});

export const updateProfile = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const data = updateUserProfileSchema.parse(req.body);

  const updatedUser = await userService.updateUserProfile(userId, data);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedUser
  });
});

export const getUserSettings = asyncWrapper(async (req: Request, res: Response) => {
  const settings = await userService.getUserSettings(req.user.id);
  res.status(StatusCodes.OK).json({ success: true, message: 'User settings fetched successfully', data: settings });
});


export const updateUserSettings = asyncWrapper(async (req: Request, res: Response) => {
  // Validation is handled by a middleware before this controller is called
  const settings = await userService.updateUserSettings(req.user.id, req.body);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User settings updated successfully.',
    data: settings,
  });
});

export const createUserSettings = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const data = userSettingsSchema.parse(req.body);
  
  const settings = await userService.createUserSettings({
    userId,
    ...data
  });
  
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'User settings created successfully',
    data: settings
  });
});

export const updateNotificationPreference = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { receivesNotifications } = notificationPreferenceSchema.parse(req.body);
  
  const settings = await userService.updateNotificationPreference(userId, receivesNotifications);
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Notification preference updated successfully',
    data: settings
  });
});

export const updateThemePreference = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { darkMode } = themePreferenceSchema.parse(req.body);
  
  const settings = await userService.updateThemePreference(userId, darkMode);
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Theme preference updated successfully',
    data: settings
  });
});

export const updateLanguagePreference = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { language } = languagePreferenceSchema.parse(req.body);
  
  const settings = await userService.updateLanguagePreference(userId, language);
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Language preference updated successfully',
    data: settings
  });
});

export const updateTimezonePreference = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { timezone } = timezonePreferenceSchema.parse(req.body);
  
  const settings = await userService.updateTimezonePreference(userId, timezone);
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Timezone preference updated successfully',
    data: settings
  });
});