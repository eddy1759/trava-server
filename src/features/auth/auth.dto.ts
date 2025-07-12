
export interface CreateUserDto {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateUserProfileDto {
  email?: string;
  fullName?: string;
}