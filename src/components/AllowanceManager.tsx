import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Calendar } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Allowance {
  id: string;
  weekly_amount: number;
  day_of_week: number;
  next_payment_at: string;
  is_active: boolean;
}

interface AllowanceManagerProps {
  childId: string;
  childName: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const AllowanceManager = ({ childId, childName }: AllowanceManagerProps) => {
  const { toast } = useToast();
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");

  useEffect(() => {
    fetchAllowances();
  }, [childId]);

  const fetchAllowances = async () => {
    try {
      const { data, error } = await supabase
        .from("allowances")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllowances(data || []);
    } catch (error) {
      console.error("Error fetching allowances:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load allowances.",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateNextPaymentDate = (dayOfWeek: number): string => {
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntilNext = dayOfWeek - currentDay;
    
    if (daysUntilNext <= 0) {
      daysUntilNext += 7;
    }
    
    const nextPayment = new Date(today);
    nextPayment.setDate(today.getDate() + daysUntilNext);
    nextPayment.setHours(0, 0, 0, 0);
    
    return nextPayment.toISOString();
  };

  const handleSaveAllowance = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid allowance amount.",
      });
      return;
    }

    try {
      const allowanceData = {
        child_id: childId,
        weekly_amount: parseFloat(amount),
        day_of_week: parseInt(dayOfWeek),
        next_payment_at: calculateNextPaymentDate(parseInt(dayOfWeek)),
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase
          .from("allowances")
          .update(allowanceData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "Allowance Updated",
          description: "Weekly allowance has been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from("allowances")
          .insert([allowanceData]);

        if (error) throw error;

        toast({
          title: "Allowance Created",
          description: "Weekly allowance has been set up successfully.",
        });
      }

      setAmount("");
      setDayOfWeek("1");
      setEditingId(null);
      fetchAllowances();
    } catch (error) {
      console.error("Error saving allowance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save allowance.",
      });
    }
  };

  const handleEdit = (allowance: Allowance) => {
    setEditingId(allowance.id);
    setAmount(allowance.weekly_amount.toString());
    setDayOfWeek(allowance.day_of_week.toString());
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("allowances")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Allowance Deleted",
        description: "Weekly allowance has been removed.",
      });

      fetchAllowances();
    } catch (error) {
      console.error("Error deleting allowance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete allowance.",
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setAmount("");
    setDayOfWeek("1");
  };

  if (loading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg"></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Weekly Allowance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Weekly Amount (tokens)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="day">Payment Day</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveAllowance} className="flex-1">
              {editingId ? "Update Allowance" : "Save Allowance"}
            </Button>
            {editingId && (
              <Button onClick={handleCancel} variant="outline">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {allowances.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No allowances set up yet.
            </p>
          ) : (
            allowances.map((allowance) => (
              <div
                key={allowance.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {allowance.weekly_amount.toFixed(2)} tokens
                    </span>
                    <span className="text-sm text-muted-foreground">
                      • Every {DAYS_OF_WEEK.find((d) => d.value === allowance.day_of_week)?.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Next payment: {new Date(allowance.next_payment_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(allowance)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Allowance?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop the weekly allowance of {allowance.weekly_amount.toFixed(2)} tokens for {childName}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(allowance.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
