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

interface WishlistApprovalQueueProps {
  childId?: string;
}

export default function WishlistApprovalQueue({ childId }: WishlistApprovalQueueProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<(WishlistItem & { child_name: string })[]>([]);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | null>(null);
  const [processing, setProcessing] = useState(false);

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
        const { error } = await supabase.functions.invoke("approve-wishlist-item", {
          body: { wishlist_item_id: selectedItem.id },
        });

        if (error) throw error;
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
      toast({
        title: "Error",
        description: error.message,
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
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  {!childId && (
                    <Badge variant="outline" className="mt-2">
                      {item.child_name}
                    </Badge>
                  )}
                  {item.description && (
                    <CardDescription className="mt-2">{item.description}</CardDescription>
                  )}
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-primary">
                  ${item.target_amount.toFixed(2)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeny(item)}
                    disabled={processing}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(item)}
                    disabled={processing}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
                  This will deduct <strong>${selectedItem?.target_amount.toFixed(2)}</strong> from{" "}
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
