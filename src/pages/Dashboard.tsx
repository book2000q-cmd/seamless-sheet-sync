import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface DashboardStats {
  totalProducts: number;
  lowStockProducts: number;
  todaySales: number;
  todayRevenue: number;
}

interface BestSeller {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    todaySales: 0,
    todayRevenue: 0,
  });
  const [salesData, setChartData] = useState<any[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Get low stock products (filter in JS since we can't compare columns in Postgrest)
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, stock_quantity, min_stock_level');
      
      const lowStock = allProducts?.filter(p => p.stock_quantity <= p.min_stock_level) || [];

      // Get today's sales
      const today = new Date().toISOString().split('T')[0];
      const { data: todaySalesData, error: salesError } = await supabase
        .from('sales')
        .select('total_amount')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);

      if (salesError) throw salesError;

      const todayRevenue = todaySalesData?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
      const todaySales = todaySalesData?.length || 0;

      // Get last 7 days sales for chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: weekSales } = await supabase
        .from('sales')
        .select('created_at, total_amount')
        .gte('created_at', sevenDaysAgo.toISOString());

      const chartData = processChartData(weekSales || []);

      // Get best sellers (top 5 products by quantity sold in last 7 days)
      const { data: bestSellersData } = await supabase
        .from('sales_items')
        .select('quantity, product_id, products(name)')
        .gte('created_at', sevenDaysAgo.toISOString());

      const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
      
      if (bestSellersData) {
        for (const item of bestSellersData) {
          const productName = (item.products as any)?.name || 'Unknown';
          if (!productSales[productName]) {
            productSales[productName] = { name: productName, quantity: 0, revenue: 0 };
          }
          productSales[productName].quantity += item.quantity;
        }
      }

      const topSellers = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(p => ({
          product_name: p.name,
          total_quantity: p.quantity,
          total_revenue: 0,
        }));

      setStats({
        totalProducts: totalProducts || 0,
        lowStockProducts: lowStock?.length || 0,
        todaySales,
        todayRevenue,
      });

      setChartData(chartData);
      setBestSellers(topSellers);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (sales: any[]) => {
    const dailyData: { [key: string]: number } = {};
    
    sales.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString('th-TH', { 
        month: 'short', 
        day: 'numeric' 
      });
      dailyData[date] = (dailyData[date] || 0) + Number(sale.total_amount);
    });

    return Object.entries(dailyData).map(([date, amount]) => ({
      date,
      amount,
    }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">กำลังโหลดข้อมูล...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">ระบบบริหารจัดการร้านขายของชำ</h1>
          <p className="text-sm sm:text-base text-muted-foreground">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">จำนวนสินค้าทั้งหมด</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
              <p className="text-xs text-muted-foreground">รายการสินค้าในคลัง</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">สินค้าใกล้หมด</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.lowStockProducts}</div>
              <p className="text-xs text-muted-foreground">ต้องเติมสต็อก</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ยอดขายวันนี้</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todaySales}</div>
              <p className="text-xs text-muted-foreground">รายการ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">รายได้วันนี้</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">฿{stats.todayRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">บาท</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>ยอดขาย 7 วันที่ผ่านมา</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <ChartContainer
                  config={{
                    amount: {
                      label: "ยอดขาย",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[250px] sm:h-[300px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>สินค้าขายดี (7 วันที่ผ่านมา)</CardTitle>
            </CardHeader>
            <CardContent>
              {bestSellers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูล</p>
              ) : (
                <div className="space-y-4">
                  {bestSellers.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            ขายไป {item.total_quantity} ชิ้น
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
