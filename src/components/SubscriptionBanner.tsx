import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CreditCard, Crown } from "lucide-react";

interface SubscriptionBannerProps {
  tier: "free" | "premium";
  onTrial: boolean;
  daysRemaining: number;
  onSubscribe: () => void;
}

export const SubscriptionBanner = ({ tier, onTrial, daysRemaining, onSubscribe }: SubscriptionBannerProps) => {
  const navigate = useNavigate();

  if (tier === "premium" && !onTrial) {
    return (
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <Crown className="h-4 w-4 text-primary" />
        <AlertTitle className="flex items-center gap-2">
          Premium Plan <Badge className="bg-primary text-primary-foreground">Active</Badge>
        </AlertTitle>
        <AlertDescription>You have full access to all FamilyBank features.</AlertDescription>
      </Alert>
    );
  }

  if (onTrial && daysRemaining > 0) {
    return (
      <Alert className="mb-6 border-amber-500/40 bg-amber-50 dark:bg-amber-950/40">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Premium Trial — {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3 text-amber-900 dark:text-amber-100">
          <span>You're enjoying all Premium features. Subscribe to keep them after your trial ends.</span>
          <Button onClick={onSubscribe} size="sm" variant="outline" className="ml-2">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscribe
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Free tier (trial expired or never started)
  return (
    <Alert className="mb-6 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
      <Sparkles className="h-4 w-4 text-primary" />
      <AlertTitle className="flex items-center gap-2">
        Family Starter <Badge variant="outline">Free</Badge>
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>Upgrade to Premium for up to 5 children, automated allowances, unlimited AI coach & more.</span>
        <div className="flex gap-2 shrink-0">
          <Button onClick={() => navigate("/pricing")} size="sm" variant="ghost">
            Compare
          </Button>
          <Button onClick={onSubscribe} size="sm">
            <CreditCard className="mr-2 h-4 w-4" />
            $4.99/mo
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
