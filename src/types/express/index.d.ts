import { UserRole } from '@prisma/client';

export {};

declare global {
    namespace Express {
        export interface Request {
            user?: {
                id: string;
                isProUser: boolean;
                isVerified: boolean;
                role: UserRole;
            }
        }
    }
}
