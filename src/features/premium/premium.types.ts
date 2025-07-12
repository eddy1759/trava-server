import { SubscriptionStatus } from "@prisma/client";

export interface UsageStats {
  trips: number;
  ai_requests: number;
  collaborators: number;
  journal_entries: number;
  photos: number;
}

export interface TierLimits {
  free: UsageStats;
  premium: UsageStats;
}

export interface UserTierInfo {
  isPremium: boolean;
  currentUsage: UsageStats;
  limits: UsageStats;
  remaining: UsageStats;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEndDate?: Date;
}
