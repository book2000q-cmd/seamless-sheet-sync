import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface Sale {
  id: string;
  total_amount: number;
  payment_method: string | null;
  created_at: string;
  items: SaleItem[];
}

interface SaleItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    barcode: string;
  };
}

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesHistory();
  }, []);

  const fetchSalesHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          items:sales_items(
            *,
            products(name, barcode)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">ประวัติการขาย</h1>
          <p className="text-sm sm:text-base text-muted-foreground">รายการขายทั้งหมด 50 รายการล่าสุด</p>
        </div>

        {sales.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              ยังไม่มีประวัติการขาย
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sales.map((sale) => (
              <Card key={sale.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Bill #{sale.id.slice(0, 8)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.created_at), 'PPpp', { locale: th })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ฿{sale.total_amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sale.payment_method || 'เงินสด'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">ราคา</TableHead>
                        <TableHead className="text-center">จำนวน</TableHead>
                        <TableHead className="text-right">รวม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.products.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.products.barcode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            ฿{item.unit_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ฿{item.subtotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
