import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  Package,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

const statusStyles: Record<string, string> = {
  PENDING: "bg-secondary text-secondary-foreground border-border",
  SHIPPED: "bg-blue-100 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
};

const COLORS = [
  "#e11d48",
  "#f43f5e",
  "#fb7185",
  "#fda4af",
  "#ffe4e6",
  "#be123c",
];

interface RecentOrder {
  id: number;
  totalPrice: number;
  orderStatus: string;
  orderDate: string;
  customer: {
    name: string;
    phone: string;
  };
}

export default function Overview() {
  const isMobile = useIsMobile();
  const [orderCount, setOrderCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [salesTrend, setSalesTrend] = useState<
    { date: string; sales: number }[]
  >([]);
  const [categoryData, setCategoryData] = useState<
    { category: string; orderCount: number }[]
  >([]);
  const [paymentData, setPaymentData] = useState<
    { method: string; totalAmount: number; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const [
          orderStatRes,
          customerStatRes,
          recentRes,
          salesTrendRes,
          categoryRes,
          paymentRes,
        ] = await Promise.all([
          api.get("/order/statistic"),
          api.get("/customer/statistic"),
          api.get("/order/recent-order"),
          api.get("/dashboard/sales-overview?timeframe=monthly"),
          api.get("/dashboard/orders-by-category"),
          api.get("/dashboard/payment-breakdown"),
        ]);

        const orderStat = orderStatRes.data?.data;
        setOrderCount(orderStat?._count ?? 0);
        setRevenue(orderStat?._sum?.totalPrice ?? 0);

        const customerStat = customerStatRes.data?.data;
        setCustomerCount(customerStat?._count ?? 0);

        setRecentOrders(recentRes.data?.data ?? []);

        // Format trend data dates for better display
        const rawTrend = (salesTrendRes.data?.data?.chartData ?? []) as Array<
          Record<string, unknown>
        >;
        const formattedTrend = rawTrend.map((t) => ({
          date: String(t.date || ""),
          sales: Number(t.sales || t.orderCount || 0),
        }));
        setSalesTrend(formattedTrend);

        setCategoryData(categoryRes.data?.data?.chartData ?? []);
        setPaymentData(paymentRes.data?.data?.chartData ?? []);
      } catch (err) {
        console.error("Failed to load overview stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatBDT = (amount: number) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      maximumFractionDigits: 0,
    }).format(amount);

  const orderNumber = (o: RecentOrder) => `FL-${String(o.id).padStart(4, "0")}`;

  const kpis = [
    {
      label: "Total Revenue",
      value: loading ? "—" : formatBDT(revenue),
      icon: DollarSign,
    },
    {
      label: "Total Orders",
      value: loading ? "—" : orderCount.toString(),
      icon: ShoppingBag,
    },
    {
      label: "Active Customers",
      value: loading ? "—" : customerCount.toString(),
      icon: Users,
    },
    {
      label: "Recent Orders",
      value: loading ? "—" : recentOrders.length.toString(),
      icon: Package,
    },
  ];

  // Custom tooltip for Sales Trend
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: unknown[];
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const point = payload[0] as Record<string, unknown> | undefined;
      const value = point ? Number(point.value as unknown) : 0;
      return (
        <div className="bg-background/95 border border-border p-3 rounded-lg shadow-elegant backdrop-blur-sm">
          <p className="text-sm font-medium mb-1">{label}</p>
          <p className="text-sm font-semibold text-primary">
            {formatBDT(value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="overflow-hidden bg-card p-4 shadow-soft transition-smooth hover:shadow-elegant sm:p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
                  {loading ? <Skeleton className="h-9 w-24" /> : k.value}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <k.icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Trend Chart */}
        <Card className="shadow-soft lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-col items-start justify-between gap-2 pb-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="font-display text-lg font-semibold sm:text-xl">
                Sales Trend
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Daily revenue over the last 30 days
              </p>
            </div>
            {!loading && salesTrend.length > 0 && (
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 text-primary"
              >
                <TrendingUp className="mr-1 h-3 w-3" /> Monthly
              </Badge>
            )}
          </CardHeader>
          <CardContent className="flex-1 min-h-[240px] sm:min-h-[300px]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-xl" />
              </div>
            ) : salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesTrend}
                  margin={
                    isMobile
                      ? { top: 10, right: 6, left: -16, bottom: 0 }
                      : { top: 10, right: 10, left: 0, bottom: 0 }
                  }
                >
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="displayDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: isMobile ? 10 : 12, fill: "#6b7280" }}
                    minTickGap={isMobile ? 28 : 20}
                  />
                  <YAxis
                    hide={isMobile}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(value) =>
                      `৳${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#e11d48"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#e11d48" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
                <p>No sales data available for this period.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders by Category Pie Chart */}
        <Card className="shadow-soft flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg font-semibold sm:text-xl">
              Categories
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Order distribution by category
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col min-h-[240px] sm:min-h-[300px]">
            {loading ? (
              <Skeleton className="w-full h-[250px] rounded-full mt-4" />
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 46 : 60}
                    outerRadius={isMobile ? 72 : 90}
                    paddingAngle={2}
                    dataKey="orderCount"
                    nameKey="category"
                  >
                    {categoryData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} Orders`, ""]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #eee",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={isMobile ? 48 : 36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: isMobile ? 10 : 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <PieChart className="h-10 w-10 mb-3 opacity-20" />
                <p>No category data available.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders List */}
        <Card className="shadow-soft lg:col-span-2 flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-lg font-semibold sm:text-xl">
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-3">
              {loading &&
                recentOrders.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-border p-4 bg-card/50"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              {recentOrders.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  className="group flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card/40 p-4 transition-smooth hover:bg-secondary/60 hover:shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0 group-hover:scale-105 transition-transform">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">
                        {orderNumber(o)}
                      </div>
                      <div className="truncate text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Users className="h-3 w-3" />
                        {o.customer?.name || "Guest User"}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-start gap-1.5 sm:w-auto sm:items-end">
                    <span className="text-sm font-bold text-foreground">
                      {formatBDT(o.totalPrice)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${statusStyles[o.orderStatus] || ""}`}
                    >
                      {o.orderStatus}
                    </Badge>
                  </div>
                </div>
              ))}
              {!loading && recentOrders.length === 0 && (
                <div className="py-8 text-center border border-dashed rounded-xl border-border">
                  <p className="text-sm text-muted-foreground">
                    No recent orders found.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card className="shadow-soft flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg font-semibold sm:text-xl">
              Payment Methods
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue by payment type
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col min-h-[240px] pt-4 sm:min-h-[300px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
                <BarChart
                  data={paymentData}
                  layout="vertical"
                  margin={{
                    top: 0,
                    right: isMobile ? 6 : 20,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e5e7eb"
                    opacity={0.5}
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    tickFormatter={(value) =>
                      `৳${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <YAxis
                    dataKey="method"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: isMobile ? 10 : 12, fontWeight: 500 }}
                    width={isMobile ? 56 : 80}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "totalAmount" ? formatBDT(value) : value,
                      name === "totalAmount" ? "Revenue" : name,
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #eee",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    cursor={{ fill: "rgba(0,0,0,0.02)" }}
                  />
                  <Bar
                    dataKey="totalAmount"
                    fill="#e11d48"
                    radius={[0, 4, 4, 0]}
                    barSize={30}
                  >
                    {paymentData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <DollarSign className="h-10 w-10 mb-3 opacity-20" />
                <p>No payment data available.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
