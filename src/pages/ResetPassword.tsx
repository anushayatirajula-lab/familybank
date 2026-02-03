import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [childUsername, setChildUsername] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resetType, setResetType] = useState<"parent" | "child">("parent");

  const handleParentResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Reset email sent!",
        description: "Check your email for a password reset link.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset email.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChildResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call edge function to send reset email to parent
      const { data, error } = await supabase.functions.invoke("reset-child-password", {
        body: {
          familyCode: familyCode.toUpperCase(),
          childUsername: childUsername.toLowerCase(),
        },
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Reset request sent!",
        description: "Your parent will receive an email with instructions to reset your password.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset request. Please check your family code and username.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
            className="w-fit mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {emailSent 
              ? "Check your email for reset instructions" 
              : "Request a password reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emailSent ? (
            <Tabs value={resetType} onValueChange={(v) => setResetType(v as "parent" | "child")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="parent">Parent</TabsTrigger>
                <TabsTrigger value="child">Child</TabsTrigger>
              </TabsList>
              
              <TabsContent value="parent">
                <form onSubmit={handleParentResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="parent@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="child">
                <form onSubmit={handleChildResetRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="familyCode">Family Code</Label>
                    <Input
                      id="familyCode"
                      type="text"
                      placeholder="ABC123"
                      value={familyCode}
                      onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                      className="font-mono uppercase tracking-widest"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="childUsername">Your Username</Label>
                    <Input
                      id="childUsername"
                      type="text"
                      placeholder="your_username"
                      value={childUsername}
                      onChange={(e) => setChildUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="font-mono"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your parent will receive an email with a link to reset your password.
                  </p>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Password Reset
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {resetType === "parent" 
                  ? `We've sent a password reset link to ${email}`
                  : "Your parent has been notified and will receive reset instructions via email."}
              </p>
              <Button onClick={() => navigate(resetType === "parent" ? "/auth" : "/child-auth")} className="w-full">
                Return to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;