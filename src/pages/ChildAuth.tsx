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
      // Use secure RPC function to authenticate child
      const { data, error } = await supabase.rpc('authenticate_child', {
        p_name: name,
        p_pin: pin || ''
      });

      if (error) throw error;

      // The RPC returns an array with one result
      const result = data?.[0];

      if (!result?.success) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result?.message || "Failed to log in. Please try again.",
        });
        return;
      }

      toast({
        title: "Welcome!",
        description: `Hi ${result.child_name}! Let's check your progress.`,
      });
      
      navigate(`/child/${result.child_id}`);
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
              <label className="text-sm font-medium mb-2 block">PIN (if set)</label>
              <Input
                type="password"
                placeholder="Enter your PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
              />
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
