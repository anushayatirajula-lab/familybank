export const TIER_LIMITS = {
  free: {
    maxChildren: 1,
    maxWishlistItems: 3,
    maxActiveChoresPerChild: 5,
    aiCoachSessionsPerMonth: 10,
    transactionHistoryDays: 30,
    automatedAllowances: false,
    recurringChores: false,
    customJarPercentages: false,
    pushNotifications: false,
    childPasswordReset: false,
    emailCredentials: false,
    spendingAnalytics: false,
  },
  premium: {
    maxChildren: 5,
    maxWishlistItems: Infinity,
    maxActiveChoresPerChild: Infinity,
    aiCoachSessionsPerMonth: Infinity,
    transactionHistoryDays: Infinity,
    automatedAllowances: true,
    recurringChores: true,
    customJarPercentages: true,
    pushNotifications: true,
    childPasswordReset: true,
    emailCredentials: true,
    spendingAnalytics: true,
  },
} as const;

export type Tier = keyof typeof TIER_LIMITS;
