import { User, Prisma, UserSettings } from "@prisma/client";
import { prisma } from "../../services/prisma";
import { authUtils, SAFE_USER_SELECT, SafeUser } from "../../utils/auth.utils";
import { CreateUserDto, UpdateUserProfileDto } from "../auth/auth.dto";
import { updatedUserSettings } from "./userSettings.validation";
import { CreateUserSettingsData } from "./dto/userSetting.dto";
import ApiError from "../../utils/ApiError";
import logger from "../../utils/logger";


class UserService {
    async createUser(data: CreateUserDto): Promise<SafeUser> {
        const hashedPassword = await authUtils.hashPassword(data.password);
        const { password, ...userData } = data;
        const user = await prisma.user.create({
            data: {
                ...userData,
                hashedPassword: hashedPassword,
                settings: {
                    create: {}
                }
            },
        });
        const { hashedPassword: _, ...safeUser } = user;
        return safeUser as SafeUser;
    }

    async findUserByEmail(email: string): Promise<SafeUser | null> {
        return prisma.user.findUnique({
            where: { email, deleted: false },
            select: SAFE_USER_SELECT,
        });
    }

    async findUserByEmailInternal(email: string): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { email: email, deleted: false },
        });

        return user;
    }

    async findUserById(id: string): Promise<SafeUser | null> {
        return prisma.user.findUnique({
            where: { id, deleted: false },
            select: SAFE_USER_SELECT,
        });
    }

    async findUserByIdInternal(id: string): Promise<User | null> {
        const user =  prisma.user.findUnique({
            where: { id, deleted: false },
        });
        return user;
    }

    async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> {
        return prisma.user.update({
            where: { id, deleted: false },
            data,
            select: SAFE_USER_SELECT,
        });
    }

    async updateUserProfile(id: string, data: UpdateUserProfileDto): Promise<SafeUser> {
        return prisma.user.update({
            where: { id },
            data,
            select: SAFE_USER_SELECT,
        });
    }

    async verifyUser(id: string): Promise<SafeUser> {
        return prisma.user.update({
            where: { id, deleted: false },
            data: { isVerified: true },
            select: SAFE_USER_SELECT,
        });
    }

    // async deleteUser(id: string): Promise<SafeUser> {
    //     return prisma.user.delete({
    //         where: { id },
    //         select: SAFE_USER_SELECT,
    //     });
    // }

    sanitizeUser(user: User): SafeUser {
    return Object.keys(SAFE_USER_SELECT).reduce((acc, key) => {
        acc[key] = user[key];
        return acc;
    }, {} as SafeUser);
}

    /**
     * Get user details by access token (user id is extracted from token)
     * @param userId - The user id extracted from the access token
     * @returns SafeUser or null
     */
    async getUserByAccessTokenPayload(userId: string): Promise<SafeUser | null> {
        return this.findUserById(userId);
    }

    /**
     * Update the user's profile picture URL
     * @param userId - The user id
     * @param profilePictureUrl - The new profile picture URL
     * @returns SafeUser
     */
    async updateProfilePicture(userId: string, profilePictureUrl: string): Promise<SafeUser> {
        return prisma.user.update({
            where: { id: userId },
            data: { profilePictureUrl },
            select: SAFE_USER_SELECT,
        });
    }

    async deleteUser(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date(),
        email: `${new Date().getTime()}_${(await this.findUserByIdInternal(id))?.email}`, // Anonymize email
        refreshToken: null,
      },
    });
  }

  async createUserSettings(data: CreateUserSettingsData & { userId: string }): Promise<UserSettings> {
    try {
      const existingSettings = await prisma.userSettings.findUnique({
        where: { userId: data.userId }
      });

      if (existingSettings) {
        throw ApiError.Conflict('User settings already exist for this user');
      }

      return await prisma.userSettings.create({
        data: {
          userId: data.userId,
          receivesNotifications: data.receivesNotifications ?? true,
          darkMode: data.darkMode ?? false,
          language: data.language ?? 'en',
          timezone: data.timezone,
        }
      });
    } catch (error) {
      logger.error('Error creating user settings:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.InternalServerError('Failed to create user settings');
    }
  }

  async getUserSettings(userId: string) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });
    return settings;
  }

  /**
   * Updates a user's settings.
   */
  async updateUserSettings(userId: string, data: updatedUserSettings) {
    return prisma.userSettings.update({
      where: { userId },
      data,
    });
  }

  async updateNotificationPreference(userId: string, receivesNotifications: boolean): Promise<UserSettings> {
    return this.updateUserSettings(userId, { receivesNotifications });
  }

  async updateThemePreference(userId: string, darkMode: boolean): Promise<UserSettings> {
    return this.updateUserSettings(userId, { darkMode });
  }

  async updateLanguagePreference(userId: string, language: string): Promise<UserSettings> {
    return this.updateUserSettings(userId, { language });
  }

  async updateTimezonePreference(userId: string, timezone: string): Promise<UserSettings> {
    return this.updateUserSettings(userId, { timezone });
  }
}

export const userService = new UserService();
export type { SafeUser };