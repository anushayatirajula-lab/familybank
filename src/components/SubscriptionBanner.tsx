import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard } from "lucide-react";

interface SubscriptionBannerProps {
  daysRemaining: number;
  onSubscribe: () => void;
  isExpired: boolean;
}

export const SubscriptionBanner = ({ daysRemaining, onSubscribe, isExpired }: SubscriptionBannerProps) => {
  if (isExpired) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Trial Expired</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span>Your 14-day free trial has ended.</span>
            <p className="text-sm mt-1 opacity-80">Paid subscriptions coming soon!</p>
          </div>
          <Button onClick={onSubscribe} size="sm" className="ml-4" disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (daysRemaining <= 3 && daysRemaining > 0) {
    return (
      <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Trial Ending Soon</AlertTitle>
        <AlertDescription className="flex items-center justify-between text-amber-800 dark:text-amber-200">
          <div>
            <span>Your free trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.</span>
            <p className="text-sm mt-1 opacity-80">Paid subscriptions coming soon!</p>
          </div>
          <Button onClick={onSubscribe} size="sm" variant="outline" className="ml-4" disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (daysRemaining > 3) {
    return (
      <Alert className="mb-6 border-primary bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertTitle>Welcome to FamilyBank! 🎉</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span>You have {daysRemaining} days left in your free trial. Enjoy all features!</span>
            <p className="text-sm mt-1 font-medium text-primary">Paid subscriptions coming soon!</p>
          </div>
          <Button onClick={onSubscribe} size="sm" variant="outline" className="ml-4" disabled>
            <CreditCard className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
