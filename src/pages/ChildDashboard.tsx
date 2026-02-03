import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, LogOut, ArrowLeft, DollarSign } from "lucide-react";
import AICoach from "@/components/AICoach";

interface Chore {
  id: string;
  title: string;
  description: string | null;
  token_reward: number;
  status: string;
  due_at: string | null;
}

interface Balance {
  jar_type: string;
  amount: number;
}

const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [child, setChild] = useState<any>(null);
  const [chores, setChores] = useState<Chore[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (childId) {
      checkAuth();
      subscribeToUpdates();
    }
  }, [childId]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Not logged in",
          description: "Please log in to view your dashboard.",
        });
        navigate("/child/login");
        return;
      }

      // Check if user has CHILD role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      // If user is a parent, redirect to parent dashboard
      if (roleData?.role !== "CHILD") {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Please use the parent dashboard to manage your children.",
        });
        navigate("/parent/dashboard");
        return;
      }

      // Verify the authenticated user matches this child
      const { data: childData, error } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .eq("user_id", user.id)
        .single();

      if (error || !childData) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You don't have permission to view this profile.",
        });
        navigate("/child/login");
        return;
      }

      setChild(childData);
      await fetchChildData();
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/child/login");
    }
  };

  const fetchChildData = async () => {
    try {
      // Get chores
      const { data: choresData } = await supabase
        .from("chores")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });

      if (choresData) {
        setChores(choresData);
      }

      // Get balances
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
        description: "Failed to load dashboard data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel("child-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "balances",
          filter: `child_id=eq.${childId}`,
        },
        () => fetchChildData()
      )
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

  const handleSubmitChore = async (choreId: string) => {
    try {
      const { error } = await supabase
        .from("chores")
        .update({ status: "SUBMITTED", submitted_at: new Date().toISOString() })
        .eq("id", choreId);

      if (error) throw error;

      toast({
        title: "Chore submitted!",
        description: "Waiting for parent approval to earn your reward.",
      });
    } catch (error) {
      console.error("Error submitting chore:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit chore.",
      });
    }
  };

  const getTotalBalance = () => {
    return balances.reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const formatMoney = (amount: number) => {
    return (amount / 10).toFixed(2);
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
      {/* Header */}
      <header className="border-b bg-gradient-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Hi, {child.name}! 👋</h1>
              <p className="text-muted-foreground">Let's check your progress today</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={async () => {
                await supabase.auth.signOut();
                navigate("/child/login");
              }}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="chores">Chores</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            <TabsTrigger value="coach">AI Coach</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Wallet Card */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  Your Wallet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-bold mb-2">${formatMoney(getTotalBalance())}</p>
                <p className="text-sm text-muted-foreground mb-6">Total savings</p>
                
                {/* Jars */}
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
          </TabsContent>

          <TabsContent value="chores">
            <Card>
              <CardHeader className="pb-2 md:pb-6">
                <CardTitle className="text-lg md:text-2xl">Your Chores</CardTitle>
                <CardDescription className="text-xs md:text-sm">Complete chores to earn more money!</CardDescription>
              </CardHeader>
              <CardContent className="px-3 md:px-6">
                <div className="space-y-2 md:space-y-4">
                  {chores.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No chores yet. Ask your parent to create some!
                    </p>
                  ) : (
                    chores.map((chore) => (
                      <div
                        key={chore.id}
                        className="flex items-center justify-between p-2 md:p-4 border rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                          {chore.status === "APPROVED" && (
                            <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0" />
                          )}
                          {chore.status === "SUBMITTED" && (
                            <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600 flex-shrink-0" />
                          )}
                          {chore.status === "PENDING" && (
                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-muted flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm md:text-base truncate">{chore.title}</h3>
                            {chore.description && (
                              <p className="text-xs md:text-sm text-muted-foreground truncate">{chore.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0 ml-2">
                          <Badge className="bg-green-500 hover:bg-green-600 text-xs md:text-sm px-1.5 md:px-2.5">
                            <DollarSign className="w-3 h-3 mr-0.5 md:mr-1" />
                            {formatMoney(Number(chore.token_reward))}
                          </Badge>
                          {chore.status === "PENDING" && (
                            <Button
                              size="sm"
                              className="text-xs md:text-sm h-7 md:h-9 px-2 md:px-3"
                              onClick={() => handleSubmitChore(chore.id)}
                            >
                              Done
                            </Button>
                          )}
                          {chore.status === "SUBMITTED" && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap">Pending</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist">
            <Card>
              <CardHeader>
                <CardTitle>My Wishlist</CardTitle>
                <CardDescription>Items you're saving up for</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/child-wishlist")}>
                  View My Wishlist
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coach" className="h-[calc(100vh-180px)] md:h-[calc(100vh-200px)]">
            <div className="max-w-3xl mx-auto h-full">
              <AICoach childAge={child?.age || undefined} childId={childId!} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ChildDashboard;
