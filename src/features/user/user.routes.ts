import { Router } from 'express';
import * as userSetting from './user.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validation.middleware';
import { userSettingsSchema, updateUserProfileSchema, notificationPreferenceSchema, themePreferenceSchema, languagePreferenceSchema, timezonePreferenceSchema} from './userSettings.validation'
import { uploadRateLimiter} from '../../middlewares/rateLimit';
import { uploadMiddleware } from '../photo/photo.upload';

const router = Router();

router.use(authMiddleware);

router.get('/me', userSetting.getMe);
router.post('/me/profile-picture', uploadRateLimiter,  uploadMiddleware.single('image'), validateBody(userSettingsSchema), userSetting.uploadProfilePicture);

router.route('/settings')
    .post(userSetting.createUserSettings)
    .get(userSetting.getUserSettings)
    .put(userSetting.updateUserSettings);

// Specific preference updates
router.put('/settings/notifications', validateBody(notificationPreferenceSchema), userSetting.updateNotificationPreference);
router.put('/settings/theme', validateBody(themePreferenceSchema), userSetting.updateThemePreference);
router.put('/settings/language', validateBody(languagePreferenceSchema), userSetting.updateLanguagePreference);
router.put('/settings/timezone', validateBody(timezonePreferenceSchema), userSetting.updateTimezonePreference);

export default router;