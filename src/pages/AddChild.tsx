import { useState, useMemo, useEffect } from "react";
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
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({ username: "", familyCode: "", childName: "" });
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [familyCode, setFamilyCode] = useState("");
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
  const isUsernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);

  // Fetch family code on mount
  useEffect(() => {
    const fetchFamilyCode = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("family_code")
          .eq("id", user.id)
          .single();
        if (profile?.family_code) {
          setFamilyCode(profile.family_code);
        }
      }
    };
    fetchFamilyCode();
  }, []);

  const copyToClipboard = async (text: string, type: 'code' | 'username') => {
    await navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedUsername(true);
      setTimeout(() => setCopiedUsername(false), 2000);
    }
    toast({
      title: "Copied!",
      description: `${type === 'code' ? 'Family code' : 'Username'} copied to clipboard`,
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

    if (!isUsernameValid) {
      toast({
        variant: "destructive",
        title: "Invalid username",
        description: "Username must be 3-20 characters, letters, numbers, and underscores only.",
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

      // Check if username is already taken within this family
      const { data: existingChild } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", user.id)
        .ilike("name", username);
      
      if (existingChild && existingChild.length > 0) {
        toast({
          variant: "destructive",
          title: "Username taken",
          description: "You already have a child with this username. Please choose a different one.",
        });
        setLoading(false);
        return;
      }

      // Generate internal email using family code and username (hidden from user)
      const internalEmail = `${username.toLowerCase()}_${familyCode.toLowerCase()}@familybank.internal`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: internalEmail,
        password: password,
        options: {
          data: {
            display_name: name,
            role: 'CHILD',
            username: username
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

      // Create child profile with username
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

      // Show credentials dialog with username and family code
      setCredentials({
        username: username,
        familyCode: familyCode,
        childName: name
      });
      setShowCredentials(true);

      toast({
        title: "Child added!",
        description: `${name} has been added successfully. Note the login details below.`,
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
              Share these login details with {credentials.childName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Family Code</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={credentials.familyCode}
                  readOnly
                  className="flex-1 font-mono text-lg font-bold tracking-widest"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(credentials.familyCode, 'code')}
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your child enters this once on their device to connect to your family
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Username</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={credentials.username}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(credentials.username, 'username')}
                >
                  {copiedUsername ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="rounded-lg bg-primary/10 p-4 border border-primary/30">
              <p className="text-sm font-medium">
                ✅ <strong>Password Set</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You set the password during setup. Share it with {credentials.childName} so they can log in.
              </p>
            </div>
            
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">📱 Child Login Steps:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to child login page</li>
                <li>Enter family code: <strong>{credentials.familyCode}</strong> (first time only)</li>
                <li>Enter username: <strong>{credentials.username}</strong></li>
                <li>Enter password you set</li>
              </ol>
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
                <Label htmlFor="name">Child's Display Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter display name (e.g., Alex)"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This is how your child's name will appear in the app
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="Enter username (e.g., alex_smith)"
                  required
                  className="font-mono"
                  maxLength={20}
                />
                {username && !isUsernameValid && (
                  <p className="text-sm text-destructive">3-20 characters, letters, numbers, underscores only</p>
                )}
                {username && isUsernameValid && (
                  <p className="text-sm text-green-600">✓ Valid username</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Your child will use this to log in
                </p>
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
              
              {familyCode && (
                <div className="rounded-lg bg-muted p-4 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Your Family Code</Label>
                      <p className="text-2xl font-mono font-bold tracking-widest">{familyCode}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(familyCode, 'code')}
                    >
                      {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    All your children use this same code to connect to your family
                  </p>
                </div>
              )}

              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <Label className="text-base">Set Child's Password *</Label>
                  <p className="text-sm text-muted-foreground">
                    Create a password your child will use to log in with their username.
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
                disabled={loading || getTotalPercentage() !== 100 || !isPasswordValid || !doPasswordsMatch || !isUsernameValid}
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
