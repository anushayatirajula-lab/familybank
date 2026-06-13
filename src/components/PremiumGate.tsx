import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PremiumGateProps {
  isPremium: boolean;
  feature: string;
  description?: string;
  children: ReactNode;
  /** When true, renders an inline overlay; otherwise hides children and shows upgrade card. */
  inline?: boolean;
}

export const PremiumGate = ({
  isPremium,
  feature,
  description,
  children,
  inline = false,
}: PremiumGateProps) => {
  const navigate = useNavigate();

  if (isPremium) return <>{children}</>;

  if (inline) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-40 select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px] rounded-lg">
          <div className="text-center p-4">
            <Lock className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium mb-2">{feature} is a Premium feature</p>
            <Button size="sm" onClick={() => navigate("/pricing")}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Upgrade
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center text-center py-8 px-4">
        <div className="rounded-full bg-primary/10 p-3 mb-3">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <p className="font-semibold mb-1">{feature}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
        )}
        <Button size="sm" onClick={() => navigate("/pricing")}>
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Upgrade to Premium
        </Button>
      </CardContent>
    </Card>
  );
};
