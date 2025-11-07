import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Clock, CheckCircle, ShoppingBag } from "lucide-react";

interface WishlistItem {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  approved_by_parent: boolean | null;
  is_purchased: boolean | null;
  created_at: string | null;
}

export default function ChildWishlist() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_amount: "",
  });

  useEffect(() => {
    loadChildData();
  }, []);

  const loadChildData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/child-auth");
        return;
      }

      const { data: child, error: childError } = await supabase
        .from("children")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (childError) throw childError;
      setChildId(child.id);

      await loadWishlistItems(child.id);
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

  const loadWishlistItems = async (childId: string) => {
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setItems(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId) return;

    try {
      const amount = parseFloat(formData.target_amount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid amount",
          description: "Please enter a valid price",
          variant: "destructive",
        });
        return;
      }

      if (editingItem) {
        const { error } = await supabase
          .from("wishlist_items")
          .update({
            title: formData.title,
            description: formData.description,
            target_amount: amount,
          })
          .eq("id", editingItem.id);

        if (error) throw error;
        toast({ title: "Item updated successfully!" });
      } else {
        const { error } = await supabase
          .from("wishlist_items")
          .insert({
            child_id: childId,
            title: formData.title,
            description: formData.description,
            target_amount: amount,
          });

        if (error) throw error;
        toast({ title: "Item added to wishlist!" });
      }

      setFormData({ title: "", description: "", target_amount: "" });
      setEditingItem(null);
      setIsAddDialogOpen(false);
      loadWishlistItems(childId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      toast({ title: "Item deleted" });
      if (childId) loadWishlistItems(childId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (item: WishlistItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      target_amount: item.target_amount.toString(),
    });
    setIsAddDialogOpen(true);
  };

  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
    setFormData({ title: "", description: "", target_amount: "" });
  };

  const getStatusBadge = (item: WishlistItem) => {
    if (item.is_purchased) {
      return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Purchased</Badge>;
    }
    if (item.approved_by_parent) {
      return <Badge className="bg-primary text-primary-foreground"><ShoppingBag className="w-3 h-3 mr-1" />Approved</Badge>;
    }
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">My Wishlist</h1>
            <p className="text-muted-foreground">Add items you want to save up for</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingItem(null); setFormData({ title: "", description: "", target_amount: "" }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Item" : "Add Wishlist Item"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Item Name</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., New Bike"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Tell us more about what you want..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.target_amount}
                      onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingItem ? "Update" : "Add"} Item
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-4">Your wishlist is empty</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{item.title}</CardTitle>
                      {item.description && (
                        <CardDescription className="mt-2">{item.description}</CardDescription>
                      )}
                    </div>
                    {getStatusBadge(item)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        ${item.target_amount.toFixed(2)}
                      </p>
                    </div>
                    {!item.approved_by_parent && !item.is_purchased && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          className="mt-6"
          onClick={() => navigate(`/child/${childId}`)}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
