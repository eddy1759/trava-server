import { prisma } from "../../services/prisma";
import { authUtils, SafeUser } from "../../utils/auth.utils";
import { userService } from "../user/user.service";
import ApiError from "../../utils/ApiError";
import logger from "../../utils/logger";
import { amqpWrapper } from "../../services/amqpWrapper";
import {
    CreateUserDto,
    RefreshTokenDto,
    LoginUserDto,
    ResetPasswordDto,
} from "./auth.dto";
import { EmailJobPayload } from "../jobs/emailJob.processor";
import { isEmailDomainValid } from "../../services/email/email.service";


class AuthService {

    async registerUser(data: CreateUserDto): Promise<SafeUser> {
        try {

            const isDomainValid = await isEmailDomainValid(data.email);
            if (!isDomainValid) {
                throw ApiError.BadRequest("Invalid email domain");
            }
            const existingUser = await userService.findUserByEmailInternal(data.email);
            if (existingUser) {
                throw ApiError.BadRequest("Credentials already in use");
            }
            const createdSafeUser = await userService.createUser(data);

            

            // send verfication email via messaging queue
            const verificationToken = authUtils.generateEmailVerificationToken(createdSafeUser);

            const emailJobPayload: EmailJobPayload = {
                type: "email_verification",
                to: createdSafeUser.email,
                fullName: createdSafeUser.fullName,
                token: verificationToken,
            };

            // Send verification email via messaging queue
            await amqpWrapper.sendEmailQueue(emailJobPayload);
            
            return createdSafeUser; // Return SafeUser as per function signature
        } catch(error) {
            if (error instanceof ApiError) {
                throw error; // Re-throw known ApiErrors
            }
            logger.error("Error during user registration", error );
            throw ApiError.InternalServerError("Failed to register user");
        }
    }

    async verifyUserEmail(token: string): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
        try {
            const payload = authUtils.verifyEmailVerificationToken(token);
            const user = await userService.findUserByIdInternal(payload.id);

            if (!user) throw ApiError.NotFound("User not found");
            
            const accessToken = authUtils.generateAccessToken(user);
            const { token: newRefreshToken, jti: newRefreshTokenJti, expiryDate: newRefreshTokenExpiry } = authUtils.generateRefreshToken(user);

            if (user.isVerified) {
                return {
                    accessToken,
                    refreshToken: newRefreshToken,
                    user: userService.sanitizeUser(user),
                };
            }

            const updatedUser = await userService.updateUser(user.id, {
                isVerified: true,
                lastLogin: new Date(),
                refreshToken: newRefreshToken,
                refreshTokenJti: newRefreshTokenJti,
                refreshTokenExpiry: newRefreshTokenExpiry,
            });

            const emailJobPayload: EmailJobPayload = {
                type: "welcome_email",
                to: updatedUser.email,
                fullName: updatedUser.fullName,
            };

            // send welcome email via messaging queue
            await amqpWrapper.publishMessage("email_job_queue", emailJobPayload);

            return {
                user: updatedUser,
                accessToken,
                refreshToken: newRefreshToken,
            };
            
        } catch (error) {
            if (error instanceof ApiError) {
                throw error; // Re-throw known ApiErrors
            }
            logger.error("Error during email verification", { error });
            throw ApiError.InternalServerError("Failed to verify email");
            
        }
    }

    async loginUser(data: LoginUserDto): Promise<{ accessToken: string; refreshToken: string; user: SafeUser } | { message: string }> {
        try {
            const user = await userService.findUserByEmailInternal(data.email);

            if (!user || !(await authUtils.comparePassword(data.password, user.hashedPassword))) {
                logger.warn(`Failed login attempt for email: ${data.email}`);
                throw ApiError.Unauthorized("Invalid email or password");
            }

            if (!user.isVerified) {
                logger.warn("User not verified", { userId: user.id });
                const verificationToken = authUtils.generateEmailVerificationToken(user);

                const emailJobPayload: EmailJobPayload = {
                    type: "email_verification",
                    to: user.email,
                    fullName: user.fullName,
                    token: verificationToken,
                };

                // Send verification email via messaging queue
                await amqpWrapper.sendEmailQueue(emailJobPayload);
                throw ApiError.Forbidden("Your account is not verified. Please check your email for a verification link.");
            } 
            

            const accessToken = authUtils.generateAccessToken(user);
            const { token: newRefreshToken, jti: newRefreshTokenJti, expiryDate: newRefreshTokenExpiry } = authUtils.generateRefreshToken(user);

            await userService.updateUser(user.id, {
                lastLogin: new Date(),
                refreshToken: newRefreshToken,
                refreshTokenJti: newRefreshTokenJti,
                refreshTokenExpiry: newRefreshTokenExpiry,
            });

            const safeUser = userService.sanitizeUser(user);

            return {
                user: safeUser,
                accessToken,
                refreshToken: newRefreshToken
            };
        } catch(error) {
            logger.error("Error during user login: ",  error );
            if (error instanceof ApiError) {
                throw error; // Re-throw known ApiErrors
            }
            throw ApiError.InternalServerError("Failed to login user");
        }
    }

    async refreshAccessToken(data: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const payload = authUtils.verifyRefreshToken(data.refreshToken);
            const user = await userService.findUserByIdInternal(payload.id);
           if (!user || user.refreshToken !== data.refreshToken || user.refreshTokenJti !== payload.jti) {
                if (user) await this.forceLogout(user.id);
                logger.error(`Potential refresh token reuse detected for user: ${payload.id}. All sessions terminated.`);
                throw ApiError.Unauthorized("Invalid refresh token. Please log in again.");
            }

            const newAccessToken = authUtils.generateAccessToken(user);
            const { token: newRefreshToken, jti: newRefreshTokenJti, expiryDate: newRefreshTokenExpiry } = authUtils.generateRefreshToken(user);

            await userService.updateUser(user.id, {
                refreshToken: newRefreshToken,
                refreshTokenJti: newRefreshTokenJti,
                refreshTokenExpiry: newRefreshTokenExpiry,
            });

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error; // Re-throw known ApiErrors
            }
            logger.error("Error during access token refresh", { error });
            throw ApiError.InternalServerError("Failed to refresh access token");
            
        }
    }

    async forgotPassword(email: string): Promise<{ message: string }> {
        try {
            const user = await userService.findUserByEmailInternal(email);
            const successMessage = "If a user with this email exists, a password reset link has been sent.";


            if (user) {
                const resetToken = authUtils.generatePasswordResetToken(user);
                const emailJobPayload: EmailJobPayload = {
                    type: "password_reset",
                    to: user.email,
                    token: resetToken,
                };
                await amqpWrapper.sendEmailQueue(emailJobPayload);
            } else {
                 logger.warn(`Forgot password attempt for non-existent email: ${email}`);
            }

            return { message: successMessage };
        } catch (error) {
            logger.error("Error during forgot password", { error });
            return { message: "If a user with this email exists, a password reset link has been sent." };
        }
    }

    async resetPassword(data: ResetPasswordDto): Promise<{ message: string }> {
        try {
            const payload = authUtils.verifyPasswordResetToken(data.token);

            const user = await userService.findUserByIdInternal(payload.id);
            if (!user) {
                throw ApiError.NotFound("User not found");
            }

            const hashedPassword = await authUtils.hashPassword(data.newPassword);
            await userService.updateUser(user.id, { hashedPassword });
            await this.forceLogout(user.id);
            return { message: "Password has been reset successfully." };
        } catch (error) {
            if (error instanceof ApiError) {
                throw error; // Re-throw known ApiErrors
            }
            logger.error("Error during password reset", { error });
            throw ApiError.InternalServerError("Failed to reset password");
        }
    }

    async logoutUser(userId: string): Promise<void> {
        await this.forceLogout(userId);
    }

    private async forceLogout(userId: string): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                refreshToken: null,
                refreshTokenJti: null,
                refreshTokenExpiry: null,
            },
        });
        logger.info(`Forced logout for user ${userId}. All refresh tokens invalidated.`);
    }
}

export const authService = new AuthService();