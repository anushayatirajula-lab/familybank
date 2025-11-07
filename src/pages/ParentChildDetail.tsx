import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
import { ArrowLeft, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import coinIcon from "@/assets/coin-icon.png";
import { AllowanceManager } from "@/components/AllowanceManager";

interface Chore {
  id: string;
  title: string;
  description: string | null;
  token_reward: number;
  status: string;
  due_at: string | null;
  submitted_at: string | null;
}

interface Balance {
  jar_type: string;
  amount: number;
}

const ParentChildDetail = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [child, setChild] = useState<any>(null);
  const [chores, setChores] = useState<Chore[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    if (childId) {
      fetchChildData();
      subscribeToUpdates();
    }
  }, [childId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth/login");
    }
  };

  const fetchChildData = async () => {
    try {
      const { data: childData } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .single();

      if (childData) {
        setChild(childData);
      }

      const { data: choresData } = await supabase
        .from("chores")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });

      if (choresData) {
        setChores(choresData);
      }

      const { data: balancesData } = await supabase
        .from("balances")
        .select("*")
        .eq("child_id", childId);

      if (balancesData) {
        setBalances(balancesData);
      }
    } catch (error) {
      console.error("Error fetching child data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load child data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel("parent-child-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chores",
          filter: `child_id=eq.${childId}`,
        },
        () => fetchChildData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleApproveChore = async (choreId: string, tokenReward: number) => {
    try {
      const { error: approveError } = await supabase.rpc("fb_approve_chore", {
        p_chore: choreId,
      });

      if (approveError) throw approveError;

      toast({
        title: "Chore approved!",
        description: "Tokens have been distributed to the child's jars.",
      });
    } catch (error) {
      console.error("Error approving chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve chore.",
      });
    }
  };

  const handleRejectChore = async (choreId: string) => {
    try {
      const { error } = await supabase
        .from("chores")
        .update({ status: "PENDING" })
        .eq("id", choreId);

      if (error) throw error;

      toast({
        title: "Chore rejected",
        description: "The chore has been sent back to pending status.",
      });
    } catch (error) {
      console.error("Error rejecting chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject chore.",
      });
    }
  };

  const getTotalBalance = () => {
    return balances.reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const handleDeleteChild = async () => {
    try {
      const { error } = await supabase
        .from("children")
        .delete()
        .eq("id", childId);

      if (error) throw error;

      toast({
        title: "Child deleted",
        description: `${child.name}'s profile has been removed.`,
      });

      navigate("/parent/dashboard");
    } catch (error) {
      console.error("Error deleting child:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete child profile.",
      });
    }
  };

  const getJarColor = (jarType: string) => {
    const colors: Record<string, string> = {
      TOYS: "bg-jar-toys",
      BOOKS: "bg-jar-books",
      SHOPPING: "bg-jar-shopping",
      CHARITY: "bg-jar-charity",
      WISHLIST: "bg-jar-wishlist",
    };
    return colors[jarType] || "bg-primary";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Child not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate("/parent/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Child
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {child.name}'s profile, including all their chores, balances, and transaction history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteChild} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <h1 className="text-3xl font-bold">{child.name}'s Profile</h1>
          {child.age && <p className="text-muted-foreground">Age {child.age}</p>}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Wallet Overview */}
        <Card className="bg-gradient-coin shadow-coin">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <img src={coinIcon} alt="Coin" className="w-10 h-10 animate-bounce-subtle" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold mb-6">{getTotalBalance().toFixed(2)} tokens</p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {balances.map((balance) => (
                <div key={balance.jar_type} className="text-center">
                  <div className={`w-full h-16 rounded-lg ${getJarColor(balance.jar_type)} mb-2 flex items-center justify-center text-white font-bold`}>
                    {Number(balance.amount).toFixed(0)}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {balance.jar_type.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Allowance */}
        <AllowanceManager childId={childId!} childName={child.name} />

        {/* Chores Management */}
        <Card>
          <CardHeader>
            <CardTitle>Chores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chores.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No chores created yet.
                </p>
              ) : (
                chores.map((chore) => (
                  <div
                    key={chore.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {chore.status === "APPROVED" && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {chore.status === "SUBMITTED" && (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        )}
                        {chore.status === "PENDING" && (
                          <div className="w-5 h-5 rounded-full border-2 border-muted" />
                        )}
                        <h3 className="font-semibold">{chore.title}</h3>
                      </div>
                      {chore.description && (
                        <p className="text-sm text-muted-foreground ml-8">{chore.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 ml-8">
                        <Badge className="bg-gradient-coin">
                          {Number(chore.token_reward).toFixed(0)} tokens
                        </Badge>
                        <Badge variant="outline">{chore.status}</Badge>
                      </div>
                    </div>
                    
                    {chore.status === "SUBMITTED" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveChore(chore.id, chore.token_reward)}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectChore(chore.id)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParentChildDetail;
