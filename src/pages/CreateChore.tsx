import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Child {
  id: string;
  name: string;
}

const CreateChore = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tokenReward, setTokenReward] = useState("");

  const moneyToTokens = (money: number) => {
    return money * 10;
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("children")
        .select("id, name")
        .eq("parent_id", user.id);

      if (data) {
        // Sort children alphabetically by name
        const sortedChildren = data.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setChildren(sortedChildren);
      }
    } catch (error) {
      console.error("Error fetching children:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChild) {
      toast({
        variant: "destructive",
        title: "Please select a child",
      });
      return;
    }

    setLoading(true);

    try {
      const money = parseFloat(tokenReward);
      const tokens = moneyToTokens(money);
      
      const { error } = await supabase
        .from("chores")
        .insert({
          child_id: selectedChild,
          title,
          description: description || null,
          token_reward: tokens,
          status: "PENDING",
        });

      if (error) throw error;

      toast({
        title: "Chore created!",
        description: "The chore has been added to your child's list.",
      });

      navigate("/parent/dashboard");
    } catch (error: any) {
      console.error("Error creating chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create chore.",
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
            <CardTitle>Create a New Chore</CardTitle>
            <CardDescription>
              Assign a task for your child to complete and earn tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="child">Assign to Child *</Label>
                <Select value={selectedChild} onValueChange={setSelectedChild} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Chore Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Clean your room"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about what needs to be done..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward">Reward Amount ($) *</Label>
                <Input
                  id="reward"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tokenReward}
                  onChange={(e) => setTokenReward(e.target.value)}
                  placeholder="5.00"
                  required
                />
                {tokenReward && parseFloat(tokenReward) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    = {moneyToTokens(parseFloat(tokenReward)).toFixed(0)} tokens
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Tokens will be automatically split into jars when approved
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Chore
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateChore;
