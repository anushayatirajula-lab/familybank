import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X } from "lucide-react";
import coinIcon from "@/assets/coin-icon.png";

const FAMILY_CODE_KEY = "familybank_family_code";

const ChildAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [familyCode, setFamilyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSavedCode, setHasSavedCode] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);

  // Load saved family code on mount
  useEffect(() => {
    const savedCode = localStorage.getItem(FAMILY_CODE_KEY);
    if (savedCode) {
      setFamilyCode(savedCode);
      setHasSavedCode(true);
    } else {
      setShowCodeInput(true);
    }
  }, []);

  const handleSaveCode = () => {
    if (familyCode.length >= 4) {
      localStorage.setItem(FAMILY_CODE_KEY, familyCode.toUpperCase());
      setHasSavedCode(true);
      setShowCodeInput(false);
      toast({
        title: "Family code saved!",
        description: "You won't need to enter it again on this device.",
      });
    }
  };

  const handleClearCode = () => {
    localStorage.removeItem(FAMILY_CODE_KEY);
    setFamilyCode("");
    setHasSavedCode(false);
    setShowCodeInput(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Construct internal email from username and family code
      const internalEmail = `${username.toLowerCase()}_${familyCode.toLowerCase()}@familybank.internal`;

      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (authError) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Incorrect username, family code, or password. Please try again.",
        });
        setLoading(false);
        return;
      }

      // Save family code if login successful
      if (!hasSavedCode) {
        localStorage.setItem(FAMILY_CODE_KEY, familyCode.toUpperCase());
        setHasSavedCode(true);
      }

      // Get child profile
      const { data: child, error: childError } = await supabase
        .from("children")
        .select("id, name, first_login")
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

      // Check if this is first login - redirect to password update
      if (child.first_login) {
        toast({
          title: "Welcome!",
          description: `Hi ${child.name}! Please set your own password to continue.`,
        });
        navigate("/update-password?first_login=true");
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
          <CardDescription>Enter your login details to access your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Family Code Section */}
            {showCodeInput ? (
              <div className="space-y-2">
                <label className="text-sm font-medium mb-2 block">Family Code</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter your family code (e.g., ABC123)"
                    value={familyCode}
                    onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                    className="font-mono text-lg tracking-widest uppercase"
                    maxLength={10}
                    required
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={handleSaveCode}
                    disabled={familyCode.length < 4}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask your parent for this code. You only need to enter it once.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Family Code</p>
                  <p className="font-mono font-bold tracking-widest">{familyCode}</p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearCode}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Change
                </Button>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="font-mono"
                required
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Password</label>
              <PasswordInput
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use the password your parent gave you
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading || !familyCode}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            
            <Button 
              type="button" 
              variant="link" 
              className="w-full text-sm"
              onClick={() => navigate("/reset-password")}
            >
              Forgot Password?
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