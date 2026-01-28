import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, Trash2, ShoppingCart, ImageIcon, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CartItem {
  product_id: string;
  barcode: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  image_url: string | null;
}

export default function POS() {
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { hasRole, loading: roleLoading } = useUserRole();

  const handleScan = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
    addToCartWithBarcode(scannedBarcode);
  };

  const addToCartWithBarcode = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;

    setLoading(true);
    try {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcodeValue.trim())
        .single();

      if (error || !product) {
        toast.error('ไม่พบสินค้าที่มีบาร์โค้ดนี้');
        return;
      }

      if (product.stock_quantity <= 0) {
        toast.error('สินค้าหมด');
        return;
      }

      const existingItem = cart.find(item => item.product_id === product.id);
      
      if (existingItem) {
        if (existingItem.quantity >= product.stock_quantity) {
          toast.error('สินค้าไม่เพียงพอ');
          return;
        }
        
        setCart(cart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        ));
      } else {
        setCart([...cart, {
          product_id: product.id,
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
          image_url: product.image_url,
        }]);
      }

      const displayName = product.brand ? `${product.name} (${product.brand})` : product.name;
      toast.success(`เพิ่ม ${displayName} ลงในตะกร้า`);
      setBarcode("");
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = (product_id: string) => {
    setCart(cart.filter(item => item.product_id !== product_id));
  };

  const updateQuantity = (product_id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(product_id);
      return;
    }

    setCart(cart.map(item =>
      item.product_id === product_id
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('ตะกร้าสินค้าว่างเปล่า');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: calculateTotal(),
          payment_method: 'cash',
          created_by: user?.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items and update stock
      for (const item of cart) {
        const { error: itemError } = await supabase
          .from('sales_items')
          .insert({
            sale_id: sale.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.price,
            subtotal: item.subtotal,
          });

        if (itemError) throw itemError;

        // Update product stock
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq('id', item.product_id);
        }

      // Record stock movement
        await supabase
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            movement_type: 'out',
            quantity: item.quantity,
            notes: `ขาย - Bill #${sale.id.slice(0, 8)}`,
            created_by: user?.id,
          });
      }

      // บันทึกรายรับอัตโนมัติเมื่อขายสำเร็จ
      await supabase
        .from('transactions')
        .insert({
          type: 'income',
          category: 'ขายสินค้า',
          amount: calculateTotal(),
          date: new Date().toISOString().split('T')[0],
          description: `ขายสินค้า Bill #${sale.id.slice(0, 8)}`,
        });

      toast.success('บันทึกการขายและรายรับสำเร็จ');
      setCart([]);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึกการขาย');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    addToCartWithBarcode(barcode);
  };

  return (
    <Layout>
      <BarcodeScanner 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
      />
      
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">จุดขายสินค้า (POS)</h1>
          <p className="text-sm sm:text-base text-muted-foreground">สแกนบาร์โค้ดเพื่อเพิ่มสินค้าในตะกร้า</p>
        </div>

        {!roleLoading && !hasRole && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>ไม่มีสิทธิ์ใช้งาน</AlertTitle>
            <AlertDescription>
              คุณยังไม่ได้รับมอบหมายยศในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ในการขายสินค้า
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Product Scanner */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>สแกนสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="กรอกบาร์โค้ดหรือสแกนด้วยกล้อง"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && barcode && hasRole) {
                      addToCart();
                    }
                  }}
                  disabled={loading || !hasRole}
                />
                <Button
                  variant="outline"
                  onClick={() => setShowScanner(true)}
                  title="สแกนด้วยกล้อง"
                  disabled={!hasRole}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Button onClick={addToCart} disabled={loading || !barcode || !hasRole}>
                  เพิ่ม
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">รูป</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-right">ราคา</TableHead>
                      <TableHead className="text-center">จำนวน</TableHead>
                      <TableHead className="text-right">รวม</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        ตะกร้าสินค้าว่างเปล่า
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                            {item.image_url ? (
                              <img 
                                src={item.image_url} 
                                alt={item.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.brand && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary mt-0.5">
                                {item.brand}
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">{item.barcode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">฿{item.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ฿{item.subtotal.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>สรุปยอดขาย</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">จำนวนรายการ:</span>
                  <span className="font-medium">{cart.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">จำนวนสินค้า:</span>
                  <span className="font-medium">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>ยอดรวม:</span>
                    <span className="text-primary">฿{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0 || !hasRole}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                ชำระเงิน
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setCart([])}
                disabled={cart.length === 0}
              >
                ล้างตะกร้า
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}