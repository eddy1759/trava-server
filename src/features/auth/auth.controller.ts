import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { authService } from './auth.service';
import ApiError from '../../utils/ApiError';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { AuthRequest } from '../../middlewares/auth';
import { CreateUserDto, LoginUserDto, ForgotPasswordDto, ResetPasswordDto} from './auth.dto';

export const authController = {
  register: asyncWrapper(async (req: Request, res: Response) => {
    const input = req.body as CreateUserDto;
    await authService.registerUser(input);
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
    });
  }),

  login: asyncWrapper(async (req: Request, res: Response) => {
    const input = req.body as LoginUserDto;
    const userData = await authService.loginUser(input);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Login successful',
      data: userData,
    });
  }),

  verifyEmail: asyncWrapper(async (req: Request, res: Response) => {
    const input = req.query.token as string;
    const userData = await authService.verifyUserEmail(input);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Email verified successfully',
      data: userData,
    });
  }),

  forgotPassword: asyncWrapper(async (req: Request, res: Response) => {
    const input = req.body as ForgotPasswordDto;
    const message = await authService.forgotPassword(input.email);
    res.status(StatusCodes.OK).json({
      success: true,
      message,
    });
  }),

  resetPassword: asyncWrapper(async (req: Request, res: Response) => {
    const input = req.query.token as string;
    const newPassword = req.body.newPassword as string;

    const data: ResetPasswordDto = {
      token: input,
      newPassword: newPassword,
    };
    const message = await authService.resetPassword(data);
    res.status(StatusCodes.OK).json({
      success: true,
      message,
    });
  }),

  refreshAccessToken: asyncWrapper(async (req: AuthRequest, res: Response) => {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
      throw ApiError.BadRequest('Refresh token is required');
    }

    const userData = await authService.refreshAccessToken(refreshToken);
    res.status(StatusCodes.OK).json({
      success: true,
      data: userData,
    });
  }),

  logout: asyncWrapper(async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    await authService.logoutUser(userId);
    res.status(StatusCodes.NO_CONTENT).send();
  })
}