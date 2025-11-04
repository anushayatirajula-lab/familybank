import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

const JAR_TYPES = ["TOYS", "BOOKS", "SHOPPING", "CHARITY", "WISHLIST"];

const AddChild = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [jarPercentages, setJarPercentages] = useState({
    TOYS: 30,
    BOOKS: 20,
    SHOPPING: 20,
    CHARITY: 10,
    WISHLIST: 20,
  });

  const handlePercentageChange = (jar: string, value: number[]) => {
    setJarPercentages((prev) => ({ ...prev, [jar]: value[0] }));
  };

  const getTotalPercentage = () => {
    return Object.values(jarPercentages).reduce((sum, val) => sum + val, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      // Generate secure credentials for child
      const childEmail = `${name.toLowerCase().replace(/\s+/g, '')}@familybank.local`;
      const childPassword = `child${Date.now()}${Math.random().toString(36)}`; // Secure random password
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: childEmail,
        password: childPassword,
        options: {
          data: {
            display_name: name,
            role: 'child'
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

      // Create child profile
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
        jar_type: jarType as "TOYS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST",
        percentage: jarPercentages[jarType as keyof typeof jarPercentages],
      }));

      const { error: jarsError } = await supabase
        .from("jars")
        .insert(jarsData);

      if (jarsError) throw jarsError;

      // Create initial balances (all zero)
      const balancesData = JAR_TYPES.map((jarType) => ({
        child_id: child.id,
        jar_type: jarType as "TOYS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST",
        amount: 0,
      }));

      const { error: balancesError } = await supabase
        .from("balances")
        .insert(balancesData);

      if (balancesError) throw balancesError;

      // Send credentials email to parent
      try {
        const { error: emailError } = await supabase.functions.invoke('send-child-credentials', {
          body: {
            parentEmail: user.email,
            childName: name,
            childUserId: authData.user.id,
            temporaryPassword: childPassword
          }
        });

        if (emailError) {
          console.error('Failed to send email:', emailError);
          toast({
            title: "Child added!",
            description: `${name} has been added, but we couldn't send the email. User ID: ${authData.user.id}`,
            duration: 10000,
          });
        } else {
          toast({
            title: "Child added!",
            description: `${name} has been added. Login credentials have been sent to your email.`,
          });
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        toast({
          title: "Child added!",
          description: `${name} has been added, but we couldn't send the email. User ID: ${authData.user.id}`,
          duration: 10000,
        });
      }

      navigate("/parent/dashboard");
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
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  min="1"
                  max="18"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Enter age"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  A secure login will be automatically generated for your child
                </p>
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

              <Button type="submit" className="w-full" disabled={loading || getTotalPercentage() !== 100}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Child
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddChild;
