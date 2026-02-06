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
import { ArrowLeft, CheckCircle, XCircle, Clock, Trash2, RefreshCw, Pencil, DollarSign } from "lucide-react";
import { AllowanceManager } from "@/components/AllowanceManager";
import WishlistApprovalQueue from "@/components/WishlistApprovalQueue";
import { SpendingInsights } from "@/components/SpendingInsights";
import { CashOutDialog } from "@/components/CashOutDialog";
import { JarPercentageEditor } from "@/components/JarPercentageEditor";
import { EditChildProfile } from "@/components/EditChildProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Chore {
  id: string;
  title: string;
  description: string | null;
  token_reward: number;
  status: string;
  due_at: string | null;
  submitted_at: string | null;
  is_recurring: boolean | null;
  recurrence_type: string | null;
  recurrence_day: number | null;
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

      // Immediately refetch to update UI without waiting for realtime
      await fetchChildData();

      // Send push notification to child
      if (child?.user_id) {
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              userId: child.user_id,
              title: "Chore Approved! 🎉",
              body: `Your chore has been approved! $${formatMoney(tokenReward)} added to your jars.`,
              url: `/child/${childId}`,
            },
          });
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Don't fail the approval if notification fails
        }
      }

      toast({
        title: "Chore approved!",
        description: "The reward has been distributed to the child's jars.",
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

      // Immediately refetch to update UI without waiting for realtime
      await fetchChildData();

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

  const handleDeleteChore = async (choreId: string, choreTitle: string) => {
    try {
      const { error } = await supabase
        .from("chores")
        .delete()
        .eq("id", choreId);

      if (error) throw error;

      toast({
        title: "Chore deleted",
        description: `"${choreTitle}" has been removed.`,
      });
      
      fetchChildData();
    } catch (error) {
      console.error("Error deleting chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete chore.",
      });
    }
  };

  const getTotalBalance = () => {
    return balances.reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const formatMoney = (amount: number) => {
    return (amount / 10).toFixed(2);
  };

  const handleDeleteChild = async () => {
    try {
      // Call edge function to delete both auth user and database records
      const { data, error } = await supabase.functions.invoke("delete-child-profile", {
        body: { childId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Child deleted",
        description: data?.message || `${child.name}'s profile has been removed.`,
      });

      navigate("/parent/dashboard");
    } catch (error) {
      console.error("Error deleting child:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete child profile.",
      });
    }
  };

  const getJarColor = (jarType: string) => {
    const colors: Record<string, string> = {
      SAVINGS: "bg-jar-savings",
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
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 md:h-16 md:w-16">
              <AvatarImage src={child.avatar_url || undefined} alt={child.name} />
              <AvatarFallback className="text-xl md:text-2xl bg-primary/10">
                {child.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold">{child.name}'s Profile</h1>
                <EditChildProfile
                  childId={childId!}
                  childName={child.name}
                  childAge={child.age}
                  avatarUrl={child.avatar_url}
                  onUpdate={fetchChildData}
                />
              </div>
              {child.age && <p className="text-muted-foreground">Age {child.age}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Wallet Overview */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <span className="text-lg md:text-2xl">Total Balance</span>
              </CardTitle>
              <div className="flex gap-2">
                <JarPercentageEditor
                  childId={childId!}
                  childName={child.name}
                  onUpdate={fetchChildData}
                />
                <CashOutDialog
                  childId={childId!}
                  childName={child.name}
                  balances={balances}
                  onCashOutComplete={fetchChildData}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold mb-6">${formatMoney(getTotalBalance())}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {balances.map((balance) => (
                <div key={balance.jar_type} className="text-center">
                  <div className={`w-full h-16 rounded-lg ${getJarColor(balance.jar_type)} mb-2 flex items-center justify-center text-white font-bold`}>
                    ${formatMoney(Number(balance.amount))}
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

        {/* Spending Insights */}
        <SpendingInsights childId={childId!} />

        {/* Wishlist Approval Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Wishlist Approval Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <WishlistApprovalQueue childId={childId} />
          </CardContent>
        </Card>

        {/* Chores Management */}
        <Card>
          <CardHeader>
            <CardTitle>Chores</CardTitle>
          </CardHeader>
          <CardContent>
            {chores.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No chores created yet.
              </p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-3 font-medium">Chore</th>
                        <th className="pb-3 font-medium text-center w-24">Reward</th>
                        <th className="pb-3 font-medium text-center w-28">Status</th>
                        <th className="pb-3 font-medium text-center w-24">Type</th>
                        <th className="pb-3 font-medium text-right w-48">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {chores.map((chore) => (
                        <tr key={chore.id} className="group">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                {chore.status === "APPROVED" && (
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                )}
                                {chore.status === "SUBMITTED" && (
                                  <Clock className="w-5 h-5 text-yellow-600" />
                                )}
                                {chore.status === "PENDING" && (
                                  <div className="w-5 h-5 rounded-full border-2 border-muted" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{chore.title}</p>
                                {chore.description && (
                                  <p className="text-sm text-muted-foreground truncate max-w-xs">{chore.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <Badge className="bg-green-500 hover:bg-green-600">
                              ${formatMoney(Number(chore.token_reward))}
                            </Badge>
                          </td>
                          <td className="py-3 text-center">
                            <Badge variant="outline">{chore.status}</Badge>
                          </td>
                          <td className="py-3 text-center">
                            {chore.is_recurring ? (
                              <Badge variant="secondary" className="gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {chore.recurrence_type === "daily" ? "Daily" : "Weekly"}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">One-time</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {chore.status !== "APPROVED" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => navigate(`/parent/chores/${chore.id}/edit`)}
                                  >
                                    <Pencil className="mr-1 h-3 w-3" />
                                    Edit
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive" className="h-8">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Chore?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete "{chore.title}". This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteChore(chore.id, chore.title)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                              {chore.status === "SUBMITTED" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={() => handleApproveChore(chore.id, chore.token_reward)}
                                  >
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => handleRejectChore(chore.id)}
                                  >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {chores.map((chore) => (
                    <div
                      key={chore.id}
                      className="p-3 border rounded-lg bg-card"
                    >
                      {/* Header row: Status icon + Title + Reward */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-shrink-0">
                          {chore.status === "APPROVED" && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          {chore.status === "SUBMITTED" && (
                            <Clock className="w-4 h-4 text-yellow-600" />
                          )}
                          {chore.status === "PENDING" && (
                            <div className="w-4 h-4 rounded-full border-2 border-muted" />
                          )}
                        </div>
                        <h3 className="flex-1 font-medium text-sm truncate">{chore.title}</h3>
                        <Badge className="bg-green-500 hover:bg-green-600 text-xs flex-shrink-0">
                          ${formatMoney(Number(chore.token_reward))}
                        </Badge>
                      </div>

                      {/* Description if present */}
                      {chore.description && (
                        <p className="text-xs text-muted-foreground mb-2 pl-6 truncate">{chore.description}</p>
                      )}
                      
                      {/* Status & Type row */}
                      <div className="flex items-center gap-2 mb-3 pl-6">
                        <Badge variant="outline" className="text-xs">{chore.status}</Badge>
                        {chore.is_recurring ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {chore.recurrence_type === "daily" ? "Daily" : "Weekly"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">One-time</span>
                        )}
                      </div>
                      
                      {/* Action buttons - full width grid */}
                      {chore.status === "PENDING" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => navigate(`/parent/chores/${chore.id}/edit`)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="w-full h-8 text-xs">
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Chore?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{chore.title}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteChore(chore.id, chore.title)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                      {chore.status === "SUBMITTED" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => navigate(`/parent/chores/${chore.id}/edit`)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="w-full h-8 text-xs">
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Chore?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{chore.title}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteChore(chore.id, chore.title)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => handleApproveChore(chore.id, chore.token_reward)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => handleRejectChore(chore.id)}
                          >
                            <XCircle className="mr-1 h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParentChildDetail;
