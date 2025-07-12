import express from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth";
import { validateBody, validateQuery, combineValidators } from "../../middlewares/validation.middleware";
import { authValidationSchemas } from "./auth.validate";
import { authRateLimiter } from "../../middlewares/rateLimit";


const authRouter = express.Router();

// Custom async middleware for email domain validation

authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(authValidationSchemas.register),
  authController.register
);

authRouter.post(
  "/login",
  authRateLimiter,
  validateBody(authValidationSchemas.login),
  authController.login
);

authRouter.get(
  "/verify-email",
  // validateQuery(authValidationSchemas.verifyEmail),
  authController.verifyEmail
);

authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(authValidationSchemas.forgotPassword),
  authController.forgotPassword
);

authRouter.post(
  "/reset-password",
  authRateLimiter,
  // combineValidators(
  //   validateQuery(authValidationSchemas.resetPassword.shape.query),
  //   validateBody(authValidationSchemas.resetPassword.shape.body)
  // ),
  authController.resetPassword
);

authRouter.post(
  "/refresh-token",
  authRateLimiter,
  authMiddleware,
  authController.refreshAccessToken
);

authRouter.post(
  "/logout",
  authMiddleware,
  authController.logout
);

export default authRouter;