import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Scan } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function StockIn() {
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [scanMode, setScanMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [productInfo, setProductInfo] = useState<any>(null);

  useEffect(() => {
    if (barcode && scanMode) {
      findProduct();
    }
  }, [barcode]);

  const findProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode.trim())
        .single();

      if (error || !data) {
        setProductInfo(null);
        return;
      }

      setProductInfo(data);
    } catch (error) {
      setProductInfo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productInfo) {
      toast.error('กรุณาสแกนหรือกรอกบาร์โค้ดสินค้าที่ถูกต้อง');
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      toast.error('กรุณากรอกจำนวนที่ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const qty = parseInt(quantity);

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: productInfo.stock_quantity + qty })
        .eq('id', productInfo.id);

      if (updateError) throw updateError;

      // Record stock movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: productInfo.id,
          movement_type: 'in',
          quantity: qty,
          notes: notes || 'รับสินค้าเข้า',
          created_by: user?.id,
        });

      if (movementError) throw movementError;

      toast.success(`เพิ่มสต็อก ${productInfo.name} จำนวน ${qty} สำเร็จ`);
      
      // Reset form
      setBarcode("");
      setQuantity("");
      setNotes("");
      setProductInfo(null);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">รับสินค้าเข้า</h1>
          <p className="text-muted-foreground">สแกนบาร์โค้ดเพื่อเพิ่มสต็อกสินค้า</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>สแกนสินค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">บาร์โค้ด *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder={scanMode ? "สแกนบาร์โค้ด..." : "กรอกบาร์โค้ด"}
                      autoFocus
                      required
                    />
                    <Button
                      type="button"
                      variant={scanMode ? "secondary" : "outline"}
                      onClick={() => setScanMode(!scanMode)}
                    >
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {productInfo && (
                  <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">สินค้า:</span>
                      <span className="font-medium">{productInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">สต็อกปัจจุบัน:</span>
                      <span className="font-medium">{productInfo.stock_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">ราคา:</span>
                      <span className="font-medium">฿{productInfo.price.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="quantity">จำนวนที่รับเข้า *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="กรอกจำนวนที่รับเข้า"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ระบุหมายเหตุ (ถ้ามี)"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading || !productInfo}>
                  {loading ? 'กำลังบันทึก...' : 'บันทึกรับสินค้าเข้า'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>คำแนะนำ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">ขั้นตอนการรับสินค้าเข้า:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>สแกนบาร์โค้ดสินค้า หรือกรอกบาร์โค้ดด้วยมือ</li>
                  <li>ตรวจสอบข้อมูลสินค้าที่แสดง</li>
                  <li>กรอกจำนวนที่ต้องการรับเข้า</li>
                  <li>ระบุหมายเหตุ (ถ้ามี)</li>
                  <li>กดปุ่มบันทึก</li>
                </ol>
              </div>

              <div className="p-4 bg-warning/10 border border-warning rounded-lg">
                <p className="text-sm font-medium">💡 เคล็ดลับ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  เมื่อเปิดโหมดสแกน (ปุ่มไอคอนสแกน) ระบบจะรอรับข้อมูลจากเครื่องสแกนบาร์โค้ดโดยอัตโนมัติ
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
