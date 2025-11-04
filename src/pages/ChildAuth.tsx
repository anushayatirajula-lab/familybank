import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import coinIcon from "@/assets/coin-icon.png";

const ChildAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert name to email format used during signup
      const childEmail = `${name.toLowerCase().replace(/\s+/g, '')}@familybank.local`;
      const password = pin || '';

      if (!password) {
        toast({
          variant: "destructive",
          title: "PIN Required",
          description: "Please enter your PIN to log in.",
        });
        setLoading(false);
        return;
      }

      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: childEmail,
        password: password,
      });

      if (authError) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Incorrect name or PIN. Please try again.",
        });
        setLoading(false);
        return;
      }

      // Get child profile
      const { data: child, error: childError } = await supabase
        .from("children")
        .select("id, name")
        .eq("user_id", authData.user.id)
        .single();

      if (childError || !child) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not find your profile. Please contact your parent.",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Welcome!",
        description: `Hi ${child.name}! Let's check your progress.`,
      });
      
      navigate(`/child/${child.id}`);
    } catch (error) {
      console.error("Error logging in:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log in. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={coinIcon} alt="Coin" className="w-16 h-16 animate-bounce-subtle" />
          </div>
          <CardTitle className="text-2xl">Child Login</CardTitle>
          <CardDescription>Enter your name and PIN to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">PIN</label>
              <Input
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use the 4-digit PIN your parent set for you
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChildAuth;
