import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Crown, Sparkles, X } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";

const freeFeatures = [
  "Parent account + 1 child account",
  "Up to 5 active chores per child",
  "Token wallet with 5 jars (Books, Shopping, Charity, Wishlist, Savings)",
  "Manual allowance (parent-triggered)",
  "Wishlist creation (up to 3 items)",
  "Basic transaction history (last 30 days)",
  "10 AI coach sessions per month",
  "PWA install on mobile/desktop",
];

const premiumFeatures = [
  "Everything in Free, plus:",
  "Up to 5 child accounts",
  "Unlimited chores per child",
  "Automated weekly allowances (cron-powered)",
  "Recurring chores (auto-regenerated weekly)",
  "Unlimited AI coach sessions (lesson, quiz, chat)",
  "Customizable jar percentages per child",
  "Unlimited wishlist items + savings goals",
  "Full transaction history + spending analytics",
  "Push notifications (chores, allowances, wishlist)",
  "Child password reset by parent",
  "Email credentials to parent",
  "Stripe customer portal (manage/cancel anytime)",
];

const Pricing = () => {
  const navigate = useNavigate();
  const sub = useSubscription();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Plans & Pricing</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Choose your FamilyBank plan</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade anytime as your family grows.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free */}
          <Card className={sub.tier === "free" ? "border-primary/40" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Family Starter</CardTitle>
                {sub.tier === "free" && <Badge variant="outline">Current</Badge>}
              </div>
              <CardDescription>Enough to see the value — not everything.</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                disabled={sub.tier === "free"}
                onClick={() => navigate("/parent/dashboard")}
              >
                {sub.tier === "free" ? "Your current plan" : "Continue with Free"}
              </Button>
            </CardContent>
          </Card>

          {/* Premium */}
          <Card className="border-primary shadow-elevated relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
            </div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Family Premium
                </CardTitle>
                {sub.tier === "premium" && <Badge>Current</Badge>}
              </div>
              <CardDescription>Full power for serious families.</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$4.99</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {premiumFeatures.map((f, i) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    {i === 0 ? (
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <span className={i === 0 ? "font-medium" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              {sub.tier === "premium" ? (
                <Button className="w-full" variant="outline" onClick={sub.openCustomerPortal}>
                  Manage Subscription
                </Button>
              ) : (
                <Button className="w-full" onClick={sub.createCheckout}>
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade to Premium
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Cancel anytime. No hidden fees.
        </p>
      </main>
    </div>
  );
};

export default Pricing;
