import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogOut, Plus, CheckCircle2, Clock, ArrowLeft, Key, Copy, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import coinIcon from "@/assets/coin-icon.png";
import { useSubscription } from "@/hooks/use-subscription";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { NotificationPrompt } from "@/components/NotificationPrompt";

interface Child {
  id: string;
  name: string;
  age: number | null;
  user_id: string | null;
  initial_password: string | null;
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
  const subscription = useSubscription();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState("");
  const [credentialsDialog, setCredentialsDialog] = useState<{ open: boolean; child: Child | null }>({
    open: false,
    child: null,
  });

  useEffect(() => {
    checkAuth();
    fetchDashboardData();
    subscribeToUpdates();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth/login");
      return;
    }

    // Check if user has PARENT role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    // If user has CHILD role, redirect to child login
    if (roleData?.role === "CHILD") {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Please use the child login to access your dashboard.",
      });
      navigate("/child/login");
      return;
    }

    // If no role found, assume parent (for backward compatibility with existing users)
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
        // Sort children alphabetically by name
        const sortedChildren = childrenData.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );
        setChildren(sortedChildren);
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

  const getChildEmail = (child: Child) => {
    if (!child.user_id) return "Not available";
    
    // Reconstruct the email from the child's name
    const namePart = child.name.toLowerCase().replace(/\s+/g, "");
    // We can't know the exact random code, but we can fetch it from profiles
    return "Loading...";
  };

  const handleViewCredentials = async (e: React.MouseEvent, child: Child) => {
    e.stopPropagation();
    
    if (!child.user_id) {
      toast({
        variant: "destructive",
        title: "Credentials Not Available",
        description: "This child doesn't have login credentials yet.",
      });
      return;
    }

    // Fetch the email from profiles
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", child.user_id)
      .single();

    if (profileData) {
      setCredentialsDialog({
        open: true,
        child: { ...child, email: profileData.email } as any,
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy manually.",
      });
    }
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
          <div className="flex gap-2">
            {subscription.subscribed && (
              <Button variant="ghost" onClick={subscription.openCustomerPortal}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscription
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Subscription Banner */}
        <SubscriptionBanner 
          daysRemaining={subscription.getTrialDaysRemaining()}
          onSubscribe={subscription.createCheckout}
          isExpired={!subscription.isAccessAllowed() && !subscription.loading}
        />

        {/* Block access if trial expired and not subscribed */}
        {!subscription.isAccessAllowed() && !subscription.loading && (
          <Card className="text-center p-12">
            <CardHeader>
              <CardTitle className="text-3xl">Trial Expired</CardTitle>
              <CardDescription className="text-lg">
                Your 7-day free trial has ended. Subscribe to continue managing your family's finances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={subscription.createCheckout} size="lg" className="mt-4">
                <CreditCard className="mr-2 h-5 w-5" />
                Subscribe Now - $4.99/month
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Show dashboard only if access is allowed */}
        {subscription.isAccessAllowed() && (
          <>
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
                onClick={() => navigate(`/parent/child/${child.id}`)}
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

                  {/* View Credentials Button */}
                  {child.user_id && child.initial_password && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => handleViewCredentials(e, child)}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      View Credentials
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {/* Credentials Dialog */}
      <Dialog open={credentialsDialog.open} onOpenChange={(open) => setCredentialsDialog({ open, child: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Credentials for {credentialsDialog.child?.name}</DialogTitle>
            <DialogDescription>
              Use these credentials to log in. Reset the password upon first login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={(credentialsDialog.child as any)?.email || ""}
                  className="flex-1 px-3 py-2 border rounded-md bg-muted"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard((credentialsDialog.child as any)?.email || "", "Email")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              {credentialsDialog.child?.initial_password ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={credentialsDialog.child.initial_password}
                    className="flex-1 px-3 py-2 border rounded-md bg-muted font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(credentialsDialog.child?.initial_password || "", "Password")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  Password not available. This child was created before credential storage was enabled.
                </p>
              )}
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                ⚠️ <strong>Important:</strong> Save these credentials and reset the password upon first login.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <NotificationPrompt />
    </div>
  );
};

export default ParentDashboard;
