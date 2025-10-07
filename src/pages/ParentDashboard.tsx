import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Plus, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import coinIcon from "@/assets/coin-icon.png";

interface Child {
  id: string;
  name: string;
  age: number | null;
  balances?: Array<{
    jar_type: string;
    amount: number;
  }>;
  chores?: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");

  useEffect(() => {
    checkAuth();
    fetchDashboardData();
    subscribeToUpdates();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth/login");
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setParentName(profile.full_name || "Parent");
      }

      // Get children with balances and chores
      const { data: childrenData } = await supabase
        .from("children")
        .select(`
          *,
          balances(*),
          chores(id, title, status)
        `)
        .eq("parent_id", user.id);

      if (childrenData) {
        setChildren(childrenData);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
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
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "balances",
        },
        () => fetchDashboardData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chores",
        },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getTotalBalance = (child: Child) => {
    if (!child.balances) return 0;
    return child.balances.reduce((sum, b) => sum + Number(b.amount), 0);
  };

  const getPendingChores = (child: Child) => {
    if (!child.chores) return 0;
    return child.chores.filter((c) => c.status === "SUBMITTED").length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">FamilyBank</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {parentName}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="flex gap-4 mb-8">
          <Button onClick={() => navigate("/parent/children/new")} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Add Child
          </Button>
          <Button onClick={() => navigate("/parent/chores/new")} variant="outline" size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Create Chore
          </Button>
        </div>

        {/* Children Overview */}
        {children.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg mb-4">No children added yet!</p>
              <p className="text-muted-foreground mb-6">
                Get started by adding your first child to begin their financial learning journey.
              </p>
              <Button onClick={() => navigate("/parent/children/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children.map((child) => (
              <Card
                key={child.id}
                className="hover:shadow-elevated transition-all cursor-pointer"
                onClick={() => navigate(`/parent/children/${child.id}`)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {child.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{child.name}</CardTitle>
                      {child.age && (
                        <CardDescription>Age {child.age}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Total Balance */}
                  <div className="flex items-center justify-between p-3 bg-gradient-coin rounded-lg">
                    <div className="flex items-center gap-2">
                      <img src={coinIcon} alt="Coin" className="w-8 h-8 animate-coin-flip" />
                      <span className="font-semibold">Total Balance</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {getTotalBalance(child).toFixed(2)}
                    </span>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{getPendingChores(child)} pending approvals</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{child.chores?.filter((c) => c.status === "APPROVED").length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
