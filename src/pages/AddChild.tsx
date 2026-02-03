import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Copy, Check } from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const JAR_TYPES = ["SAVINGS", "BOOKS", "SHOPPING", "CHARITY", "WISHLIST"];

// Password strength calculation
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  
  if (score < 40) return { score, label: "Weak", color: "bg-destructive" };
  if (score < 70) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score < 90) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
};

const AddChild = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", childName: "" });
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [jarPercentages, setJarPercentages] = useState({
    SAVINGS: 30,
    BOOKS: 20,
    SHOPPING: 20,
    CHARITY: 10,
    WISHLIST: 20,
  });

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const isPasswordValid = password.length >= 8 && passwordStrength.score >= 40;
  const doPasswordsMatch = password === confirmPassword;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    toast({
      title: "Copied!",
      description: "Email copied to clipboard",
    });
  };

  const handlePercentageChange = (jar: string, value: number[]) => {
    setJarPercentages((prev) => ({ ...prev, [jar]: value[0] }));
  };

  const getTotalPercentage = () => {
    return Object.values(jarPercentages).reduce((sum, val) => sum + val, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 6 || parsedAge > 16) {
      toast({
        variant: "destructive",
        title: "Invalid age",
        description: "Please enter an age between 6 and 16 years.",
      });
      return;
    }

    if (!isPasswordValid) {
      toast({
        variant: "destructive",
        title: "Weak password",
        description: "Password must be at least 8 characters with a mix of letters, numbers, or symbols.",
      });
      return;
    }

    if (!doPasswordsMatch) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
      });
      return;
    }

    if (getTotalPercentage() !== 100) {
      toast({
        variant: "destructive",
        title: "Invalid percentages",
        description: "Jar percentages must total exactly 100%",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Save parent session before creating child
      const { data: { session: parentSession } } = await supabase.auth.getSession();
      if (!parentSession) throw new Error("No active session");

      // Generate email for child with simple 4-digit code (password is set by parent)
      const uniqueCode = Math.floor(1000 + Math.random() * 9000); // 4-digit code
      const childEmail = `${name.toLowerCase().replace(/\s+/g, '')}.${uniqueCode}@familybank.app`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: childEmail,
        password: password, // Use parent-set password
        options: {
          data: {
            display_name: name,
            role: 'CHILD'
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create child auth account");

      // Restore parent session immediately
      await supabase.auth.setSession({
        access_token: parentSession.access_token,
        refresh_token: parentSession.refresh_token
      });

      // Create child profile (password is shown once and NOT stored for security)
      const { data: child, error: childError } = await supabase
        .from("children")
        .insert({
          parent_id: user.id,
          user_id: authData.user.id,
          name,
          age: parseInt(age),
        })
        .select()
        .single();

      if (childError) throw childError;

      // Create jars
      const jarsData = JAR_TYPES.map((jarType) => ({
        child_id: child.id,
        jar_type: jarType as "SAVINGS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST",
        percentage: jarPercentages[jarType as keyof typeof jarPercentages],
      }));

      const { error: jarsError } = await supabase
        .from("jars")
        .insert(jarsData);

      if (jarsError) throw jarsError;

      // Create initial balances (all zero)
      const balancesData = JAR_TYPES.map((jarType) => ({
        child_id: child.id,
        jar_type: jarType as "SAVINGS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST",
        amount: 0,
      }));

      const { error: balancesError } = await supabase
        .from("balances")
        .insert(balancesData);

      if (balancesError) throw balancesError;

      // Show credentials dialog (only email - parent already knows the password)
      setCredentials({
        email: childEmail,
        childName: name
      });
      setShowCredentials(true);

      toast({
        title: "Child added!",
        description: `${name} has been added successfully. Note the login email below.`,
      });
    } catch (error: any) {
      console.error("Error adding child:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add child.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={showCredentials} onOpenChange={(open) => {
        setShowCredentials(open);
        if (!open) navigate("/parent/dashboard");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🎉 Child Account Created!</DialogTitle>
            <DialogDescription>
              Share the login email with {credentials.childName}. They'll use the password you just set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Login Email</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={credentials.email}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(credentials.email)}
                >
                  {copiedEmail ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-primary/10 p-4 border border-primary/30">
              <p className="text-sm font-medium">
                ✅ <strong>Password Set</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You set the password during setup. Share it with {credentials.childName} so they can log in at the child login page.
              </p>
            </div>
            <Button onClick={() => {
              setShowCredentials(false);
              navigate("/parent/dashboard");
            }} className="w-full">
              Done - Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/parent/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Add a New Child</CardTitle>
            <CardDescription>
              Set up your child's profile and customize their savings jar percentages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Child's Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age (6-16 years) *</Label>
                <Input
                  id="age"
                  type="number"
                  min="6"
                  max="16"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Enter age (6-16)"
                  required
                  className="text-base"
                />
              </div>

              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <Label className="text-base">Set Child's Password *</Label>
                  <p className="text-sm text-muted-foreground">
                    Create a password your child will use to log in. An email will be auto-generated.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a password for your child"
                    required
                  />
                  {password && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Strength:</span>
                        <span className={`font-medium ${
                          passwordStrength.label === 'Weak' ? 'text-destructive' :
                          passwordStrength.label === 'Fair' ? 'text-yellow-600' :
                          passwordStrength.label === 'Good' ? 'text-blue-600' : 'text-green-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <Progress 
                        value={passwordStrength.score} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use 8+ characters with uppercase, lowercase, numbers, and symbols
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm the password"
                    required
                  />
                  {confirmPassword && !doPasswordsMatch && (
                    <p className="text-sm text-destructive">Passwords don't match</p>
                  )}
                  {confirmPassword && doPasswordsMatch && (
                    <p className="text-sm text-green-600">✓ Passwords match</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-base">Jar Percentages</Label>
                  <p className="text-sm text-muted-foreground">
                    Set how tokens are automatically split when earned. Must total 100%.
                  </p>
                  <p className="text-sm font-medium mt-2">
                    Current total: {getTotalPercentage()}%{" "}
                    {getTotalPercentage() === 100 ? "✓" : "⚠️"}
                  </p>
                </div>

                {JAR_TYPES.map((jar) => (
                  <div key={jar} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{jar.toLowerCase()}</Label>
                      <span className="font-semibold text-primary">
                        {jarPercentages[jar as keyof typeof jarPercentages]}%
                      </span>
                    </div>
                    <Slider
                      value={[jarPercentages[jar as keyof typeof jarPercentages]]}
                      onValueChange={(value) => handlePercentageChange(jar, value)}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || getTotalPercentage() !== 100 || !isPasswordValid || !doPasswordsMatch}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Child
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default AddChild;
