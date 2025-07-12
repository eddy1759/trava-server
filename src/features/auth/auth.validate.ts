import { query } from 'winston';
import { z } from 'zod';

export const authValidationSchemas = {
  login: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),

  register: z.object({
    email: z.string().email(),
    fullName: z.string().min(1).max(100),
    password: z.string().min(8),
  }),

  verifyEmail: z.object({
      token: z.string(),
  }),

  resetPassword: z.object({
    query: z.object({
      token: z.string().uuid(),
    }),
    body: z.object({
      newPassword: z.string().min(8),
    }),
  }),

  forgotPassword: z.object({
    email: z.string().email(),
  })
};

export type RegisterInput = z.infer<typeof authValidationSchemas.register>;
export type LoginInput = z.infer<typeof authValidationSchemas.login>;
export type VerifyEmailInput = z.infer<typeof authValidationSchemas.verifyEmail>;
export type ResetPasswordInput = z.infer<typeof authValidationSchemas.resetPassword>;
export type ForgotPasswordInput = z.infer<typeof authValidationSchemas.forgotPassword>;