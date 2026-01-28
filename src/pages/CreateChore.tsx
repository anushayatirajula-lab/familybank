import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly">("weekly");
  const [recurrenceDay, setRecurrenceDay] = useState<number>(1); // Monday

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
      
      const choreData: any = {
        child_id: selectedChild,
        title,
        description: description || null,
        token_reward: tokens,
        status: "PENDING",
        is_recurring: isRecurring,
      };

      if (isRecurring) {
        choreData.recurrence_type = recurrenceType;
        if (recurrenceType === "weekly") {
          choreData.recurrence_day = recurrenceDay;
        }
      }

      const { error } = await supabase.from("chores").insert(choreData);

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

              {/* Recurring Chore Options */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="recurring" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Recurring Chore
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create this chore on a schedule
                    </p>
                  </div>
                  <Switch
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>

                {isRecurring && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-2">
                      <Label>Repeat</Label>
                      <Select
                        value={recurrenceType}
                        onValueChange={(value: "daily" | "weekly") => setRecurrenceType(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {recurrenceType === "weekly" && (
                      <div className="space-y-2">
                        <Label>Day of Week</Label>
                        <Select
                          value={recurrenceDay.toString()}
                          onValueChange={(value) => setRecurrenceDay(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                      💡 This chore will be automatically created {recurrenceType === "daily" ? "every day" : `every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][recurrenceDay]}`} after the first one is approved.
                    </p>
                  </div>
                )}
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
