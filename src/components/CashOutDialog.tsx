import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Banknote, DollarSign } from "lucide-react";

interface Balance {
  jar_type: string;
  amount: number;
}

interface CashOutDialogProps {
  childId: string;
  childName: string;
  balances: Balance[];
  onCashOutComplete: () => void;
}

const NON_WISHLIST_JARS = ["TOYS", "BOOKS", "SHOPPING", "CHARITY"];

const JAR_LABELS: Record<string, string> = {
  TOYS: "Toys",
  BOOKS: "Books",
  SHOPPING: "Shopping",
  CHARITY: "Charity",
};

export function CashOutDialog({ childId, childName, balances, onCashOutComplete }: CashOutDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedJar, setSelectedJar] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const availableJars = balances.filter(
    (b) => NON_WISHLIST_JARS.includes(b.jar_type) && Number(b.amount) > 0
  );

  const selectedBalance = balances.find((b) => b.jar_type === selectedJar);
  const maxAmount = selectedBalance ? Number(selectedBalance.amount) / 10 : 0;

  const formatMoney = (amount: number) => {
    return (amount / 10).toFixed(2);
  };

  const handleCashOut = async () => {
    if (!selectedJar || !amount) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a jar and enter an amount.",
      });
      return;
    }

    const cashOutAmount = parseFloat(amount);
    if (isNaN(cashOutAmount) || cashOutAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid amount greater than 0.",
      });
      return;
    }

    if (cashOutAmount > maxAmount) {
      toast({
        variant: "destructive",
        title: "Insufficient funds",
        description: `The ${JAR_LABELS[selectedJar]} jar only has $${maxAmount.toFixed(2)}.`,
      });
      return;
    }

    setLoading(true);
    try {
      // Convert to internal amount (multiply by 10)
      const internalAmount = Math.round(cashOutAmount * 10);

      // Update the balance - cast jar_type to the expected enum type
      const jarType = selectedJar as "TOYS" | "BOOKS" | "SHOPPING" | "CHARITY" | "WISHLIST";
      
      const { error: balanceError } = await supabase
        .from("balances")
        .update({
          amount: (selectedBalance?.amount || 0) - internalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("child_id", childId)
        .eq("jar_type", jarType);

      if (balanceError) throw balanceError;
      
      toast({
        title: "Cash out successful!",
        description: `$${cashOutAmount.toFixed(2)} has been deducted from ${childName}'s ${JAR_LABELS[selectedJar]} jar.${description ? ` Reason: ${description}` : ""}`,
      });

      setOpen(false);
      setSelectedJar("");
      setAmount("");
      setDescription("");
      onCashOutComplete();
    } catch (error) {
      console.error("Error processing cash out:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process cash out. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetMaxAmount = () => {
    if (maxAmount > 0) {
      setAmount(maxAmount.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Banknote className="h-4 w-4" />
          Cash Out
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Cash Out from Jar
          </DialogTitle>
          <DialogDescription>
            Deduct money from {childName}'s savings when you give them real cash or buy something for them.
          </DialogDescription>
        </DialogHeader>

        {availableJars.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            No jars have funds available for cash out.
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jar">Select Jar</Label>
              <Select value={selectedJar} onValueChange={setSelectedJar}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a jar" />
                </SelectTrigger>
                <SelectContent>
                  {availableJars.map((balance) => (
                    <SelectItem key={balance.jar_type} value={balance.jar_type}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{JAR_LABELS[balance.jar_type]}</span>
                        <span className="text-muted-foreground">
                          ${formatMoney(Number(balance.amount))} available
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount</Label>
                {selectedJar && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={handleSetMaxAmount}
                  >
                    Use max (${maxAmount.toFixed(2)})
                  </Button>
                )}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxAmount}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Reason (optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g., Bought a toy at the store"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCashOut}
            disabled={loading || availableJars.length === 0}
          >
            {loading ? "Processing..." : "Confirm Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
