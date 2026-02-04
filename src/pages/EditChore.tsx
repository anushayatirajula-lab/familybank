import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const EditChore = () => {
  const navigate = useNavigate();
  const { choreId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [childName, setChildName] = useState("");
  const [childId, setChildId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly">("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);

  const formatStoredAmount = (stored: number) => {
    return stored / 10;
  };

  const dollarsToCents = (dollars: number) => {
    return dollars * 10;
  };

  useEffect(() => {
    fetchChore();
  }, [choreId]);

  const fetchChore = async () => {
    try {
      const { data: chore, error } = await supabase
        .from("chores")
        .select(`
          *,
          children:child_id (id, name)
        `)
        .eq("id", choreId)
        .maybeSingle();

      if (error) throw error;

      if (!chore) {
        toast({
          variant: "destructive",
          title: "Chore not found",
        });
        navigate("/parent/dashboard");
        return;
      }

      setTitle(chore.title);
      setDescription(chore.description || "");
      setRewardAmount(formatStoredAmount(Number(chore.token_reward)).toString());
      setIsRecurring(chore.is_recurring || false);
      setRecurrenceType((chore.recurrence_type as "daily" | "weekly") || "weekly");
      // Use recurrence_days if available, fall back to recurrence_day for backward compat
      const days = (chore as any).recurrence_days;
      if (days && Array.isArray(days) && days.length > 0) {
        setSelectedDays(days);
      } else if (chore.recurrence_day !== null) {
        setSelectedDays([chore.recurrence_day]);
      } else {
        setSelectedDays([1]);
      }
      setChildId(chore.child_id);
      setChildName((chore.children as any)?.name || "");
    } catch (error) {
      console.error("Error fetching chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load chore details.",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dollars = parseFloat(rewardAmount);
      const storedAmount = dollarsToCents(dollars);

      const choreData: any = {
        title,
        description: description || null,
        token_reward: storedAmount,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_days: isRecurring && recurrenceType === "weekly" ? selectedDays : null,
        recurrence_day: isRecurring && recurrenceType === "weekly" ? selectedDays[0] : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("chores")
        .update(choreData)
        .eq("id", choreId);

      if (error) throw error;

      toast({
        title: "Chore updated!",
        description: "The chore has been successfully updated.",
      });

      navigate(`/parent/child/${childId}`);
    } catch (error: any) {
      console.error("Error updating chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update chore.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(`/parent/child/${childId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {childName}'s Profile
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Edit Chore</CardTitle>
            <CardDescription>
              Update the chore details for {childName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  placeholder="5.00"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This amount will be automatically split into jars when approved
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
                        <Label>Days of Week</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <div key={day.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-day-${day.value}`}
                                checked={selectedDays.includes(day.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDays([...selectedDays, day.value].sort());
                                  } else {
                                    if (selectedDays.length > 1) {
                                      setSelectedDays(selectedDays.filter(d => d !== day.value));
                                    }
                                  }
                                }}
                              />
                              <Label htmlFor={`edit-day-${day.value}`} className="text-sm font-normal cursor-pointer">
                                {day.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950 p-2 rounded border border-amber-200 dark:border-amber-800">
                      💡 This chore will be automatically created {recurrenceType === "daily" 
                        ? "every day" 
                        : `on ${selectedDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(", ")}`} after approval.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/parent/child/${childId}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditChore;
