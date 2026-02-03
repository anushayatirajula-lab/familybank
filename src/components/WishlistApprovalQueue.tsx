import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X, ShoppingBag } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WishlistItem {
  id: string;
  child_id: string;
  title: string;
  description: string | null;
  target_amount: number;
  approved_by_parent: boolean | null;
  is_purchased: boolean | null;
  created_at: string | null;
}

interface Child {
  id: string;
  name: string;
}

interface ChildBalance {
  child_id: string;
  wishlist_amount: number;
}

interface WishlistApprovalQueueProps {
  childId?: string;
}

export default function WishlistApprovalQueue({ childId }: WishlistApprovalQueueProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<(WishlistItem & { child_name: string })[]>([]);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | null>(null);
  const [processing, setProcessing] = useState(false);

  const formatMoney = (amount: number) => {
    return (amount / 10).toFixed(2);
  };

  useEffect(() => {
    loadPendingItems();
  }, [childId]);

  const loadPendingItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("wishlist_items")
        .select(`
          *,
          children!inner(name, parent_id)
        `)
        .eq("approved_by_parent", false)
        .eq("is_purchased", false);

      if (childId) {
        query = query.eq("child_id", childId);
      } else {
        query = query.eq("children.parent_id", user.id);
      }

      const { data, error } = await query.order("created_at", { ascending: true });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        ...item,
        child_name: item.children.name,
      })) || [];

      setItems(formattedData);

      // Load WISHLIST balances for all children
      const childIds = [...new Set(formattedData.map(item => item.child_id))];
      if (childIds.length > 0) {
        const { data: balanceData, error: balanceError } = await supabase
          .from("balances")
          .select("child_id, amount")
          .eq("jar_type", "WISHLIST")
          .in("child_id", childIds);

        if (balanceError) throw balanceError;

        const balanceMap = new Map(
          balanceData?.map(b => [b.child_id, b.amount]) || []
        );
        setBalances(balanceMap);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: WishlistItem) => {
    setSelectedItem(item);
    setActionType("approve");
  };

  const handleDeny = async (item: WishlistItem) => {
    setSelectedItem(item);
    setActionType("deny");
  };

  const confirmAction = async () => {
    if (!selectedItem || !actionType) return;

    setProcessing(true);
    try {
      if (actionType === "approve") {
        const { data, error } = await supabase.functions.invoke("approve-wishlist-item", {
          body: { wishlist_item_id: selectedItem.id },
        });

        if (error) throw error;
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        toast({ title: "Item approved and purchased!" });
      } else {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("id", selectedItem.id);

        if (error) throw error;
        toast({ title: "Item denied and removed" });
      }

      await loadPendingItems();
    } catch (error: any) {
      const errorMessage = error.message || "An error occurred";
      toast({
        title: "Error",
        description: errorMessage.includes("Insufficient balance") 
          ? "Child doesn't have enough saved in their WISHLIST jar for this item."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setSelectedItem(null);
      setActionType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No pending wishlist items</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => {
          const wishlistBalance = balances.get(item.child_id) || 0;
          const hasEnoughBalance = wishlistBalance >= item.target_amount;
          
          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="p-4">
                {/* Header row: Title + Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{item.title}</h3>
                      {!childId && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {item.child_name}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">Pending</Badge>
                </div>

                {/* Content row: Price info + Actions */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-xl font-bold text-primary">
                      ${formatMoney(item.target_amount)}
                    </span>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Saved: ${formatMoney(wishlistBalance)}</span>
                      {!hasEnoughBalance && (
                        <span className="text-amber-600">
                          (needs ${formatMoney(item.target_amount - wishlistBalance)} more)
                        </span>
                      )}
                      {hasEnoughBalance && (
                        <span className="text-green-600">✓ Ready</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeny(item)}
                      disabled={processing}
                      className="h-8 px-3"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item)}
                      disabled={processing || !hasEnoughBalance}
                      className="h-8 px-3"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setActionType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" ? "Approve Wishlist Item" : "Deny Wishlist Item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve" ? (
                <>
                  This will deduct <strong>${formatMoney(selectedItem?.target_amount || 0)}</strong> from{" "}
                  {childId ? "the" : selectedItem ? `${(selectedItem as any).child_name}'s` : "the"} WISHLIST jar and mark the item as purchased. An email notification will be sent.
                </>
              ) : (
                "This will permanently remove this item from the wishlist."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={processing}>
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                actionType === "approve" ? "Approve & Purchase" : "Deny"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
