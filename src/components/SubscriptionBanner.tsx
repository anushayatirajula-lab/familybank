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
          <span>Your 7-day free trial has ended. Subscribe now to continue using FamilyBank.</span>
          <Button onClick={onSubscribe} size="sm" className="ml-4">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscribe ($4.99/month)
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
          <span>Your free trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Subscribe now for $4.99/month.</span>
          <Button onClick={onSubscribe} size="sm" variant="outline" className="ml-4">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscribe Now
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
          <span>You have {daysRemaining} days left in your free trial. After that, it's just $4.99/month to continue.</span>
          <Button onClick={onSubscribe} size="sm" variant="outline" className="ml-4">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscribe Early
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
