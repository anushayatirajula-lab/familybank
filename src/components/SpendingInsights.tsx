import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { TrendingUp, TrendingDown, PiggyBank, DollarSign } from "lucide-react";

interface SpendingInsightsProps {
  childId: string;
}

interface Transaction {
  id: string;
  child_id: string;
  jar_type: string;
  amount: number;
  transaction_type: string;
  created_at: string;
  description: string | null;
}

interface Balance {
  jar_type: string;
  amount: number;
}

const JAR_COLORS: Record<string, string> = {
  SAVINGS: "#10b981",
  BOOKS: "#3b82f6",
  SHOPPING: "#a855f7",
  CHARITY: "#22c55e",
  WISHLIST: "#ec4899",
};

const chartConfig: ChartConfig = {
  earnings: {
    label: "Earnings",
    color: "hsl(var(--chart-1))",
  },
  spending: {
    label: "Spending",
    color: "hsl(var(--chart-2))",
  },
  balance: {
    label: "Balance",
    color: "hsl(var(--chart-3))",
  },
};

export const SpendingInsights = ({ childId }: SpendingInsightsProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [childId]);

  const fetchData = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [transactionsRes, balancesRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("child_id", childId)
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: true }),
        supabase.from("balances").select("*").eq("child_id", childId),
      ]);

      if (transactionsRes.data) {
        setTransactions(transactionsRes.data);
      }
      if (balancesRes.data) {
        setBalances(balancesRes.data);
      }
    } catch (error) {
      console.error("Error fetching insights data:", error);
    } finally {
      setLoading(false);
    }
  };

  const tokensToMoney = (tokens: number) => tokens / 10;

  // Calculate daily balance trend
  const getDailyTrend = () => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), 14),
      end: new Date(),
    });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayTransactions = transactions.filter(
        (t) =>
          new Date(t.created_at) <= day &&
          new Date(t.created_at) >= subDays(new Date(), 30)
      );

      const earnings = dayTransactions
        .filter((t) =>
          ["CHORE_REWARD", "ALLOWANCE", "ALLOWANCE_SPLIT", "MANUAL_ADJUSTMENT"].includes(
            t.transaction_type
          ) && t.amount > 0
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const spending = dayTransactions
        .filter((t) => t.transaction_type === "WISHLIST_SPEND" || t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      return {
        date: format(day, "MMM dd"),
        earnings: tokensToMoney(earnings),
        spending: tokensToMoney(spending),
        balance: tokensToMoney(earnings - spending),
      };
    });
  };

  // Calculate jar distribution
  const getJarDistribution = () => {
    return balances.map((b) => ({
      name: b.jar_type.charAt(0) + b.jar_type.slice(1).toLowerCase(),
      value: tokensToMoney(Number(b.amount)),
      color: JAR_COLORS[b.jar_type] || "#6b7280",
    }));
  };

  // Calculate earnings by source
  const getEarningsBySource = () => {
    const sources: Record<string, number> = {};

    transactions.forEach((t) => {
      if (t.amount > 0) {
        const sourceLabel =
          t.transaction_type === "CHORE_REWARD"
            ? "Chores"
            : t.transaction_type === "ALLOWANCE" ||
              t.transaction_type === "ALLOWANCE_SPLIT"
            ? "Allowance"
            : "Other";
        sources[sourceLabel] = (sources[sourceLabel] || 0) + Number(t.amount);
      }
    });

    return Object.entries(sources).map(([name, value]) => ({
      name,
      value: tokensToMoney(value),
    }));
  };

  // Calculate summary stats
  const getStats = () => {
    const totalEarnings = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSpending = transactions
      .filter((t) => t.transaction_type === "WISHLIST_SPEND" || t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalBalance = balances.reduce((sum, b) => sum + Number(b.amount), 0);

    const savingsRate =
      totalEarnings > 0
        ? ((totalEarnings - totalSpending) / totalEarnings) * 100
        : 0;

    return {
      totalEarnings: tokensToMoney(totalEarnings),
      totalSpending: tokensToMoney(totalSpending),
      totalBalance: tokensToMoney(totalBalance),
      savingsRate: Math.max(0, savingsRate),
    };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const stats = getStats();
  const dailyTrend = getDailyTrend();
  const jarDistribution = getJarDistribution();
  const earningsBySource = getEarningsBySource();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Spending Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Earnings (30d)</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              ${stats.totalEarnings.toFixed(2)}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">Spending (30d)</span>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              ${stats.totalSpending.toFixed(2)}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Balance</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              ${stats.totalBalance.toFixed(2)}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <PiggyBank className="h-4 w-4" />
              <span className="text-sm font-medium">Savings Rate</span>
            </div>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {stats.savingsRate.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Charts */}
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trend">Balance Trend</TabsTrigger>
            <TabsTrigger value="jars">Jar Distribution</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-4">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={12}
                  tickFormatter={(value) => `$${value}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEarnings)"
                  name="Earnings"
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="jars" className="mt-4">
            {jarDistribution.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jarDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                      labelLine={false}
                    >
                      {jarDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No balance data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="earnings" className="mt-4">
            {earningsBySource.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={earningsBySource}>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Amount"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No earnings data available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
