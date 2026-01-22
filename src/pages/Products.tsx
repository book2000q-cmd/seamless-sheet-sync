import { useEffect, useState, useRef } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Camera, Search, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";

interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  stock_quantity: number;
  min_stock_level: number;
  category: string | null;
  image_url: string | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    barcode: "",
    name: "",
    brand: "",
    description: "",
    price: "",
    stock_quantity: "",
    min_stock_level: "10",
    category: "",
    image_url: "",
  });

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleScan = (scannedBarcode: string) => {
    setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
    // Re-open dialog after scan
    setDialogOpen(true);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error('ไม่สามารถโหลดข้อมูลสินค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error: any) {
      toast.error('ไม่สามารถอัปโหลดรูปภาพได้');
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            barcode: formData.barcode,
            name: formData.name,
            brand: formData.brand || null,
            description: formData.description,
            price: parseFloat(formData.price),
            stock_quantity: parseInt(formData.stock_quantity),
            min_stock_level: parseInt(formData.min_stock_level),
            category: formData.category,
            image_url: formData.image_url || null,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('แก้ไขสินค้าสำเร็จ');
      } else {
        const { error: productError } = await supabase
          .from('products')
          .insert({
            barcode: formData.barcode,
            name: formData.name,
            brand: formData.brand || null,
            description: formData.description,
            price: parseFloat(formData.price),
            stock_quantity: parseInt(formData.stock_quantity),
            min_stock_level: parseInt(formData.min_stock_level),
            category: formData.category,
            image_url: formData.image_url || null,
          });

        if (productError) throw productError;

        // บันทึกรายจ่ายอัตโนมัติเมื่อเพิ่มสินค้าใหม่
        const totalCost = parseFloat(formData.price) * parseInt(formData.stock_quantity);
        await supabase
          .from('transactions')
          .insert({
            type: 'expense',
            category: 'สินค้า',
            amount: totalCost,
            date: new Date().toISOString().split('T')[0],
            description: `นำเข้าสินค้า: ${formData.name}${formData.brand ? ` (${formData.brand})` : ''} (${formData.stock_quantity} ชิ้น)`,
          });

        toast.success('เพิ่มสินค้าและบันทึกรายจ่ายสำเร็จ');
      }

      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      // ตรวจสอบ error ที่เกิดจากบาร์โค้ดซ้ำ
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('products_barcode_key')) {
        toast.error('บาร์โค้ดนี้มีอยู่ในระบบแล้ว กรุณาใช้บาร์โค้ดอื่น');
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่? (รวมถึงประวัติการขายและการเคลื่อนไหวสต็อกที่เกี่ยวข้อง)')) return;

    try {
      // ลบข้อมูลที่เกี่ยวข้องใน sales_items ก่อน
      await supabase
        .from('sales_items')
        .delete()
        .eq('product_id', id);

      // ลบข้อมูลที่เกี่ยวข้องใน stock_movements
      await supabase
        .from('stock_movements')
        .delete()
        .eq('product_id', id);

      // จากนั้นลบสินค้า
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('ลบสินค้าสำเร็จ');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาดในการลบสินค้า');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      barcode: product.barcode,
      name: product.name,
      brand: product.brand || "",
      description: product.description || "",
      price: product.price.toString(),
      stock_quantity: product.stock_quantity.toString(),
      min_stock_level: product.min_stock_level.toString(),
      category: product.category || "",
      image_url: product.image_url || "",
    });
    setImagePreview(product.image_url || null);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      barcode: "",
      name: "",
      brand: "",
      description: "",
      price: "",
      stock_quantity: "",
      min_stock_level: "10",
      category: "",
      image_url: "",
    });
    setImagePreview(null);
  };

  // กรองสินค้าตามคำค้นหา
  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase();
    return (
      product.barcode.toLowerCase().includes(query) ||
      product.name.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  return (
    <Layout>
      <BarcodeScanner 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
      />
      
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">จัดการสินค้า</h1>
            <p className="text-sm sm:text-base text-muted-foreground">เพิ่ม แก้ไข และลบสินค้าในระบบ</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มสินค้า
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</DialogTitle>
                <DialogDescription>
                  กรอกข้อมูลสินค้า หรือสแกนบาร์โค้ด
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload Section */}
                <div className="space-y-2">
                  <Label>รูปภาพสินค้า</Label>
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center overflow-hidden bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview || formData.image_url ? (
                        <img 
                          src={imagePreview || formData.image_url} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingImage ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                      </Button>
                      <p className="text-xs text-muted-foreground">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">บาร์โค้ด *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="กรอกหรือสแกนบาร์โค้ด"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Close dialog first to prevent keyboard from staying open
                        setDialogOpen(false);
                        // Blur all inputs
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        // Small delay then open scanner
                        setTimeout(() => {
                          setShowScanner(true);
                        }, 100);
                      }}
                      title="สแกนด้วยกล้อง"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">ชื่อสินค้า *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">ยี่ห้อสินค้า</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="เช่น Samsung, Apple, LG"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">หมวดหมู่</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">รายละเอียด</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">ราคา (บาท) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">จำนวนคงเหลือ *</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">สต็อกขั้นต่ำ</Label>
                    <Input
                      id="minStock"
                      type="number"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={uploadingImage}>
                    {editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    ยกเลิก
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>รายการสินค้า</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาสินค้า..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">กำลังโหลด...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">รูปภาพ</TableHead>
                    <TableHead>บาร์โค้ด</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>ยี่ห้อ</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead className="text-right">ราคา</TableHead>
                    <TableHead className="text-right">คงเหลือ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">
                        {searchQuery ? 'ไม่พบสินค้าที่ตรงกับคำค้นหา' : 'ไม่มีข้อมูลสินค้า'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{product.barcode}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.brand ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                              {product.brand}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{product.category || '-'}</TableCell>
                        <TableCell className="text-right">฿{product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={product.stock_quantity <= product.min_stock_level ? 'text-warning font-bold' : ''}>
                            {product.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}